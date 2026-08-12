import { db } from "../db";
import { creditPulls } from "@shared/schema";
import { and, eq, isNotNull, desc } from "drizzle-orm";
import { taskEventEmitter } from "./taskEventEmitter";

/**
 * Credit monitoring sweep — the producer for an event socket that has been wired and
 * unfired since it was built.
 *
 * `taskEventEmitter.emitCreditEvent` and its task mappings (`CRD_SCORE_CHANGE`,
 * `CRD_NEW_TRADELINE`, `CRD_EXPIRED`) already exist, with SLAs seeded. Nothing called
 * them: `CREDIT_SCORE_DROPPED` was an unreachable event type, so no score change
 * anywhere in the product produced anything. This module is the missing plug.
 *
 * WHAT IT DELIBERATELY DOES NOT DO — solicit the borrower.
 * The pitch this program came from wants the opposite: "the exact moment their FICO score
 * crosses the threshold (e.g. 620 or 680), our Deterministic Underwriting Engine instantly
 * intercepts them for a mortgage pre-approval." That is a credit-triggered solicitation,
 * and two things block it here. First, this repo has no `permissiblePurpose` concept at
 * all — FCRA permissible purpose is currently conflated with consent, and using monitored
 * report data to trigger an offer is prescreen/firm-offer territory (§604(c), §615(d)).
 * Second, `LICENSED_STATES = ["IL"]`. So the output is a STAFF TASK. A human decides what,
 * if anything, happens next.
 *
 * WHY THERE IS NO MATERIALITY THRESHOLD. Any decrease fires. A "only if it drops more than
 * N points" rule would need N, and N would be a policy number invented here — the repo's
 * policy numbers come from the Postgres lookup matrices with citations
 * (`server/services/lookupResolver.ts`, whose `resolveMatrixValue` throws rather than
 * falling back, by Fair Lending design). Inventing 20 to keep the queue quiet is exactly
 * the move that rule exists to prevent. If materiality is wanted, it arrives as a seeded,
 * cited matrix scalar.
 *
 * KNOWN GAP — upward crossings are not emitted. `CreditEventType` has no "score improved"
 * member, and adding one means a new task-type code plus an SLA seed row. That is a
 * separate change with its own consumer; firing `CREDIT_SCORE_DROPPED` for a rise would
 * put a false statement in the event log's type column. See the adjudication log.
 */

/** Minimal shape the planner needs. Kept narrow so the planner stays pure and testable. */
export interface CreditPullSnapshot {
  readonly applicationId: string;
  readonly representativeScore: number | null;
  readonly completedAt: Date | null;
  readonly isSimulated: boolean;
}

export interface CreditScoreEvent {
  readonly applicationId: string;
  readonly previousScore: number;
  readonly newScore: number;
  readonly delta: number;
  /** True when either side of the comparison came from a fabricated pull. */
  readonly simulated: boolean;
}

export interface PlanOptions {
  /** Sweep time. Injected so the planner is deterministic and testable. */
  readonly now: Date;
  /**
   * Only fire when the newer pull completed within this many hours of `now`.
   *
   * THIS IS THE IDEMPOTENCY GUARD, and it is load-bearing. `emitCreditEvent` builds its
   * idempotencyKey as `credit_${type}_${applicationId}_${Date.now()}` — a fresh value on
   * every call — so the emitter does NOT dedupe. Without this window, a daily sweep would
   * re-emit the same delta between the same two pulls every day, forever, and each run
   * would create another staff task.
   */
  readonly lookbackHours: number;
}

export const DEFAULT_LOOKBACK_HOURS = 24;

/**
 * Pure planner: which score-drop events does this data imply? Exported for tests.
 *
 * Accepts pulls in any order and groups them by application. A pull participates only if
 * it is completed and carries a representative score — the middle score used for
 * underwriting. Comparing anything else (a single bureau, VantageScore) would mix score
 * models across a delta and produce a number that means nothing.
 */
export function planCreditScoreEvents(
  pulls: readonly CreditPullSnapshot[],
  { now, lookbackHours }: PlanOptions,
): CreditScoreEvent[] {
  const cutoff = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  const byApplication = new Map<string, CreditPullSnapshot[]>();
  for (const pull of pulls) {
    if (pull.representativeScore == null || pull.completedAt == null) continue;
    const list = byApplication.get(pull.applicationId) ?? [];
    list.push(pull);
    byApplication.set(pull.applicationId, list);
  }

  const events: CreditScoreEvent[] = [];
  for (const [applicationId, list] of byApplication) {
    if (list.length < 2) continue;

    // Newest first. completedAt is non-null for every survivor of the filter above.
    const sorted = [...list].sort(
      (a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime(),
    );
    const [newest, previous] = sorted;

    // Outside the window ⇒ already swept. See PlanOptions.lookbackHours.
    if ((newest.completedAt as Date) < cutoff) continue;

    const newScore = newest.representativeScore as number;
    const previousScore = previous.representativeScore as number;
    const delta = newScore - previousScore;
    if (delta >= 0) continue; // only drops have an event type today

    events.push({
      applicationId,
      previousScore,
      newScore,
      delta,
      simulated: newest.isSimulated || previous.isSimulated,
    });
  }

  // Stable order so a sweep's output does not depend on Map iteration incidentals.
  return events.sort((a, b) => a.applicationId.localeCompare(b.applicationId));
}

export interface CreditSweepResult {
  readonly scanned: number;
  readonly emitted: number;
}

/**
 * Load completed pulls and emit an event per score drop.
 *
 * Reads only the columns the planner needs — never the encrypted raw response, and never
 * a score VALUE into a log line (the repo control in creditAdverseActions.ts: UUIDs only).
 */
export async function runCreditMonitoringSweep(
  options: Partial<PlanOptions> = {},
): Promise<CreditSweepResult> {
  const now = options.now ?? new Date();
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;

  const rows = await db
    .select({
      applicationId: creditPulls.applicationId,
      representativeScore: creditPulls.representativeScore,
      completedAt: creditPulls.completedAt,
      isSimulated: creditPulls.isSimulated,
    })
    .from(creditPulls)
    .where(and(eq(creditPulls.status, "completed"), isNotNull(creditPulls.representativeScore)))
    .orderBy(desc(creditPulls.completedAt));

  const events = planCreditScoreEvents(rows as CreditPullSnapshot[], { now, lookbackHours });

  for (const event of events) {
    await taskEventEmitter.emitCreditEvent("CREDIT_SCORE_DROPPED", {
      applicationId: event.applicationId,
      previousScore: event.previousScore,
      newScore: event.newScore,
      triggeredBy: "credit_monitoring_sweep",
      metadata: {
        delta: event.delta,
        // Surfaced so a reviewer is never asked to act on a fabricated score without
        // being told it is fabricated. Every pull is simulated today — there is no live
        // bureau adapter (server/mcp/vendors.ts throws if a vendor key is set).
        simulated: event.simulated,
      },
    });
  }

  console.log(
    `[CreditMonitoring] swept ${rows.length} completed pull(s), emitted ${events.length} score-drop event(s)`,
  );

  return { scanned: rows.length, emitted: events.length };
}
