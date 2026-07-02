import { describe, expect, it } from "vitest";
import {
  computeRefiSavings,
  estimateRemainingBalance,
  monthlyPayment,
  PMI_REMOVAL_LTV_THRESHOLD,
  REFI_ALERT_RATE_DROP,
} from "../server/services/lifecycleEngine";

describe("monthlyPayment", () => {
  it("computes the standard amortized payment", () => {
    // $400k @ 7% / 30yr ≈ $2,661/mo
    const p = monthlyPayment(400_000, 7);
    expect(p).toBeGreaterThan(2_640);
    expect(p).toBeLessThan(2_680);
  });

  it("handles a zero rate as straight-line", () => {
    expect(monthlyPayment(360_000, 0)).toBeCloseTo(1_000, 5);
  });

  it("returns 0 for a non-positive principal", () => {
    expect(monthlyPayment(0, 7)).toBe(0);
  });
});

describe("estimateRemainingBalance", () => {
  it("starts at the original amount and ends at zero", () => {
    expect(estimateRemainingBalance(400_000, 7, 0)).toBeCloseTo(400_000, 0);
    expect(estimateRemainingBalance(400_000, 7, 360)).toBeCloseTo(0, 0);
  });

  it("amortizes slowly early in the loan (mostly interest)", () => {
    const afterFiveYears = estimateRemainingBalance(400_000, 7, 60);
    // At 7%, ~5 years in you've barely dented principal
    expect(afterFiveYears).toBeGreaterThan(370_000);
    expect(afterFiveYears).toBeLessThan(400_000);
  });

  it("clamps months to the term", () => {
    expect(estimateRemainingBalance(400_000, 7, 999)).toBeCloseTo(0, 0);
  });
});

describe("computeRefiSavings", () => {
  it("produces positive savings when the market rate is lower", () => {
    const s = computeRefiSavings(350_000, 7.5, 6.5);
    expect(s.monthlySavings).toBeGreaterThan(200);
    expect(s.lifetimeSavings).toBeCloseTo(s.monthlySavings * 360, 5);
    expect(s.marketPayment).toBeLessThan(s.currentPayment);
  });

  it("produces negative savings when rates moved against the borrower", () => {
    const s = computeRefiSavings(350_000, 6.0, 7.0);
    expect(s.monthlySavings).toBeLessThan(0);
  });
});

describe("thresholds", () => {
  it("uses the standard 80% LTV PMI-removal threshold", () => {
    expect(PMI_REMOVAL_LTV_THRESHOLD).toBe(80);
  });

  it("requires at least a quarter-point drop before raising refi alerts", () => {
    expect(REFI_ALERT_RATE_DROP).toBeGreaterThanOrEqual(0.25);
  });
});
