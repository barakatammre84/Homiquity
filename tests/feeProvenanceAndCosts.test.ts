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
  costForApplication,
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
    // Labour and commissions are captured nowhere, so this must never be
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
