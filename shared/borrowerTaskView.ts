/**
 * Borrower-facing task view — the masked read model behind
 * GET /api/task-engine/applications/:id/borrower-tasks AND the legacy
 * /api/tasks family (list, per-user, per-application, detail, task-document
 * links, mutation responses) for non-staff callers.
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
 * unit suite exercises it without a database. Schema imports are type-only —
 * nothing from drizzle lands in the client bundle.
 */

import type { Task, TaskDocument, Document } from "./schema";

export type BorrowerTaskSlaStatus = "green" | "amber" | "red";

/**
 * tasks-table columns that may reach a client-role payload (directly, or —
 * for assignedToUserId — viewer-scoped to the caller's own assignment).
 * Together with BORROWER_TASK_EMBARGOED_COLUMNS this classifies EVERY column;
 * tests/borrowerTaskView.test.ts pins the union against the live table, so a
 * new tasks column fails the unit gate until it is classified deliberately.
 */
export const BORROWER_TASK_VIEW_COLUMNS = [
  "id",
  "applicationId",
  "assignedToUserId",
  "title",
  "description",
  "taskType",
  "taskTypeCode",
  "ownerRole",
  "slaClass",
  "documentCategory",
  "documentYear",
  "documentInstructions",
  "requestingTeam",
  "isCustomRequest",
  "status",
  "priority",
  "dueDate",
  "verificationStatus",
  "verifiedAt",
  "completedAt",
  "createdAt",
] as const satisfies readonly (keyof Task)[];

/** tasks-table columns that must never appear in a client-role payload. */
export const BORROWER_TASK_EMBARGOED_COLUMNS = [
  "createdByUserId",
  "triggerSource",
  "slaDueAt",
  "escalationLevel",
  "escalatedAt",
  "verificationNotes",
  "verifiedByUserId",
  "resolutionNotes",
  "resolvedByUserId",
  "autoResolved",
  "autoResolveCondition",
  "blocksLoanProgress",
  "aiAnalysisResult",
  "aiAnalyzedAt",
  "extractedData",
  "triggerMetadata",
  "updatedAt",
] as const satisfies readonly (keyof Task)[];

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
  /** Optional: the /api/tasks family serves plain rows without the SLA trio. */
  slaStatus?: BorrowerTaskSlaStatus;
  timeRemaining?: number | null;
  percentageElapsed?: number | null;
  /** Optional plain-row fields the legacy /api/tasks family carries. */
  assignedToUserId?: string | null;
  verifiedAt?: Date | string | null;
  completedAt?: Date | string | null;
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
  /** Verdict timestamp only — the free text and author never leave staff. */
  verifiedAt?: Date | string | null;
  completedAt?: Date | string | null;
  /** Present only when the SOURCE row carried the derived SLA trio. */
  slaStatus?: BorrowerTaskSlaStatus;
  timeRemaining?: number | null;
  percentageElapsed?: number | null;
  /**
   * Present only when the task is assigned to the viewer (the client computes
   * canUpload from it); anyone else's assignee id — e.g. the staff member on
   * a transparency-visible task — is never emitted.
   */
  assignedToUserId?: string;
  /** Present only on staff transparency rows. */
  borrowerDisplayText?: string;
}

/** Fallback when a visible staff task somehow lacks display text (the seed
 *  invariant makes this unreachable; belt-and-suspenders for hand-inserted
 *  mappings). */
const GENERIC_TRANSPARENCY_TEXT = "In progress on our side.";

/**
 * Mask one task row for a client-role viewer. viewerUserId (the requester's
 * own id, when the serving route knows it) scopes assignedToUserId: the
 * viewer's own assignment survives — TaskDetail computes canUpload from it —
 * while any other assignee id is dropped with the rest of the staff ids.
 */
export function toBorrowerTaskView(
  task: MaskableBorrowerTask,
  viewerUserId?: string,
): BorrowerTaskView {
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
    verifiedAt: task.verifiedAt ?? undefined,
    completedAt: task.completedAt ?? undefined,
    // The derived SLA trio travels only when the source row carried it (the
    // task-engine surfaces); the raw SLA internals never travel at all.
    ...(task.slaStatus !== undefined
      ? {
          slaStatus: task.slaStatus,
          timeRemaining: task.timeRemaining ?? null,
          percentageElapsed: task.percentageElapsed ?? null,
        }
      : {}),
    ...(viewerUserId !== undefined &&
    task.assignedToUserId != null &&
    task.assignedToUserId === viewerUserId
      ? { assignedToUserId: task.assignedToUserId }
      : {}),
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

export function toBorrowerTaskViews(
  tasks: MaskableBorrowerTask[],
  viewerUserId?: string,
): BorrowerTaskView[] {
  return tasks.map((task) => toBorrowerTaskView(task, viewerUserId));
}

/**
 * Task-document link rows carry their own per-document staff review free text
 * (task_documents.verification_notes — written by the staff verify action).
 *
 * The joined document row is the borrower's own application document —
 * a borrower-authorized resource with its own surfaces — so it passes through
 * subtractively rather than via a second whitelist. The subtraction follows
 * the publicExtraction() doctrine (server/routes/documents.ts): the encrypted
 * extraction payload (ciphertext/IV/key id) is server-side only, and the
 * reviewer's user id is staff metadata; rejectionReason stays — it IS the
 * borrower-facing "what to re-upload" copy.
 */
export type BorrowerTaskDocument = Omit<
  Document,
  "extractionRawEncrypted" | "extractionRawIv" | "extractionRawKeyId" | "reviewedByUserId"
>;

export interface BorrowerTaskDocumentView {
  id: string;
  taskId: string;
  documentId: string;
  isVerified: boolean | null;
  createdAt: TaskDocument["createdAt"];
  document?: BorrowerTaskDocument;
}

export function toBorrowerTaskDocumentView(
  taskDoc: TaskDocument & { document?: Document },
): BorrowerTaskDocumentView {
  const view: BorrowerTaskDocumentView = {
    id: taskDoc.id,
    taskId: taskDoc.taskId,
    documentId: taskDoc.documentId,
    isVerified: taskDoc.isVerified,
    createdAt: taskDoc.createdAt,
  };
  if (taskDoc.document !== undefined) {
    const { extractionRawEncrypted, extractionRawIv, extractionRawKeyId, reviewedByUserId, ...rest } =
      taskDoc.document;
    view.document = rest;
  }
  return view;
}
