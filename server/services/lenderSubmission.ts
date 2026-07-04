/**
 * Wholesale lender submission — the "submit" action of the broker pipeline.
 *
 * Submitting a file to a lender is gated on the broker submission-readiness
 * workflow (stages 1–3 must carry no blockers) and is recorded as a
 * lender_submissions row with a snapshot of the readiness report at the
 * moment of submission (audit: what did we believe about the file when we
 * sent it?).
 *
 * The lender leg follows the ausSubmission.ts convention: env-gated real
 * integration with a clearly-flagged deterministic simulation until broker
 * agreements exist. No wholesale lender offers a generic submission API —
 * each onboarding (UWM EASE, Rocket TPO portal, etc.) lands behind
 * submitToLenderPortal(), which is the single seam to replace.
 */

import { createHash } from "node:crypto";
import { storage } from "../storage";
import {
  getWholesaleLender,
  isValidSubmissionTransition,
  LENDER_SUBMISSION_STATUSES,
  type LenderSubmissionStatus,
  type WholesaleLender,
} from "@shared/wholesaleLenders";
import type { LenderSubmission } from "@shared/schema";
import type { BrokerSubmissionReadiness } from "./brokerSubmissionReadiness";

/** Statuses that count as a live submission (blocks a duplicate to the same lender). */
const ACTIVE_STATUSES: LenderSubmissionStatus[] = [
  "submitted", "acknowledged", "in_underwriting", "conditions_issued",
  "conditions_cleared", "clear_to_close", "suspended",
];

export class SubmissionBlockedError extends Error {
  constructor(
    message: string,
    public readonly blockers: string[],
  ) {
    super(message);
    this.name = "SubmissionBlockedError";
  }
}

export interface LenderAcknowledgment {
  simulated: boolean;
  confirmationId: string;
}

/**
 * Deterministic simulated lender acknowledgment: stable confirmation id from
 * (lenderId, applicationId), shaped like a lender-side loan number. Pure —
 * unit-tested directly.
 */
export function simulateLenderAcknowledgment(lenderId: string, applicationId: string): LenderAcknowledgment {
  const digest = createHash("sha256").update(`${lenderId}:${applicationId}`).digest("hex");
  const numeric = String(parseInt(digest.slice(0, 10), 16) % 1_000_000_000).padStart(9, "0");
  return {
    simulated: true,
    confirmationId: `${lenderId.toUpperCase().replace(/-/g, "").slice(0, 4)}-${numeric}`,
  };
}

/**
 * The single integration seam per lender portal. Real integrations are gated
 * on per-lender env credentials that do not exist yet; until then this
 * returns the deterministic simulation.
 */
async function submitToLenderPortal(
  lender: WholesaleLender,
  applicationId: string,
): Promise<LenderAcknowledgment> {
  // e.g. process.env.UWM_EASE_CLIENT_ID — no broker agreements are signed, so
  // every lender resolves to the simulation today.
  return simulateLenderAcknowledgment(lender.id, applicationId);
}

export interface SubmitResult {
  submission: LenderSubmission;
  readiness: BrokerSubmissionReadiness;
}

export async function submitToWholesaleLender(
  applicationId: string,
  lenderId: string,
  submittedBy: string,
): Promise<SubmitResult> {
  const lender = getWholesaleLender(lenderId);
  if (!lender) {
    throw new SubmissionBlockedError(`Unknown wholesale lender "${lenderId}"`, []);
  }

  // One live submission per lender: withdrawn/denied submissions may be
  // superseded, active ones may not.
  const existing = await storage.getLenderSubmissionsByApplication(applicationId);
  const active = existing.find(
    s => s.lenderId === lenderId && ACTIVE_STATUSES.includes(s.status as LenderSubmissionStatus),
  );
  if (active) {
    throw new SubmissionBlockedError(
      `An active submission to ${lender.name} already exists (status: ${active.status})`,
      [],
    );
  }

  // Server-enforced readiness gate: stages 1–3 must carry no blockers.
  const { evaluateBrokerSubmissionReadiness } = await import("./brokerSubmissionReadiness");
  const readiness = await evaluateBrokerSubmissionReadiness(applicationId);
  if (!readiness.readyToSubmitToLender) {
    const blockers = readiness.stages.flatMap(s => s.blockers.map(b => `[${s.label}] ${b}`));
    throw new SubmissionBlockedError(
      "File is not ready for lender submission — resolve the workflow blockers first.",
      blockers,
    );
  }

  const ack = await submitToLenderPortal(lender, applicationId);

  const submission = await storage.createLenderSubmission({
    applicationId,
    lenderId,
    status: "submitted",
    simulated: ack.simulated,
    confirmationId: ack.confirmationId,
    readinessSnapshot: readiness as unknown as Record<string, unknown>,
    submittedBy,
  });

  await storage.createDealActivity({
    applicationId,
    activityType: "note",
    title: `Submitted to ${lender.name}`,
    description: `Wholesale submission ${ack.confirmationId}${ack.simulated ? " (simulated — no broker agreement live)" : ""}`,
    performedBy: submittedBy,
  });

  return { submission, readiness };
}

export async function updateSubmissionStatus(
  submissionId: string,
  toStatus: string,
  notes: string | undefined,
  performedBy: string,
): Promise<LenderSubmission> {
  if (!(LENDER_SUBMISSION_STATUSES as readonly string[]).includes(toStatus)) {
    throw new SubmissionBlockedError(`"${toStatus}" is not a valid submission status`, []);
  }
  const submission = await storage.getLenderSubmission(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }
  const from = submission.status as LenderSubmissionStatus;
  if (!isValidSubmissionTransition(from, toStatus as LenderSubmissionStatus)) {
    throw new SubmissionBlockedError(`Cannot move a submission from "${from}" to "${toStatus}"`, []);
  }

  const updated = await storage.updateLenderSubmission(submissionId, {
    status: toStatus,
    ...(notes !== undefined ? { notes } : {}),
  });

  await storage.createDealActivity({
    applicationId: submission.applicationId,
    activityType: "note",
    title: `Lender submission ${toStatus.replace(/_/g, " ")}`,
    description: `${getWholesaleLender(submission.lenderId)?.name ?? submission.lenderId}: ${from} → ${toStatus}${notes ? ` — ${notes}` : ""}`,
    performedBy,
  });

  return updated!;
}
