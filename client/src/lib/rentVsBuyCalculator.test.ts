import { describe, expect, it } from "vitest";
import { calculateRentVsBuyResults, rentVsBuyDefaultInputs } from "./rentVsBuyCalculator";

describe("calculateRentVsBuyResults", () => {
  it("pins current output for the default inputs", () => {
    const results = calculateRentVsBuyResults(rentVsBuyDefaultInputs);

    expect(results.monthlyMortgage).toBeCloseTo(2022.6176751774892, 6);
    expect(results.totalMonthlyOwnership).toBeCloseTo(2922.617675177489, 6);
    expect(results.totalRentCost).toBeCloseTo(127419.25944000001, 5);
    expect(results.totalOwnershipCost).toBeCloseTo(175357.06051064935, 6);
    expect(results.homeEquity).toBeCloseTo(164154.5019069956, 6);
    expect(results.netCostRenting).toBeCloseTo(127419.25944000001, 5);
    expect(results.netCostBuying).toBeCloseTo(91202.55860365374, 6);
    expect(results.breakEvenYears).toBe(1);
    expect(results.recommendation).toBe("buy");
  });

  it("recommends renting when ownership cost dominates", () => {
    const results = calculateRentVsBuyResults({
      ...rentVsBuyDefaultInputs,
      monthlyRent: 500,
      homePrice: 900000,
      downPaymentPercent: 5,
      interestRate: 8,
      annualAppreciation: 0,
    });

    expect(results.recommendation).toBe("rent");
  });
});
