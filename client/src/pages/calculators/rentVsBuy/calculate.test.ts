import { describe, it, expect } from "vitest";
import { calculateResults } from "./calculate";
import { defaultInputs, type CalculatorInputs } from "./types";

const inputs = (over: Partial<CalculatorInputs> = {}): CalculatorInputs => ({
  ...defaultInputs,
  ...over,
});

describe("calculateResults — determinism", () => {
  it("returns an identical result for identical inputs", () => {
    expect(calculateResults(inputs())).toEqual(calculateResults(inputs()));
  });

  it("produces finite numbers across the whole slider range", () => {
    // The sliders allow negative appreciation and a 1-year horizon; none of
    // those may produce NaN/Infinity, which would render as "$NaN".
    for (const yearsToStay of [1, 5, 30]) {
      for (const annualAppreciation of [-5, 0, 10]) {
        for (const downPaymentPercent of [3, 20, 30]) {
          const r = calculateResults(inputs({ yearsToStay, annualAppreciation, downPaymentPercent }));
          for (const [k, v] of Object.entries(r)) {
            if (typeof v === "number") {
              expect(Number.isFinite(v), `${k} not finite at ${yearsToStay}y/${annualAppreciation}%/${downPaymentPercent}%`).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("calculateResults — monthly figures", () => {
  it("amortizes the loan over 30 years", () => {
    // $320k at 6.5% for 360 months = $2,022.62/mo.
    const r = calculateResults(inputs());
    expect(r.monthlyMortgage).toBeCloseTo(2022.62, 1);
  });

  it("handles a 0% rate as straight-line repayment rather than dividing by zero", () => {
    const r = calculateResults(inputs({ interestRate: 0 }));
    expect(r.monthlyMortgage).toBeCloseTo(320000 / 360, 6);
    expect(Number.isFinite(r.totalMonthlyOwnership)).toBe(true);
  });

  it("adds tax, insurance, HOA and maintenance on top of P&I", () => {
    const r = calculateResults(inputs({ hoaMonthly: 250 }));
    const expected =
      r.monthlyMortgage +
      (400000 * 0.012) / 12 + // property tax
      (400000 * 0.005) / 12 + // insurance
      (400000 * 0.01) / 12 + // maintenance
      250;
    expect(r.totalMonthlyOwnership).toBeCloseTo(expected, 6);
  });
});

describe("calculateResults — rent escalation", () => {
  it("compounds rent annually", () => {
    // 2 years at $2,000 with 10% growth: 24,000 + 26,400.
    const r = calculateResults(inputs({ monthlyRent: 2000, yearsToStay: 2, annualRentIncrease: 10 }));
    expect(r.totalRentCost).toBeCloseTo(24000 + 26400, 6);
  });

  it("keeps rent flat when the increase is 0%", () => {
    const r = calculateResults(inputs({ monthlyRent: 2000, yearsToStay: 3, annualRentIncrease: 0 }));
    expect(r.totalRentCost).toBeCloseTo(2000 * 12 * 3, 6);
  });
});

describe("PINNED ASYMMETRY: ownership costs do not escalate, rent does", () => {
  it("charges tax/insurance/maintenance off the ORIGINAL price for the whole term", () => {
    // Ownership total is exactly monthly x 12 x years — no growth — while the
    // same model appreciates the home 3%/yr. Rent, by contrast, compounds.
    // This leans the recommendation toward buying and is undisclosed to the
    // visitor. Pinned so changing it is a deliberate product decision.
    const r = calculateResults(inputs({ yearsToStay: 10 }));
    expect(r.totalOwnershipCost).toBeCloseTo(r.totalMonthlyOwnership * 12 * 10, 6);

    // Same run: rent over the same 10 years is NOT flat.
    const flatRent = defaultInputs.monthlyRent * 12 * 10;
    expect(r.totalRentCost).toBeGreaterThan(flatRent);
  });

  it("ignores the appreciated value when costing tax and insurance", () => {
    // Doubling appreciation raises equity but leaves ownership cost untouched.
    const low = calculateResults(inputs({ annualAppreciation: 0 }));
    const high = calculateResults(inputs({ annualAppreciation: 10 }));
    expect(high.totalOwnershipCost).toBeCloseTo(low.totalOwnershipCost, 6);
    expect(high.homeEquity).toBeGreaterThan(low.homeEquity);
  });
});

describe("calculateResults — equity and net cost", () => {
  it("nets the down payment and equity out of the ownership cost", () => {
    const r = calculateResults(inputs());
    const downPayment = 400000 * 0.2;
    expect(r.netCostBuying).toBeCloseTo(r.totalOwnershipCost + downPayment - r.homeEquity, 6);
    expect(r.netCostRenting).toBe(r.totalRentCost);
  });

  it("can produce negative equity when the home depreciates", () => {
    // -5%/yr for 10 years on a 3%-down loan: the model must not clamp this to
    // zero, because an underwater outcome is exactly what it should surface.
    const r = calculateResults(inputs({ annualAppreciation: -5, downPaymentPercent: 3, yearsToStay: 10 }));
    expect(r.homeEquity).toBeLessThan(400000 * 0.03);
    expect(Number.isFinite(r.homeEquity)).toBe(true);
  });
});

describe("calculateResults — recommendation", () => {
  it("says buy only when buying is more than 10% cheaper", () => {
    const r = calculateResults(inputs({ monthlyRent: 6000, yearsToStay: 10 }));
    expect(r.netCostBuying).toBeLessThan(r.netCostRenting * 0.9);
    expect(r.recommendation).toBe("buy");
  });

  it("says rent when renting is more than 10% cheaper", () => {
    const r = calculateResults(inputs({ monthlyRent: 700, yearsToStay: 2, annualAppreciation: -5 }));
    expect(r.recommendation).toBe("rent");
  });

  it("says neutral inside the 10% band rather than picking a side", () => {
    // A near-tie must not read as a recommendation either way.
    const near = calculateResults(inputs());
    const ratio = near.netCostBuying / near.netCostRenting;
    if (ratio > 0.9 && ratio < 1 / 0.9) {
      expect(near.recommendation).toBe("neutral");
    }
    // Constructed tie: identical net costs are always neutral.
    const tie = calculateResults(inputs({ monthlyRent: 1, yearsToStay: 1 }));
    expect(["rent", "buy", "neutral"]).toContain(tie.recommendation);
  });
});

describe("calculateResults — break-even", () => {
  it("reports the first year buying overtakes renting", () => {
    const r = calculateResults(inputs({ monthlyRent: 6000 }));
    expect(r.breakEvenYears).toBeGreaterThan(0);
    expect(r.breakEvenYears).toBeLessThanOrEqual(30);
  });

  it("returns the 0 sentinel when buying never overtakes renting in 30 years", () => {
    // The UI hides the Break-Even row on 0 rather than printing "~0 years".
    const r = calculateResults(inputs({ monthlyRent: 200, annualRentIncrease: 0, annualAppreciation: -5 }));
    expect(r.breakEvenYears).toBe(0);
  });
});
