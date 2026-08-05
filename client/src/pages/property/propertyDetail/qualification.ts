/**
 * Per-property qualification estimate for the property detail page.
 *
 * Extracted verbatim from PropertyDetail.tsx. Deterministic: no clock, no
 * randomness, no I/O.
 *
 * DUPLICATION NOTE: client/src/pages/borrower/BuyerProperties.tsx carries a
 * near-identical calculateAffordability — same credit-tier rate ladder
 * (760/720/680), same 1.25% tax, same max($100, 0.3%) insurance, same 0.8%
 * PMI above 80% LTV, same 50/43/36 DTI thresholds. The two differ only in
 * their message wording and in this one taking downPaymentPercent as a
 * parameter (BuyerProperties hardcodes 5%). They should share this module;
 * doing so is a follow-up because the two pages' reason strings differ and
 * merging them blindly would change copy on both.
 *
 * The rate ladder is a display estimate, not pricing — real pricing comes from
 * the LLPA/pricing engine.
 */
import type { Property } from "@shared/schema";

export interface PaymentBreakdown {
  principal: number;
  interest: number;
  taxes: number;
  insurance: number;
  pmi: number;
  hoa: number;
}

export type QualificationStatus = "within_guidelines" | "requires_review" | "exceeds_guidelines";

export interface QualificationNumbers {
  status: QualificationStatus;
  meetsGuidelines: boolean;
  estimatedPayment: number;
  paymentBreakdown: PaymentBreakdown;
  dtiWithProperty: number;
  requiredDownPayment: number;
  loanAmount: number;
  ltvRatio: number;
  /** The tier rate used, as an annual decimal (0.0625 = 6.25%). */
  annualRate: number;
  price: number;
  /** True when the property costs more than the borrower's pre-approval. */
  overPreApproval: boolean;
}

const TERM_MONTHS = 360;
const ANNUAL_TAX_RATE = 0.0125;
const ANNUAL_INSURANCE_RATE = 0.003;
const MIN_MONTHLY_INSURANCE = 100;
const ANNUAL_PMI_RATE = 0.008;
/** GSE-aligned DTI bands. */
export const DTI_HARD_CAP = 50;
export const DTI_REVIEW_THRESHOLD = 43;

/** Estimated note rate by credit tier. Display only — not the pricing engine. */
export function tierRate(creditScore?: number): number {
  if (creditScore && creditScore >= 760) return 0.0625;
  if (creditScore && creditScore >= 720) return 0.065;
  if (creditScore && creditScore >= 680) return 0.07;
  return 0.075;
}

/**
 * Returns null when income is unknown — DTI is unknowable without it, and
 * reporting 0% would read as "comfortably qualified".
 */
export function calculateQualificationNumbers(
  property: Pick<Property, "price">,
  preApprovalAmount: number,
  monthlyIncome: number,
  monthlyDebts: number,
  creditScore?: number,
  downPaymentPercent: number = 5,
): QualificationNumbers | null {
  if (monthlyIncome <= 0) return null;

  const price = parseFloat(property.price);
  const downPayment = price * (downPaymentPercent / 100);
  const loanAmount = price - downPayment;
  const ltvRatio = (loanAmount / price) * 100;

  const annualRate = tierRate(creditScore);
  const monthlyRate = annualRate / 12;

  const monthlyPI =
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, TERM_MONTHS))) /
    (Math.pow(1 + monthlyRate, TERM_MONTHS) - 1);

  // First-month split — principal grows and interest shrinks over the term, so
  // this is the least-favourable month, not an average.
  const interestFirstMonth = loanAmount * monthlyRate;
  const principalFirstMonth = monthlyPI - interestFirstMonth;

  const monthlyTax = (price * ANNUAL_TAX_RATE) / 12;
  const monthlyInsurance = Math.max(MIN_MONTHLY_INSURANCE, (price * ANNUAL_INSURANCE_RATE) / 12);
  const pmi = ltvRatio > 80 ? (loanAmount * ANNUAL_PMI_RATE) / 12 : 0;
  const hoa = 0;

  const estimatedPayment = monthlyPI + monthlyTax + monthlyInsurance + pmi + hoa;
  const dtiWithProperty = ((estimatedPayment + monthlyDebts) / monthlyIncome) * 100;

  const overPreApproval = price > preApprovalAmount;

  let status: QualificationStatus = "within_guidelines";
  if (overPreApproval) status = "exceeds_guidelines";
  if (dtiWithProperty > DTI_HARD_CAP) {
    status = "exceeds_guidelines";
  } else if (dtiWithProperty > DTI_REVIEW_THRESHOLD && status !== "exceeds_guidelines") {
    status = "requires_review";
  }

  return {
    status,
    meetsGuidelines: status !== "exceeds_guidelines",
    estimatedPayment,
    paymentBreakdown: {
      principal: principalFirstMonth,
      interest: interestFirstMonth,
      taxes: monthlyTax,
      insurance: monthlyInsurance,
      pmi,
      hoa,
    },
    dtiWithProperty,
    requiredDownPayment: downPayment,
    loanAmount,
    ltvRatio,
    annualRate,
    price,
    overPreApproval,
  };
}

/**
 * The borrower-facing reasons and tips.
 *
 * Kept beside the numbers but separate from them: BuyerProperties computes the
 * same figures with different wording, so when the two pages share the maths
 * only this part stays per-page.
 */
export function buildReasonsAndTips(
  q: QualificationNumbers,
  preApprovalAmount: number,
  downPaymentPercent: number,
  formatCurrency: (v: number) => string,
  creditScore?: number,
): { reasons: string[]; tips: string[] } {
  const reasons: string[] = [];
  const tips: string[] = [];

  if (q.overPreApproval) {
    reasons.push(`Property price of ${formatCurrency(q.price)} exceeds your pre-approval of ${formatCurrency(preApprovalAmount)}`);
    tips.push("Consider properties within your pre-approval amount");
  }

  const dti = q.dtiWithProperty.toFixed(1);
  if (q.dtiWithProperty > DTI_HARD_CAP) {
    reasons.push(`Your DTI would be ${dti}% (maximum allowed is 50%)`);
    tips.push("Pay down existing debts to improve your DTI ratio");
  } else if (q.dtiWithProperty > DTI_REVIEW_THRESHOLD) {
    reasons.push(`DTI of ${dti}% requires compensating factors`);
    tips.push("Additional documentation of reserves or income history may be needed");
  } else {
    // Both the <=36 and the 36-43 band produced this same line originally.
    reasons.push(`DTI of ${dti}% is within guidelines`);
  }

  if (downPaymentPercent < 20 && q.paymentBreakdown.pmi > 0) {
    tips.push(`With ${downPaymentPercent}% down, PMI of ${formatCurrency(q.paymentBreakdown.pmi)}/mo until 20% equity`);
  }
  if (creditScore !== undefined && creditScore < 680) {
    tips.push("Improving your credit score could lower your interest rate");
  }

  return { reasons, tips };
}
