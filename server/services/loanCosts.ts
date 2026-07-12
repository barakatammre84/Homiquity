// ---------------------------------------------------------------------------
// Platform closing-cost model — the ONE fee schedule behind the TRID Loan
// Estimate (services/loanEstimate.ts) and the LO-2 what-if scenario simulator
// (services/scenarioSimulator.ts). Extracted from generateLoanEstimate so a
// scenario's cash-to-close is the same number the Loan Estimate would show for
// the same inputs — two surfaces, one schedule.
//
// services/apr.ts's advertised-rate model mirrors the origination /
// application / underwriting / tax-service constants for marketing surfaces;
// change them together.
//
// Pure and side-effect free: prepaid interest takes a day count (the LE
// derives it from its estimated closing date; the simulator uses the same
// 15-day assumption as the advertised-fee model) so callers stay
// deterministic.
// ---------------------------------------------------------------------------

export interface ClosingCostInputs {
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  /** Note rate, %. */
  interestRate: number;
  /** Monthly private MI premium ($/month; 0 when none applies). */
  monthlyPMI: number;
  /** Days of prepaid interest collected at closing. */
  prepaidInterestDays: number;
  /** Annual property taxes; defaults to the platform 1.2%-of-price model. */
  annualPropertyTaxes?: number;
  /** Annual homeowner's insurance; defaults to max($1,200, 0.3% of price). */
  annualHomeownersInsurance?: number;
  /** Lender credits (e.g. the FTHB LLPA waiver), subtracted from cash to close. */
  lenderCredits?: number;
}

export interface ClosingCostStructure {
  originationFee: number;
  points: number;
  applicationFee: number;
  underwritingFee: number;
  appraisalFee: number;
  creditReportFee: number;
  floodDeterminationFee: number;
  taxServiceFee: number;
  titleInsurance: number;
  titleSearch: number;
  surveyFee: number;
  pestInspectionFee: number;
  recordingFees: number;
  transferTaxes: number;
  ownersTitleInsurance: number;

  annualPropertyTax: number;
  annualHomeownersInsurance: number;
  monthlyPropertyTax: number;
  monthlyHomeownersInsurance: number;
  monthlyEscrow: number;

  prepaidInterest: number;
  prepaidHomeownersInsurance: number;
  prepaidMortgageInsurance: number;
  prepaidPropertyTaxes: number;
  escrowHomeownersInsurance: number;
  escrowMortgageInsurance: number;
  escrowPropertyTaxes: number;

  loanCostsTotal: number;
  otherCostsTotal: number;
  totalClosingCosts: number;
  /** Prepaid finance charges per §1026.4 — the APR solver's fee input. */
  prepaidFinanceCharges: number;
  lenderCredits: number;
  cashToClose: number;
}

/**
 * Banded conventional monthly BPMI estimate by FICO/LTV (0 at or below 80
 * LTV). This is the Loan Estimate's disclosure-grade estimate; the
 * underwriting engine's binding figure resolves from the CONVENTIONAL_PMI
 * matrix at decision time.
 */
export function calculatePMI(loanAmount: number, propertyValue: number, creditScore: number): number {
  const ltv = (loanAmount / propertyValue) * 100;
  if (ltv <= 80) return 0;

  let rate = 0;
  if (creditScore >= 760) {
    rate = ltv > 95 ? 1.05 : ltv > 90 ? 0.80 : ltv > 85 ? 0.52 : 0.35;
  } else if (creditScore >= 720) {
    rate = ltv > 95 ? 1.35 : ltv > 90 ? 1.05 : ltv > 85 ? 0.68 : 0.45;
  } else if (creditScore >= 680) {
    rate = ltv > 95 ? 1.85 : ltv > 90 ? 1.40 : ltv > 85 ? 0.95 : 0.65;
  } else {
    rate = ltv > 95 ? 2.45 : ltv > 90 ? 1.90 : ltv > 85 ? 1.35 : 0.95;
  }

  return (loanAmount * rate / 100) / 12;
}

export function computeClosingCosts(input: ClosingCostInputs): ClosingCostStructure {
  const { purchasePrice, downPayment, loanAmount, interestRate, monthlyPMI } = input;

  const annualPropertyTax = input.annualPropertyTaxes ?? purchasePrice * 0.012;
  const monthlyPropertyTax = annualPropertyTax / 12;
  const annualHomeownersInsurance =
    input.annualHomeownersInsurance ?? Math.max(1200, purchasePrice * 0.003);
  const monthlyHomeownersInsurance = annualHomeownersInsurance / 12;
  const monthlyEscrow = monthlyPropertyTax + monthlyHomeownersInsurance;

  const originationFee = loanAmount * 0.01;
  const points = 0;
  const applicationFee = 500;
  const underwritingFee = 1500;
  const appraisalFee = 650;
  const creditReportFee = 75;
  const floodDeterminationFee = 25;
  const taxServiceFee = 100;
  const titleInsurance = loanAmount * 0.005;
  const titleSearch = 350;
  const surveyFee = 450;
  const pestInspectionFee = 150;
  const recordingFees = 150;
  const transferTaxes = purchasePrice * 0.001;

  const dailyInterest = (loanAmount * (interestRate / 100)) / 365;
  const prepaidInterest = dailyInterest * input.prepaidInterestDays;
  const prepaidHomeownersInsurance = annualHomeownersInsurance;
  const prepaidMortgageInsurance = monthlyPMI * 2;
  const prepaidPropertyTaxes = monthlyPropertyTax * 2;

  const escrowHomeownersInsurance = monthlyHomeownersInsurance * 3;
  const escrowMortgageInsurance = monthlyPMI * 2;
  const escrowPropertyTaxes = monthlyPropertyTax * 3;

  const ownersTitleInsurance = purchasePrice * 0.003;

  const loanCostsTotal = originationFee + points + applicationFee + underwritingFee +
    appraisalFee + creditReportFee + floodDeterminationFee + taxServiceFee +
    titleInsurance + titleSearch + surveyFee + pestInspectionFee;

  const otherCostsTotal = recordingFees + transferTaxes +
    prepaidHomeownersInsurance + prepaidMortgageInsurance + prepaidInterest + prepaidPropertyTaxes +
    escrowHomeownersInsurance + escrowMortgageInsurance + escrowPropertyTaxes +
    ownersTitleInsurance;

  const totalClosingCosts = loanCostsTotal + otherCostsTotal;

  // Prepaid finance charges per §1026.4: origination, points, application/
  // underwriting fees, tax service, prepaid interest, and prepaid MI.
  // Appraisal, credit report, title, survey, pest, and recording/transfer
  // charges are excluded (§1026.4(c)(7), (e)).
  const prepaidFinanceCharges =
    originationFee + points + applicationFee + underwritingFee + taxServiceFee +
    prepaidInterest + prepaidMortgageInsurance;

  const lenderCredits = input.lenderCredits ?? 0;
  const cashToClose = totalClosingCosts + downPayment - lenderCredits;

  return {
    originationFee,
    points,
    applicationFee,
    underwritingFee,
    appraisalFee,
    creditReportFee,
    floodDeterminationFee,
    taxServiceFee,
    titleInsurance,
    titleSearch,
    surveyFee,
    pestInspectionFee,
    recordingFees,
    transferTaxes,
    ownersTitleInsurance,

    annualPropertyTax,
    annualHomeownersInsurance,
    monthlyPropertyTax,
    monthlyHomeownersInsurance,
    monthlyEscrow,

    prepaidInterest,
    prepaidHomeownersInsurance,
    prepaidMortgageInsurance,
    prepaidPropertyTaxes,
    escrowHomeownersInsurance,
    escrowMortgageInsurance,
    escrowPropertyTaxes,

    loanCostsTotal,
    otherCostsTotal,
    totalClosingCosts,
    prepaidFinanceCharges,
    lenderCredits,
    cashToClose,
  };
}
