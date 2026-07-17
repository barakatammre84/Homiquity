// =============================================================================
// STAGE REQUIREMENTS
//
// Data-integrity invariants for the loan-application status ladder. Certain
// statuses represent a credit decision or commitment *for an amount* — a
// pre-approval, approval, or anything downstream. Reaching one of those without
// a coherent, positive loan amount is an impossible state: it produces "$0"
// pipeline rows and a pre-approval that approves nothing.
//
// This module is the single source of truth for "which statuses require an
// amount" and "what the coherent amount of an application is." It is pure (no
// DB, no imports) so it can guard route/service seams and be unit-tested, and
// so the admin dashboard measures volume the same way the guard enforces it.
//
// Sibling guard: shared/dataProvenance.ts (assertVerifiedForDecisioning) gates
// the same stages on *verified* data; this gates them on a *coherent amount*.
// =============================================================================

/**
 * Statuses that commit the file to a loan amount. Reaching any of these without
 * a positive amount is incoherent. Deliberately excludes pre-decision statuses
 * (draft, submitted, analyzing, under_review) where no amount exists yet,
 * doc_collection/processing (reachable amount-less via under_review), and
 * terminal statuses (denied, withdrawn, expired) which carry no amount.
 *
 * Members are LOAN_APP_STATUSES values only (this module stays import-free for
 * purity, so tests/stageRequirements.test.ts reconciles the sets against the
 * canonical vocabulary — this is exactly LOAN_APP_APPROVED_GRADE_STATUSES minus
 * doc_collection/processing). The borrower-journey state machine
 * (server/services/borrowerStateMachine.ts) is a different vocabulary and
 * never passes through here.
 */
export const AMOUNT_BEARING_STATUSES: ReadonlySet<string> = new Set([
  "pre_approved",
  "underwriting",
  "conditional",
  "clear_to_close",
  "closing",
  "funded",
]);

export function statusRequiresLoanAmount(status: string | null | undefined): boolean {
  return !!status && AMOUNT_BEARING_STATUSES.has(status);
}

/**
 * Statuses where the borrower has reached a pre-approval or later — i.e. has
 * demonstrated commitment by progressing through the funnel. Beyond the
 * amount-bearing statuses this adds the post-approval processing sub-stages.
 *
 * Used to suppress engagement-based "uncertainty" signals that only make sense
 * pre-commitment: a pre-approved borrower with low recent clickstream activity
 * is mid-process, not wavering, so flagging them "uncertain/inactive"
 * contradicts their status.
 *
 * Set-equal to LOAN_APP_APPROVED_GRADE_STATUSES (pinned by tests).
 */
export const COMMITTED_STATUSES: ReadonlySet<string> = new Set([
  ...AMOUNT_BEARING_STATUSES,
  "doc_collection",
  "processing",
]);

export function isCommittedStage(status: string | null | undefined): boolean {
  return !!status && COMMITTED_STATUSES.has(status);
}

/** Parse a positive numeric amount from a decimal string / number field. */
export function positiveAmount(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface StageRequirementInput {
  status?: string | null;
  preApprovalAmount?: string | number | null;
  purchasePrice?: string | number | null;
}

/**
 * The coherent loan amount for an application: the purchase price once a
 * property is under contract, otherwise the pre-approval amount. Zero when
 * neither is present. This is exactly what admin "pipeline volume" measures.
 */
export function coherentLoanAmount(app: StageRequirementInput): number {
  return positiveAmount(app.purchasePrice) || positiveAmount(app.preApprovalAmount);
}

/**
 * Check whether an application (in its resulting state) satisfies the
 * requirements for its status. Returns the list of missing fields so callers
 * can surface a specific reason.
 */
export function checkStageRequirements(app: StageRequirementInput): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (statusRequiresLoanAmount(app.status) && coherentLoanAmount(app) <= 0) {
    missing.push("loanAmount");
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Guard for any code path that advances an application to an amount-bearing
 * status. Throws if the resulting state would be incoherent. Call it with the
 * *resulting* status plus the application's amount fields.
 */
export function assertStageRequirements(app: StageRequirementInput, context: string): void {
  const { ok, missing } = checkStageRequirements(app);
  if (!ok) {
    throw new Error(
      `Cannot advance application to "${app.status}" for ${context}: ` +
        `missing required data [${missing.join(", ")}]. ` +
        `A credit-decision status requires a positive pre-approval amount or purchase price.`,
    );
  }
}
