// WF1-002 regression pins — the instant-decision pricing path.
//
// Root cause: since 1967dff the engine priced PITI through the DISCLOSABLE
// generateLoanEstimate, which (correctly, §1026.36(d)(2)) fails closed when
// the LO compensation election is unset — and no intake path sets it, so
// EVERY fresh intake was undecidable (NEEDS_MORE_INFO, null policyFingerprint).
//
// The fix gives the loan-estimate service an internal, compensation-
// independent payment projection (computePaymentProjection) that the engine
// consumes instead. Three properties are load-bearing and pinned here:
//
//   1. NO ELECTION, STILL PRICEABLE — the projection succeeds on a file with
//      no compensation election, while the disclosable generator keeps its
//      fail-closed guard on the very same file (the guard was never the bug;
//      the shared path was).
//   2. NO DRIFT — for identical inputs (election present), the projection's
//      numbers are byte-identical to the Loan Estimate's projectedPayments
//      block: one derivation, one escrow model, one rounding.
//   3. HONEST GAPS + DETERMINISM — a file missing a genuine pricing input
//      still throws the same named error, and same inputs give the same
//      projection (mortgage-calculations house rule).
//
// Hermetic, same harness as tests/leDisclosedFeeProvenance.test.ts: storage
// and the LLPA matrix lookup are mocked; every number the assertions touch is
// pure arithmetic over the mocked inputs.
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  application: null as any,
  costEntries: [] as any[],
}));

vi.mock("../server/storage", () => ({
  storage: {
    getLoanApplication: async () => h.application,
    getLoanCostEntries: async () => h.costEntries,
  },
}));

// Pricing reaches the rate sheet in the DB; holding the LLPA at zero keeps the
// projection arithmetic the only moving part.
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

import { computePaymentProjection, generateLoanEstimate } from "../server/services/loanEstimate";

function application(overrides: Record<string, unknown> = {}) {
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
    // Deliberately NO loCompensationModel / loCompensationBps: this is the
    // exact state of every fresh intake.
    ...overrides,
  };
}

beforeEach(() => {
  h.application = application();
  h.costEntries = [];
});

describe("computePaymentProjection — compensation independence (WF1-002)", () => {
  it("prices a fresh intake with NO compensation election", async () => {
    const projection = await computePaymentProjection("app-1");

    // 400k @ 80 LTV, FICO 740, conventional: base 6.875, no adjustments,
    // zero LLPA ⇒ 6.875% note rate; LTV ≤ 80 ⇒ no MI.
    expect(projection.loanAmount).toBe(400000);
    expect(projection.interestRate).toBe(6.875);
    expect(projection.monthlyMortgageInsurance).toBe(0);
    // Escrow model: tax 500000*0.012/12 = 500; insurance max(1200, 1500)/12 = 125.
    expect(projection.monthlyEscrow).toBe(625);
    expect(projection.estimatedMonthlyTotal).toBeGreaterThan(0);
    expect(projection.estimatedMonthlyTotal).toBeCloseTo(
      projection.monthlyPrincipalAndInterest +
        projection.monthlyMortgageInsurance +
        projection.monthlyEscrow,
      1,
    );
  });

  it("the DISCLOSABLE generator keeps its §1026.36(d)(2) fail-closed guard on the same file", async () => {
    await expect(generateLoanEstimate("app-1")).rejects.toThrow(
      /compensation model and rate are required/i,
    );
  });

  it("is deterministic — same inputs, same projection", async () => {
    const first = await computePaymentProjection("app-1");
    const second = await computePaymentProjection("app-1");
    expect(second).toEqual(first);
  });

  it("still gaps honestly on a genuinely missing pricing input", async () => {
    h.application = application({ creditScore: null });
    await expect(computePaymentProjection("app-1")).rejects.toThrow(
      /credit score is required/i,
    );
  });
});

describe("computePaymentProjection — no drift from the Loan Estimate", () => {
  it("matches projectedPayments.years1Through5 byte-for-byte when the election exists", async () => {
    h.application = application({
      loCompensationModel: "lender_paid",
      loCompensationBps: 125,
    });

    const le = await generateLoanEstimate("app-1");
    const projection = await computePaymentProjection("app-1");

    expect(projection.estimatedMonthlyTotal).toBe(
      le.projectedPayments.years1Through5.estimatedTotal,
    );
    expect(projection.monthlyPrincipalAndInterest).toBe(
      le.projectedPayments.years1Through5.principalAndInterest,
    );
    expect(projection.monthlyMortgageInsurance).toBe(
      le.projectedPayments.years1Through5.mortgageInsurance,
    );
    expect(projection.monthlyEscrow).toBe(
      le.projectedPayments.years1Through5.estimatedEscrow,
    );
    expect(projection.interestRate).toBe(le.loanTerms.interestRate);
    expect(projection.loanAmount).toBe(le.loanTerms.loanAmount);
  });

  it("holds parity on an MI-bearing file too (LTV > 80)", async () => {
    h.application = application({
      downPayment: "50000", // 450k / 500k = 90 LTV ⇒ conventional BPMI applies
      loCompensationModel: "borrower_paid",
      loCompensationBps: 100,
    });

    const le = await generateLoanEstimate("app-1");
    const projection = await computePaymentProjection("app-1");

    expect(projection.monthlyMortgageInsurance).toBeGreaterThan(0);
    expect(projection.estimatedMonthlyTotal).toBe(
      le.projectedPayments.years1Through5.estimatedTotal,
    );
    expect(projection.monthlyMortgageInsurance).toBe(
      le.projectedPayments.years1Through5.mortgageInsurance,
    );
  });
});
