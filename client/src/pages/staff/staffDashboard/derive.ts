/**
 * Derived values for the staff dashboard — the counts behind the KPI tiles,
 * the queue ordering, and the pipeline search filter.
 *
 * Extracted from StaffDashboard.tsx unchanged. These feed numbers a loan
 * officer triages by, so "0 breached" or an empty search result being wrong is
 * an operational problem, not a cosmetic one.
 */
import type { Task } from "@shared/schema";
import { SLA_SORT_ORDER } from "@/lib/sla";
import type { PipelineSummary, QueueTask } from "./model";

/** Tasks that are done or dead never occupy a queue. */
const isOpen = (t: QueueTask) => t.status !== "COMPLETED" && t.status !== "EXPIRED";

/**
 * Worst SLA state first, then soonest due.
 *
 * A task with no due date sorts last rather than first — Infinity, not 0. It
 * is unbounded work, so it must never displace something actually running out
 * of time at the top of the queue.
 */
export function sortQueueTasks(queueTasks: QueueTask[] | undefined): QueueTask[] {
  return (queueTasks || [])
    .filter(isOpen)
    .sort((a, b) => {
      const aOrder = SLA_SORT_ORDER[a.slaStatus] ?? 2;
      const bOrder = SLA_SORT_ORDER[b.slaStatus] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.timeRemaining ?? Infinity) - (b.timeRemaining ?? Infinity);
    });
}

export const countBreached = (sorted: QueueTask[]): number =>
  sorted.filter(t => t.slaStatus === "red").length;

/** Rule-engine work, i.e. anything not raised by a person. */
export const automatedTasks = (sorted: QueueTask[]): QueueTask[] =>
  sorted.filter(t => t.triggerSource && t.triggerSource !== "MANUAL");

/**
 * Awaiting review = document submitted (IN_PROGRESS) with the verification
 * verdict still pending.
 *
 * The old check compared status === "submitted", a value the canonical task
 * vocabulary never contained — so the tile read 0 no matter how much work was
 * actually waiting. Keep both halves of this predicate.
 */
export const awaitingReview = (tasks: Task[]): Task[] =>
  tasks.filter(t => t.status === "IN_PROGRESS" && t.verificationStatus === "pending");

/** Sums loanAmount defensively — the column is a nullable numeric string. */
export function totalPipelineVolume(pipeline: PipelineSummary[]): number {
  return pipeline.reduce((sum, l) => sum + (parseFloat(l.loanAmount || "0") || 0), 0);
}

/** Case-insensitive match over borrower name, stage and application id. */
export function matchesPipelineSearch(item: PipelineSummary, searchTerm: string): boolean {
  if (!searchTerm) return true;
  const s = searchTerm.toLowerCase();
  return (
    (item.borrowerName || "").toLowerCase().includes(s) ||
    item.currentStage.toLowerCase().includes(s) ||
    item.applicationId.toLowerCase().includes(s)
  );
}
