import { trackIntent } from "./intentTracker";

/**
 * Server-observed friction logging — the raw material of the continuous
 * learning loop.
 *
 * A "friction point" is any moment the platform stops a user: a blocked
 * consent gate, a failed upload, a rate limit. Each event lands in
 * intent_events (eventType "friction_event", category "friction") with a
 * stable point name, so the daily guardian can aggregate the last N days
 * (GET /api/jobs/friction-summary) and turn recurring walls into scenario
 * proposals or UX fixes in knowledge-base/compliance/UNDERWRITING_SCENARIOS.md.
 *
 * Friction data NEVER changes behavior directly — it produces proposals that
 * go through the same cited, tested pipeline as every other change.
 */

export type FrictionPoint =
  | "consent_gate_blocked" // requireConsent 403 (eDisclosure etc.)
  | "anti_steering_blocked" // rate lock attempted before acknowledgment
  | "document_upload_failed" // upload endpoint 500
  | "credit_pull_blocked" // pull attempted without consent
  | "rate_limited"; // auth/test-login limiter hit

export function logFriction(
  point: FrictionPoint,
  options: {
    userId?: string;
    applicationId?: string;
    detail?: string;
    metadata?: Record<string, unknown>;
  } = {},
): void {
  // Fire-and-forget: friction telemetry must never break the request path.
  void trackIntent("friction_event", {
    userId: options.userId,
    targetType: options.applicationId ? "loan_application" : undefined,
    targetId: options.applicationId,
    targetLabel: point,
    metadata: { detail: options.detail, ...options.metadata },
  }).catch((err) => {
    console.error(`[friction] Failed to log ${point} (non-fatal):`, err);
  });
}
