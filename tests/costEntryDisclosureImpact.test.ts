// F-0807-03 — a staff-keyed cost entry silently re-prices four zero-tolerance
// TRID lines with no changed-circumstance gate.
//
// Once F-4's baseline exists the borrower's NUMBER is held, so the sharper
// statement is: booking a cost entry silently creates CURE LIABILITY — money
// owed at closing, produced as a side effect of bookkeeping and discovered in
// a report read too late. These pin that the consequence is surfaced at the
// moment of the action, and that it never blocks the entry.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COST_CATEGORY_TO_DISCLOSED_FEE_ID } from "../server/services/loanEstimate";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("which cost categories can move a disclosure", () => {
  it("maps exactly the four that feed a disclosed fee line", () => {
    expect(COST_CATEGORY_TO_DISCLOSED_FEE_ID).toEqual({
      appraisal: "appraisal",
      credit_report: "credit_report",
      flood: "flood_determination",
      title: "title_insurance",
    });
  });

  it("does not map internal spend that is not a borrower charge", () => {
    // Labour, marketing and credit re-pulls are real costs and NOT disclosed
    // charges; mapping one would inflate a borrower's disclosure.
    for (const category of ["labor", "marketing", "rate_lock_extension"]) {
      expect(COST_CATEGORY_TO_DISCLOSED_FEE_ID[category]).toBeUndefined();
    }
  });
});

describe("the impact is evaluated where it can still be acted on", () => {
  const service = read("server/services/leDisclosureBaseline.ts");
  const route = read("server/routes/underwriting/submissions.ts");

  it("returns null before anything is disclosed — no baseline, no exposure", () => {
    expect(service).toMatch(/if \(!baselineRow\) return null;/);
  });

  it("flags a zero-tolerance increase as cure exposure", () => {
    expect(service).toMatch(/createsCureExposure: increase > 0 && disclosed\.bucket === "zero"/);
  });

  it("measures the LEDGER TOTAL, not the single entry", () => {
    // A supplemental invoice adds to the first and a reversal subtracts; the
    // exposure is the category's net against what was disclosed.
    expect(route).toMatch(/e\.category === parsed\.data\.category && !e\.simulated/);
  });

  it("audits the impact so a cure has a traceable cause", () => {
    expect(route).toMatch(/disclosureImpact,/);
    expect(route).toMatch(/loan_cost\.recorded/);
  });

  it("never blocks the entry — a real invoice is a real invoice", () => {
    // The handler must still return 201 with the entry; refusing to record
    // spend would corrupt the cost ledger to flatter a disclosure.
    expect(route).toMatch(/res\.status\(201\)\.json\(\{ \.\.\.entry, disclosureImpact \}\)/);
  });
});
