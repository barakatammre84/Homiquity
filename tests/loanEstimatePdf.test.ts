import { describe, it, expect } from "vitest";
import { generateLoanEstimatePDF, type LoanEstimatePdfData } from "../server/services/pdfLetterGenerator";

const data = (over: Partial<LoanEstimatePdfData> = {}): LoanEstimatePdfData => ({
  applicationId: "app-12345678",
  dateIssued: new Date("2026-03-02T00:00:00Z"),
  expirationDate: new Date("2026-03-12T00:00:00Z"),
  loanTerms: {
    loanAmount: 320000,
    interestRate: 6.5,
    monthlyPrincipalAndInterest: 2022.62,
    prepaymentPenalty: false,
    balloonPayment: false,
  },
  projectedPayments: {
    years1Through5: { principalAndInterest: 2022.62, mortgageInsurance: 0, estimatedEscrow: 566, estimatedTotal: 2588.62 },
    years6Through30: { principalAndInterest: 2022.62, mortgageInsurance: 0, estimatedEscrow: 600, estimatedTotal: 2622.62 },
  },
  costsAtClosing: { estimatedClosingCosts: 9500, estimatedCashToClose: 89500 },
  closingCostDetails: {
    loanCosts: {
      originationCharges: { originationFee: 3200, points: 0, applicationFee: 500, underwritingFee: 995, total: 4695 },
      servicesYouCannotShopFor: { appraisal: 650, creditReport: 75, floodDetermination: 25, taxService: 85, total: 835 },
      servicesYouCanShopFor: { titleInsurance: 1400, titleSearch: 400, surveyFee: 450, pestInspection: 120, total: 2370 },
      totalLoanCosts: 7900,
    },
    otherCosts: {
      taxesAndGovernmentFees: { recordingFees: 145, transferTaxes: 400, total: 545 },
      prepaids: { homeownersInsurance: 1200, mortgageInsurance: 0, prepaidInterest: 340, propertyTaxes: 800, total: 2340 },
      initialEscrowPaymentAtClosing: { homeownersInsurance: 300, mortgageInsurance: 0, propertyTaxes: 800, total: 1100 },
      totalOtherCosts: 3985,
    },
    totalClosingCosts: 11885,
  },
  comparisons: {
    inFiveYears: { totalYouWillHavePaid: 133000, principalPaidOff: 21000 },
    apr: 6.712,
    totalInterestPercentage: 127.4,
  },
  lenderCredits: 0,
  borrowerName: "Jordan Rivera",
  companyLegalName: "Homiquity Lending LLC",
  companyNmlsId: "1234567",
  ...over,
});

/**
 * Recover the rendered text from a PDFKit document.
 *
 * Content streams are deflate-compressed, and inside them PDFKit emits text as
 * `[<hex> 140 <hex> ...] TJ` — hex-encoded glyph runs with kerning numbers
 * between them. Inflating the streams and concatenating the hex runs in order
 * reproduces the visible string; the kerning numbers are spacing, not
 * characters, so dropping them is correct. Standard fonts are WinAnsi-encoded,
 * so the bytes are ASCII for everything asserted below.
 */
async function pdfText(buffer: Buffer): Promise<string> {
  const zlib = await import("zlib");
  const raw = buffer.toString("latin1");
  let out = "";
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    let content: string;
    try {
      content = zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue; // Fonts and other binary streams — no text to recover.
    }
    for (const run of content.match(/<([0-9a-fA-F]+)>/g) || []) {
      out += Buffer.from(run.slice(1, -1), "hex").toString("latin1");
    }
  }
  return out;
}

describe("generateLoanEstimatePDF", () => {
  it("produces a valid PDF", async () => {
    const buf = await generateLoanEstimatePDF(data());
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.subarray(-6).toString()).toContain("%%EOF");
  });

  it("renders every section of the disclosure", async () => {
    const text = await pdfText(await generateLoanEstimatePDF(data()));
    for (const section of [
      "Loan Terms",
      "Projected Payments",
      "Costs at Closing",
      "A. Loan Costs",
      "B. Other Costs",
      "Total Closing Costs",
      "Comparisons",
    ]) {
      expect(text, section).toContain(section);
    }
  });

  it("renders the borrower's name and the figures it was given", async () => {
    const text = await pdfText(await generateLoanEstimatePDF(data()));
    expect(text).toContain("Jordan Rivera");
    expect(text).toContain("$320,000");
    expect(text).toContain("6.5%");
    // APR is the headline comparison figure on the form.
    expect(text).toContain("6.712%");
  });

  it("states that it is not the official CFPB form", async () => {
    // The page tells the borrower to save this and compare it with their
    // Closing Disclosure; it must not be mistaken for the H-24 form itself.
    const text = await pdfText(await generateLoanEstimatePDF(data()));
    expect(text).toContain("not the official CFPB Loan Estimate form");
    expect(text).toContain("1234567");
  });

  it("shows a lender credit as a negative when there is one", async () => {
    const without = await pdfText(await generateLoanEstimatePDF(data({ lenderCredits: 0 })));
    expect(without).not.toContain("Lender Credits");

    const withCredit = await pdfText(await generateLoanEstimatePDF(data({ lenderCredits: 2500 })));
    expect(withCredit).toContain("Lender Credits");
    expect(withCredit).toContain("-$2,500");
  });

  it("omits the years 6-30 block when the loan has no second period", async () => {
    const text = await pdfText(await generateLoanEstimatePDF(data({
      projectedPayments: {
        years1Through5: { principalAndInterest: 1000, mortgageInsurance: 0, estimatedEscrow: 200, estimatedTotal: 1200 },
      },
    })));
    expect(text).toContain("Years 1-5");
    expect(text).not.toContain("Years 6-30");
  });

  it("spells out prepayment penalty and balloon payment either way", async () => {
    const clean = await pdfText(await generateLoanEstimatePDF(data()));
    expect(clean).toContain("No prepayment penalty");
    expect(clean).toContain("No balloon payment");

    const flagged = await pdfText(await generateLoanEstimatePDF(data({
      loanTerms: { ...data().loanTerms, prepaymentPenalty: true, balloonPayment: true },
    })));
    expect(flagged).toContain("Yes - see loan documents");
  });

  it("is deterministic apart from the PDF's own creation timestamp", async () => {
    // Same inputs must yield the same disclosure content — nothing in here
    // reads the clock or recomputes a figure.
    const a = await pdfText(await generateLoanEstimatePDF(data()));
    const b = await pdfText(await generateLoanEstimatePDF(data()));
    const strip = (s: string) => s.replace(/\/CreationDate\s*\([^)]*\)/g, "").replace(/\/ID\s*\[[^\]]*\]/g, "");
    expect(strip(a)).toBe(strip(b));
  });
});
