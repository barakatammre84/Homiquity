// Pre-approval letter integrity: an issued letter is a record, and every
// re-render must come from that record.
//
// Two layers, mirroring tests/licensedStates.test.ts:
//  1. Unit tests on letterDataFromStoredRow — the pure regeneration builder.
//  2. Source guards on server/routes/lending/letters.ts pinning the route
//     contracts the 2026-08-04 cross-sector adjudication §3 established:
//     no regeneration from live application data, no letter minted by the
//     download route, prior letters superseded on reissue, and issuance
//     failing loudly when the row cannot be recorded.

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  letterDataFromStoredRow,
  STANDARD_PRE_APPROVAL_CONDITIONS,
  type StoredPreApprovalLetter,
} from "../server/services/pdfLetterGenerator";

const storedRow: StoredPreApprovalLetter = {
  letterNumber: "BN-TEST123-ABCD",
  borrowerName: "Jordan Example",
  loanAmount: "400000.00",
  productType: "CONV",
  occupancy: "Primary",
  loanPurpose: "Purchase",
  companyLegalName: "Homiquity LLC",
  companyNmlsId: "427468",
  companyContactInfo: "support@homiquity.com",
  expirationDate: "2026-11-02T00:00:00.000Z",
  generatedAt: "2026-08-04T12:00:00.000Z",
  createdAt: "2026-08-04T12:00:00.000Z",
  watermarkApplied: true,
};

describe("letterDataFromStoredRow", () => {
  it("renders the issued terms verbatim from the row", () => {
    const data = letterDataFromStoredRow(storedRow);
    expect(data.letterNumber).toBe("BN-TEST123-ABCD");
    expect(data.borrowerName).toBe("Jordan Example");
    expect(data.loanAmount).toBe("400000.00");
    expect(data.productType).toBe("CONV");
    expect(data.occupancy).toBe("Primary");
    expect(data.expirationDate).toEqual(new Date("2026-11-02T00:00:00.000Z"));
    expect(data.generatedAt).toEqual(new Date("2026-08-04T12:00:00.000Z"));
    expect(data.conditions).toEqual([...STANDARD_PRE_APPROVAL_CONDITIONS]);
    expect(data.watermarkApplied).toBe(true);
  });

  it("carries no live-application financial detail — omitted, not recomputed", () => {
    const data = letterDataFromStoredRow(storedRow);
    // The row does not store these; a regeneration must not source them from
    // the application's current state (the drift the adjudication §3.1 bars).
    expect(data.purchasePrice).toBeUndefined();
    expect(data.downPayment).toBeUndefined();
    expect(data.downPaymentPercent).toBeUndefined();
    expect(data.annualIncome).toBeUndefined();
    expect(data.monthlyPaymentEstimate).toBeUndefined();
    expect(data.estimatedDti).toBeUndefined();
    expect(data.creditScoreRange).toBeUndefined();
    expect(data.employmentType).toBeUndefined();
    expect(data.propertyType).toBeUndefined();
    expect(data.propertyState).toBeUndefined();
    expect(data.incomeSources).toBeUndefined();
    // Empty disclaimers fall back to the generator's standard five.
    expect(data.disclaimers).toEqual([]);
  });

  it("falls back to createdAt when generatedAt is missing", () => {
    const data = letterDataFromStoredRow({
      ...storedRow,
      generatedAt: null,
      createdAt: "2026-08-01T09:30:00.000Z",
    });
    expect(data.generatedAt).toEqual(new Date("2026-08-01T09:30:00.000Z"));
  });

  it("the stored-row input renders a real PDF (the regen path end-to-end)", async () => {
    const { generatePreApprovalPDF } = await import("../server/services/pdfLetterGenerator");
    const buffer = await generatePreApprovalPDF(letterDataFromStoredRow(storedRow));
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("letters route source guards", () => {
  const lettersSource = () =>
    readFile(join(__dirname, "../server/routes/lending/letters.ts"), "utf8");

  it("letter-pdf refuses to serve when no letter was ever issued", async () => {
    const source = await lettersSource();
    expect(
      source.includes('"No pre-approval letter found"'),
      "expected the letter-pdf route to 404 when no pre_approval_letters row exists — the download route carries none of the issuance gates and must never mint a letter",
    ).toBe(true);
    // Exactly one BN- letter number is ever minted: at issuance. A second
    // minting site means the download route regrew its fresh-number fallback.
    expect(
      (source.match(/`BN-\$\{/g) || []).length,
      "expected exactly one BN- letter-number minting site (the issuance route)",
    ).toBe(1);
  });

  it("regeneration renders from the stored row, and only issuance prices", async () => {
    const source = await lettersSource();
    expect(
      source.includes("letterDataFromStoredRow(letter)"),
      "expected the letter-pdf regeneration fallback to build its render input from the stored row via letterDataFromStoredRow",
    ).toBe(true);
    // currentAdvertised30YrRate: one definition + one call, in generate-letter.
    // A second call site means a download/regen path started pricing from
    // today's rates under an original issuance date.
    expect(
      (source.match(/currentAdvertised30YrRate\(/g) || []).length,
      "expected currentAdvertised30YrRate to appear exactly twice: its definition and the single issuance-route call",
    ).toBe(2);
  });

  it("issuing a new letter supersedes prior issued letters", async () => {
    const source = await lettersSource();
    expect(
      source.includes('status: "superseded"'),
      "expected generate-letter to flip prior issued letters to superseded (supersede-on-reissue)",
    ).toBe(true);
    expect(
      source.includes("supersededAt"),
      "expected the supersede writer to stamp supersededAt",
    ).toBe(true);
  });

  it("an unrecorded letter is not issued", async () => {
    const source = await lettersSource();
    expect(
      source.includes("Letter could not be recorded and was not issued"),
      "expected generate-letter to fail loudly (500) when the pre_approval_letters insert fails, instead of handing out a PDF the system cannot account for",
    ).toBe(true);
  });
});
