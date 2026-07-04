import { describe, expect, it } from "vitest";
import {
  advertisedAPR,
  buildMortgagePaymentStream,
  calculateMortgageAPR,
  estimatePrepaidFinanceCharges,
  solveAPRFromStream,
} from "../server/services/apr";

/**
 * APR ground-truth validation (Reg Z §1026.22 / Appendix J).
 *
 * apr.test.ts pins behavior (anchors, direction, guards). This file validates
 * the engine's *numerical correctness* three independent ways, none of which
 * is "the solver checking the solver":
 *
 *   1. ANALYTIC — single- and two-payment streams whose APR is exact by hand.
 *   2. DEFINITIONAL — the returned rate must satisfy the actuarial identity
 *      the regulation defines the APR by: AmountFinanced == Σ Pₜ / (1+i)ᵗ.
 *      Verifying this IS validating against the regulatory method, not an
 *      implementation.
 *   3. ALGORITHM-INDEPENDENT — a Newton–Raphson solver (a different root
 *      finder) must agree with the production bisection.
 *
 * Assumption (stated so no one over-claims): the model is the Appendix J
 * "single advance, whole unit-periods" case — the first payment is one full
 * period after consummation, with odd-days/prepaid interest folded into the
 * prepaid finance charges. Loans that close mid-period carry a small odd-days
 * adjustment this does not model.
 */

const REG_Z_TOLERANCE = 0.125; // §1026.22(a)(2): 1/8 of 1 percentage point.

/** Independent reference solver — Newton–Raphson on f(i) = PV(payments,i) − AF. */
function newtonAPR(amountFinanced: number, payments: number[]): number {
  const pv = (i: number) => payments.reduce((acc, p, t) => acc + p / Math.pow(1 + i, t + 1), 0);
  const dpv = (i: number) =>
    payments.reduce((acc, p, t) => acc - (t + 1) * p / Math.pow(1 + i, t + 2), 0);

  let i = 0.005; // ~6% annual start
  for (let n = 0; n < 100; n++) {
    const f = pv(i) - amountFinanced;
    const df = dpv(i);
    if (Math.abs(df) < 1e-15) break;
    const next = i - f / df;
    if (!isFinite(next) || next <= -1) break;
    if (Math.abs(next - i) < 1e-12) {
      i = next;
      break;
    }
    i = next;
  }
  return i * 12 * 100;
}

/** PV of a payment stream at an annual APR (%), used to check the definitional identity. */
function presentValueAtAPR(payments: number[], annualAprPct: number): number {
  const i = annualAprPct / 100 / 12;
  return payments.reduce((acc, p, t) => acc + p / Math.pow(1 + i, t + 1), 0);
}

/** d(PV)/d(monthly i) at a given APR — used to size the rounding-consistent PV tolerance. */
function pvSlope(payments: number[], annualAprPct: number): number {
  const i = annualAprPct / 100 / 12;
  return payments.reduce((acc, p, t) => acc - (t + 1) * p / Math.pow(1 + i, t + 2), 0);
}

// The engine reports the APR to 3 decimal places (nearest 0.001 percentage
// point) — far tighter than the §1026.22 1/8-point standard, but it means the
// PV discounted at the *reported* rate reproduces the amount financed only to
// within the PV shift caused by half a rounding unit. This derives that exact
// dollar bound so the identity check is honest rather than arbitrarily strict.
const HALF_ROUNDING_UNIT_MONTHLY = 0.0005 / 100 / 12; // half of 0.001% annual, as a monthly rate
function allowedPvResidual(payments: number[], annualAprPct: number): number {
  return Math.abs(pvSlope(payments, annualAprPct)) * HALF_ROUNDING_UNIT_MONTHLY + 0.05;
}

describe("APR validation — analytic ground truth (exact by hand)", () => {
  it("single payment: AF=1000, one payment of 1010 → i=1%/mo → APR=12.000%", () => {
    // 1000 = 1010 / (1+i)  ⇒  i = 0.01 exactly.
    expect(solveAPRFromStream(1000, [1010])).toBeCloseTo(12.0, 3);
  });

  it("two payments at exactly 1%/mo → APR=12.000%", () => {
    // At i=0.01: PV = 100/1.01 + 100/1.01² = 197.039506…
    const af = 100 / 1.01 + 100 / Math.pow(1.01, 2);
    expect(solveAPRFromStream(af, [100, 100])).toBeCloseTo(12.0, 3);
  });

  it("recovers a known monthly rate on a real amortizing schedule", () => {
    // Build a 360-payment stream at 5.500% and confirm the solver, given the
    // full loan amount (zero fees), returns exactly the note rate.
    const stream = buildMortgagePaymentStream({ loanAmount: 300000, noteRatePct: 5.5, termMonths: 360 });
    expect(solveAPRFromStream(300000, stream)).toBeCloseTo(5.5, 3);
  });
});

describe("APR validation — definitional identity (Appendix J actuarial equation)", () => {
  const scenarios = [
    { loanAmount: 200000, noteRatePct: 6.0, termMonths: 360, prepaidFinanceCharges: 4000 },
    { loanAmount: 280000, noteRatePct: 6.375, termMonths: 360, prepaidFinanceCharges: 6800 },
    { loanAmount: 150000, noteRatePct: 7.125, termMonths: 180, prepaidFinanceCharges: 3200 },
    { loanAmount: 380000, noteRatePct: 6.5, termMonths: 360, prepaidFinanceCharges: 5000, monthlyMI: 190, propertyValue: 400000 },
  ];

  for (const s of scenarios) {
    it(`PV(payments @ APR) == amount financed for ${s.loanAmount}@${s.noteRatePct}%`, () => {
      const apr = calculateMortgageAPR(s);
      const stream = buildMortgagePaymentStream(s);
      const amountFinanced = s.loanAmount - s.prepaidFinanceCharges;
      // The returned rate reproduces the amount financed within the residual
      // implied by 3-decimal APR rounding (see allowedPvResidual).
      expect(Math.abs(presentValueAtAPR(stream, apr) - amountFinanced)).toBeLessThanOrEqual(
        allowedPvResidual(stream, apr),
      );
    });
  }
});

describe("APR validation — algorithm-independent cross-check", () => {
  const matrix = [
    { loanAmount: 200000, noteRatePct: 6.0, termMonths: 360, prepaidFinanceCharges: 4000 },
    { loanAmount: 280000, noteRatePct: 6.375, termMonths: 360, prepaidFinanceCharges: 6800 },
    { loanAmount: 150000, noteRatePct: 7.125, termMonths: 180, prepaidFinanceCharges: 3200 },
    { loanAmount: 500000, noteRatePct: 5.25, termMonths: 360, prepaidFinanceCharges: 9000 },
    { loanAmount: 380000, noteRatePct: 6.5, termMonths: 360, prepaidFinanceCharges: 5000, monthlyMI: 190, propertyValue: 400000 },
  ];

  for (const s of matrix) {
    it(`bisection agrees with Newton for ${s.loanAmount}@${s.noteRatePct}%`, () => {
      const engine = calculateMortgageAPR(s);
      const reference = newtonAPR(s.loanAmount - s.prepaidFinanceCharges, buildMortgagePaymentStream(s));
      // Comfortably inside the 1/8-point legal tolerance — the two solvers
      // actually agree far tighter than that.
      expect(Math.abs(engine - reference)).toBeLessThan(REG_Z_TOLERANCE);
      expect(Math.abs(engine - reference)).toBeLessThan(0.005);
    });
  }
});

describe("APR validation — advertised-rate path is PV-consistent", () => {
  it("conventional advertised APR reproduces its own amount financed", () => {
    const loanAmount = 280000;
    const noteRatePct = 6.375;
    const apr = advertisedAPR(loanAmount, noteRatePct, 360);
    const amountFinanced = loanAmount - estimatePrepaidFinanceCharges(loanAmount, noteRatePct);
    const stream = buildMortgagePaymentStream({ loanAmount, noteRatePct, termMonths: 360 });
    expect(Math.abs(presentValueAtAPR(stream, apr) - amountFinanced)).toBeLessThanOrEqual(
      allowedPvResidual(stream, apr),
    );
  });

  it("advertised APR sits above the note rate but within a sane band (< 0.5pt on typical fees)", () => {
    const apr = advertisedAPR(280000, 6.375, 360);
    expect(apr).toBeGreaterThan(6.375);
    expect(apr - 6.375).toBeLessThan(0.5);
  });
});
