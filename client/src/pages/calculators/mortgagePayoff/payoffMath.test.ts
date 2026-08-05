import { describe, it, expect } from "vitest";
import {
  calculate,
  defaultInputs,
  monthlyPI,
  payoffProgressPercent,
  simulate,
  MAX_SIMULATED_MONTHS,
  type PayoffInputs,
} from "./payoffMath";

const inputs = (over: Partial<PayoffInputs> = {}): PayoffInputs => ({ ...defaultInputs, ...over });

describe("monthlyPI", () => {
  it("computes the standard payment", () => {
    expect(monthlyPI(320000, 6.5, 360)).toBeCloseTo(2022.62, 1);
  });

  it("divides evenly at 0%", () => {
    expect(monthlyPI(360000, 0, 360)).toBe(1000);
  });

  it("is 0 for a non-loan rather than NaN", () => {
    expect(monthlyPI(0, 6.5, 360)).toBe(0);
    expect(monthlyPI(-1, 6.5, 360)).toBe(0);
    expect(monthlyPI(280000, 6.5, 0)).toBe(0);
  });
});

describe("simulate", () => {
  it("pays off a scheduled loan in exactly its term", () => {
    const pay = monthlyPI(280000, 6.5, 324);
    expect(simulate(280000, 6.5, pay, 0, 0, false).months).toBe(324);
  });

  it("returns Infinity when the payment never covers the interest", () => {
    // $1/mo against $280k at 6.5% — the balance grows every month. A finite
    // month count here would promise a payoff date that never arrives.
    const never = simulate(280000, 6.5, 1, 0, 0, false);
    expect(never.months).toBe(Infinity);
    expect(never.interest).toBe(Infinity);
  });

  it("caps iteration so a pathological input cannot hang the page", () => {
    const interestOnly = 280000 * (6.5 / 100 / 12);
    const crawl = simulate(280000, 6.5, interestOnly + 1, 0, 0, false);
    expect(crawl.months).toBeLessThanOrEqual(MAX_SIMULATED_MONTHS);
  });

  it("applies the one-time extra once, in the first month only", () => {
    const pay = monthlyPI(280000, 6.5, 324);
    const lump = simulate(280000, 6.5, pay, 0, 20000, false);
    const recurring = simulate(280000, 6.5, pay, 20000, 0, false);
    expect(lump.months).toBeLessThan(324);
    // A $20k lump sum must not shorten the loan as much as $20k every month.
    expect(lump.months).toBeGreaterThan(recurring.months);
  });

  it("spreads the biweekly extra as one extra payment a year", () => {
    const pay = monthlyPI(280000, 6.5, 324);
    const bi = simulate(280000, 6.5, pay, 0, 0, true);
    const equivalent = simulate(280000, 6.5, pay, pay / 12, 0, false);
    expect(bi.months).toBe(equivalent.months);
    expect(bi.interest).toBeCloseTo(equivalent.interest, 6);
  });

  it("shortens the term as the extra payment rises", () => {
    const pay = monthlyPI(280000, 6.5, 324);
    const none = simulate(280000, 6.5, pay, 0, 0, false).months;
    const some = simulate(280000, 6.5, pay, 200, 0, false).months;
    const lots = simulate(280000, 6.5, pay, 2000, 0, false).months;
    expect(some).toBeLessThan(none);
    expect(lots).toBeLessThan(some);
  });

  it("never overpays the final month", () => {
    // The last principal payment is clamped to the remaining balance, so the
    // simulation cannot drive the balance negative and over-count interest.
    const pay = monthlyPI(280000, 6.5, 324);
    expect(simulate(280000, 6.5, pay, 5000, 0, false).interest).toBeGreaterThan(0);
  });
});

describe("calculate", () => {
  it("is deterministic", () => {
    expect(calculate(inputs())).toEqual(calculate(inputs()));
  });

  it("reports no saving when no strategy is applied", () => {
    const r = calculate(inputs({ extraMonthly: 0, oneTimeExtra: 0, biweekly: false }));
    expect(r.monthsSaved).toBe(0);
    expect(r.interestSaved).toBe(0);
    expect(r.acceleratedMonths).toBe(r.baselineMonths);
  });

  it("saves both time and interest when paying extra", () => {
    const r = calculate(inputs({ extraMonthly: 400 }));
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.acceleratedInterest).toBeLessThan(r.baselineInterest);
  });

  it("never reports a negative saving", () => {
    // Both figures are clamped at 0, so a non-accelerating strategy reads as
    // "no saving" rather than "you saved -3 months".
    for (const extraMonthly of [0, 1, 50, 100000]) {
      const r = calculate(inputs({ extraMonthly }));
      expect(r.monthsSaved, String(extraMonthly)).toBeGreaterThanOrEqual(0);
      expect(r.interestSaved, String(extraMonthly)).toBeGreaterThanOrEqual(0);
    }
  });

  it("stacks the three strategies", () => {
    const one = calculate(inputs({ extraMonthly: 200, oneTimeExtra: 0, biweekly: false })).monthsSaved;
    const all = calculate(inputs({ extraMonthly: 200, oneTimeExtra: 10000, biweekly: true })).monthsSaved;
    expect(all).toBeGreaterThan(one);
  });

  it("falls back to finite figures when nothing ever amortizes", () => {
    // A zero balance yields a zero base payment, so both simulations come back
    // Infinity. The result must still be numbers the page can render.
    const r = calculate(inputs({ currentBalance: 0, extraMonthly: 0 }));
    expect(Number.isFinite(r.baselineMonths)).toBe(true);
    expect(Number.isFinite(r.acceleratedMonths)).toBe(true);
    expect(Number.isFinite(r.baselineInterest)).toBe(true);
    expect(Number.isFinite(r.interestSaved)).toBe(true);
  });

  it("rounds a fractional remaining term to whole months, floor of one", () => {
    expect(calculate(inputs({ remainingTermYears: 0 })).baselineMonths).toBeGreaterThanOrEqual(1);
  });

  it("handles a 0% loan", () => {
    const r = calculate(inputs({ interestRate: 0, extraMonthly: 0 }));
    expect(r.baselineInterest).toBeCloseTo(0, 6);
    expect(r.baselineMonths).toBe(324);
  });
});

describe("payoffProgressPercent", () => {
  it("is 100% when the strategy changes nothing", () => {
    expect(payoffProgressPercent(calculate(inputs({ extraMonthly: 0 })))).toBe(100);
  });

  it("shrinks as the payoff accelerates", () => {
    const modest = payoffProgressPercent(calculate(inputs({ extraMonthly: 200 })));
    const aggressive = payoffProgressPercent(calculate(inputs({ extraMonthly: 2000 })));
    expect(modest).toBeLessThan(100);
    expect(aggressive).toBeLessThan(modest);
  });

  it("never exceeds 100% — the accelerated bar cannot outrun the baseline", () => {
    expect(payoffProgressPercent({
      basePayment: 0, baselineMonths: 10, baselineInterest: 0,
      acceleratedMonths: 999, acceleratedInterest: 0, monthsSaved: 0, interestSaved: 0,
    })).toBe(100);
  });

  it("does not divide by a zero baseline", () => {
    expect(payoffProgressPercent({
      basePayment: 0, baselineMonths: 0, baselineInterest: 0,
      acceleratedMonths: 0, acceleratedInterest: 0, monthsSaved: 0, interestSaved: 0,
    })).toBe(100);
  });
});
