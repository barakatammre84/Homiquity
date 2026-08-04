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
//
// COMPENSATION IS A REQUIRED INPUT (12 CFR §1026.36(d)(2)). A loan originator
// may not be paid by the consumer and by another person on the same
// transaction, so the borrower-paid origination fee is not a constant — it is
// a function of how the originator is paid. Under a lender-paid plan it is
// ZERO, and the compensation the lender pays is reported separately (it is not
// a charge to the borrower and does not appear in the borrower's cost totals,
// but it does count toward the QM points-and-fees cap — see
// shared/compliance/loCompensation.ts).
//
// There is deliberately no default: a missing compensation model must stop the
// Loan Estimate, because assuming one is exactly the §1026.36(d)(2) mistake.
// ---------------------------------------------------------------------------

import {
  borrowerPaidOriginationAllowed,
  compensationAmount,
  type OriginatorCompensation,
} from "@shared/compliance/loCompensation";
import { resolveFeeAmount, type ActualFeeMap } from "@shared/compliance/feeProvenance";

/** Borrower-paid origination fee as a fraction of the loan amount. */
export const ORIGINATION_FEE_RATE = 0.01;
/**
 * Flat platform fees. Exported because the QM points-and-fees floor
 * (services/mismoValidation.ts) must score the same numbers the Loan Estimate
 * discloses — two surfaces, one schedule.
 */
export const PLATFORM_APPLICATION_FEE = 500;
export const PLATFORM_UNDERWRITING_FEE = 1500;

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
  /**
   * How the loan originator is paid on this transaction. Required — see the
   * header. Determines whether the borrower is charged an origination fee.
   */
  compensation: OriginatorCompensation;
  /**
   * Real, known third-party charges for THIS file (the AMC's appraisal quote,
   * the title company's figure) keyed by the fee ids in
   * shared/compliance/feeProvenance.ts. Any fee present here is disclosed at
   * its actual amount instead of the platform estimate.
   *
   * This is the practical half of the F-9 fix: the fee constants below are
   * unverified national figures sitting in a zero-tolerance bucket, and the
   * appraisal is the largest single variance on a file. Disclosing the real
   * number when it is known removes the cure rather than measuring it.
   */
  actualFees?: ActualFeeMap;
  /** Annual property taxes; defaults to the platform 1.2%-of-price model. */
  annualPropertyTaxes?: number;
  /** Annual homeowner's insurance; defaults to max($1,200, 0.3% of price). */
  annualHomeownersInsurance?: number;
  /** Lender credits (e.g. the FTHB LLPA waiver), subtracted from cash to close. */
  lenderCredits?: number;
}

export interface ClosingCostStructure {
  /** Borrower-paid origination fee. Always 0 under a lender-paid plan. */
  originationFee: number;
  /**
   * Compensation the wholesale lender pays the originator. NOT a borrower
   * charge — excluded from every borrower-facing total below, and excluded
   * from the Loan Estimate (which has no "paid by others" column; that column
   * exists only on the Closing Disclosure). Carried here because the QM
   * points-and-fees cap counts it.
   */
  lenderPaidCompensation: number;
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
  const { purchasePrice, downPayment, loanAmount, interestRate, monthlyPMI, compensation } = input;

  if (!compensation) {
    throw new Error(
      "Originator compensation model is required to compute closing costs (12 CFR 1026.36(d)(2))",
    );
  }

  const annualPropertyTax = input.annualPropertyTaxes ?? purchasePrice * 0.012;
  const monthlyPropertyTax = annualPropertyTax / 12;
  const annualHomeownersInsurance =
    input.annualHomeownersInsurance ?? Math.max(1200, purchasePrice * 0.003);
  const monthlyHomeownersInsurance = annualHomeownersInsurance / 12;
  const monthlyEscrow = monthlyPropertyTax + monthlyHomeownersInsurance;

  // §1026.36(d)(2): charge the borrower an origination fee ONLY when the
  // originator takes compensation from nobody else on this transaction.
  const originationFee = borrowerPaidOriginationAllowed(compensation.model)
    ? loanAmount * ORIGINATION_FEE_RATE
    : 0;
  const lenderPaidCompensation =
    compensation.model === "lender_paid" ? compensationAmount(loanAmount, compensation) : 0;
  const points = 0;
  const applicationFee = PLATFORM_APPLICATION_FEE;
  const underwritingFee = PLATFORM_UNDERWRITING_FEE;
  // Third-party charges. Every constant below is an UNVERIFIED national
  // working figure with no citation — provenance and the known-suspect entries
  // are catalogued in shared/compliance/feeProvenance.ts (audit F-9). A file
  // with a real quote recorded discloses that instead.
  const actuals = input.actualFees ?? {};
  const fee = (id: string, estimate: number) => resolveFeeAmount(id, estimate, actuals);

  const appraisalFee = fee("appraisal", 650);
  const creditReportFee = fee("credit_report", 75);
  const floodDeterminationFee = fee("flood_determination", 25);
  const taxServiceFee = fee("tax_service", 100);
  const titleInsurance = fee("title_insurance", loanAmount * 0.005);
  const titleSearch = fee("title_search", 350);
  const surveyFee = fee("survey_fee", 450);
  const pestInspectionFee = fee("pest_inspection", 150);
  const recordingFees = fee("recording_fees", 150);
  // SUSPECT (F-9): a single national percentage applied to an Illinois-only
  // footprint, where transfer tax is levied at state, county AND municipal
  // level. Zero-tolerance, so an understatement is a dollar-for-dollar cure.
  const transferTaxes = fee("transfer_taxes", purchasePrice * 0.001);

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
  //
  // OPEN ITEM — lender-paid compensation and the APR. §1026.4(a)(3) governs
  // whether a fee payable to a mortgage broker is a finance charge when the
  // creditor rather than the consumer pays it. That text could not be
  // verified when this was written (ledger: regz-1026-36d2-dual-compensation),
  // so `lenderPaidCompensation` is deliberately NOT added here — the APR math
  // is unchanged from its previously-verified state rather than altered on an
  // unverified reading. Resolve before the first real lender-paid file.
  const prepaidFinanceCharges =
    originationFee + points + applicationFee + underwritingFee + taxServiceFee +
    prepaidInterest + prepaidMortgageInsurance;

  const lenderCredits = input.lenderCredits ?? 0;
  const cashToClose = totalClosingCosts + downPayment - lenderCredits;

  return {
    originationFee,
    lenderPaidCompensation,
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
