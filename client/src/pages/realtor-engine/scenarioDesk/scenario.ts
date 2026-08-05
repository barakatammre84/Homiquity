/**
 * Scenario pricing for the agent-facing scenario desk.
 *
 * Extracted verbatim from ScenarioDesk.tsx. Deterministic — no clock, no
 * randomness, no I/O.
 *
 * The DEFAULT_RATES below are illustrative program defaults for a what-if
 * tool, not a rate sheet: the user can override the rate, and real pricing
 * comes from the LLPA/pricing engine. Likewise programNotes are educational
 * program summaries, not an eligibility determination.
 */
export type LoanProgram = "conventional" | "fha" | "va" | "usda";

export interface ScenarioInput {
  purchasePrice: string;
  downPaymentPercent: string;
  creditScore: string;
  loanProgram: LoanProgram;
  annualIncome: string;
  interestRate: string;
  propertyTaxRate: string;
  insuranceRate: string;
}

export interface ScenarioResult {
  loanAmount: number;
  downPaymentAmount: number;
  ltv: number;
  monthlyPrincipalInterest: number;
  monthlyPmi: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  dti: number | null;
  programNotes: string[];
  interestRateUsed: number;
}

export const DEFAULT_RATES: Record<LoanProgram, number> = {
  conventional: 6.875,
  fha: 6.5,
  va: 6.25,
  usda: 6.375,
};

export const PROGRAM_LABELS: Record<LoanProgram, string> = {
  conventional: "Conventional",
  fha: "FHA",
  va: "VA",
  usda: "USDA",
};

export function calculateScenario(input: ScenarioInput): ScenarioResult | null {
  const purchasePrice = parseFloat(input.purchasePrice);
  const downPaymentPercent = parseFloat(input.downPaymentPercent);
  const creditScore = parseInt(input.creditScore);

  if (!purchasePrice || purchasePrice <= 0) return null;
  if (isNaN(downPaymentPercent) || downPaymentPercent < 0 || downPaymentPercent > 100) return null;
  if (!creditScore || creditScore < 300 || creditScore > 850) return null;

  const loanProgram = input.loanProgram;
  const interestRate = input.interestRate ? parseFloat(input.interestRate) : DEFAULT_RATES[loanProgram];
  const propertyTaxRate = input.propertyTaxRate ? parseFloat(input.propertyTaxRate) : 1.1;
  const insuranceRate = input.insuranceRate ? parseFloat(input.insuranceRate) : 0.35;
  const annualIncome = input.annualIncome ? parseFloat(input.annualIncome) : null;

  const downPaymentAmount = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPaymentAmount;
  const ltv = (loanAmount / purchasePrice) * 100;

  const monthlyRate = interestRate / 12 / 100;
  const numPayments = 360;
  const monthlyPrincipalInterest =
    monthlyRate > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  let monthlyPmi = 0;
  if (loanProgram === "conventional" && ltv > 80) {
    monthlyPmi = (loanAmount * 0.005) / 12;
  } else if (loanProgram === "fha") {
    monthlyPmi = (loanAmount * 0.0085) / 12;
  }

  const monthlyPropertyTax = (purchasePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (purchasePrice * (insuranceRate / 100)) / 12;
  const totalMonthlyPayment = monthlyPrincipalInterest + monthlyPmi + monthlyPropertyTax + monthlyInsurance;

  let dti: number | null = null;
  if (annualIncome && annualIncome > 0) {
    dti = (totalMonthlyPayment / (annualIncome / 12)) * 100;
  }

  const programNotes: string[] = [];
  if (loanProgram === "fha") {
    programNotes.push("FHA requires minimum 3.5% down payment with 580+ credit score");
    if (downPaymentPercent < 3.5) {
      programNotes.push("Warning: Down payment is below FHA minimum of 3.5%");
    }
    if (creditScore < 580) {
      programNotes.push("FHA requires 10% down payment for credit scores below 580");
    }
    programNotes.push("FHA MIP is required for the life of the loan with less than 10% down");
  } else if (loanProgram === "va") {
    programNotes.push("VA loans require no down payment and no PMI");
    programNotes.push("VA funding fee may apply (1.25% - 3.3% of loan amount)");
    if (downPaymentPercent === 0) {
      programNotes.push("100% financing available for eligible veterans");
    }
  } else if (loanProgram === "usda") {
    programNotes.push("USDA loans require no down payment for eligible rural areas");
    programNotes.push("USDA guarantee fee: 1% upfront + 0.35% annual");
    programNotes.push("Income limits apply based on county and household size");
  } else if (loanProgram === "conventional") {
    if (ltv > 80) {
      programNotes.push("PMI required when LTV exceeds 80%");
      programNotes.push("PMI can be removed once LTV reaches 78%");
    }
    if (downPaymentPercent < 3) {
      programNotes.push("Conventional loans typically require minimum 3% down payment");
    }
    if (creditScore < 620) {
      programNotes.push("Most conventional loans require minimum 620 credit score");
    }
  }

  if (dti !== null) {
    if (dti > 50) {
      programNotes.push("DTI exceeds 50% - may not qualify for most loan programs");
    } else if (dti > 43) {
      programNotes.push("DTI exceeds 43% - may need compensating factors for approval");
    }
  }

  return {
    loanAmount,
    downPaymentAmount,
    ltv,
    monthlyPrincipalInterest,
    monthlyPmi,
    monthlyPropertyTax,
    monthlyInsurance,
    totalMonthlyPayment,
    dti,
    programNotes,
    interestRateUsed: interestRate,
  };
}

