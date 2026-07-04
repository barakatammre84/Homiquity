// =============================================================================
// FILE HEALTH
//
// Deterministic green/yellow/red health light for a loan application, built
// for the LO Command Center's at-a-glance pipeline view. "Health" answers a
// different question than PipelineSummary.priority: priority ranks how urgent
// staff attention is *given the stage* (clear-to-close is always urgent),
// while health flags whether the file is progressing cleanly or silently
// stalling — the "No-Stall" signal.
//
// This module is pure (no DB, no clock reads beyond the inputs) so the rules
// can be unit-tested exhaustively and audited. It is rule-based on purpose:
// like every credit-adjacent surface in this codebase, no model output may
// influence it (Reg B — deterministic, explainable reasons only).
// =============================================================================

import { checkStageRequirements } from "@shared/stageRequirements";

export type FileHealthLight = "green" | "yellow" | "red";

export interface FileHealth {
  light: FileHealthLight;
  /**
   * Human-readable reasons, worst first. The first entry is what the Command
   * Center surfaces as the row's "blocking item"; the rest show on hover.
   * Green files get an empty array — nothing is blocking.
   */
  reasons: string[];
}

export interface FileHealthInput {
  /** Canonical loan-application status (shared/schema status vocabulary). */
  status: string | null | undefined;
  /**
   * Whole days since the last recorded touch on the file (deal activity or
   * application update). Null when no timestamp is available — treated as
   * unknown, not as idle, so data gaps don't manufacture red lights.
   */
  daysIdle: number | null;
  /** Whole days since submission (PipelineSummary.daysInPipeline). */
  daysInPipeline: number;
  /** Conditions currently in "outstanding" status. */
  conditionsOutstanding: number;
  /** Amount fields for the stage-coherence check (shared/stageRequirements). */
  preApprovalAmount?: string | number | null;
  purchasePrice?: string | number | null;
}

/**
 * A file goes stale after two full days without a touch — the "No-Stall"
 * threshold the LO-partner pitch is built on (>48h idle = broken promise).
 */
export const STALL_DAYS = 2;

/** One idle day is the early-warning band: not stalled yet, worth a look. */
export const IDLE_WARNING_DAYS = 1;

/**
 * Mirrors the pipeline engine's escalation: any active file older than 30
 * days in the pipeline is already treated as urgent there, so it cannot be
 * "healthy" here.
 */
export const PIPELINE_AGE_RED_DAYS = 30;

/** Matches buildPipelineSummary's "high" band for outstanding conditions. */
export const CONDITIONS_WARNING_COUNT = 3;

const TERMINAL_STATUSES = new Set(["funded", "denied", "withdrawn", "expired"]);

/**
 * Compute the health light for one file. Rules are evaluated worst-first and
 * every triggered rule contributes a reason, so a red file also lists its
 * yellow-band problems (the LO sees the whole picture, not just the trigger).
 */
export function computeFileHealth(input: FileHealthInput): FileHealth {
  const status = input.status || "draft";

  // Terminal files are done being worked; the light reports the outcome and
  // no stall/aging rule applies to them.
  if (TERMINAL_STATUSES.has(status)) {
    return status === "funded"
      ? { light: "green", reasons: [] }
      : { light: "red", reasons: [`File is ${status.replace(/_/g, " ")}`] };
  }

  const redReasons: string[] = [];
  const yellowReasons: string[] = [];

  // Incoherent state: an amount-bearing status with no coherent loan amount
  // produces "$0 pre-approvals" — always red, never a matter of degree.
  const stageCheck = checkStageRequirements({
    status,
    preApprovalAmount: input.preApprovalAmount,
    purchasePrice: input.purchasePrice,
  });
  if (!stageCheck.ok) {
    redReasons.push("Status requires a loan amount but none is on file");
  }

  if (input.daysIdle !== null && input.daysIdle >= STALL_DAYS) {
    redReasons.push(`No activity for ${input.daysIdle} days`);
  } else if (input.daysIdle !== null && input.daysIdle >= IDLE_WARNING_DAYS) {
    yellowReasons.push("No activity since yesterday");
  }

  if (input.daysInPipeline > PIPELINE_AGE_RED_DAYS) {
    redReasons.push(`${input.daysInPipeline} days in pipeline (limit ${PIPELINE_AGE_RED_DAYS})`);
  }

  // Outstanding conditions are an active file's normal work list, not a
  // stall — they only tint the light once the pile crosses the same "high"
  // band the pipeline engine escalates on.
  if (input.conditionsOutstanding > CONDITIONS_WARNING_COUNT) {
    yellowReasons.push(`${input.conditionsOutstanding} conditions outstanding`);
  }

  if (redReasons.length > 0) {
    return { light: "red", reasons: [...redReasons, ...yellowReasons] };
  }
  if (yellowReasons.length > 0) {
    return { light: "yellow", reasons: yellowReasons };
  }
  return { light: "green", reasons: [] };
}

/**
 * Whole days between a timestamp and now, floored; null in = null out.
 * Split out so callers pass data, not clock math, into computeFileHealth
 * tests.
 */
export function daysSince(timestamp: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!timestamp) return null;
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24));
  return days < 0 ? 0 : days;
}
