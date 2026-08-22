// Regression cover for two defects found reviewing the F-4/F-9/F-11 work
// after it landed (#342). Both were invisible to the existing suite.
//
// 1. Simulated vendor costs reached the borrower's Loan Estimate.
//    server/services/creditPulls.ts books a soft pull at its platform-assumption
//    unit cost ($5) and flags it `simulated` "so they cannot leak". The LE's
//    actual-fee resolver summed every ledger entry in a mapped category
//    regardless of that flag, so a simulated $5 replaced the $75 disclosed
//    credit-report line. That line is zero-tolerance
//    (shared/compliance/feeTolerance.ts), where an understatement at closing is
//    a dollar-for-dollar cure — the simulation manufactured real liability.
//    tests/feeProvenanceAndCosts.test.ts already pins the COST side ("keeps
//    simulated spend out of it"); this pins the DISCLOSURE side.
//
// 2. The revised-LE redisclosure path was unreachable. See the ordering guard
//    at the bottom for why that one is a source assertion and not a behavior
//    test.
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const h = vi.hoisted(() => ({
  application: null as any,
  costEntries: [] as any[],
  propertyInfo: null as any,
}));

vi.mock("../server/storage", () => ({
  storage: {
    getLoanApplication: async () => h.application,
    getLoanCostEntries: async () => h.costEntries,
    // B3-6-03: the projection reads subject-property association dues to build
    // the qualifying PITIA. `h.propertyInfo` defaults to null (no URLA property
    // row), which is the shape a fresh intake actually has.
    getUrlaPropertyInfo: async () => h.propertyInfo,
  },
}));

// Pricing reaches the rate sheet in the DB; the LLPA value is irrelevant here
// and holding it at zero keeps the disclosed fee the only moving part.
vi.mock("../server/pricing", () => ({
  calculateLLPA: async (loanAmount: number) => ({
    baseLLPA: 0,
    propertyTypeAdjustment: 0,
    condoAdjustment: 0,
    fthbWaiver: 0,
    totalLLPA: 0,
    pricing: { loanAmount, lLPAFeeAmount: 0, pmiAnnualRate: 0, pmiMonthlyPayment: 0 },
  }),
}));

import { generateLoanEstimate } from "../server/services/loanEstimate";

function application() {
  return {
    id: "app-1",
    purchasePrice: "500000",
    downPayment: "100000",
    creditScore: 740,
    propertyState: "IL",
    propertyType: "single_family",
    preferredLoanType: "conventional",
    isVeteran: false,
    isFirstTimeBuyer: false,
    // Required since F-1: a guessed compensation model is itself the violation.
    loCompensationModel: "lender_paid",
    loCompensationBps: 200,
  };
}

/** The disclosed credit-report line out of the LE fee surface. */
function creditReportLine(le: any): number {
  return Number(le.closingCostDetails.loanCosts.servicesYouCannotShopFor.creditReport);
}

beforeEach(() => {
  h.application = application();
  h.costEntries = [];
});

describe("disclosed fees vs the cost ledger", () => {
  it("uses the platform estimate when the only ledger entry is simulated", async () => {
    h.costEntries = [
      { category: "credit_report", amount: "5.00", simulated: true },
    ];
    const le = await generateLoanEstimate("app-1");
    // $75 estimate stands; the simulated $5 must not become the disclosure.
    expect(creditReportLine(le)).toBe(75);
  });

  it("lets a REAL invoice move the disclosed figure", async () => {
    h.costEntries = [
      { category: "credit_report", amount: "45.00", simulated: false },
    ];
    const le = await generateLoanEstimate("app-1");
    // Whole dollars on purpose: the LE rounds displayed fees, so a value like
    // 42.50 would surface as 43 and confuse a rounding assertion with this
    // test's actual subject, which is whose number gets disclosed.
    expect(creditReportLine(le)).toBe(45);
  });

  it("ignores simulated entries while still summing real ones in the same category", async () => {
    h.costEntries = [
      { category: "credit_report", amount: "5.00", simulated: true },
      { category: "credit_report", amount: "40.00", simulated: false },
      { category: "credit_report", amount: "15.00", simulated: true },
    ];
    const le = await generateLoanEstimate("app-1");
    // Only the real $40 — not $60, and not $45.
    expect(creditReportLine(le)).toBe(40);
  });

  it("falls back to the estimate rather than disclosing $0 when every entry is simulated", async () => {
    h.costEntries = [
      { category: "appraisal", amount: "0.00", simulated: true },
      { category: "credit_report", amount: "5.00", simulated: true },
    ];
    const le = await generateLoanEstimate("app-1");
    expect(creditReportLine(le)).toBe(75);
    expect(creditReportLine(le)).toBeGreaterThan(0);
  });
});

describe("revised-LE redisclosure ordering (source guard)", () => {
  // This is a call-ORDER invariant inside an Express handler, and the ordering
  // is only wrong end-to-end: each function is individually correct, and the
  // unit suite mocks getOpenChangeOfCircumstances directly, which is exactly
  // why the original defect survived. Asserting the order in source is the
  // cheapest thing that actually fails if someone reintroduces it.
  const src = fs.readFileSync(
    path.join(__dirname, "../server/routes/underwriting/delivery.ts"),
    "utf8",
  );

  it("reconciles the disclosure BEFORE stamping changes of circumstance redisclosed", () => {
    const reconcile = src.indexOf("reconcileDisclosure(id, le)");
    const stamp = src.indexOf("markRevisedLeDelivered(id)");
    expect(reconcile).toBeGreaterThan(-1);
    expect(stamp).toBeGreaterThan(-1);
    // markRevisedLeDelivered flips open CoCs to status "redisclosed", and
    // reconcileDisclosure asks for the OPEN ones. Stamping first means
    // reconcile always sees [], so `increase_justified` is unreachable and
    // every CoC-backed increase books as a cure forever.
    expect(stamp).toBeGreaterThan(reconcile);
  });

  it("returns the held baseline before it can stamp a revised-LE delivery", () => {
    const blocked = src.indexOf('decision.action === "blocked_no_coc"');
    const stamp = src.indexOf("markRevisedLeDelivered(id)");
    expect(blocked).toBeGreaterThan(-1);
    // On blocked_no_coc the borrower is deliberately served the OLD baseline.
    // Recording a §1026.19(e)(4)(i) revised-LE delivery on that same request
    // would assert a disclosure the consumer provably did not receive.
    expect(stamp).toBeGreaterThan(blocked);
  });
});
