import { describe, it, expect } from "vitest";
import {
  toBorrowerOfferViews,
  productLabelFor,
  optionLetter,
  type MaskableOffer,
} from "@shared/borrowerOfferView";

/**
 * Borrower transparency doctrine (2026-07-08): wholesale-lender identity must
 * never reach a borrower payload. These tests pin the masking mapper behind
 * GET /api/loan-applications/:id/offers for client-role callers.
 */

function makeOffer(overrides: Partial<MaskableOffer> = {}): MaskableOffer {
  return {
    lenderName: "Summit Wholesale Lending",
    lenderCode: "SWL",
    productType: "CONVENTIONAL",
    loanTerm: 360,
    amortizationType: "FIXED",
    adjustedRate: 6.625,
    lockTerm: 30,
    pricingBreakdown: {
      baseRate: 6.5,
      llpaAdjustment: 0.125,
      lockTermAdjustment: 0,
      lenderAdjustments: [{ name: "FICO 620-659 with LTV > 80%", value: 0.375 }],
      totalAdjustments: 0.5,
      finalRate: 6.625,
    },
    estimatedMonthlyPI: 2724.12,
    estimatedMonthlyMI: 0,
    estimatedMonthlyTotal: 2724.12,
    labels: ["LOWEST_RATE"],
    ...overrides,
  };
}

describe("toBorrowerOfferViews", () => {
  it("emits no lender identity fields — strict whitelist, not field deletion", () => {
    const views = toBorrowerOfferViews([makeOffer()]);
    expect(views).toHaveLength(1);
    const view = views[0] as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty("lenderName");
    expect(view).not.toHaveProperty("lenderCode");
    expect(view).not.toHaveProperty("lenderId");
    expect(view).not.toHaveProperty("productId");
    expect(view).not.toHaveProperty("productCode");
    expect(view).not.toHaveProperty("productName");
    expect(view).not.toHaveProperty("lenderFees");
    expect(view).not.toHaveProperty("eligibilityConstraints");
  });

  it("never serializes the lender's name or code anywhere in the payload", () => {
    // Worst case: vendor free text embeds the lender brand in the product
    // name AND the adjustment names.
    const branded = makeOffer({
      lenderName: "United Wholesale Mortgage",
      lenderCode: "UWM",
      pricingBreakdown: {
        baseRate: 6.5,
        llpaAdjustment: 0.125,
        lockTermAdjustment: 0,
        lenderAdjustments: [
          { name: "United Wholesale Mortgage preferred-partner credit", value: -0.125 },
          { name: "UWM overlay: FICO below 640", value: 0.5 },
        ],
        totalAdjustments: 0.5,
        finalRate: 6.625,
      },
    });
    const serialized = JSON.stringify(toBorrowerOfferViews([branded]));
    expect(serialized).not.toMatch(/United Wholesale/i);
    expect(serialized).not.toMatch(/UWM/);
  });

  it("keeps the pricing decomposition intact for the 'Why this rate?' panel", () => {
    const [view] = toBorrowerOfferViews([makeOffer()]);
    expect(view.adjustedRate).toBe(6.625);
    expect(view.pricingBreakdown.baseRate).toBe(6.5);
    expect(view.pricingBreakdown.llpaAdjustment).toBe(0.125);
    expect(view.pricingBreakdown.finalRate).toBe(6.625);
    expect(view.pricingBreakdown.lenderAdjustments).toEqual([
      { name: "FICO 620-659 with LTV > 80%", value: 0.375 },
    ]);
    expect(view.estimatedMonthlyTotal).toBe(2724.12);
    expect(view.labels).toEqual(["LOWEST_RATE"]);
    expect(view.lockTerm).toBe(30);
  });

  it("labels options sequentially in the given (rate-sorted) order", () => {
    const views = toBorrowerOfferViews([
      makeOffer({ adjustedRate: 6.1 }),
      makeOffer({ adjustedRate: 6.2 }),
      makeOffer({ adjustedRate: 6.3 }),
    ]);
    expect(views.map((v) => v.optionId)).toEqual(["A", "B", "C"]);
    expect(views.map((v) => v.optionLabel)).toEqual(["Option A", "Option B", "Option C"]);
  });

  it("scrubs the lender's identifiers from free-text adjustment names only when present", () => {
    const [view] = toBorrowerOfferViews([
      makeOffer({
        pricingBreakdown: {
          baseRate: 6.5,
          llpaAdjustment: 0,
          lockTermAdjustment: 0,
          lenderAdjustments: [
            { name: "Summit Wholesale Lending investor overlay", value: 0.25 },
            { name: "swl rate special", value: -0.125 },
          ],
          totalAdjustments: 0.125,
          finalRate: 6.625,
        },
      }),
    ]);
    expect(view.pricingBreakdown.lenderAdjustments[0].name).toBe("Lender investor overlay");
    expect(view.pricingBreakdown.lenderAdjustments[1].name).toBe("Lender rate special");
  });

  it("does not mangle adjustment names when a lender code is degenerately short", () => {
    const [view] = toBorrowerOfferViews([
      makeOffer({
        lenderCode: "VA",
        pricingBreakdown: {
          baseRate: 6.5,
          llpaAdjustment: 0,
          lockTermAdjustment: 0,
          lenderAdjustments: [{ name: "VA funding-fee financed", value: 0 }],
          totalAdjustments: 0,
          finalRate: 6.5,
        },
      }),
    ]);
    expect(view.pricingBreakdown.lenderAdjustments[0].name).toBe("VA funding-fee financed");
  });
});

describe("productLabelFor", () => {
  it("derives neutral labels from typed columns, never vendor free text", () => {
    expect(productLabelFor({ productType: "CONVENTIONAL", loanTerm: 360, amortizationType: "FIXED" }))
      .toBe("30-Year Fixed Conventional");
    expect(productLabelFor({ productType: "CONVENTIONAL", loanTerm: 180, amortizationType: null }))
      .toBe("15-Year Fixed Conventional");
    expect(productLabelFor({ productType: "FHA", loanTerm: 360, amortizationType: "FIXED" }))
      .toBe("30-Year Fixed FHA");
    expect(productLabelFor({ productType: "VA", loanTerm: 360, amortizationType: null }))
      .toBe("30-Year Fixed VA");
    expect(productLabelFor({ productType: "JUMBO", loanTerm: 360, amortizationType: null }))
      .toBe("30-Year Fixed Jumbo");
  });

  it("labels ARMs by amortization type or product type", () => {
    expect(productLabelFor({ productType: "ARM", loanTerm: 360, amortizationType: "ARM" }))
      .toBe("30-Year Adjustable-Rate (ARM)");
    expect(productLabelFor({ productType: "CONVENTIONAL", loanTerm: 360, amortizationType: "ARM" }))
      .toBe("30-Year Adjustable-Rate (ARM)");
  });

  it("falls back gracefully for unknown types and odd terms", () => {
    expect(productLabelFor({ productType: "NON_QM", loanTerm: 360, amortizationType: null }))
      .toBe("30-Year Fixed Non-QM");
    expect(productLabelFor({ productType: "BANK_STATEMENT", loanTerm: 360, amortizationType: null }))
      .toBe("30-Year Fixed Bank Statement");
    expect(productLabelFor({ productType: "CONVENTIONAL", loanTerm: 100, amortizationType: null }))
      .toBe("100-Month Fixed Conventional");
  });
});

describe("optionLetter", () => {
  it("follows spreadsheet-column lettering past Z", () => {
    expect(optionLetter(0)).toBe("A");
    expect(optionLetter(25)).toBe("Z");
    expect(optionLetter(26)).toBe("AA");
    expect(optionLetter(27)).toBe("AB");
  });
});
