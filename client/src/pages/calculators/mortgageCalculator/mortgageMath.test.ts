import { describe, it, expect } from "vitest";
import {
  calculateMortgage,
  defaultInputs,
  paymentBreakdown,
  type MortgageInputs,
} from "./mortgageMath";

const inputs = (over: Partial<MortgageInputs> = {}): MortgageInputs => ({ ...defaultInputs, ...over });

describe("calculateMortgage — the payment", () => {
  it("computes the standard amortized P&I", () => {
    // $400k at 20% down = $320k; 6.5% over 360 months = $2,022.62.
    const r = calculateMortgage(inputs());
    expect(r.loanAmount).toBe(320000);
    expect(r.downPayment).toBe(80000);
    expect(r.monthlyPrincipalInterest).toBeCloseTo(2022.62, 1);
  });

  it("divides evenly at 0% rather than dividing by zero", () => {
    const r = calculateMortgage(inputs({ interestRate: 0 }));
    expect(r.monthlyPrincipalInterest).toBeCloseTo(320000 / 360, 6);
    expect(Number.isFinite(r.totalInterestPaid)).toBe(true);
  });

  it("prorates tax and insurance off the home price, not the loan", () => {
    // Both are property charges — they do not shrink with a bigger down payment.
    const small = calculateMortgage(inputs({ downPaymentPercent: 5 }));
    const large = calculateMortgage(inputs({ downPaymentPercent: 50 }));
    expect(small.monthlyPropertyTax).toBeCloseTo(large.monthlyPropertyTax, 9);
    expect(small.monthlyPropertyTax).toBeCloseTo((400000 * 0.012) / 12, 6);
    expect(small.monthlyInsurance).toBeCloseTo((400000 * 0.005) / 12, 6);
  });

  it("sums the five components into the total payment", () => {
    const r = calculateMortgage(inputs({ downPaymentPercent: 10, hoaMonthly: 250 }));
    expect(r.totalMonthlyPayment).toBeCloseTo(
      r.monthlyPrincipalInterest + r.monthlyPropertyTax + r.monthlyInsurance + r.monthlyPMI + r.monthlyHOA,
      9,
    );
  });

  it("passes HOA straight through", () => {
    expect(calculateMortgage(inputs({ hoaMonthly: 375 })).monthlyHOA).toBe(375);
  });
});

describe("calculateMortgage — PMI", () => {
  it("charges PMI below 20% down and not at or above it", () => {
    expect(calculateMortgage(inputs({ downPaymentPercent: 19.99 })).monthlyPMI).toBeGreaterThan(0);
    expect(calculateMortgage(inputs({ downPaymentPercent: 20 })).monthlyPMI).toBe(0);
    expect(calculateMortgage(inputs({ downPaymentPercent: 21 })).monthlyPMI).toBe(0);
  });

  it("charges PMI on the loan amount, so it shrinks as the down payment grows", () => {
    const five = calculateMortgage(inputs({ downPaymentPercent: 5 }));
    const fifteen = calculateMortgage(inputs({ downPaymentPercent: 15 }));
    expect(five.monthlyPMI).toBeCloseTo((five.loanAmount * 0.005) / 12, 9);
    expect(fifteen.monthlyPMI).toBeLessThan(five.monthlyPMI);
  });

  it("PINNED: PMI never drops off — it is a snapshot, not a schedule", () => {
    // A real loan sheds PMI as the balance amortizes past 80% LTV. This
    // calculator has no notion of time passing, so the same PMI is charged in
    // year 30 as in year 1. Documented at the top of mortgageMath.ts; the test
    // exists so the limitation stays visible rather than being mistaken for a
    // full cost projection.
    const r = calculateMortgage(inputs({ downPaymentPercent: 5, loanTermYears: 30 }));
    expect(r.monthlyPMI).toBeGreaterThan(0);
    // ...and it is excluded from the loan totals entirely.
    expect(r.totalCostOfLoan).toBeCloseTo(r.monthlyPrincipalInterest * 360, 6);
  });
});

describe("calculateMortgage — loan totals", () => {
  it("totalCostOfLoan is P&I times the term, and interest is that less principal", () => {
    const r = calculateMortgage(inputs());
    expect(r.totalCostOfLoan).toBeCloseTo(r.monthlyPrincipalInterest * 360, 6);
    expect(r.totalInterestPaid).toBeCloseTo(r.totalCostOfLoan - r.loanAmount, 6);
  });

  it("a shorter term costs less interest despite a higher payment", () => {
    const thirty = calculateMortgage(inputs({ loanTermYears: 30 }));
    const fifteen = calculateMortgage(inputs({ loanTermYears: 15 }));
    expect(fifteen.monthlyPrincipalInterest).toBeGreaterThan(thirty.monthlyPrincipalInterest);
    expect(fifteen.totalInterestPaid).toBeLessThan(thirty.totalInterestPaid);
  });
});

describe("calculateMortgage — amortization schedule", () => {
  it("emits one row per year of the term", () => {
    expect(calculateMortgage(inputs({ loanTermYears: 30 })).amortizationSchedule).toHaveLength(30);
    expect(calculateMortgage(inputs({ loanTermYears: 15 })).amortizationSchedule).toHaveLength(15);
  });

  it("retires the balance to zero by the final year", () => {
    const schedule = calculateMortgage(inputs()).amortizationSchedule;
    expect(schedule[schedule.length - 1].balance).toBeLessThan(1);
  });

  it("shifts from interest-heavy to principal-heavy across the term", () => {
    const schedule = calculateMortgage(inputs()).amortizationSchedule;
    expect(schedule[0].interest).toBeGreaterThan(schedule[0].principal);
    const last = schedule[schedule.length - 1];
    expect(last.principal).toBeGreaterThan(last.interest);
  });

  it("never reports a negative balance", () => {
    for (const loanTermYears of [15, 20, 30]) {
      for (const row of calculateMortgage(inputs({ loanTermYears })).amortizationSchedule) {
        expect(row.balance, `${loanTermYears}y year ${row.year}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("yearly principal sums to the loan amount", () => {
    const schedule = calculateMortgage(inputs()).amortizationSchedule;
    expect(schedule.reduce((s, y) => s + y.principal, 0)).toBeCloseTo(320000, 2);
  });

  it("is deterministic", () => {
    expect(calculateMortgage(inputs())).toEqual(calculateMortgage(inputs()));
  });
});

describe("paymentBreakdown", () => {
  it("drops zero components so the legend never lists a charge that isn't there", () => {
    // Default: 20% down (no PMI) and no HOA — both must be absent, not $0 rows.
    const labels = paymentBreakdown(calculateMortgage(inputs())).map(s => s.label);
    expect(labels).toEqual(["Principal & Interest", "Property Tax", "Insurance"]);
  });

  it("includes PMI and HOA once they apply", () => {
    const labels = paymentBreakdown(calculateMortgage(inputs({ downPaymentPercent: 5, hoaMonthly: 100 }))).map(s => s.label);
    expect(labels).toEqual(["Principal & Interest", "Property Tax", "Insurance", "PMI", "HOA"]);
  });

  it("emits no zero-width bar segments", () => {
    // The stacked bar sizes each segment as a percentage of the total; a zero
    // component would render an invisible div and a dead legend row.
    for (const slice of paymentBreakdown(calculateMortgage(inputs({ hoaMonthly: 0 })))) {
      expect(slice.value, slice.label).toBeGreaterThan(0);
    }
  });

  it("slices sum to the total monthly payment", () => {
    const r = calculateMortgage(inputs({ downPaymentPercent: 10, hoaMonthly: 200 }));
    const sum = paymentBreakdown(r).reduce((s, x) => s + x.value, 0);
    expect(sum).toBeCloseTo(r.totalMonthlyPayment, 9);
  });

  it("gives every slice a distinct colour token", () => {
    const colors = paymentBreakdown(calculateMortgage(inputs({ downPaymentPercent: 5, hoaMonthly: 100 }))).map(s => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
