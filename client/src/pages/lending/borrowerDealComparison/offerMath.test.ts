import { describe, it, expect } from "vitest";
import { formatRate, calculateBreakeven } from "./offerMath";

// The page renders these two directly to the borrower — the rate string next
// to the APR, and the break-even month count that also drives the ">60 months"
// warning. Both are pure, so pin the boundaries.

describe("formatRate", () => {
  it("always shows three decimals, matching the APR column's precision", () => {
    expect(formatRate(6.625)).toBe("6.625%");
    expect(formatRate(6.5)).toBe("6.500%");
    expect(formatRate(7)).toBe("7.000%");
  });
});

describe("calculateBreakeven", () => {
  it("rounds up — a partial month is not yet recouped", () => {
    expect(calculateBreakeven(5000, 100)).toBe(50);
    expect(calculateBreakeven(5001, 100)).toBe(51);
  });

  it("returns Infinity when the buy-down saves nothing, so the UI shows N/A", () => {
    // Guards the divide-by-zero and the negative-months case: without this the
    // page would render "0 months" or a negative count as if it were a real
    // pay-back period.
    expect(calculateBreakeven(5000, 0)).toBe(Infinity);
    expect(calculateBreakeven(5000, -25)).toBe(Infinity);
  });

  it("stays below the 60-month warning threshold for a fast pay-back", () => {
    expect(calculateBreakeven(3800, 100)).toBe(38);
  });
});
