import { describe, it, expect, vi } from "vitest";

// F-087: the wholesale pricing adapter charged a flat 0.6%/yr MI above 80 LTV
// on EVERY product — a VA offer showed MI that does not exist, an FHA offer
// below 80 LTV showed $0 while MIP is charged, and the matrix PMI that
// calculateLLPA had already resolved was discarded. These pin the
// product-aware routing. The matrix VALUES themselves are pinned by the
// integration suite (tests/pricingUnderwriting.test.ts) against seeded
// matrices; here calculateLLPA is mocked so the routing is hermetic.

const MATRIX_MONTHLY_PMI = 270; // 0.90%/yr on 360k / 12 — the 660-679 × 85-90 band

vi.mock("../server/pricing", () => ({
  calculateLLPA: vi.fn(async () => ({
    baseLLPA: 0.5,
    propertyTypeAdjustment: 0,
    condoAdjustment: 0,
    fthbWaiver: 0,
    totalLLPA: 0.5,
    pricing: {
      loanAmount: 360_000,
      lLPAFeeAmount: 1_800,
      pmiAnnualRate: 0.9,
      pmiMonthlyPayment: MATRIX_MONTHLY_PMI,
    },
  })),
}));

import { computeOffers, type BorrowerPricingProfile } from "../server/services/pricingAdapter";
import { fhaMonthlyMIP, offerMonthlyMI } from "../server/services/mortgageInsurance";
import type { IStorage } from "../server/storage";

const product = (id: string, productType: string) => ({
  id,
  productCode: `${productType}-30`,
  productName: `${productType} 30yr`,
  productType,
  loanTerm: 30,
  amortizationType: "fixed",
  baseRate: "6.500",
  lockTermAdjustments: null,
  lenderFees: null,
  eligibilityConstraints: null,
});

function stubStorage(products: ReturnType<typeof product>[]): IStorage {
  return {
    getActiveRateSheets: vi.fn(async () => [{ id: "sheet-1", lenderId: "lender-1" }]),
    getWholesaleLenders: vi.fn(async () => [
      {
        id: "lender-1",
        lenderId: "TL1",
        lenderName: "Test Lender",
        lenderCode: "TL1",
        approvalStatus: "target",
        isDemo: true,
        status: "ACTIVE",
      },
    ]),
    getRateSheetProducts: vi.fn(async () => products),
    getLenderPricingAdjustments: vi.fn(async () => []),
  } as unknown as IStorage;
}

// 90% LTV — above the conventional PMI trigger, below the FHA >95 tier.
const profile: BorrowerPricingProfile = {
  creditScore: 660,
  loanAmount: 360_000,
  propertyValue: 400_000,
};

describe("offer MI is product-aware (F-087)", () => {
  it("routes conventional to the matrix PMI, VA to zero, FHA to MIP — never the flat 0.6%", async () => {
    const offers = await computeOffers(
      stubStorage([
        product("p-conv", "CONVENTIONAL"),
        product("p-va", "VA"),
        product("p-fha", "FHA"),
      ]),
      profile,
    );
    const byType = Object.fromEntries(offers.map((o) => [o.productType, o]));

    // The reintroduced flat rate would be 360k × 0.6% / 12 = $180 on all three.
    const flat = (360_000 * 0.6) / 12 / 100;

    expect(byType.CONVENTIONAL.estimatedMonthlyMI).toBe(MATRIX_MONTHLY_PMI);
    expect(byType.CONVENTIONAL.estimatedMonthlyMI).not.toBe(flat);

    expect(byType.VA.estimatedMonthlyMI).toBe(0);

    const expectedMIP = Math.round(fhaMonthlyMIP(360_000, 90) * 100) / 100;
    expect(byType.FHA.estimatedMonthlyMI).toBe(expectedMIP);
    expect(expectedMIP).toBeGreaterThan(0);

    // MI participates in the payment totals that drive LOWEST_PAYMENT labels.
    for (const o of offers) {
      expect(o.estimatedMonthlyTotal).toBeCloseTo(o.estimatedMonthlyPI + o.estimatedMonthlyMI, 2);
    }
  });

  it("FHA carries MIP even below 80 LTV, where conventional carries none", () => {
    // Below the trigger the matrix figure is 0 by construction (lookupPMIRate
    // returns 0 under the high-LTV trigger) — the helper must not resurrect
    // it, and must still charge FHA MIP.
    expect(
      offerMonthlyMI({
        productType: "CONVENTIONAL",
        loanAmount: 300_000,
        ltvPct: 75,
        conventionalMonthlyPMI: 0,
      }),
    ).toBe(0);
    expect(
      offerMonthlyMI({
        productType: "FHA",
        loanAmount: 300_000,
        ltvPct: 75,
        conventionalMonthlyPMI: 0,
      }),
    ).toBeCloseTo((300_000 * 0.008) / 12, 6);
  });

  it("FHA MIP steps up above 95 LTV; VA and HELOC stay at zero everywhere", () => {
    expect(fhaMonthlyMIP(360_000, 96)).toBeCloseTo((360_000 * 0.0085) / 12, 6);
    expect(fhaMonthlyMIP(360_000, 95)).toBeCloseTo((360_000 * 0.008) / 12, 6);
    for (const productType of ["VA", "HELOC", "va"]) {
      expect(
        offerMonthlyMI({ productType, loanAmount: 500_000, ltvPct: 97, conventionalMonthlyPMI: 400 }),
      ).toBe(0);
    }
  });

  it("unrecognized product types default to the matrix figure, not to a constant", () => {
    expect(
      offerMonthlyMI({ productType: "JUMBO", loanAmount: 900_000, ltvPct: 88, conventionalMonthlyPMI: 512 }),
    ).toBe(512);
  });
});
