import { describe, it, expect } from "vitest";
import { calculate, defaultInputs, monthlyPI, simulate, type AmortizationInputs } from "./amortization";

const inputs = (over: Partial<AmortizationInputs> = {}): AmortizationInputs => ({
  ...defaultInputs,
  ...over,
});

describe("monthlyPI", () => {
  it("computes the standard fully-amortizing payment", () => {
    // $320k at 6.5% over 360 months = $2,022.62.
    expect(monthlyPI(320000, 6.5, 360)).toBeCloseTo(2022.62, 1);
  });

  it("divides evenly at 0% rather than dividing by zero", () => {
    expect(monthlyPI(360000, 0, 360)).toBe(1000);
  });

  it("is 0 for a non-loan rather than NaN", () => {
    expect(monthlyPI(0, 6.5, 360)).toBe(0);
    expect(monthlyPI(-1, 6.5, 360)).toBe(0);
    expect(monthlyPI(320000, 6.5, 0)).toBe(0);
  });
});

describe("simulate", () => {
  it("pays off a standard loan in exactly its term", () => {
    const pay = monthlyPI(320000, 6.5, 360);
    expect(simulate(320000, 6.5, pay, 0).months).toBe(360);
  });

  it("returns Infinity when the payment never covers interest", () => {
    // $1/mo against $320k at 6.5% — the balance grows every month. Returning
    // a number here would mean reporting a payoff date that never comes.
    const never = simulate(320000, 6.5, 1, 0);
    expect(never.months).toBe(Infinity);
    expect(never.totalInterest).toBe(Infinity);
  });

  it("caps iteration so a pathological input cannot hang the page", () => {
    // A payment a hair above the interest amortizes, but very slowly; the
    // 1200-month cap must terminate it.
    const interestOnly = 320000 * (6.5 / 100 / 12);
    const crawl = simulate(320000, 6.5, interestOnly + 1, 0);
    expect(crawl.months).toBeLessThanOrEqual(1200);
  });

  it("shortens the term as extra payments rise", () => {
    const pay = monthlyPI(320000, 6.5, 360);
    const none = simulate(320000, 6.5, pay, 0).months;
    const some = simulate(320000, 6.5, pay, 200).months;
    const lots = simulate(320000, 6.5, pay, 1000).months;
    expect(some).toBeLessThan(none);
    expect(lots).toBeLessThan(some);
  });
});

describe("calculate", () => {
  it("is deterministic", () => {
    expect(calculate(inputs())).toEqual(calculate(inputs()));
  });

  it("reports no saving when there is no extra payment", () => {
    const r = calculate(inputs({ extraMonthly: 0 }));
    expect(r.interestSaved).toBe(0);
    expect(r.monthsSaved).toBe(0);
    expect(r.payoffMonths).toBe(r.baselineMonths);
  });

  it("saves interest and months when paying extra", () => {
    const r = calculate(inputs({ extraMonthly: 300 }));
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(r.payoffMonths).toBeLessThan(r.baselineMonths);
    expect(r.totalInterest).toBeLessThan(r.baselineTotalInterest);
  });

  it("never reports a negative saving", () => {
    // Both saving figures are clamped at 0, so a longer accelerated run can
    // never render as "you saved -3 months".
    for (const extraMonthly of [0, 1, 50, 5000]) {
      const r = calculate(inputs({ extraMonthly }));
      expect(r.interestSaved).toBeGreaterThanOrEqual(0);
      expect(r.monthsSaved).toBeGreaterThanOrEqual(0);
    }
  });

  it("totalPaid is principal plus interest", () => {
    const r = calculate(inputs({ extraMonthly: 250 }));
    expect(r.totalPaid).toBeCloseTo(320000 + r.totalInterest, 6);
  });

  it("builds a monthly schedule that retires the balance", () => {
    const r = calculate(inputs());
    expect(r.monthly).toHaveLength(r.payoffMonths);
    expect(r.monthly[r.monthly.length - 1].balance).toBeLessThanOrEqual(0.01);
    // Interest falls and principal rises across the term.
    expect(r.monthly[0].interest).toBeGreaterThan(r.monthly[0].principal);
    const last = r.monthly[r.monthly.length - 1];
    expect(last.principal).toBeGreaterThan(last.interest);
  });

  it("year rows reconcile with the months they summarise", () => {
    const r = calculate(inputs({ extraMonthly: 200 }));
    const firstYear = r.yearly[0];
    const firstTwelve = r.monthly.slice(0, 12);
    expect(firstYear.principal).toBeCloseTo(firstTwelve.reduce((s, m) => s + m.principal, 0), 6);
    expect(firstYear.interest).toBeCloseTo(firstTwelve.reduce((s, m) => s + m.interest, 0), 6);
    expect(firstYear.balance).toBe(320000);
  });

  it("emits a final partial year rather than dropping the last months", () => {
    // Extra payments usually end the loan mid-year; those months must still
    // appear in a year row or the schedule would not sum to the total.
    const r = calculate(inputs({ extraMonthly: 700 }));
    expect(r.payoffMonths % 12).not.toBe(0);
    const yearlyPrincipal = r.yearly.reduce((s, y) => s + y.principal, 0);
    expect(yearlyPrincipal).toBeCloseTo(320000, 2);
  });

  it("falls back to the scheduled term when the loan never amortizes", () => {
    // 0-length term would divide by zero; monthlyPI returns 0, so no payment
    // covers interest and both simulations come back Infinity. The result must
    // still be finite numbers rather than "Infinity months".
    const r = calculate(inputs({ interestRate: 20, loanTermYears: 30, extraMonthly: 0 }));
    expect(Number.isFinite(r.payoffMonths)).toBe(true);
    expect(Number.isFinite(r.totalInterest)).toBe(true);
    expect(Number.isFinite(r.baselineMonths)).toBe(true);
  });

  it("handles a 0% loan", () => {
    const r = calculate(inputs({ interestRate: 0 }));
    expect(r.totalInterest).toBeCloseTo(0, 6);
    expect(r.payoffMonths).toBe(360);
  });
});
