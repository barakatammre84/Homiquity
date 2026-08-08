import { describe, it, expect } from "vitest";
import {
  paymentAtMonthlyRate,
  monthlyPrincipalAndInterest,
  monthlyPrincipalAndInterestFromFraction,
  paymentFactor,
  loanSupportedByPayment,
  annuityFactor,
} from "@shared/lib/amortization";

/**
 * Equivalence harness for the amortization consolidation.
 *
 * ~24 call sites each re-derived the payment formula. Before any of them was
 * migrated, this file pinned the canonical helper against EVERY historical
 * algebraic variant found in the tree, so a consolidation that changed a
 * borrower-facing or regulated number would fail here rather than ship.
 *
 * ── WHY NOT bit-exact ────────────────────────────────────────────────────────
 * The historical variants disagree with EACH OTHER in the last ULP: writing
 * `P * (r * G)` and `P * r * G` are algebraically identical but multiply in a
 * different order, so IEEE-754 rounds differently (observed: …734428 vs
 * …734429 on a $750k payment — a difference of ~1e-12 dollars). No single
 * implementation can be bit-identical to all of them, so this harness pins the
 * invariant that actually matters for a regulated document:
 *
 *   1. the value is IDENTICAL TO THE CENT  (`toFixed(2)`), and
 *   2. the absolute delta is < 1e-6 — proving it is float noise, not a
 *      changed formula. A real algebra or unit error blows past this by
 *      many orders of magnitude.
 *
 * Do not loosen these bounds. Tightening #1 to exact equality is impossible;
 * relaxing it hides a genuine numeric change to a borrower-facing figure.
 */

/** Assert two payment figures agree to the cent, with only float-noise delta. */
function expectSameMoney(actual: number, legacy: number): void {
  expect(actual.toFixed(2)).toBe(legacy.toFixed(2));
  expect(Math.abs(actual - legacy)).toBeLessThan(1e-6);
}

/** Realistic mortgage inputs — principal, annual rate PERCENT, term months. */
const CASES: Array<[number, number, number]> = [
  [400_000, 6.5, 360],
  [250_000, 7.25, 360],
  [1_000_000, 5.875, 360],
  [150_000, 6.0, 180],
  [750_000, 7.999, 360],
  [95_500, 6.125, 240],
  [1, 6.5, 360], // per-dollar factor
  [333_333.33, 6.3721, 360], // non-round everything
];

describe("canonical amortization helper", () => {
  describe("matches every historical call-site variant exactly", () => {
    it("variant A — principal·(r(1+r)^n)/((1+r)^n−1), the most common form", () => {
      // MortgageCalculator, RentVsBuy, affordabilityCheck, ScenarioDesk,
      // affordabilityEstimate, PropertyDetail, BuyerProperties, apr.ts
      for (const [principal, pct, n] of CASES) {
        const r = pct / 100 / 12;
        const legacy =
          (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
        expectSameMoney(monthlyPrincipalAndInterest(principal, pct, n), legacy);
      }
    });

    it("variant B — principal·r·(1+r)^n/((1+r)^n−1), operand order differs", () => {
      // AmortizationCalculator, MortgagePayoff, Refinance, lifecycleEngine,
      // loanAnalysis, preUnderwriting, letters.ts
      for (const [principal, pct, n] of CASES) {
        const r = pct / 100 / 12;
        const legacy =
          (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        expectSameMoney(monthlyPrincipalAndInterest(principal, pct, n), legacy);
      }
    });

    it("variant C — hoisted growth term (scenariosWaitlist, buyingPowerScenario)", () => {
      for (const [principal, pct, n] of CASES) {
        const r = pct / 100 / 12;
        const factor = Math.pow(1 + r, n);
        const legacy = (principal * (r * factor)) / (factor - 1);
        expectSameMoney(monthlyPrincipalAndInterest(principal, pct, n), legacy);
      }
    });

    it("variant D — reciprocal annuity factor (affordabilityEstimate, rentToOwn, borrowerGraph)", () => {
      for (const [, pct, n] of CASES) {
        const r = pct / 100 / 12;
        const legacy =
          (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
        expect(annuityFactor(pct, n)).toBeCloseTo(legacy, 12);
      }
    });

    it("variant E — present value of annuity, negative exponent (FirstTimeBuyer)", () => {
      // This form is algebraically equal but NOT float-identical, so it is the
      // one variant compared with a tolerance. FirstTimeBuyer is a public
      // estimate surface, not a regulated document.
      for (const [payment, pct, n] of CASES) {
        const r = pct / 100 / 12;
        const legacy = (payment * (1 - Math.pow(1 + r, -n))) / r;
        expect(loanSupportedByPayment(payment, pct, n)).toBeCloseTo(legacy, 6);
      }
    });
  });

  describe("the rate-unit trap", () => {
    it("percent and fraction entry points agree on the same real rate", () => {
      for (const [principal, pct, n] of CASES) {
        expect(monthlyPrincipalAndInterestFromFraction(principal, pct / 100, n)).toBe(
          monthlyPrincipalAndInterest(principal, pct, n),
        );
      }
    });

    it("fraction form matches the historical `rate / 12` call sites", () => {
      // letters.ts, preUnderwriting, PropertyDetail, BuyerProperties,
      // underwriting.ts, borrowerGraph — all held a decimal rate.
      for (const [principal, pct, n] of CASES) {
        const fraction = pct / 100;
        const r = fraction / 12;
        const legacy =
          (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        expectSameMoney(
          monthlyPrincipalAndInterestFromFraction(principal, fraction, n),
          legacy,
        );
      }
    });

    it("confuses nobody: passing a fraction to the percent form is ~100x off", () => {
      // Guards the documented trap — if someone "simplifies" the two entry
      // points into one, this is the failure they would be shipping.
      const asPct = monthlyPrincipalAndInterest(400_000, 6.5, 360);
      const asFractionByMistake = monthlyPrincipalAndInterest(400_000, 0.065, 360);
      expect(asFractionByMistake).toBeLessThan(asPct / 2);
    });
  });

  describe("CONTRACT edge cases", () => {
    it("zero rate amortizes principal evenly (all legacy guards agreed on this)", () => {
      expect(monthlyPrincipalAndInterest(360_000, 0, 360)).toBe(1000);
      expect(monthlyPrincipalAndInterestFromFraction(360_000, 0, 360)).toBe(1000);
      expect(paymentAtMonthlyRate(360_000, 0, 360)).toBe(1000);
    });

    it("non-positive principal or term yields 0, never NaN", () => {
      expect(monthlyPrincipalAndInterest(0, 6.5, 360)).toBe(0);
      expect(monthlyPrincipalAndInterest(-1, 6.5, 360)).toBe(0);
      expect(monthlyPrincipalAndInterest(400_000, 6.5, 0)).toBe(0);
      expect(loanSupportedByPayment(0, 6.5, 360)).toBe(0);
    });

    it("never returns NaN or Infinity across the case matrix", () => {
      for (const [principal, pct, n] of CASES) {
        const p = monthlyPrincipalAndInterest(principal, pct, n);
        expect(Number.isFinite(p)).toBe(true);
      }
    });

    it("does not round — full precision reaches apr.ts and the Loan Estimate", () => {
      const p = monthlyPrincipalAndInterest(400_000, 6.5, 360);
      expect(p).not.toBe(Math.round(p));
      expect(p.toFixed(2)).toBe("2528.27");
    });
  });

  describe("inverse consistency", () => {
    it("payment → loan → payment round-trips", () => {
      for (const [principal, pct, n] of CASES) {
        const payment = monthlyPrincipalAndInterest(principal, pct, n);
        expect(loanSupportedByPayment(payment, pct, n)).toBeCloseTo(principal, 6);
      }
    });

    it("paymentFactor and annuityFactor are reciprocals", () => {
      for (const [, pct, n] of CASES) {
        expect(paymentFactor(pct, n) * annuityFactor(pct, n)).toBeCloseTo(1, 12);
      }
    });

    it("round-trip holds at 0% too", () => {
      expect(loanSupportedByPayment(1000, 0, 360)).toBe(360_000);
    });
  });
});
