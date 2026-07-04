import { describe, expect, it } from "vitest";
import { generateAdverseActionNotice } from "../server/services/creditService";

/**
 * Adverse-action notice content (ECOA/Reg B §1002.9, FCRA §615(a)).
 *
 * Two regimes:
 *  - The ECOA block (anti-discrimination notice + creditor identity +
 *    administering agency) is UNCONDITIONAL — required on any adverse action
 *    on a credit application.
 *  - The FCRA §615(a) consumer-report content (basis statement, CRA contact,
 *    score disclosure, report rights) applies ONLY when the action was actually
 *    based on a consumer report. Asserting it otherwise is a misstatement.
 */

const bureau = {
  name: "Experian",
  address: "P.O. Box 4500, Allen, TX 75013",
  phone: "1-888-397-3742",
  website: "www.experian.com",
};

describe("Adverse-action notice — ECOA is unconditional", () => {
  for (const basedOnConsumerReport of [true, false]) {
    it(`includes the ECOA block when basedOnConsumerReport=${basedOnConsumerReport}`, () => {
      const notice = generateAdverseActionNotice({
        actionType: "denial",
        primaryReason: "Debt-to-income ratio exceeds maximum threshold",
        basedOnConsumerReport,
        bureau: basedOnConsumerReport ? bureau : null,
      });
      expect(notice).toContain("EQUAL CREDIT OPPORTUNITY ACT");
      expect(notice).toContain("prohibits creditors from discriminating");
      expect(notice).toContain("CREDITOR:");
    });
  }
});

describe("Adverse-action notice — FCRA content is gated on report use", () => {
  it("a self-reported denial does NOT claim a consumer report was used", () => {
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Insufficient funds for down payment and/or closing costs",
      basedOnConsumerReport: false,
      creditScoreUsed: 640, // present, but must be ignored when no report was used
      bureau: null,
    });
    expect(notice).not.toContain("consumer reporting agency");
    expect(notice).not.toContain("FAIR CREDIT REPORTING ACT");
    expect(notice).not.toContain("CREDIT SCORE INFORMATION");
    // Closing cites ECOA only.
    expect(notice).toContain("required by the Equal Credit Opportunity Act.");
    expect(notice).not.toContain("Fair Credit Reporting Act.");
  });

  it("a report-based denial includes the full FCRA §615(a) content", () => {
    const notice = generateAdverseActionNotice({
      actionType: "denial",
      primaryReason: "Derogatory items on credit report",
      basedOnConsumerReport: true,
      creditScoreUsed: 610,
      bureau,
      bureauReasonCodes: ["022"],
    });
    expect(notice).toContain("information obtained from a consumer reporting agency");
    expect(notice).toContain("FAIR CREDIT REPORTING ACT");
    expect(notice).toContain("CREDIT SCORE INFORMATION");
    expect(notice).toContain("Your credit score: 610");
    expect(notice).toContain("Experian");
    // Closing cites both statutes.
    expect(notice).toContain("Equal Credit Opportunity Act and the Fair Credit Reporting Act");
  });
});
