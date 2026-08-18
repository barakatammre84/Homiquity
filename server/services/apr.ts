// ---------------------------------------------------------------------------
// Actuarial APR — Reg Z §1026.22 / Appendix J.
//
// The APR is the rate that discounts the payment stream back to the amount
// financed (loan amount minus prepaid finance charges). Every APR the
// platform displays — advertised rates, the Loan Estimate, borrower-facing
// comparisons — must come from this solver. Flat spreads over the note rate
// ("rate + 0.2") are not APRs and advertising them is a TILA violation.
//
// Finance-charge composition (§1026.4): origination fees, points, application
// and underwriting fees, prepaid interest, and mortgage insurance ARE finance
// charges. Appraisal, credit report, title, survey, pest inspection
// (§1026.4(c)(7)) and recording/transfer taxes (§1026.4(e)) are NOT.
// ---------------------------------------------------------------------------

import {
  ORIGINATION_FEE_RATE,
  PLATFORM_APPLICATION_FEE,
  PLATFORM_UNDERWRITING_FEE,
} from "./loanCosts";
import { fhaUpfrontMIP } from "./mortgageInsurance";

// The payment formula lives in @shared/lib/amortization — one canonical copy
// shared by the calculators, the letter path, and this APR solver. Re-exported
// here so existing importers of `./apr` keep working unchanged.
export { monthlyPrincipalAndInterest } from "@shared/lib/amortization";
import { monthlyPrincipalAndInterest } from "@shared/lib/amortization";

export interface MortgageStreamParams {
  loanAmount: number;
  noteRatePct: number;
  termMonths: number;
  /** Monthly MI premium; included in the stream until the balance amortizes to 78% LTV (HPA auto-termination). */
  monthlyMI?: number;
  /** Property value used for the 78% MI-termination test. Required when monthlyMI > 0. */
  propertyValue?: number;
}

/** Builds the month-by-month payment stream (P&I plus MI while in force). */
export function buildMortgagePaymentStream(params: MortgageStreamParams): number[] {
  const { loanAmount, noteRatePct, termMonths } = params;
  const monthlyMI = params.monthlyMI ?? 0;
  const propertyValue = params.propertyValue ?? 0;

  const pAndI = monthlyPrincipalAndInterest(loanAmount, noteRatePct, termMonths);
  const monthlyRate = noteRatePct / 100 / 12;
  const miTerminationBalance = propertyValue > 0 ? propertyValue * 0.78 : 0;

  const payments: number[] = new Array(termMonths);
  let balance = loanAmount;
  for (let t = 0; t < termMonths; t++) {
    const miApplies = monthlyMI > 0 && (miTerminationBalance === 0 || balance > miTerminationBalance);
    payments[t] = pAndI + (miApplies ? monthlyMI : 0);
    balance -= pAndI - balance * monthlyRate;
  }
  return payments;
}

/**
 * Solves the periodic-rate equation: finds the annual rate (%) at which the
 * present value of `payments` equals `amountFinanced`. Bisection — the PV is
 * strictly decreasing in the rate, so convergence is guaranteed.
 */
export function solveAPRFromStream(amountFinanced: number, payments: number[]): number {
  if (amountFinanced <= 0) {
    throw new Error("APR solve requires a positive amount financed");
  }
  if (payments.length === 0) {
    throw new Error("APR solve requires a non-empty payment stream");
  }

  const presentValue = (monthlyRate: number): number => {
    let pv = 0;
    let discount = 1;
    const base = 1 + monthlyRate;
    for (let t = 0; t < payments.length; t++) {
      discount /= base;
      pv += payments[t] * discount;
    }
    return pv;
  };

  // Total of payments below the amount financed means a negative rate —
  // outside any scenario this platform prices. Guard rather than extrapolate.
  if (presentValue(0) <= amountFinanced) return 0;

  let lo = 0;
  let hi = 0.1; // 120% annual — far above any priced scenario
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (presentValue(mid) > amountFinanced) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-10) break;
  }

  const annualPct = ((lo + hi) / 2) * 12 * 100;
  return Math.round(annualPct * 1000) / 1000;
}

export interface MortgageAPRParams extends MortgageStreamParams {
  /** Sum of prepaid finance charges per §1026.4 (origination, points, app/underwriting fees, prepaid interest, upfront MI). */
  prepaidFinanceCharges: number;
}

/** Full mortgage APR: builds the payment stream and solves against the amount financed. */
export function calculateMortgageAPR(params: MortgageAPRParams): number {
  const payments = buildMortgagePaymentStream(params);
  const amountFinanced = params.loanAmount - params.prepaidFinanceCharges;
  return solveAPRFromStream(amountFinanced, payments);
}

// ---------------------------------------------------------------------------
// Representative fee model for ADVERTISED rates.
//
// Advertised APRs must reflect fees a borrower would actually incur. This
// mirrors the platform fee schedule in services/loanCosts.ts (shared by the
// Loan Estimate and the scenario simulator) — if that schedule changes,
// change this with it. Prepaid interest assumes 15 days.
// ---------------------------------------------------------------------------

export interface AdvertisedFeeModelOptions {
  isFHA?: boolean;
}

/**
 * Representative fee model for ADVERTISED rates only — there is no borrower and
 * therefore no elected compensation model on a marketing surface. It keeps the
 * borrower-paid origination fee unconditionally, which is the conservative
 * direction for advertising (a higher disclosed APR, never a lower one).
 *
 * services/loanCosts.ts is the transaction-level schedule and does NOT work
 * this way: there the origination fee is zero under a lender-paid plan
 * (§1026.36(d)(2)). The two are intentionally different; do not "reconcile"
 * them by making this one conditional on a model that does not exist here.
 */
export function estimatePrepaidFinanceCharges(
  loanAmount: number,
  noteRatePct: number,
  options: AdvertisedFeeModelOptions = {},
): number {
  const originationFee = loanAmount * ORIGINATION_FEE_RATE;
  const applicationFee = PLATFORM_APPLICATION_FEE;
  const underwritingFee = PLATFORM_UNDERWRITING_FEE;
  const taxServiceFee = 100;
  const prepaidInterest = ((loanAmount * (noteRatePct / 100)) / 365) * 15;
  // FHA up-front MIP is a prepaid finance charge. The rate lives in
  // services/mortgageInsurance.ts (FHA_UPFRONT_MIP_RATE) — one figure for
  // this advertised model and the transaction-level LE/scenario surfaces.
  const upfrontMIP = options.isFHA ? fhaUpfrontMIP(loanAmount) : 0;
  return originationFee + applicationFee + underwritingFee + taxServiceFee + prepaidInterest + upfrontMIP;
}

/** Advertised-rate APR from the representative fee model. */
export function advertisedAPR(
  loanAmount: number,
  noteRatePct: number,
  termMonths: number,
  options: AdvertisedFeeModelOptions = {},
): number {
  // FHA annual MIP (0.55% of the loan amount) runs for the life of the loan
  // at the LTVs we advertise; conventional marketing profiles are ≤80% LTV,
  // so no monthly MI.
  const monthlyMI = options.isFHA ? (loanAmount * 0.0055) / 12 : 0;
  return calculateMortgageAPR({
    loanAmount,
    noteRatePct,
    termMonths,
    monthlyMI,
    // Life-of-loan MIP: no 78% termination for FHA (post-2013 rules at >90% LTV).
    propertyValue: options.isFHA ? 0 : undefined,
    prepaidFinanceCharges: estimatePrepaidFinanceCharges(loanAmount, noteRatePct, options),
  });
}
