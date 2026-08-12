import { describe, it, expect } from "vitest";
import { calculateResults, defaultInputs, type CalculatorInputs } from "./rentVsBuyEstimate";

// Characterization tests (refactor-radar RR-012): pin calculateResults' current
// output before it moves out of the page component, so the extraction can be
// proven behavior-preserving to the cent.

const shortStayRentWins: CalculatorInputs = {
  monthlyRent: 1800,
  homePrice: 550000,
  downPaymentPercent: 10,
  interestRate: 7.25,
  propertyTaxRate: 1.5,
  insuranceRate: 0.6,
  hoaMonthly: 250,
  maintenanceRate: 1.2,
  yearsToStay: 2,
  annualRentIncrease: 2,
  annualAppreciation: 1.5,
};

describe("calculateResults (rent vs. buy)", () => {
  it("matches the pinned output for defaultInputs — buy wins over 5 years", () => {
    const results = calculateResults(defaultInputs);
    expect(results.recommendation).toBe("buy");
    expect(results.breakEvenYears).toBe(1);
    expect(results.monthlyMortgage).toBeCloseTo(2022.6176751774892, 6);
    expect(results.totalMonthlyOwnership).toBeCloseTo(2922.617675177489, 6);
    expect(results.totalRentCost).toBeCloseTo(127419.25944000001, 6);
    expect(results.totalOwnershipCost).toBeCloseTo(175357.06051064935, 6);
    expect(results.homeEquity).toBeCloseTo(164154.5019069956, 6);
    expect(results.netCostRenting).toBeCloseTo(127419.25944000001, 6);
    expect(results.netCostBuying).toBeCloseTo(91202.55860365374, 6);
  });

  it("matches the pinned output for a short-stay, high-HOA scenario — rent wins", () => {
    const results = calculateResults(shortStayRentWins);
    expect(results.recommendation).toBe("rent");
    expect(results.breakEvenYears).toBe(0);
    expect(results.monthlyMortgage).toBeCloseTo(3376.7725862781413, 6);
    expect(results.totalMonthlyOwnership).toBeCloseTo(5139.272586278141, 6);
    expect(results.totalRentCost).toBeCloseTo(43632, 6);
    expect(results.totalOwnershipCost).toBeCloseTo(123342.54207067538, 6);
    expect(results.homeEquity).toBeCloseTo(81564.64874483546, 6);
    expect(results.netCostRenting).toBeCloseTo(43632, 6);
    expect(results.netCostBuying).toBeCloseTo(96777.89332583992, 6);
  });
});
