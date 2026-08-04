/**
 * Pure "what could I afford" estimate math — front/back-end DTI against
 * income and debts, back-solved to a max home price. Estimate-only (see
 * PresalesDisclaimer / PRESALES_DISCLAIMER): not underwriting, no vendor
 * calls, safe to run pre-signup. Shared by the public affordability
 * calculator and the pre-approval funnel's pre-signup teaser so the two
 * never drift.
 */

export interface AffordabilityEstimateInputs {
  annualIncome: number;
  monthlyDebts: number;
  downPaymentSaved: number;
  creditScore: number;
  interestRate: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  loanTermYears: number;
}

export interface AffordabilityEstimateResults {
  maxHomePrice: number;
  maxMonthlyPayment: number;
  frontEndDTI: number;
  backEndDTI: number;
  comfortablePrice: number;
  stretchPrice: number;
  requiredDownPayment: number;
  monthlyPITI: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  withinGuidelines: boolean;
}

/** Assumed rate/cost inputs for callers that haven't collected the
 * borrower's actual figures yet (no lender quote exists at this point). */
export const AFFORDABILITY_ESTIMATE_DEFAULTS = {
  interestRate: 6.5,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  loanTermYears: 30,
} as const;

export function calculateAffordabilityEstimate(
  inputs: AffordabilityEstimateInputs,
): AffordabilityEstimateResults {
  const {
    annualIncome,
    monthlyDebts,
    downPaymentSaved,
    creditScore,
    interestRate,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    loanTermYears,
  } = inputs;

  const monthlyIncome = annualIncome / 12;
  const maxFrontEndDTI = 0.28;
  const maxBackEndDTI = creditScore >= 740 ? 0.45 : creditScore >= 700 ? 0.43 : 0.41;

  const maxHousingPayment = monthlyIncome * maxFrontEndDTI;
  const maxTotalPayment = monthlyIncome * maxBackEndDTI - monthlyDebts;
  const maxMonthlyPayment = Math.min(maxHousingPayment, maxTotalPayment);

  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;
  const monthlyTaxInsuranceRate = (propertyTaxRate + insuranceRate) / 100 / 12;

  const availableForPI = maxMonthlyPayment - hoaMonthly;

  let maxLoanAmount = 0;
  if (monthlyRate > 0) {
    const factor =
      (Math.pow(1 + monthlyRate, numPayments) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments));
    maxLoanAmount = (availableForPI / (1 + monthlyTaxInsuranceRate * factor)) * factor;
  } else {
    maxLoanAmount = (availableForPI * numPayments) / (1 + monthlyTaxInsuranceRate * numPayments);
  }

  const minDownPaymentPercent = creditScore >= 740 ? 0.03 : creditScore >= 680 ? 0.05 : 0.1;

  let maxHomePrice = maxLoanAmount / (1 - minDownPaymentPercent);
  const maxFromDownPayment = downPaymentSaved / minDownPaymentPercent;
  maxHomePrice = Math.min(maxHomePrice, maxFromDownPayment);

  const comfortablePrice = maxHomePrice * 0.85;
  const stretchPrice = maxHomePrice * 1.1;
  const requiredDownPayment = maxHomePrice * minDownPaymentPercent;

  const loanAmount = maxHomePrice - requiredDownPayment;
  const monthlyPI =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyTax = (maxHomePrice * propertyTaxRate) / 100 / 12;
  const monthlyInsurance = (maxHomePrice * insuranceRate) / 100 / 12;
  const monthlyPMI = minDownPaymentPercent < 0.2 ? (loanAmount * 0.005) / 12 : 0;
  const monthlyPITI = monthlyPI + monthlyTax + monthlyInsurance + hoaMonthly + monthlyPMI;

  const frontEndDTI = (monthlyPITI / monthlyIncome) * 100;
  const backEndDTI = ((monthlyPITI + monthlyDebts) / monthlyIncome) * 100;
  const withinGuidelines = frontEndDTI <= 28 && backEndDTI <= maxBackEndDTI * 100;

  return {
    maxHomePrice: Math.max(0, maxHomePrice),
    maxMonthlyPayment: Math.max(0, maxMonthlyPayment),
    frontEndDTI,
    backEndDTI,
    comfortablePrice: Math.max(0, comfortablePrice),
    stretchPrice: Math.max(0, stretchPrice),
    requiredDownPayment: Math.max(0, requiredDownPayment),
    monthlyPITI: Math.max(0, monthlyPITI),
    monthlyPI: Math.max(0, monthlyPI),
    monthlyTax: Math.max(0, monthlyTax),
    monthlyInsurance: Math.max(0, monthlyInsurance),
    monthlyPMI: Math.max(0, monthlyPMI),
    withinGuidelines,
  };
}
