/**
 * Bucketing the borrower's task list.
 *
 * Every rule here is a fix that has already been made once, which is why they
 * are pinned in taskBuckets.test.ts rather than left inline:
 *
 *  - Scope to the ACTIVE application. Tasks from old or denied applications
 *    are noise, not next steps (the "56 pending tasks" defect).
 *  - EXPIRED tasks are dead, not to-dos — they neither appear nor count
 *    against progress.
 *  - Buckets read the CANONICAL uppercase vocabulary. An earlier version
 *    grouped on lowercase values the task engine never writes, so every OPEN
 *    task was invisible on this page.
 *  - A "rejected" verdict on a non-completed task outranks its lifecycle
 *    bucket: it is the thing the borrower must act on.
 */
import type { Task } from "@shared/schema";

export interface TaskBuckets {
  myTasks: Task[];
  rejectedTasks: Task[];
  pendingTasks: Task[];
  pendingDocTasks: Task[];
  pendingOtherTasks: Task[];
  submittedTasks: Task[];
  completedTasks: Task[];
  totalTasks: number;
  completedCount: number;
  progressPercent: number;
}

export function bucketTasks(
  tasks: Task[] | undefined,
  activeApplicationId: string | undefined,
): TaskBuckets {
  const myTasks = (tasks || []).filter(
    (t) =>
      (!activeApplicationId || t.applicationId === activeApplicationId) &&
      t.status !== "EXPIRED",
  );

  const rejectedTasks = myTasks.filter(
    (t) => t.verificationStatus === "rejected" && t.status !== "COMPLETED",
  );
  const pendingTasks = myTasks.filter(
    (t) => (t.status === "OPEN" || t.status === "BLOCKED") && t.verificationStatus !== "rejected",
  );
  const submittedTasks = myTasks.filter(
    (t) => t.status === "IN_PROGRESS" && t.verificationStatus !== "rejected",
  );
  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED");

  // Milestone grouping: document requests collapse into ONE checklist card
  // instead of a wall of near-identical task rows.
  const pendingDocTasks = pendingTasks.filter((t) => t.taskType === "document_request");
  const pendingOtherTasks = pendingTasks.filter((t) => t.taskType !== "document_request");

  const totalTasks = myTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  return {
    myTasks,
    rejectedTasks,
    pendingTasks,
    pendingDocTasks,
    pendingOtherTasks,
    submittedTasks,
    completedTasks,
    totalTasks,
    completedCount,
    progressPercent,
  };
}
