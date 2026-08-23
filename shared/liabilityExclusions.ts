/**
 * B3-6-05, Monthly Debt Obligations — "Debts Paid by Others"
 * (Fannie Mae Selling Guide, edition 08/05/2026; a section revised in that
 * release). The one rule both DTI paths read, so the instant decision and the
 * staff calculations engine cannot disagree about which debts a borrower is
 * judged by.
 *
 * The Guide, paraphrased closely:
 *
 *   * NON-MORTGAGE debt (installment, student loans, revolving accounts,
 *     lease payments, alimony, child support, separate maintenance): when the
 *     borrower is obligated but is NOT the party actually repaying it, the
 *     lender MAY exclude the monthly payment. This applies whether or not the
 *     other party is obligated on the debt — but NOT if the other party is an
 *     interested party to the subject transaction (such as the seller or the
 *     real estate agent).
 *   * MORTGAGE debt: the full monthly housing expense (PITIA) may be excluded
 *     only if the party making the payments is obligated on the mortgage,
 *     there are no delinquencies in the most recent 12 months, and the
 *     borrower is not using rental income from that property to qualify.
 *     The property still counts toward the financed-property count.
 *   * EITHER WAY, to exclude the debt the lender must obtain the most recent
 *     12 months' cancelled checks (or bank statements) from the other party
 *     documenting a 12-month payment history with no delinquent payments.
 *
 * How this platform applies it — a product decision recorded here rather than
 * remembered: the exclusion is applied as soon as the borrower's answers make
 * the debt ELIGIBLE, and the 12-month documentation is raised as an
 * auto-generated loan condition (`PRE_UW_THIRD_PARTY_PAID_DEBT`) that staff
 * clear on the documents. The borrower is qualified on the ratio the Guide
 * entitles them to, with the paperwork named — not held to a ratio the Guide
 * says they need not carry. The 12-month no-delinquency fact is what the
 * documentation proves; it is not a self-reported field.
 */
import { isMortgageClassLiability } from "./liabilityTypes";

export const THIRD_PARTY_PAYMENT_HISTORY_DOCUMENT_TYPE = "third_party_payment_history";
export const THIRD_PARTY_PAYMENT_HISTORY_MONTHS = 12;
export const PAID_BY_OTHER_PARTY_CONDITION_RULE = "PRE_UW_THIRD_PARTY_PAID_DEBT";

/** Who makes the payments — a relationship, never a name (no third-party PII). */
export const OTHER_PARTY_RELATIONSHIPS = [
  { value: "family_member", label: "A parent or other family member" },
  { value: "former_spouse", label: "A former spouse or partner" },
  { value: "employer", label: "My employer" },
  { value: "business", label: "A business I own or work for" },
  { value: "other", label: "Someone else" },
] as const;

export type OtherPartyRelationship = (typeof OTHER_PARTY_RELATIONSHIPS)[number]["value"];

/**
 * Every field optional on purpose: the predicate is read with full DB rows,
 * with `Partial<UrlaLiability>` form rows, and with the decision path's
 * narrow liability shape, and an absent answer must mean the same thing as a
 * NULL one — "not answered".
 */
export interface PaidByOtherPartyFacts {
  liabilityType?: string | null;
  paidByOtherParty?: boolean | null;
  otherPartyObligated?: boolean | null;
  otherPartyInterestedParty?: boolean | null;
  usesRentalIncomeFromProperty?: boolean | null;
}

export type PaidByOtherPartyIneligibleReason =
  | "answers_incomplete"
  | "interested_party"
  | "mortgage_payer_not_obligated"
  | "mortgage_rental_income_used";

export type PaidByOtherPartyAssessment =
  | { status: "not_claimed" }
  | { status: "ineligible"; reason: PaidByOtherPartyIneligibleReason }
  | { status: "excludable"; mortgageClass: boolean };

/**
 * Borrower-facing copy for each ineligible reason — shared so the form, the
 * engine's breakdown and any notification say the same thing.
 */
export const PAID_BY_OTHER_PARTY_INELIGIBLE_COPY: Record<PaidByOtherPartyIneligibleReason, string> = {
  answers_incomplete:
    "Answer the questions about who makes the payments so we can tell whether this debt can be left out of your ratio.",
  interested_party:
    "Because the person paying is involved in this purchase (for example the seller or a real estate agent), Fannie Mae does not allow this payment to be left out of your debt ratio.",
  mortgage_payer_not_obligated:
    "For a mortgage, the person making the payments has to be on the loan too for the payment to be left out of your ratio.",
  mortgage_rental_income_used:
    "Because you are using rental income from this property to qualify, its mortgage payment stays in your ratio.",
};

export function assessPaidByOtherParty(l: PaidByOtherPartyFacts): PaidByOtherPartyAssessment {
  if (!l.paidByOtherParty) return { status: "not_claimed" };
  // The Guide's conditions are affirmative: an unanswered question is a
  // condition not yet met, and the debt stays in the ratio until it is. This
  // is not caution — the form asks every question the rule turns on.
  if (typeof l.otherPartyInterestedParty !== "boolean") {
    return { status: "ineligible", reason: "answers_incomplete" };
  }
  if (l.otherPartyInterestedParty) return { status: "ineligible", reason: "interested_party" };

  const mortgageClass = isMortgageClassLiability(l.liabilityType);
  if (mortgageClass) {
    if (typeof l.otherPartyObligated !== "boolean" || typeof l.usesRentalIncomeFromProperty !== "boolean") {
      return { status: "ineligible", reason: "answers_incomplete" };
    }
    if (!l.otherPartyObligated) return { status: "ineligible", reason: "mortgage_payer_not_obligated" };
    if (l.usesRentalIncomeFromProperty) return { status: "ineligible", reason: "mortgage_rental_income_used" };
  }
  return { status: "excludable", mortgageClass };
}

/** True when B3-6-05 lets this payment out of the recurring monthly obligations. */
export function isExcludedAsPaidByOtherParty(l: PaidByOtherPartyFacts): boolean {
  return assessPaidByOtherParty(l).status === "excludable";
}
