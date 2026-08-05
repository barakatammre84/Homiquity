import { describe, it, expect } from "vitest";
import {
  calculateAffordabilityForProperty,
  getBasisPrice,
  maxBackEndDtiFor,
} from "./affordability";
import type { FinancialInputs, PropertyData } from "./types";

// This math drives what a visitor is told about a specific home they are
// looking at. It had no coverage while it lived inline in the page component;
// these cases pin the behaviour that was extracted, so a later edit to the
// thresholds is a deliberate act rather than a silent one.

function propertyAt(price: number, over: Partial<PropertyData> = {}): PropertyData {
  return {
    propertyId: "p1",
    price,
    address: "1 Test St",
    city: "Springfield",
    state: "Illinois",
    stateCode: "IL",
    zipcode: "62701",
    beds: 3,
    baths: 2,
    sqft: 1800,
    yearBuilt: 1998,
    propertyType: "single_family",
    photo: null,
    photos: [],
    status: "for_sale",
    propertyTaxRate: 1.1,
    hoaMonthly: 0,
    mortgage: null,
    neighborhoods: [],
    ...over,
  };
}

const BASE_INPUTS: FinancialInputs = {
  annualIncome: 120000,
  monthlyDebts: 500,
  downPayment: 60000,
  creditScore: 700,
  interestRate: 6.75,
};

describe("getBasisPrice", () => {
  it("uses the list price when the home is on the market", () => {
    const property = propertyAt(400000, { valueEstimate: { value: 380000, low: null, high: null, date: null, source: null, sources: [] } });
    expect(getBasisPrice(property)).toBe(400000);
  });

  it("falls back to the AVM estimate for an off-market home with no list price", () => {
    const property = propertyAt(0, { valueEstimate: { value: 380000, low: null, high: null, date: null, source: null, sources: [] } });
    expect(getBasisPrice(property)).toBe(380000);
  });

  it("is 0 when there is neither a price nor an estimate", () => {
    expect(getBasisPrice(propertyAt(0))).toBe(0);
  });
});

describe("maxBackEndDtiFor", () => {
  it("tiers the back-end ceiling by credit score", () => {
    expect(maxBackEndDtiFor(740)).toBe(45);
    expect(maxBackEndDtiFor(800)).toBe(45);
    expect(maxBackEndDtiFor(700)).toBe(43);
    expect(maxBackEndDtiFor(739)).toBe(43);
    expect(maxBackEndDtiFor(699)).toBe(41);
    expect(maxBackEndDtiFor(580)).toBe(41);
  });
});

describe("calculateAffordabilityForProperty", () => {
  it("is deterministic — identical inputs give an identical result", () => {
    const property = propertyAt(400000);
    const a = calculateAffordabilityForProperty(property, BASE_INPUTS);
    const b = calculateAffordabilityForProperty(property, { ...BASE_INPUTS });
    expect(a).toEqual(b);
  });

  it("returns a zeroed, non-throwing result when there is no price to work from", () => {
    // The page renders this result; NaN or a divide-by-zero would surface as
    // "$NaN/mo" rather than an empty state.
    const result = calculateAffordabilityForProperty(propertyAt(0), BASE_INPUTS);
    expect(result.monthlyPayment).toBe(0);
    expect(result.loanAmount).toBe(0);
    expect(result.status).toBe("affordable");
    expect(result.maxBackEndDTI).toBe(43);
  });

  it("amortizes principal and interest over 30 years", () => {
    // $340k at 6.75% for 360 months = $2,205.23/mo by the standard formula.
    const result = calculateAffordabilityForProperty(propertyAt(400000), BASE_INPUTS);
    expect(result.loanAmount).toBe(340000);
    expect(result.principalInterest).toBeCloseTo(2205.23, 1);
  });

  it("handles a 0% rate as straight-line repayment instead of dividing by zero", () => {
    const result = calculateAffordabilityForProperty(propertyAt(360000), {
      ...BASE_INPUTS,
      downPayment: 0,
      interestRate: 0,
    });
    expect(result.principalInterest).toBe(1000);
    expect(Number.isFinite(result.monthlyPayment)).toBe(true);
  });

  it("charges PMI below 20% down and drops it at 20%", () => {
    const property = propertyAt(400000);
    const under = calculateAffordabilityForProperty(property, { ...BASE_INPUTS, downPayment: 60000 });
    const at = calculateAffordabilityForProperty(property, { ...BASE_INPUTS, downPayment: 80000 });
    expect(under.downPaymentPercent).toBe(15);
    expect(under.monthlyPMI).toBeCloseTo((340000 * 0.005) / 12, 6);
    expect(at.downPaymentPercent).toBe(20);
    expect(at.monthlyPMI).toBe(0);
  });

  it("caps the down payment at half the price", () => {
    const result = calculateAffordabilityForProperty(propertyAt(400000), {
      ...BASE_INPUTS,
      downPayment: 350000,
    });
    expect(result.downPaymentPercent).toBe(50);
    expect(result.loanAmount).toBe(200000);
  });

  it("adds taxes, insurance and HOA on top of P&I", () => {
    const property = propertyAt(400000, { propertyTaxRate: 1.2, hoaMonthly: 250 });
    const result = calculateAffordabilityForProperty(property, BASE_INPUTS);
    expect(result.monthlyTax).toBeCloseTo(400, 6);
    expect(result.monthlyInsurance).toBeCloseTo((400000 * 0.005) / 12, 6);
    expect(result.monthlyHOA).toBe(250);
    expect(result.monthlyPayment).toBeCloseTo(
      result.principalInterest + result.monthlyTax + result.monthlyInsurance + result.monthlyPMI + 250,
      6,
    );
  });

  it("treats a debt load it cannot measure as failing, not passing", () => {
    // No income means DTI is unknowable. Reporting 0% (and therefore
    // "Within Your Budget") would be the dangerous direction to fail in.
    const result = calculateAffordabilityForProperty(propertyAt(400000), {
      ...BASE_INPUTS,
      annualIncome: 0,
    });
    expect(result.frontEndDTI).toBe(100);
    expect(result.backEndDTI).toBe(100);
    expect(result.status).toBe("over_budget");
  });

  it("grades affordable / stretch / over_budget off the DTI thresholds", () => {
    const property = propertyAt(300000, { propertyTaxRate: 1.0 });

    const comfortable = calculateAffordabilityForProperty(property, {
      ...BASE_INPUTS,
      annualIncome: 220000,
      monthlyDebts: 200,
      downPayment: 60000,
    });
    expect(comfortable.status).toBe("affordable");

    const tight = calculateAffordabilityForProperty(property, {
      ...BASE_INPUTS,
      annualIncome: 60000,
      monthlyDebts: 1500,
      downPayment: 15000,
    });
    expect(tight.status).toBe("over_budget");
  });

  it("lets a stronger credit score change the verdict at the same payment", () => {
    // Same home, same money — only the back-end ceiling moves (43 -> 45).
    // Tuned so back-end DTI lands at ~44.2%: over the 700-tier ceiling, under
    // the 740-tier one, with front-end at ~24.8% so it triggers nothing.
    const property = propertyAt(340000, { propertyTaxRate: 1.1 });
    const inputs = { ...BASE_INPUTS, annualIncome: 124000, monthlyDebts: 2000, downPayment: 34000 };

    const lowerTier = calculateAffordabilityForProperty(property, { ...inputs, creditScore: 700 });
    const higherTier = calculateAffordabilityForProperty(property, { ...inputs, creditScore: 740 });

    expect(lowerTier.monthlyPayment).toBeCloseTo(higherTier.monthlyPayment, 6);
    expect(lowerTier.maxBackEndDTI).toBe(43);
    expect(higherTier.maxBackEndDTI).toBe(45);
    expect(lowerTier.backEndDTI).toBeGreaterThan(43);
    expect(lowerTier.backEndDTI).toBeLessThanOrEqual(45);
    expect(lowerTier.status).toBe("over_budget");
    expect(higherTier.status).not.toBe("over_budget");
  });
});
