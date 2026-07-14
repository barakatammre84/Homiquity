import { EventEmitter } from "node:events";
import { storage } from "../../storage";
import { evaluateBrokerSubmissionReadiness } from "../brokerSubmissionReadiness";
import type { AutopilotPhase, AutopilotStatus } from "@shared/autopilotStatus";

export type { AutopilotPhase, AutopilotStatus } from "@shared/autopilotStatus";

/**
 * Autopilot real-time surfacing (Phase 4).
 *
 * A tiny in-process pub/sub + a DB-derived status snapshot. The orchestrator
 * publishes transitions (reviewing → result); the SSE endpoint
 * (server/routes/autopilot.ts) forwards them to the borrower's live banner AND
 * re-derives the snapshot from the DB on an interval — so the banner is correct
 * across serverless instances even when the orchestrator ran in a different
 * process than the one holding the SSE connection. (Durable cross-instance push
 * is a Phase 5 concern — the outbox — this is best-effort push + DB truth.)
 *
 * The status is broker packaging state, never a credit decision, and the copy
 * never claims approval (Reg N).
 */

const BANNER_COPY: Record<AutopilotPhase, string> = {
  reviewing: "We're reviewing your information…",
  clean: "Looks good! No issues found.",
  items_needed: "A few items needed.",
};

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open SSE connection

const channel = (applicationId: string) => `autopilot:${applicationId}`;

export function subscribeAutopilot(
  applicationId: string,
  listener: (status: AutopilotStatus) => void,
): () => void {
  const ch = channel(applicationId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
}

export function publishAutopilotStatus(status: AutopilotStatus): void {
  bus.emit(channel(status.applicationId), status);
}

/**
 * Derive the current status from the DB (source of truth). Never throws —
 * returns a best-effort snapshot so the banner always has something to show.
 */
export async function buildAutopilotStatus(applicationId: string): Promise<AutopilotStatus> {
  let outstanding = 0;
  let readyToSubmitToLender = false;
  let completed = 0;
  let total = 0;
  try {
    const conditions = await storage.getLoanConditionsByApplication(applicationId);
    outstanding = conditions.filter((c) => c.status === "outstanding").length;
  } catch {
    /* leave outstanding = 0 */
  }
  try {
    const readiness = await evaluateBrokerSubmissionReadiness(applicationId);
    readyToSubmitToLender = readiness.readyToSubmitToLender;
    const relevant = readiness.stages.filter((s) => s.status !== "not_applicable");
    total = relevant.length;
    completed = relevant.filter((s) => s.status === "ready").length;
  } catch {
    /* readiness is advisory */
  }

  const phase: AutopilotPhase = outstanding > 0 ? "items_needed" : "clean";
  return {
    applicationId,
    phase,
    message: BANNER_COPY[phase],
    outstandingConditions: outstanding,
    readyToSubmitToLender,
    readiness: { completed, total },
    updatedAt: new Date().toISOString(),
  };
}

/** Publish a transient "reviewing" state carrying the current (pre-run) counts. */
export async function publishReviewing(applicationId: string): Promise<void> {
  const snapshot = await buildAutopilotStatus(applicationId);
  publishAutopilotStatus({ ...snapshot, phase: "reviewing", message: BANNER_COPY.reviewing });
}

/** Recompute from the DB and publish the result state. */
export async function publishCurrentStatus(applicationId: string): Promise<void> {
  publishAutopilotStatus(await buildAutopilotStatus(applicationId));
}

/** Stable identity for change-detection (excludes the always-changing timestamp). */
export function statusFingerprint(s: AutopilotStatus): string {
  return `${s.phase}|${s.outstandingConditions}|${s.readyToSubmitToLender}|${s.readiness.completed}/${s.readiness.total}`;
}
