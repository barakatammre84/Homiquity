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
 * (draft, submitted, analyzing, in_review) where no amount exists yet, and
 * terminal statuses (denied, withdrawn, expired) which carry no amount.
 *
 * Both naming schemes in the codebase are covered ("conditional" from the
 * pipeline engine and "conditional_approval" from the staff status enum).
 */
export const AMOUNT_BEARING_STATUSES: ReadonlySet<string> = new Set([
  "pre_approved",
  "approved",
  "underwriting",
  "conditional",
  "conditional_approval",
  "clear_to_close",
  "closing",
  "funded",
]);

export function statusRequiresLoanAmount(status: string | null | undefined): boolean {
  return !!status && AMOUNT_BEARING_STATUSES.has(status);
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
