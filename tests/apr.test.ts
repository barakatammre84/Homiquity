import { describe, expect, it } from "vitest";
import {
  advertisedAPR,
  buildMortgagePaymentStream,
  calculateMortgageAPR,
  estimatePrepaidFinanceCharges,
  monthlyPrincipalAndInterest,
  solveAPRFromStream,
} from "../server/services/apr";

/**
 * Actuarial APR engine (Reg Z §1026.22 / Appendix J).
 *
 * The anchor property: with zero prepaid finance charges and no MI, the APR
 * must equal the note rate — the solver is recovering the rate that generated
 * the payment stream. Every other case moves off that anchor in a known
 * direction (fees and MI can only raise the APR).
 */

describe("APR: zero-fee anchor", () => {
  it("recovers the note rate exactly when there are no finance charges", () => {
    const apr = calculateMortgageAPR({
      loanAmount: 100000,
      noteRatePct: 6.0,
      termMonths: 360,
      prepaidFinanceCharges: 0,
    });
    expect(apr).toBeCloseTo(6.0, 2);
  });

  it("holds the anchor across rates and terms", () => {
    for (const rate of [3.25, 5.5, 7.125]) {
      for (const term of [180, 360]) {
        const apr = calculateMortgageAPR({
          loanAmount: 250000,
          noteRatePct: rate,
          termMonths: term,
          prepaidFinanceCharges: 0,
        });
        expect(apr).toBeCloseTo(rate, 2);
      }
    }
  });
});

describe("APR: fees and MI move the APR in the required direction", () => {
  it("prepaid finance charges raise the APR above the note rate", () => {
    const apr = calculateMortgageAPR({
      loanAmount: 280000,
      noteRatePct: 6.5,
      termMonths: 360,
      prepaidFinanceCharges: 6500,
    });
    expect(apr).toBeGreaterThan(6.5);
    // Reg Z tolerance is 1/8 point; ~2.3% in fees on a 30-year loan lands
    // roughly a quarter point over the note rate — sanity-bound it.
    expect(apr).toBeLessThan(7.5);
  });

  it("monthly MI raises the APR further", () => {
    const base = calculateMortgageAPR({
      loanAmount: 380000,
      noteRatePct: 6.5,
      termMonths: 360,
      prepaidFinanceCharges: 5000,
      propertyValue: 400000,
    });
    const withMI = calculateMortgageAPR({
      loanAmount: 380000,
      noteRatePct: 6.5,
      termMonths: 360,
      prepaidFinanceCharges: 5000,
      monthlyMI: 200,
      propertyValue: 400000,
    });
    expect(withMI).toBeGreaterThan(base);
  });

  it("drops MI from the stream once the balance amortizes to 78% LTV", () => {
    const stream = buildMortgagePaymentStream({
      loanAmount: 95,
      noteRatePct: 6.0,
      termMonths: 360,
      monthlyMI: 1,
      propertyValue: 100,
    });
    const pAndI = monthlyPrincipalAndInterest(95, 6.0, 360);
    expect(stream[0]).toBeCloseTo(pAndI + 1, 10);
    // 95→78 takes years of amortization; the tail must be P&I only.
    expect(stream[stream.length - 1]).toBeCloseTo(pAndI, 10);
    expect(stream.some(p => p === pAndI)).toBe(true);
  });
});

describe("APR: solver guards", () => {
  it("rejects a non-positive amount financed", () => {
    expect(() => solveAPRFromStream(0, [100])).toThrow();
    expect(() => solveAPRFromStream(-5, [100])).toThrow();
  });

  it("rejects an empty payment stream", () => {
    expect(() => solveAPRFromStream(1000, [])).toThrow();
  });

  it("handles a zero note rate without dividing by zero", () => {
    const apr = calculateMortgageAPR({
      loanAmount: 120000,
      noteRatePct: 0,
      termMonths: 360,
      prepaidFinanceCharges: 0,
    });
    expect(apr).toBe(0);
  });
});

describe("Advertised APR (representative fee model)", () => {
  it("is strictly above the note rate", () => {
    const apr = advertisedAPR(280000, 6.375, 360);
    expect(apr).toBeGreaterThan(6.375);
  });

  it("FHA carries upfront + annual MIP and prices above conventional at the same note rate", () => {
    const conventional = advertisedAPR(280000, 6.375, 360);
    const fha = advertisedAPR(280000, 6.375, 360, { isFHA: true });
    expect(fha).toBeGreaterThan(conventional);
  });

  it("fee model includes FHA upfront MIP only for FHA", () => {
    const conv = estimatePrepaidFinanceCharges(280000, 6.375);
    const fha = estimatePrepaidFinanceCharges(280000, 6.375, { isFHA: true });
    expect(fha - conv).toBeCloseTo(280000 * 0.0175, 6);
  });
});
