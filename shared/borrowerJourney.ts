/**
 * Borrower journey detail lines — pure derivation over payloads the borrower
 * is already authorized to see (Borrower Clarity PR 6, kb log 2026-08-04 §4).
 *
 * Input is what the pipeline endpoint + borrower-tasks endpoint already
 * return: the loan_milestones timestamp row, the pipeline engine's
 * document/condition counters, and whether the closing-prep transparency task
 * is in flight. Output is per-step display lines keyed by the JourneyTracker
 * step ids. No fetching, no clock, no new statuses, no new columns.
 *
 * Deliberately ABSENT (adjudicated, kb log 2026-08-04 §4):
 *  - "Income Audit Complete" — machine `requiresManualReview` semantics make
 *    "complete" a human-verification claim (MR-2); income transparency is the
 *    income-summary surface's job, post-decision.
 *  - "CD Issued" — loanApplications.cdIssuedDate has no writer; a milestone
 *    would be a lie.
 *
 * Dates format in UTC ("Aug 4") so the derivation is deterministic — a
 * milestone is a calendar fact recorded server-side, not a local-time event.
 */

export interface JourneyMilestoneTimestamps {
  submittedAt?: Date | string | null;
  preApprovedAt?: Date | string | null;
  docCollectionStartedAt?: Date | string | null;
  processingStartedAt?: Date | string | null;
  underwritingStartedAt?: Date | string | null;
  conditionalApprovedAt?: Date | string | null;
  clearToCloseAt?: Date | string | null;
  closingScheduledAt?: Date | string | null;
  fundedAt?: Date | string | null;
}

export interface JourneyDetailInput {
  milestones?: JourneyMilestoneTimestamps | null;
  /** Pipeline engine counters (progress.documentsComplete/documentsTotal). */
  documents?: { complete: number; total: number } | null;
  /** Pipeline engine counters (progress.conditionsCleared/conditionsTotal). */
  conditions?: { cleared: number; total: number } | null;
  /** True when the visible CMP_CLOSING_DISC staff task is OPEN/IN_PROGRESS. */
  closingPrepInProgress?: boolean;
}

/** Step ids match client JOURNEY_STEPS (JourneyTracker.tsx). */
export type JourneyStepId =
  | "submitted"
  | "pre_approved"
  | "processing"
  | "underwriting"
  | "clear_to_close"
  | "closing"
  | "funded";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatUtcDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function deriveJourneyStepDetails(
  input: JourneyDetailInput,
): Partial<Record<JourneyStepId, string[]>> {
  const m = input.milestones ?? {};
  const details: Partial<Record<JourneyStepId, string[]>> = {};
  const push = (step: JourneyStepId, line: string | undefined) => {
    if (!line) return;
    (details[step] ??= []).push(line);
  };

  const dated = (prefix: string, value: Date | string | null | undefined): string | undefined => {
    const date = formatUtcDate(value);
    return date ? `${prefix} ${date}` : undefined;
  };

  push("submitted", dated("Received", m.submittedAt));
  push("pre_approved", dated("Pre-approved", m.preApprovedAt));

  push("processing", dated("Started", m.processingStartedAt ?? m.docCollectionStartedAt));
  if (input.documents && input.documents.total > 0) {
    push("processing", `Documents: ${input.documents.complete} of ${input.documents.total} complete`);
  }

  push("underwriting", dated("Started", m.underwritingStartedAt));
  if (input.conditions && input.conditions.total > 0) {
    push("underwriting", `Conditions cleared: ${input.conditions.cleared} of ${input.conditions.total}`);
  }

  push("clear_to_close", dated("Cleared to close", m.clearToCloseAt));
  if (input.closingPrepInProgress) {
    push("clear_to_close", "We're preparing your closing paperwork");
  }

  push("closing", dated("Closing scheduled for", m.closingScheduledAt));
  push("funded", dated("Funded", m.fundedAt));

  return details;
}
