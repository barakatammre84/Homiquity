import { annuityFactor } from "@shared/lib/amortization";
export interface CreditTier {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  representativeScore: number;
  minDownPaymentPct: number;
  interestRate: number;
  pmiAnnualRate: number;
}

export interface CreditTiersResponse {
  baseRate: number;
  tiers: CreditTier[];
}

export interface RentInputs {
  monthlyRent: number;
  downPaymentSaved: number;
  creditScore: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  loanTermYears: number;
  zipCode: string;
}

export interface TierResult {
  homePrice: number;
  loanAmount: number;
  downPaymentNeeded: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  hoaMonthly: number;
  interestRate: number;
  minDownPaymentPct: number;
  pmiAnnualRate: number;
}

export const defaultInputs: RentInputs = {
  monthlyRent: 2000,
  downPaymentSaved: 10000,
  creditScore: 680,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  loanTermYears: 30,
  zipCode: "",
};

// Reverse-affordability: given a target monthly housing payment (the renter's
// current rent), derive the home price that payment could support at a given
// credit tier's rate / PMI / minimum down payment.
export function computeTierResult(
  monthlyRent: number,
  tier: CreditTier,
  inputs: RentInputs,
): TierResult {
  const { propertyTaxRate, insuranceRate, hoaMonthly, loanTermYears } = inputs;
  const monthlyRate = tier.interestRate / 100 / 12;
  const n = loanTermYears * 12;
  const d = tier.minDownPaymentPct;

  const factor = annuityFactor(tier.interestRate, n);

  const tiRate = (propertyTaxRate + insuranceRate) / 100 / 12;
  const pmiMonthly = d < 0.2 ? tier.pmiAnnualRate / 100 / 12 : 0;

  // payment = loan/factor + (loan/(1-d))*tiRate + loan*pmiMonthly + hoa
  const denom = 1 / factor + tiRate / (1 - d) + pmiMonthly;
  const available = Math.max(0, monthlyRent - hoaMonthly);
  const loanAmount = denom > 0 ? available / denom : 0;
  const homePrice = loanAmount / (1 - d);

  const monthlyPI = loanAmount / factor;
  const monthlyTax = (homePrice * propertyTaxRate) / 100 / 12;
  const monthlyInsurance = (homePrice * insuranceRate) / 100 / 12;
  const monthlyPMI = loanAmount * pmiMonthly;

  return {
    homePrice: Math.max(0, homePrice),
    loanAmount: Math.max(0, loanAmount),
    downPaymentNeeded: Math.max(0, homePrice * d),
    monthlyPI: Math.max(0, monthlyPI),
    monthlyTax: Math.max(0, monthlyTax),
    monthlyInsurance: Math.max(0, monthlyInsurance),
    monthlyPMI: Math.max(0, monthlyPMI),
    hoaMonthly,
    interestRate: tier.interestRate,
    minDownPaymentPct: d,
    pmiAnnualRate: tier.pmiAnnualRate,
  };
}
