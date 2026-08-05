/**
 * Per-document-category progress for the borrower onboarding journey.
 *
 * The journey page needs to answer "has this borrower supplied their tax
 * returns / bank statements yet?". Nothing in the onboarding payload used to
 * carry that, so the steps that ask for those documents hardcoded
 * `complete: false` and a self-employed or non-QM borrower could never reach
 * 100%. The answer lives in the tasks table: a document request carries a
 * `documentCategory`, and the task reaching COMPLETED is what "supplied and
 * accepted" means (the verify endpoint sets COMPLETED only on approval, and
 * reopens to OPEN on rejection).
 *
 * Pure: takes rows, returns counts. No DB, no clock.
 */

export interface DocumentCategoryProgress {
  /** Document-request tasks raised for this category. */
  requested: number;
  /** How many of them reached COMPLETED. */
  completed: number;
}

export type DocumentProgress = Record<string, DocumentCategoryProgress>;

/** The task lifecycle status that means the document was supplied and accepted. */
const COMPLETED_STATUS = "COMPLETED";

export interface DocumentTaskRow {
  documentCategory?: string | null;
  status?: string | null;
}

/**
 * Count document-request tasks per category.
 *
 * Tasks with no documentCategory are not document requests and are skipped —
 * they would otherwise all pile into one meaningless bucket.
 */
export function summariseDocumentTasks(tasks: DocumentTaskRow[]): DocumentProgress {
  const progress: DocumentProgress = {};
  for (const task of tasks) {
    const category = task.documentCategory;
    if (!category) continue;
    const entry = progress[category] ?? { requested: 0, completed: 0 };
    entry.requested += 1;
    if (task.status === COMPLETED_STATUS) entry.completed += 1;
    progress[category] = entry;
  }
  return progress;
}

/**
 * Is every document requested in this category accounted for?
 *
 * Requires at least one request. A category nobody has asked for is NOT
 * satisfied — "we never asked" is not the same as "you're done", and treating
 * it as done would mark a brand-new borrower's tax documentation complete
 * before they had uploaded anything.
 */
export function isCategorySatisfied(progress: DocumentProgress | undefined, category: string): boolean {
  const entry = progress?.[category];
  return !!entry && entry.requested > 0 && entry.completed === entry.requested;
}

/** Every listed category satisfied. An empty list is not satisfaction. */
export function areCategoriesSatisfied(
  progress: DocumentProgress | undefined,
  categories: readonly string[],
): boolean {
  return categories.length > 0 && categories.every(c => isCategorySatisfied(progress, c));
}
