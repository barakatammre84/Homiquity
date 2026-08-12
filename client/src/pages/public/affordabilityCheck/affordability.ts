/**
 * Affordability math for the /afford tool.
 *
 * Extracted verbatim from AffordabilityCheck.tsx — this is the calculation the
 * page has always run, now callable (and testable) without mounting a
 * component. The constants below are the same conservative heuristics
 * client/src/lib/buyingPowerScenario.ts documents for the landing-page
 * estimator, so the hero widget and this tool do not disagree.
 *
 * Deterministic by construction: no clock, no randomness, no I/O. Same
 * property + same inputs => same result, which is what affordability.test.ts
 * pins.
 */
import type { AffordabilityResult, AffordabilityStatus, FinancialInputs, PropertyData } from "./types";
import { monthlyPrincipalAndInterest } from "@shared/lib/amortization";

/** Annual homeowner's insurance as a share of price. */
const INSURANCE_ANNUAL_RATE = 0.005;
/** Annual PMI as a share of the loan, charged below 20% down. */
const PMI_ANNUAL_RATE = 0.005;
/** Down payment is capped at half the price — beyond that this tool isn't the right one. */
const MAX_DOWN_PAYMENT_SHARE = 0.5;
const TERM_MONTHS = 360;
/** Front-end (housing-only) DTI ceilings; the back-end ceiling is credit-tiered. */
const FRONT_END_LIMIT = 28;
const FRONT_END_STRETCH = 25;

// Off-market homes come back with no list price; fall back to the AVM
// estimate so the affordability math still works.
export function getBasisPrice(property: PropertyData): number {
  return property.price > 0 ? property.price : property.valueEstimate?.value ?? 0;
}

/** Back-end DTI ceiling by credit tier. */
export function maxBackEndDtiFor(creditScore: number): number {
  return creditScore >= 740 ? 45 : creditScore >= 700 ? 43 : 41;
}

export function calculateAffordabilityForProperty(
  property: PropertyData,
  inputs: FinancialInputs,
): AffordabilityResult {
  const { annualIncome, monthlyDebts, downPayment, creditScore, interestRate } = inputs;
  const price = getBasisPrice(property);

  if (price <= 0) {
    return {
      monthlyPayment: 0, principalInterest: 0, monthlyTax: 0, monthlyInsurance: 0,
      monthlyPMI: 0, monthlyHOA: 0, loanAmount: 0, downPaymentPercent: 0,
      frontEndDTI: 0, backEndDTI: 0, status: "affordable" as const, maxBackEndDTI: 43,
    };
  }

  const effectiveDown = Math.min(downPayment, price * MAX_DOWN_PAYMENT_SHARE);
  const loanAmount = price - effectiveDown;
  const downPaymentPercent = (effectiveDown / price) * 100;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = TERM_MONTHS;

  const principalInterest = monthlyPrincipalAndInterest(loanAmount, interestRate, numPayments);

  const monthlyTax = (price * property.propertyTaxRate) / 100 / 12;
  const monthlyInsurance = (price * INSURANCE_ANNUAL_RATE) / 12;
  const monthlyPMI = downPaymentPercent < 20 ? (loanAmount * PMI_ANNUAL_RATE) / 12 : 0;
  const monthlyHOA = property.hoaMonthly || 0;
  const monthlyPayment = principalInterest + monthlyTax + monthlyInsurance + monthlyPMI + monthlyHOA;

  const monthlyIncome = annualIncome / 12;
  const frontEndDTI = monthlyIncome > 0 ? (monthlyPayment / monthlyIncome) * 100 : 100;
  const backEndDTI = monthlyIncome > 0 ? ((monthlyPayment + monthlyDebts) / monthlyIncome) * 100 : 100;

  const maxBackEndDTI = maxBackEndDtiFor(creditScore);

  let status: AffordabilityStatus = "affordable";
  if (backEndDTI > maxBackEndDTI || frontEndDTI > FRONT_END_LIMIT) {
    status = "over_budget";
  } else if (backEndDTI > maxBackEndDTI - 5 || frontEndDTI > FRONT_END_STRETCH) {
    status = "stretch";
  }

  return {
    monthlyPayment,
    principalInterest,
    monthlyTax,
    monthlyInsurance,
    monthlyPMI,
    monthlyHOA,
    loanAmount,
    downPaymentPercent,
    frontEndDTI,
    backEndDTI,
    status,
    maxBackEndDTI,
  };
}
