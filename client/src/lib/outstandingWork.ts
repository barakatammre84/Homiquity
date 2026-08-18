// THE selector for "what does the borrower still have to do".
//
// DESIGN_SYSTEM §13 (Agreement) requires every count, badge and empty state on
// a borrower surface to derive from one place. Before this module they did not,
// and the two surfaces disagreed in the borrower's least favourite direction:
//
//   • The dashboard card (BorrowerRequests) selected `status === "OPEN"` only.
//   • /tasks counted OPEN *and* BLOCKED as pending, and surfaced tasks whose
//     verification came back "rejected" as its most urgent bucket.
//
// So a borrower whose document was REJECTED — who must re-upload something —
// was told "You're all caught up / Nothing needed from you right now" on the
// dashboard, while /tasks said "Needs Your Attention (1)". That is the exact
// defect the Better teardown recorded at §6.1 and §8.
//
// The predicates below are deliberately structural rather than tied to one
// endpoint's type: the task-engine's borrower view and the `tasks` table row
// both satisfy `BorrowerActionableTask`, so both surfaces can share one
// definition without unifying their data sources (§14 keeps data-flow changes
// out of a conformance change). `verificationStatus` is in the borrower
// whitelist (shared/borrowerTaskView.ts), so no endpoint change is needed.

/** The minimal shape both borrower task representations satisfy. */
export interface BorrowerActionableTask {
  status: string;
  /** Present on both shapes; "rejected" means the borrower must redo something. */
  verificationStatus?: string | null;
  /**
   * Task-engine rows carry an owner. Staff-owned rows are shown to the borrower
   * for transparency ("in progress on our side") and are never their work.
   * Rows without an owner (the /api/tasks shape) are already borrower-scoped.
   */
  ownerRole?: string | null;
}

/** Terminal states that are not work: done, or dead. */
const CLOSED_STATUSES = new Set(["COMPLETED", "EXPIRED", "CANCELLED"]);

/** Statuses that represent live borrower work. BLOCKED still needs them. */
const OPEN_STATUSES = new Set(["OPEN", "BLOCKED"]);

/** True when the row belongs to the borrower rather than to staff. */
export function isBorrowerOwned(task: BorrowerActionableTask): boolean {
  // No ownerRole on the row means the caller already scoped to the borrower.
  return !task.ownerRole || task.ownerRole === "BORROWER";
}

/**
 * A verification came back rejected and the task is not closed — the borrower
 * has to redo something. This outranks the lifecycle bucket: a rejected task
 * needs attention whether its status is OPEN, BLOCKED or IN_PROGRESS.
 */
export function isRejectedTask(task: BorrowerActionableTask): boolean {
  return (
    task.verificationStatus === "rejected" && !CLOSED_STATUSES.has(task.status)
  );
}

/** Live work that has not been rejected — the ordinary "to do" bucket. */
export function isPendingTask(task: BorrowerActionableTask): boolean {
  return OPEN_STATUSES.has(task.status) && !isRejectedTask(task);
}

/**
 * THE question: is this task outstanding for the borrower right now?
 * Every count, badge and empty state on a borrower surface answers it here.
 */
export function needsBorrowerAction(task: BorrowerActionableTask): boolean {
  return isBorrowerOwned(task) && (isRejectedTask(task) || isPendingTask(task));
}

/** The outstanding subset, in the order given. */
export function selectOutstanding<T extends BorrowerActionableTask>(
  tasks: readonly T[] | undefined | null,
): T[] {
  return (tasks ?? []).filter(needsBorrowerAction);
}

/** How many things the borrower still has to do. */
export function countOutstanding(
  tasks: readonly BorrowerActionableTask[] | undefined | null,
): number {
  return selectOutstanding(tasks).length;
}
