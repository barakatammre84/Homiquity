import { describe, it, expect, vi } from "vitest";

// F-077: the Loan Estimate's disclosed MI — and the DTI the instant decision
// is made on — came from loanCosts.calculatePMI, a compile-time FICO×LTV card
// that exceeds the versioned CONVENTIONAL_PMI matrix in every live cell
// (1.42×–2.17×), while derivePricing had already awaited calculateLLPA and
// held the matrix figure. These pin the routing hermetically: the payment
// projection must carry the matrix number, not the card's.

const MATRIX_MONTHLY_PMI = 239.2; // $368k × 0.78%/yr / 12 — the register's worked example

vi.mock("../server/pricing", () => ({
  calculateLLPA: vi.fn(async () => ({
    baseLLPA: 0,
    propertyTypeAdjustment: 0,
    condoAdjustment: 0,
    fthbWaiver: 0,
    totalLLPA: 0,
    pricing: {
      loanAmount: 368_000,
      lLPAFeeAmount: 0,
      pmiAnnualRate: 0.78,
      pmiMonthlyPayment: MATRIX_MONTHLY_PMI,
    },
  })),
}));

const application = {
  id: "app-f077",
  purchasePrice: "400000",
  downPayment: "32000", // → $368k loan, 92% LTV — the register's worked example
  creditScore: 700,
  isVeteran: false,
  isFirstTimeBuyer: false,
  propertyType: "single_family",
  propertyState: "IL",
  loanPurpose: "purchase",
};

vi.mock("../server/storage", () => ({
  storage: {
    getLoanApplication: vi.fn(async () => application),
  },
}));

import { computePaymentProjection } from "../server/services/loanEstimate";

describe("payment projection MI comes from the CONVENTIONAL_PMI matrix (F-077)", () => {
  it("carries the matrix figure — not the hardcoded card that fed the decision", async () => {
    const projection = await computePaymentProjection("app-f077");

    expect(projection.monthlyMortgageInsurance).toBe(MATRIX_MONTHLY_PMI);

    // The card's figure for the same inputs was materially different — the
    // register's worked example: $429.33 vs $239.20 (+$190.13/mo, 2.38 DTI
    // points on $8k/mo income). loanCosts.calculatePMI was deleted when its
    // last caller (the scenario simulator) migrated to the matrix, so the
    // figure is pinned as a historical constant: 700 FICO × 92 LTV → the
    // card's 1.40%/yr band → $368k × 1.40% / 12 = $429.33. If the projection
    // ever equals it again, the defect is back.
    const DELETED_CARD_FIGURE = 429.33;
    expect(projection.monthlyMortgageInsurance).not.toBe(DELETED_CARD_FIGURE);

    // The PITI total composes from the same figure.
    expect(projection.estimatedMonthlyTotal).toBeCloseTo(
      projection.monthlyPrincipalAndInterest +
        projection.monthlyMortgageInsurance +
        projection.monthlyEscrow,
      2,
    );
  });

  it("keeps VA at zero MI through the VA pricing stub", async () => {
    const { storage } = await import("../server/storage");
    vi.mocked(storage.getLoanApplication).mockResolvedValueOnce({
      ...application,
      isVeteran: true,
      loanType: "va",
    } as never);

    const projection = await computePaymentProjection("app-f077");
    expect(projection.monthlyMortgageInsurance).toBe(0);
  });
});
