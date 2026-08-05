/**
 * Splitting and ordering the session list, and parsing the action-item box.
 *
 * One distinction here is deliberate and easy to mistake for a bug: the
 * "Completed" TAB holds completed AND cancelled sessions (its empty state says
 * so — "Completed and cancelled sessions will appear here"), while the
 * "Completed Sessions" STAT counts only genuinely completed ones. A cancelled
 * session is archived, not an accomplishment. Both are returned separately so
 * neither call site has to re-derive it.
 */
import type { StrategySession } from "./types";

const byScheduledAsc = (a: StrategySession, b: StrategySession) =>
  new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();

const byScheduledDesc = (a: StrategySession, b: StrategySession) =>
  new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();

export interface SessionPartition {
  /** status === "scheduled", soonest first. */
  upcoming: StrategySession[];
  /** completed + cancelled, most recent first. */
  archived: StrategySession[];
  /** Genuinely completed only — cancelled sessions are not an achievement. */
  completedCount: number;
  /** The soonest upcoming session, or null. */
  next: StrategySession | null;
}

export function partitionSessions(sessions: StrategySession[]): SessionPartition {
  // sort() mutates, so it must only ever run on the array filter() just
  // allocated — never on `sessions` itself, which is query-cache data.
  const upcoming = sessions.filter((s) => s.status === "scheduled").sort(byScheduledAsc);
  const archived = sessions
    .filter((s) => s.status === "completed" || s.status === "cancelled")
    .sort(byScheduledDesc);
  return {
    upcoming,
    archived,
    completedCount: sessions.filter((s) => s.status === "completed").length,
    next: upcoming[0] ?? null,
  };
}

/** One action item per line; blank lines are dropped, not stored as empties. */
export function parseActionItems(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The textarea round-trip of a stored action-item list. */
export function actionItemsToText(actionItems: string[] | null | undefined): string {
  return (actionItems || []).join("\n");
}
