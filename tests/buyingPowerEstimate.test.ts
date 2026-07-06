import { describe, it, expect } from "vitest";
import { estimateBuyingPower } from "../client/src/lib/buyingPowerScenario";

// The landing-page hero estimator must stay consistent with the /afford
// heuristics (28% front-end, 43% back-end, PMI under 20% down) and must
// stay conservative: a visitor should never be shown a range the
// affordability tool would immediately contradict.

describe("estimateBuyingPower", () => {
  it("returns the verified baseline range for the median scenario", () => {
    // $100k income, $500/mo debts, $50k down — verified against the
    // AffordabilityCheck math by hand: max price ≈ $325k with PMI.
    const result = estimateBuyingPower(100000, 500, 50000);
    expect(result).toEqual({ low: 300000, high: 325000 });
  });

  it("returns null when debts consume the back-end budget", () => {
    // $30k income → $2,500/mo gross; 43% = $1,075 < $2,000 debts.
    expect(estimateBuyingPower(30000, 2000, 25000)).toBeNull();
  });

  it("binds on the 28% front-end cap when debts are low", () => {
    // With zero debts the 43% back-end never binds; doubling income
    // should roughly double the price (linear in the front-end cap).
    const oneX = estimateBuyingPower(100000, 0, 0);
    const twoX = estimateBuyingPower(200000, 0, 0);
    expect(oneX).not.toBeNull();
    expect(twoX).not.toBeNull();
    expect(twoX!.high).toBeGreaterThan(oneX!.high * 1.95);
    expect(twoX!.high).toBeLessThan(oneX!.high * 2.05);
  });

  it("drops PMI once the down payment crosses 20% of the price", () => {
    // A down payment large enough to clear 20% must buy MORE house per
    // dollar than one below the threshold (PMI stops taxing the budget).
    const below = estimateBuyingPower(150000, 0, 50000);
    const above = estimateBuyingPower(150000, 0, 200000);
    expect(below).not.toBeNull();
    expect(above).not.toBeNull();
    // No-PMI branch actually engaged: down / price >= 20%.
    expect(200000 / above!.high).toBeGreaterThanOrEqual(0.2);
    // Extra $150k down yields at least $150k more house.
    expect(above!.high - below!.high).toBeGreaterThanOrEqual(150000);
  });

  it("always returns a rounded, ordered range", () => {
    for (const [income, debts, down] of [
      [60000, 125, 10000],
      [100000, 500, 50000],
      [250000, 1125, 100000],
      [500000, 2000, 100000],
    ] as const) {
      const r = estimateBuyingPower(income, debts, down);
      expect(r).not.toBeNull();
      expect(r!.low).toBeLessThanOrEqual(r!.high);
      expect(r!.low % 5000).toBe(0);
      expect(r!.high % 5000).toBe(0);
      expect(r!.high).toBeGreaterThan(down);
    }
  });
});
