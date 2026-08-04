/**
 * Borrower-facing task view — the masked read model behind
 * GET /api/task-engine/applications/:id/borrower-tasks for non-staff callers.
 *
 * Modeled on shared/borrowerOfferView.ts: every mapper here is a strict
 * whitelist. The raw task row carries staff review free text
 * (verificationNotes, resolutionNotes), staff user ids (assignedToUserId,
 * verifiedByUserId, resolvedByUserId, createdByUserId), and escalation
 * internals that must never reach a borrower payload. A new field is exposed
 * by adding it to the view interface deliberately — never by spreading the
 * task.
 *
 * Two row shapes:
 *  - BORROWER-owned actionables keep their full borrower-facing context
 *    (title, description, document category/year/instructions).
 *  - Staff transparency rows (ownerRole !== "BORROWER", surfaced because
 *    their task type is flagged visibleToBorrower) display ONLY the
 *    mapping's borrowerDisplayText — the staff-authored working title and
 *    description stay internal.
 *
 * Lives in shared/ because it is pure and dependency-free at runtime: the
 * server maps rows through it, the client imports the view type, and the
 * unit suite exercises it without a database.
 */

export type BorrowerTaskSlaStatus = "green" | "amber" | "red";

/**
 * Structural subset of the server's TaskWithSlaStatus (+ the
 * borrowerDisplayText getBorrowerTasks attaches from taskTypeSlaMapping).
 * Declared here rather than imported because shared/ must not import from
 * server/. Fields the mapper deliberately drops are not listed — spreading
 * a wider object into the mapper input is fine; the OUTPUT is the contract.
 */
export interface MaskableBorrowerTask {
  id: string;
  applicationId: string;
  title: string;
  description: string | null;
  taskType: string;
  taskTypeCode: string | null;
  ownerRole: string | null;
  slaClass: string | null;
  status: string;
  priority: string | null;
  dueDate: Date | string | null;
  createdAt: Date | string | null;
  documentCategory: string | null;
  documentYear: string | null;
  documentInstructions: string | null;
  requestingTeam: string | null;
  isCustomRequest: boolean | null;
  verificationStatus: string | null;
  slaStatus: BorrowerTaskSlaStatus;
  timeRemaining: number | null;
  percentageElapsed: number | null;
  borrowerDisplayText?: string | null;
}

export interface BorrowerTaskView {
  id: string;
  applicationId: string;
  /** Borrower-owned: the task title. Staff transparency row: borrowerDisplayText. */
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  ownerRole?: string;
  slaClass?: string;
  status: string;
  priority?: string;
  dueDate?: Date | string | null;
  createdAt?: Date | string | null;
  documentCategory?: string;
  documentYear?: string;
  documentInstructions?: string;
  requestingTeam?: string;
  isCustomRequest?: boolean;
  verificationStatus?: string;
  slaStatus: BorrowerTaskSlaStatus;
  timeRemaining: number | null;
  percentageElapsed: number | null;
  /** Present only on staff transparency rows. */
  borrowerDisplayText?: string;
}

/** Fallback when a visible staff task somehow lacks display text (the seed
 *  invariant makes this unreachable; belt-and-suspenders for hand-inserted
 *  mappings). */
const GENERIC_TRANSPARENCY_TEXT = "In progress on our side.";

export function toBorrowerTaskView(task: MaskableBorrowerTask): BorrowerTaskView {
  const isBorrowerOwned = task.ownerRole === "BORROWER";

  const common = {
    id: task.id,
    applicationId: task.applicationId,
    taskType: task.taskType,
    taskTypeCode: task.taskTypeCode ?? undefined,
    ownerRole: task.ownerRole ?? undefined,
    slaClass: task.slaClass ?? undefined,
    status: task.status,
    priority: task.priority ?? undefined,
    dueDate: task.dueDate ?? undefined,
    createdAt: task.createdAt ?? undefined,
    verificationStatus: task.verificationStatus ?? undefined,
    slaStatus: task.slaStatus,
    timeRemaining: task.timeRemaining,
    percentageElapsed: task.percentageElapsed,
  };

  if (isBorrowerOwned) {
    return {
      ...common,
      title: task.title,
      description: task.description ?? undefined,
      documentCategory: task.documentCategory ?? undefined,
      documentYear: task.documentYear ?? undefined,
      documentInstructions: task.documentInstructions ?? undefined,
      requestingTeam: task.requestingTeam ?? undefined,
      isCustomRequest: task.isCustomRequest ?? undefined,
    };
  }

  // Staff transparency row: the mapping's borrowerDisplayText IS the borrower
  // display string; the staff-authored title/description stay internal.
  const displayText = task.borrowerDisplayText ?? GENERIC_TRANSPARENCY_TEXT;
  return {
    ...common,
    title: displayText,
    borrowerDisplayText: displayText,
  };
}

export function toBorrowerTaskViews(tasks: MaskableBorrowerTask[]): BorrowerTaskView[] {
  return tasks.map(toBorrowerTaskView);
}
