// Audit finding F-4 — the issued Loan Estimate is now a persisted baseline.
//
// The behavior these tests pin: the Loan Estimate is generated from live file
// data, so without a baseline the figures a borrower saw silently changed
// underneath them and no tolerance comparison was possible. A new baseline is
// written ONLY when a change of circumstance authorizes it.
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  disclosures: [] as any[],
  openCocs: [] as any[],
}));

vi.mock("../server/storage", () => ({
  storage: {
    getLatestLoanEstimateDisclosure: async () =>
      h.disclosures.length === 0
        ? undefined
        : h.disclosures.reduce((a, b) => (a.version >= b.version ? a : b)),
    createLoanEstimateDisclosure: async (data: any) => {
      const row = { id: `disc-${h.disclosures.length + 1}`, ...data };
      h.disclosures.push(row);
      return row;
    },
    getOpenChangeOfCircumstances: async () => h.openCocs,
  },
}));

import {
  reconcileDisclosure,
  snapshotFromLoanEstimate,
  applyDisclosedFees,
  getToleranceReview,
} from "../server/services/leDisclosureBaseline";

/** Minimal LoanEstimateData with the fee surface the baseline reads. */
function le(overrides: { appraisal?: number; originationTotal?: number; recording?: number } = {}) {
  const originationTotal = overrides.originationTotal ?? 6_000;
  return {
    loanTerms: { loanAmount: 400_000, interestRate: 6.875 },
    costsAtClosing: { estimatedClosingCosts: 0, estimatedCashToClose: 0 },
    closingCostDetails: {
      loanCosts: {
        // Since F-7 the origination fee is its own named line and the section
        // total is the sum of the lines above it.
        originationCharges: {
          originationFee: originationTotal - 2_000,
          points: 0,
          applicationFee: 500,
          underwritingFee: 1_500,
          total: originationTotal,
        },
        servicesYouCannotShopFor: {
          appraisal: overrides.appraisal ?? 650,
          creditReport: 75,
          floodDetermination: 25,
          taxService: 100,
          total: 850,
        },
        servicesYouCanShopFor: { titleInsurance: 2_000, titleSearch: 350, surveyFee: 450, pestInspection: 150, total: 2_950 },
        totalLoanCosts: 9_800,
      },
      otherCosts: {
        taxesAndGovernmentFees: { recordingFees: overrides.recording ?? 150, transferTaxes: 500, total: 650 },
        prepaids: { homeownersInsurance: 1_200, mortgageInsurance: 0, prepaidInterest: 1_130, propertyTaxes: 1_000, total: 3_330 },
        initialEscrowPaymentAtClosing: { homeownersInsurance: 300, mortgageInsurance: 0, propertyTaxes: 1_500, total: 1_800 },
        otherItems: { ownersTitleInsurance: 1_500, total: 1_500 },
        totalOtherCosts: 7_280,
      },
      totalClosingCosts: 17_080,
    },
    cashToClose: {
      totalClosingCosts: 17_080,
      closingCostsPaidBeforeClosing: 0,
      downPayment: 100_000,
      deposit: 0,
      fundsFromBorrower: 117_080,
      sellerCredits: 0,
      adjustmentsAndOtherCredits: 0,
      cashToClose: 117_080,
    },
  } as any;
}

beforeEach(() => {
  h.disclosures = [];
  h.openCocs = [];
});

describe("F-4 — snapshot extraction", () => {
  it("carries the itemized origination fee into the baseline", () => {
    const s = snapshotFromLoanEstimate(le());
    expect(s.fees.find(f => f.id === "origination_fee")?.amount).toBe(4_000);
  });

  it("keeps Section A's total equal to the sum of its lines (F-7)", () => {
    // The defect: `total` included the origination fee while the itemized
    // lines did not, so a borrower saw a $6,000 subtotal above lines summing
    // to $2,000 — §1026.37(f)(1) requires each charge itemized by name.
    const a = le().closingCostDetails.loanCosts.originationCharges;
    expect(a.originationFee + a.points + a.applicationFee + a.underwritingFee).toBe(a.total);
  });
});

describe("F-4 — baseline lifecycle", () => {
  it("persists version 1 on first borrower delivery", async () => {
    const decision = await reconcileDisclosure("app-1", le());
    expect(decision.action).toBe("issued_first");
    expect(decision.disclosure.version).toBe(1);
    expect(decision.evaluation).toBeNull();
    expect(h.disclosures).toHaveLength(1);
  });

  it("does not write a new version when nothing changed", async () => {
    await reconcileDisclosure("app-1", le());
    const decision = await reconcileDisclosure("app-1", le());
    expect(decision.action).toBe("unchanged");
    expect(decision.disclosure.version).toBe(1);
    expect(h.disclosures).toHaveLength(1);
  });

  it("holds the baseline when charges rise with no change of circumstance", async () => {
    await reconcileDisclosure("app-1", le());
    const decision = await reconcileDisclosure("app-1", le({ appraisal: 1_200 }));

    expect(decision.action).toBe("blocked_no_coc");
    expect(decision.evaluation?.verdict).toBe("cure_required");
    expect(decision.evaluation?.cureAmount).toBe(550);
    // The baseline did NOT move — that is the whole fix.
    expect(decision.disclosure.version).toBe(1);
    expect(h.disclosures).toHaveLength(1);
  });

  it("rediscloses and resets the baseline when a change of circumstance is open", async () => {
    await reconcileDisclosure("app-1", le());
    h.openCocs = [{ id: "coc-1", status: "open" }];

    const decision = await reconcileDisclosure("app-1", le({ appraisal: 1_200 }));
    expect(decision.action).toBe("redisclosed");
    expect(decision.disclosure.version).toBe(2);
    expect(decision.cocId).toBe("coc-1");
    expect(h.disclosures).toHaveLength(2);

    // The new baseline is now in force: the same figures no longer cure.
    h.openCocs = [];
    const after = await reconcileDisclosure("app-1", le({ appraisal: 1_200 }));
    expect(after.action).toBe("unchanged");
  });

  it("does not cure a decrease", async () => {
    await reconcileDisclosure("app-1", le());
    const decision = await reconcileDisclosure("app-1", le({ appraisal: 400 }));
    expect(decision.action).toBe("unchanged");
    expect(decision.evaluation?.cureAmount).toBe(0);
  });
});

describe("F-4 — serving the figures that were disclosed", () => {
  it("restores the disclosed fees and recomputes every dependent total", async () => {
    const first = await reconcileDisclosure("app-1", le());
    const drifted = le({ appraisal: 1_200 });
    const held = applyDisclosedFees(drifted, first.disclosure.snapshot as any);

    // The borrower sees the disclosed $650, not today's $1,200.
    expect(held.closingCostDetails.loanCosts.servicesYouCannotShopFor.appraisal).toBe(650);
    // ...and the roll-ups agree with it rather than with the drifted input.
    expect(held.closingCostDetails.loanCosts.servicesYouCannotShopFor.total).toBe(850);
    const d = held.closingCostDetails;
    expect(d.loanCosts.totalLoanCosts).toBe(
      d.loanCosts.originationCharges.total + d.loanCosts.servicesYouCannotShopFor.total + d.loanCosts.servicesYouCanShopFor.total,
    );
    expect(d.totalClosingCosts).toBe(d.loanCosts.totalLoanCosts + d.otherCosts.totalOtherCosts);
    expect(held.cashToClose.cashToClose).toBe(d.totalClosingCosts + held.cashToClose.downPayment);
    expect(held.costsAtClosing.estimatedCashToClose).toBe(held.cashToClose.cashToClose);
  });

  it("emits a Section A whose total equals the sum of its named lines (F-7)", async () => {
    const first = await reconcileDisclosure("app-1", le());
    const held = applyDisclosedFees(le({ appraisal: 1_200 }), first.disclosure.snapshot as any);
    const a = held.closingCostDetails.loanCosts.originationCharges;

    expect(a.originationFee).toBe(4_000);
    expect(a.total).toBe(6_000);
    // The invariant that was broken: an unlabeled $4,000 sat between the
    // itemized lines and the subtotal the borrower read.
    expect(a.originationFee + a.points + a.applicationFee + a.underwritingFee).toBe(a.total);
  });
});

describe("F-4 — staff tolerance review", () => {
  it("reports no baseline before the first delivery", async () => {
    const review = await getToleranceReview("app-1", le());
    expect(review.hasBaseline).toBe(false);
    expect(review.evaluation).toBeNull();
  });

  it("reports the live cure exposure without writing anything", async () => {
    await reconcileDisclosure("app-1", le());
    const review = await getToleranceReview("app-1", le({ appraisal: 1_200 }));

    expect(review.hasBaseline).toBe(true);
    expect(review.baselineVersion).toBe(1);
    expect(review.evaluation?.verdict).toBe("cure_required");
    expect(review.evaluation?.cureAmount).toBe(550);
    expect(h.disclosures).toHaveLength(1); // read-only
  });
});
