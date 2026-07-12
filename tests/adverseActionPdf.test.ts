import { describe, expect, it } from "vitest";
import { generateAdverseActionPDF } from "../server/services/pdfLetterGenerator";
import { generateAdverseActionNotice } from "../server/services/creditService";

/**
 * Mailable adverse-action letter (the postal fallback channel for the ECOA
 * §1002.9 delivery window).
 *
 * The legal wording is NOT this generator's concern — it renders the stored
 * notice_text verbatim, and that text's content rules are covered by
 * tests/adverseActionNotice.test.ts. These tests assert the artifact itself:
 * a well-formed PDF that carries the full notice, paginating when the text
 * exceeds one page. PDF content streams are compressed, so assertions follow
 * the repo's buffer-signature pattern (magic bytes / uncompressed structures)
 * rather than extracting rendered text.
 */

const bureau = {
  name: "Experian",
  address: "P.O. Box 4500, Allen, TX 75013",
  phone: "1-888-397-3742",
  website: "www.experian.com",
};

function letterData(noticeText: string) {
  return {
    noticeId: "3f2b8a10-6c1d-4e2f-9a7b-000000000000",
    actionType: "denial",
    noticeDate: new Date("2026-07-01T12:00:00Z"),
    noticeText,
    borrowerName: "Jordan Applicant",
    borrowerAddressLines: ["123 Main St, Unit 4", "Springfield, IL 62704"],
    companyLegalName: "Homiquity",
    companyNmlsId: "PENDING",
    companyContactInfo: "compliance@example.com | (555) 000-0000",
  };
}

/** Page objects are uncompressed dictionaries, so they are countable raw. */
function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length;
}

describe("generateAdverseActionPDF — well-formed artifact", () => {
  it("renders a report-based denial notice to a valid PDF", async () => {
    const noticeText = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Derogatory items on credit report",
      secondaryReasons: ["Debt-to-income ratio exceeds maximum threshold"],
      basedOnConsumerReport: true,
      creditScoreUsed: 610,
      bureau,
      bureauReasonCodes: ["022", "038"],
    });

    const pdf = await generateAdverseActionPDF(letterData(noticeText));

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    // A real letter, not a stub: header + multi-block notice body.
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(1);
  });

  it("renders a non-report (ECOA-only) notice too", async () => {
    const noticeText = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Insufficient funds for down payment and/or closing costs",
      basedOnConsumerReport: false,
      bureau: null,
    });

    const pdf = await generateAdverseActionPDF(letterData(noticeText));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("paginates when the notice text exceeds one page", async () => {
    const noticeText = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Derogatory items on credit report",
      // Enough enumerated reasons to force the flowing body past page one.
      secondaryReasons: Array.from(
        { length: 40 },
        (_, i) => `Additional adverse factor number ${i + 1} identified during underwriting review`,
      ),
      basedOnConsumerReport: true,
      creditScoreUsed: 610,
      bureau,
      bureauReasonCodes: ["022"],
    });

    const pdf = await generateAdverseActionPDF(letterData(noticeText));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(2);
  });

  it("tolerates missing optional fields (no mailing address, no contact info)", async () => {
    const noticeText = generateAdverseActionNotice({
      actionType: "counteroffer",
      primaryReason: "Debt-to-income ratio exceeds maximum threshold",
      basedOnConsumerReport: false,
      bureau: null,
    });

    const pdf = await generateAdverseActionPDF({
      noticeId: "no-optionals",
      actionType: "counteroffer",
      noticeDate: new Date("2026-07-01T12:00:00Z"),
      noticeText,
      borrowerName: "Applicant",
      companyLegalName: "Homiquity",
      companyNmlsId: "PENDING",
    });

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
