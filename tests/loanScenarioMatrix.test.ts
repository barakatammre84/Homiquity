import { describe, it, expect } from "vitest";
import { buildScenarios, type ScenarioInputs } from "../server/services/loanAnalysis";

// Guards the transparency contract behind the loan comparison matrix:
// monthlyPayment must be the full PITI sum of its displayed parts (no hidden
// math), the amortization must follow the standard compound-interest model,
// and the 15-year scenario must show the equity-velocity trade-off honestly.

const BASE: ScenarioInputs = {
  purchasePrice: 400000,
  downPayment: 80000, // 20% — keeps conventional PMI out of the baseline
  loanAmount: 320000,
  creditScore: 760,
  isVeteran: false,
  isFirstTimeBuyer: false,
  enginePmiMonthly: null,
};

const num = (v: string) => parseFloat(v);

function standardPI(principal: number, annualRatePct: number, n: number): number {
  const r = annualRatePct / 100 / 12;
  return (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
}

describe("buildScenarios — comparison matrix contract", () => {
  it("includes a 15-year conventional scenario alongside the 30-year options", () => {
    const scenarios = buildScenarios(BASE);
    const terms = scenarios.filter((s) => s.loanType === "conventional").map((s) => s.loanTerm);
    expect(terms).toContain(30);
    expect(terms).toContain(15);
  });

  it("prices the 15-year term 0.50% below the 30-year base rate", () => {
    const scenarios = buildScenarios(BASE);
    const thirty = scenarios.find((s) => s.loanTerm === 30 && s.points === "0")!;
    const fifteen = scenarios.find((s) => s.loanTerm === 15)!;
    expect(num(thirty.interestRate) - num(fifteen.interestRate)).toBeCloseTo(0.5, 6);
  });

  it("computes P&I with the standard amortization formula for both terms", () => {
    const scenarios = buildScenarios(BASE);
    for (const s of scenarios.filter((x) => x.loanType === "conventional")) {
      const expected = standardPI(num(s.loanAmount), num(s.interestRate), s.loanTerm * 12);
      expect(num(s.principalAndInterest)).toBeCloseTo(expected, 1);
    }
  });

  it("shows the 15-year trade-off: higher payment, less lifetime interest", () => {
    const scenarios = buildScenarios(BASE);
    const thirty = scenarios.find((s) => s.loanTerm === 30 && s.points === "0")!;
    const fifteen = scenarios.find((s) => s.loanTerm === 15)!;
    expect(num(fifteen.principalAndInterest)).toBeGreaterThan(num(thirty.principalAndInterest));
    expect(num(fifteen.totalInterestPaid)).toBeLessThan(num(thirty.totalInterestPaid));
  });

  it("monthlyPayment equals the sum of its displayed PITI parts — no hidden math", () => {
    // Include a low-down variant so the PMI component is exercised too.
    const lowDown: ScenarioInputs = {
      ...BASE,
      downPayment: 20000,
      loanAmount: 380000,
      creditScore: 680,
      isFirstTimeBuyer: true,
    };
    for (const inputs of [BASE, lowDown]) {
      for (const s of buildScenarios(inputs)) {
        const parts =
          num(s.principalAndInterest) + num(s.propertyTax) + num(s.homeInsurance) + num(s.pmi);
        expect(num(s.monthlyPayment)).toBeCloseTo(parts, 1);
      }
    }
  });

  it("keeps APR at or above the note rate on every scenario", () => {
    for (const s of buildScenarios(BASE)) {
      expect(num(s.apr)).toBeGreaterThanOrEqual(num(s.interestRate));
    }
  });
});
