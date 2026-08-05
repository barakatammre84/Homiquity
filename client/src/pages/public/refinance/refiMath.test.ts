import { describe, it, expect } from "vitest";
import { calculateRefi, monthlyPI, type RefiInputs } from "./refiMath";

const inputs = (over: Partial<RefiInputs> = {}): RefiInputs => ({
  balance: 320000,
  currentRate: 7.5,
  yearsRemaining: 28,
  newRate: 6.0,
  newTermYears: 30,
  closingCosts: 6000,
  ...over,
});

describe("monthlyPI", () => {
  it("computes the standard payment", () => {
    expect(monthlyPI(320000, 6.5, 360)).toBeCloseTo(2022.62, 1);
  });

  it("returns 0 rather than NaN for an empty form", () => {
    // The page renders before the visitor types anything.
    expect(monthlyPI(0, 6.5, 360)).toBe(0);
    expect(monthlyPI(320000, 6.5, 0)).toBe(0);
    expect(monthlyPI(-1, 6.5, 360)).toBe(0);
  });

  it("divides evenly at 0%", () => {
    expect(monthlyPI(360000, 0, 360)).toBe(1000);
  });
});

describe("calculateRefi", () => {
  it("reports a monthly saving when the new rate is lower", () => {
    const r = calculateRefi(inputs());
    expect(r.monthlyDiff).toBeGreaterThan(0);
    expect(r.newPayment).toBeLessThan(r.currentPayment);
  });

  it("reports a negative diff when the refinance costs more per month", () => {
    // Signed, not absolute — the page keys "costs more" off the sign.
    const r = calculateRefi(inputs({ newRate: 9.0 }));
    expect(r.monthlyDiff).toBeLessThan(0);
  });

  it("recoups closing costs over the monthly saving, rounded up", () => {
    const r = calculateRefi(inputs({ closingCosts: 6000 }));
    expect(r.breakEvenMonths).toBe(Math.ceil(6000 / r.monthlyDiff));
  });

  it("returns a null break-even when there is nothing to recoup", () => {
    // Null rather than 0 or Infinity: "0 months to break even" would read as
    // an instant win, which is the opposite of the truth here.
    expect(calculateRefi(inputs({ newRate: 9.0 })).breakEvenMonths).toBeNull();
    expect(calculateRefi(inputs({ closingCosts: 0 })).breakEvenMonths).toBeNull();
  });

  it("PINNED: resetting the term can raise total interest despite a lower payment", () => {
    // 28 years left, refinanced into a fresh 30 at a lower rate. The monthly
    // payment falls but the borrower pays more interest overall — the case the
    // page's interestGoesUp flag exists to surface.
    const r = calculateRefi(inputs({ balance: 320000, currentRate: 7.5, yearsRemaining: 10, newRate: 6.0, newTermYears: 30 }));
    expect(r.monthlyDiff).toBeGreaterThan(0);
    expect(r.newInterest).toBeGreaterThan(r.currentInterest);
  });

  it("interest totals are payment x months minus principal", () => {
    const r = calculateRefi(inputs());
    expect(r.currentInterest).toBeCloseTo(r.currentPayment * 28 * 12 - 320000, 6);
    expect(r.newInterest).toBeCloseTo(r.newPayment * 30 * 12 - 320000, 6);
  });

  it("is all zeroes on an empty form rather than NaN", () => {
    const r = calculateRefi(inputs({ balance: 0 }));
    expect(r.currentPayment).toBe(0);
    expect(r.newPayment).toBe(0);
    expect(r.monthlyDiff).toBe(0);
    expect(r.breakEvenMonths).toBeNull();
    expect(Number.isFinite(r.currentInterest)).toBe(true);
  });
});
