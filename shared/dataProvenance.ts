// =============================================================================
// DATA PROVENANCE
//
// Every financial figure in the system has a provenance. The distinction that
// matters for compliance is between what a user *thinks* they know (pre-sales,
// self-reported, for engagement) and what has been *verified* against documents
// or authoritative sources (used for decisions and required disclosures).
//
// Self-reported data may power calculators, "what could I afford" estimates, and
// engagement flows — always labeled non-binding. It must NEVER silently become
// the basis for a credit decision, a Loan Estimate/Closing Disclosure, a
// pre-approval letter, or anything that implies a commitment (TILA/TRID, ECOA).
// =============================================================================

export const DATA_PROVENANCE = {
  /** Entered by the borrower in a pre-sales / exploratory flow. Unverified. */
  SELF_REPORTED: "self_reported",
  /** Backed by a document, credit pull, or authoritative source. */
  VERIFIED: "verified",
  /** Derived by the system from other values (still inherits the weakest input). */
  SYSTEM_CALCULATED: "system_calculated",
} as const;

export type DataProvenance = (typeof DATA_PROVENANCE)[keyof typeof DATA_PROVENANCE];

/** Provenance strengths that may back a decision or a required disclosure. */
const DECISION_GRADE: ReadonlySet<DataProvenance> = new Set([DATA_PROVENANCE.VERIFIED]);

export function isDecisionGrade(provenance: DataProvenance | null | undefined): boolean {
  return !!provenance && DECISION_GRADE.has(provenance);
}

/**
 * Guard for any code path that produces a credit decision, disclosure, or
 * commitment. Throws if the underlying data is self-reported/estimated rather
 * than verified. Call this before generating an LE/CD, denial, approval, or
 * pre-approval letter from application data.
 */
export function assertVerifiedForDecisioning(
  provenance: DataProvenance | null | undefined,
  context: string,
): void {
  if (!isDecisionGrade(provenance)) {
    throw new Error(
      `Cannot use ${provenance ?? "unmarked"} data for ${context}: ` +
        `a credit decision or required disclosure must be based on verified data. ` +
        `Verify the borrower's figures against documentation first.`,
    );
  }
}

/**
 * The mandatory non-binding disclaimer for any pre-sales / self-reported output
 * shown to a borrower. Kept here so the AI gateway and UI use identical wording.
 */
export const PRESALES_DISCLAIMER =
  "These figures are estimates based on information you provided and have not " +
  "been verified. This is not a commitment to lend, a Loan Estimate, or an " +
  "approval. Actual terms depend on verification of your income, assets, credit, " +
  "and the property.";

/**
 * Non-binding disclaimer for borrower-facing PREDICTIVE insights (likelihood to
 * close, estimated days to funding). These are a deterministic heuristic over
 * self-reported data — surfacing them without a caveat risks reading as a
 * representation about the loan outcome (UDAAP, 12 U.S.C. §5531(d)/§5536; keep
 * consistent with the pre-approval funnel footnote). The explicit "not a
 * promised closing or funding date" clause covers the days-to-funding figure,
 * the sharpest exposure. Do not soften without compliance/counsel review.
 */
export const PREDICTION_INSIGHTS_DISCLAIMER =
  "These figures are estimates based on the information you've provided and " +
  "typical processing timelines — not a credit decision, an approval, a " +
  "guarantee that your loan will close, a promised closing or funding date, or a " +
  "commitment to lend. Your loan remains subject to full underwriting, " +
  "verification of your information, and property approval.";
