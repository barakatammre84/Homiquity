// ---------------------------------------------------------------------------
// Change-of-circumstance reason catalog — Reg Z §1026.19(e)(3)(iv)(A)–(F).
//
// A creditor may only use a revised Loan Estimate to reset good-faith
// tolerance baselines for one of the six reasons below. The revised LE must
// be provided within 3 business days of receiving information sufficient to
// establish that the reason occurred (§1026.19(e)(4)(i)); this catalog is the
// single source for both the staff UI labels and server-side validation.
//
// Fee-tolerance / good-faith cure math is deliberately NOT automated: every
// recorded change of circumstance routes to manual review (counsel item in
// kb/compliance/COMPLIANCE_COUNSEL_REVIEW.md §6). Deterministic records only.
// ---------------------------------------------------------------------------

export const COC_REASON_TYPES = [
  "changed_circumstance_settlement",
  "changed_circumstance_eligibility",
  "borrower_requested",
  "rate_lock",
  "le_expiration",
  "construction_delay",
] as const;

export type CocReasonType = (typeof COC_REASON_TYPES)[number];

export const COC_STATUSES = ["open", "redisclosed", "voided"] as const;
export type CocStatus = (typeof COC_STATUSES)[number];

export interface CocReasonDefinition {
  id: CocReasonType;
  label: string;
  /** The authorizing clause of 12 CFR §1026.19(e)(3)(iv). */
  cite: string;
  description: string;
}

export const COC_REASONS: readonly CocReasonDefinition[] = [
  {
    id: "changed_circumstance_settlement",
    label: "Changed circumstance — settlement charges",
    cite: "12 CFR §1026.19(e)(3)(iv)(A)",
    description:
      "An extraordinary event, or information relied on that was inaccurate or changed, caused estimated settlement charges to increase.",
  },
  {
    id: "changed_circumstance_eligibility",
    label: "Changed circumstance — borrower eligibility",
    cite: "12 CFR §1026.19(e)(3)(iv)(B)",
    description:
      "A changed circumstance affected the consumer's creditworthiness or the value of the security, changing eligibility or the terms offered.",
  },
  {
    id: "borrower_requested",
    label: "Borrower-requested revision",
    cite: "12 CFR §1026.19(e)(3)(iv)(C)",
    description: "The consumer requested revisions to the credit terms or settlement that cause an estimated charge to increase.",
  },
  {
    id: "rate_lock",
    label: "Rate lock — rate-dependent charges changed",
    cite: "12 CFR §1026.19(e)(3)(iv)(D)",
    description:
      "The interest rate was locked and points or lender credits changed; a revised LE is required within 3 business days of the lock.",
  },
  {
    id: "le_expiration",
    label: "Loan Estimate expiration",
    cite: "12 CFR §1026.19(e)(3)(iv)(E)",
    description:
      "The consumer indicated intent to proceed more than 10 business days after the Loan Estimate was provided.",
  },
  {
    id: "construction_delay",
    label: "Construction loan — delayed settlement",
    cite: "12 CFR §1026.19(e)(3)(iv)(F)",
    description:
      "A construction loan with settlement expected more than 60 days after the LE, where the required clear-and-conspicuous statement was provided.",
  },
] as const;

export function cocReasonById(id: string): CocReasonDefinition | undefined {
  return COC_REASONS.find(r => r.id === id);
}
