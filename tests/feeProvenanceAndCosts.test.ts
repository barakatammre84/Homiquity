// Audit findings F-9 (unsourced fee constants) and F-11 (no cost side).
//
// F-9: fifteen fee constants with no citation, four of them in the TRID
//      zero-tolerance bucket where every dollar of error is a cure.
// F-11: no cost-per-file, no vendor ledger, so gross margin was uncomputable
//      and credit-pull spend was unmetered.
import { describe, it, expect } from "vitest";
import {
  THIRD_PARTY_FEE_DEFINITIONS,
  feeProvenance,
  reportFeeProvenance,
  resolveFeeAmount,
  resolvedProvenanceTier,
  suspectFees,
  toActualFeeMap,
  unverifiedFees,
} from "../shared/compliance/feeProvenance";
import {
  computeUnitEconomics,
  computeWorkingCapitalPosition,
  costForApplication,
  projectWorkingCapital,
  summarizeCommissionCosts,
  summarizeCosts,
} from "../shared/costLedger";
import { computeClosingCosts } from "../server/services/loanCosts";

const BORROWER_PAID = { model: "borrower_paid", bps: 100 } as const;
const baseCosts = {
  purchasePrice: 500_000,
  downPayment: 100_000,
  loanAmount: 400_000,
  interestRate: 6.875,
  monthlyPMI: 0,
  prepaidInterestDays: 15,
  compensation: BORROWER_PAID,
};

describe("F-9 — fee provenance is now answerable", () => {
  it("marks every third-party fee as an unverified estimate, honestly", () => {
    // None has been upgraded to `cited`: the sources needed could not be
    // reached. The point is that this is now VISIBLE rather than implied.
    expect(unverifiedFees()).toHaveLength(THIRD_PARTY_FEE_DEFINITIONS.length);
    expect(THIRD_PARTY_FEE_DEFINITIONS.every(f => f.provenance.tier === "platform_estimate")).toBe(true);
  });

  it("flags transfer taxes as known-suspect for the licensed footprint", () => {
    const suspects = suspectFees().map(f => f.id);
    expect(suspects).toContain("transfer_taxes");
    expect(feeProvenance("transfer_taxes")?.note).toMatch(/state, county AND municipal/i);
  });

  it("keeps the zero-tolerance fees identifiable — the cure-risk surface", () => {
    const zeroTolerance = THIRD_PARTY_FEE_DEFINITIONS.filter(f => f.bucket === "zero").map(f => f.id);
    expect(zeroTolerance).toContain("appraisal");
    expect(zeroTolerance).toContain("transfer_taxes");
    // Recording fees are the 10% tier, not zero.
    expect(zeroTolerance).not.toContain("recording_fees");
  });

  it("returns null provenance for an unknown fee rather than inventing one", () => {
    expect(feeProvenance("not_a_fee")).toBeNull();
  });
});

describe("F-9 — per-file actuals override the estimate", () => {
  it("prefers a recorded actual over the platform estimate", () => {
    const actuals = toActualFeeMap([
      { feeId: "appraisal", amount: 1_200, source: "AMC quote", recordedAt: "2026-08-04" },
    ]);
    expect(resolveFeeAmount("appraisal", 650, actuals)).toBe(1_200);
    expect(resolvedProvenanceTier("appraisal", actuals)).toBe("actual");
    // Untouched fees still resolve to the estimate.
    expect(resolveFeeAmount("credit_report", 75, actuals)).toBe(75);
    expect(resolvedProvenanceTier("credit_report", actuals)).toBe("platform_estimate");
  });

  it("ignores unknown fee ids and negative amounts rather than disclosing them", () => {
    const actuals = toActualFeeMap([
      { feeId: "not_a_fee", amount: 999, source: "x", recordedAt: "2026-08-04" },
      { feeId: "appraisal", amount: -50, source: "x", recordedAt: "2026-08-04" },
    ]);
    expect(actuals).toEqual({});
  });

  it("discloses the real appraisal through the fee schedule — removing the cure", () => {
    // This is the practical win: the $650 national guess sits in the
    // zero-tolerance bucket, so a $1,200 complex appraisal is a $550 cure.
    // Disclosing the known number up front removes it instead of measuring it.
    const withEstimate = computeClosingCosts(baseCosts);
    const withActual = computeClosingCosts({
      ...baseCosts,
      actualFees: toActualFeeMap([
        { feeId: "appraisal", amount: 1_200, source: "AMC", recordedAt: "2026-08-04" },
      ]),
    });

    expect(withEstimate.appraisalFee).toBe(650);
    expect(withActual.appraisalFee).toBe(1_200);
    expect(withActual.totalClosingCosts - withEstimate.totalClosingCosts).toBeCloseTo(550, 6);
  });

  it("reports how much of a file's disclosure rests on guesses", () => {
    const none = reportFeeProvenance({});
    expect(none.actualCount).toBe(0);
    expect(none.zeroToleranceEstimateCount).toBeGreaterThan(0);
    expect(none.suspectFeeIds).toContain("transfer_taxes");

    const withAppraisal = reportFeeProvenance(
      toActualFeeMap([{ feeId: "appraisal", amount: 1_200, source: "AMC", recordedAt: "x" }]),
    );
    expect(withAppraisal.actualCount).toBe(1);
    expect(withAppraisal.zeroToleranceEstimateCount).toBe(none.zeroToleranceEstimateCount - 1);
  });
});

describe("F-11 — cost ledger", () => {
  const entries = [
    { applicationId: "a1", category: "credit_report", amount: "30" },
    { applicationId: "a1", category: "credit_report", amount: "30" },
    { applicationId: "a1", category: "appraisal", amount: "650" },
    { applicationId: "a2", category: "credit_report", amount: "30" },
    { applicationId: "a3", category: "avm", amount: "12", simulated: true },
  ];

  it("totals real spend and keeps simulated spend out of it", () => {
    const s = summarizeCosts(entries);
    expect(s.totalCost).toBe(740);
    expect(s.simulatedCost).toBe(12);
  });

  it("breaks cost down largest-first so the leak is findable", () => {
    const s = summarizeCosts(entries);
    expect(s.byCategory[0]).toEqual({ category: "appraisal", amount: 650, count: 1 });
    expect(s.byCategory[1]).toEqual({ category: "credit_report", amount: 90, count: 3 });
  });

  it("counts files carrying cost, including simulated-only ones", () => {
    expect(summarizeCosts(entries).filesWithCost).toBe(3);
  });

  it("computes per-file direct cost", () => {
    expect(costForApplication(entries, "a1")).toBe(710);
    expect(costForApplication(entries, "a3")).toBe(0); // simulated only
  });
});

describe("F-11 — unit economics", () => {
  const costs = summarizeCosts([
    { applicationId: "a1", category: "appraisal", amount: "650" },
    { applicationId: "a2", category: "credit_report", amount: "30" },
    { applicationId: "a3", category: "credit_report", amount: "30" },
  ]);

  it("divides cost by FUNDED loans, not by files touched", () => {
    // 710 of cost across 3 files, only 1 of which funded. The honest cost of
    // a closing is 710, not 236.67 — dividing by files flatters the business
    // by exactly the pull-through gap.
    const u = computeUnitEconomics({ receivedCompensation: 8_000, fundedCount: 1, costs });
    expect(u.costPerFundedLoan).toBe(710);
    expect(u.costPerFileTouched).toBeCloseTo(236.67, 2);
    expect(u.marginPerFundedLoan).toBe(7_290);
  });

  it("computes gross margin and labels it an upper bound", () => {
    const u = computeUnitEconomics({ receivedCompensation: 8_000, fundedCount: 1, costs });
    expect(u.grossMargin).toBe(7_290);
    expect(u.grossMarginPct).toBeCloseTo(91.13, 2);
    // Labour and overhead are captured nowhere, so this must never be
    // presented as the real margin.
    expect(u.costSideIncomplete).toBe(true);
    expect(u.notes.join(" ")).toMatch(/upper bound/i);
  });

  it("returns null per-funded figures rather than a misleading zero", () => {
    const u = computeUnitEconomics({ receivedCompensation: 0, fundedCount: 0, costs });
    expect(u.costPerFundedLoan).toBeNull();
    expect(u.marginPerFundedLoan).toBeNull();
    expect(u.grossMarginPct).toBeNull();
    expect(u.notes.join(" ")).toMatch(/undefined rather than zero/i);
  });

  it("calls out simulated spend excluded from the margin", () => {
    const withSim = summarizeCosts([
      { applicationId: "a1", category: "avm", amount: "12", simulated: true },
    ]);
    const u = computeUnitEconomics({ receivedCompensation: 8_000, fundedCount: 1, costs: withSim });
    expect(u.directCost).toBe(0);
    expect(u.notes.join(" ")).toMatch(/still-simulated vendor adapters/i);
  });
});

// ---------------------------------------------------------------------------
// F-20 — commission payouts are a cost, and were counted as none.
//
// `broker_commissions` recorded real money leaving the company per funded
// loan; nothing financial read the table, so the margin figure omitted the
// largest variable cost a brokerage carries while asserting commissions were
// "not captured anywhere".
// ---------------------------------------------------------------------------
describe("F-20 — commission payouts on the cost side", () => {
  const rows = [
    { status: "paid", commissionAmount: "1200.00" },
    { status: "approved", commissionAmount: "800.00" },
    { status: "pending", commissionAmount: "500.00" },
    { status: "rejected", commissionAmount: "9999.00" },
  ];

  it("splits the payout by lifecycle state rather than summing it flat", () => {
    const c = summarizeCommissionCosts(rows);
    expect(c.paidAmount).toBe(1_200);
    expect(c.approvedAmount).toBe(800);
    expect(c.pendingAmount).toBe(500);
    // committed = approved + paid. Pending is not yet owed; rejected never is.
    expect(c.committedAmount).toBe(2_000);
  });

  it("never lets a rejected commission reach any total", () => {
    const c = summarizeCommissionCosts(rows);
    const everyTotal = c.paidAmount + c.approvedAmount + c.pendingAmount;
    expect(everyTotal).toBe(2_500);
    expect(c.committedAmount).toBeLessThan(9_999);
  });

  it("charges committed commission against gross margin", () => {
    const costs = summarizeCosts([{ applicationId: "a1", category: "appraisal", amount: "650" }]);
    const withoutCommissions = computeUnitEconomics({
      receivedCompensation: 8_000,
      fundedCount: 1,
      costs,
    });
    const withCommissions = computeUnitEconomics({
      receivedCompensation: 8_000,
      fundedCount: 1,
      costs,
      commissions: summarizeCommissionCosts(rows),
    });

    expect(withoutCommissions.grossMargin).toBe(7_350);
    // 2,000 of committed payout is 25% of revenue on this file. Omitting it
    // overstated margin by exactly that.
    expect(withCommissions.grossMargin).toBe(5_350);
    expect(withCommissions.commissionCost).toBe(2_000);
    expect(withCommissions.vendorCost).toBe(650);
    expect(withCommissions.directCost).toBe(2_650);
  });

  it("says how much pending commission would move the number if approved", () => {
    const u = computeUnitEconomics({
      receivedCompensation: 8_000,
      fundedCount: 1,
      costs: summarizeCosts([]),
      commissions: summarizeCommissionCosts(rows),
    });
    expect(u.notes.join(" ")).toMatch(/500\.00 of commission/);
    expect(u.notes.join(" ")).toMatch(/pending admin sign-off/);
  });

  it("keeps the margin an upper bound even with commissions counted", () => {
    // Labour and overhead remain unmodeled — counting one more cost line must
    // not be mistaken for completing the cost side.
    const u = computeUnitEconomics({
      receivedCompensation: 8_000,
      fundedCount: 1,
      costs: summarizeCosts([]),
      commissions: summarizeCommissionCosts(rows),
    });
    expect(u.costSideIncomplete).toBe(true);
    expect(u.notes.join(" ")).toMatch(/upper bound/i);
    expect(u.notes.join(" ")).toMatch(/processing labour/i);
  });

  it("omitting commissions entirely is equivalent to zero, not a crash", () => {
    const u = computeUnitEconomics({
      receivedCompensation: 8_000,
      fundedCount: 1,
      costs: summarizeCosts([]),
    });
    expect(u.commissionCost).toBe(0);
    expect(u.grossMargin).toBe(8_000);
  });
});

// ---------------------------------------------------------------------------
// F-23 — working capital.
//
// F-16 established there is no duration mismatch on assets because there are no
// assets. What remains is the cash-flow question: spend goes out at application
// and comes back after the lender's wire. Two figures, and they are different
// kinds of thing — one measured off the ledger, one projected from an arrival
// rate the platform does not hold.
// ---------------------------------------------------------------------------
describe("F-23 — working capital", () => {
  it("reports committed capital as a measurement, not a model", () => {
    const w = computeWorkingCapitalPosition({
      unrecoveredCost: 4_260,
      unrecoveredFileCount: 6,
      daysToCashMedian: 32,
      daysToCashP90: 48,
    });
    expect(w.committed).toBe(4_260);
    expect(w.costPerUnrecoveredFile).toBe(710);
    expect(w.notes.join(" ")).toMatch(/measured, not modeled/);
  });

  it("returns null per-file spend on an empty book rather than dividing by zero", () => {
    const w = computeWorkingCapitalPosition({
      unrecoveredCost: 0,
      unrecoveredFileCount: 0,
      daysToCashMedian: null,
      daysToCashP90: null,
    });
    expect(w.costPerUnrecoveredFile).toBeNull();
    expect(w.notes.join(" ")).toMatch(/projection below cannot be run yet/);
  });

  it("projects steady-state capital by Little's Law", () => {
    // 20 files/month × $710 each, tied up 45 days = 1.5 months of arrivals.
    expect(
      projectWorkingCapital({ filesStartedPerMonth: 20, costPerFile: 710, daysToCash: 45 }),
    ).toBe(21_300);
  });

  it("scales linearly in each operand — the property that makes it a planning number", () => {
    const base = projectWorkingCapital({ filesStartedPerMonth: 10, costPerFile: 500, daysToCash: 30 })!;
    expect(projectWorkingCapital({ filesStartedPerMonth: 20, costPerFile: 500, daysToCash: 30 })).toBe(base * 2);
    expect(projectWorkingCapital({ filesStartedPerMonth: 10, costPerFile: 1_000, daysToCash: 30 })).toBe(base * 2);
    expect(projectWorkingCapital({ filesStartedPerMonth: 10, costPerFile: 500, daysToCash: 60 })).toBe(base * 2);
  });

  it("refuses to project on a missing operand rather than returning a partial number", () => {
    expect(projectWorkingCapital({ filesStartedPerMonth: 20, costPerFile: null, daysToCash: 45 })).toBeNull();
    expect(projectWorkingCapital({ filesStartedPerMonth: 20, costPerFile: 710, daysToCash: null })).toBeNull();
    expect(projectWorkingCapital({ filesStartedPerMonth: 0, costPerFile: 710, daysToCash: 45 })).toBeNull();
  });

  it("does NOT double-count the days — the formula the audit doc first stated was circular", () => {
    // The original write-up said `in-flight count × cost × days/365`. An
    // in-flight count is ALREADY arrival rate × time in system, so multiplying
    // by the days again counts them twice. Use an arrival rate OR an in-flight
    // count, never both: at 20 files/month over 45 days there are ~30 files in
    // flight, each tying up $710 — $21,300, which is what the projection gives.
    const inFlight = 20 * (45 / 30);
    expect(
      projectWorkingCapital({ filesStartedPerMonth: 20, costPerFile: 710, daysToCash: 45 }),
    ).toBe(inFlight * 710);
  });
});
