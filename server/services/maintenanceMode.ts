import type { RequestHandler } from "express";

/**
 * Intake kill switch.
 *
 * Set INTAKE_PAUSED=true (env var) to pause all NEW business instantly:
 *   - new loan applications (funnel submit → POST /api/loan-applications)
 *   - new leads (landing pages / aggregators → POST /api/leads)
 *   - outbound calls to live pricing vendors (rateService live fetch)
 *
 * Existing borrowers keep full access to their applications, documents, and
 * messages — the switch stops new intake, not service. The env var is read
 * per-request (never cached at module load) so flipping it in dev needs no
 * restart, and on Vercel the change takes effect with the next deployment.
 *
 * Blocked requests get 503 { code: "INTAKE_PAUSED" } with a borrower-safe
 * message; friendlyApiError lets a deliberate 503 envelope through to the
 * toast, so the funnel shows the maintenance copy rather than a generic error.
 */
const TRUTHY = new Set(["1", "true", "yes", "on"]);

export function isIntakePaused(): boolean {
  return TRUTHY.has((process.env.INTAKE_PAUSED ?? "").trim().toLowerCase());
}

export const INTAKE_PAUSED_MESSAGE =
  "We're briefly paused for scheduled maintenance. Your saved progress is safe — please try again in a little while.";

/** Mount before the route handler: app.post(path, intakePausedGate, handler). */
export const intakePausedGate: RequestHandler = (_req, res, next) => {
  if (!isIntakePaused()) return next();
  res.setHeader("Retry-After", "600");
  return res.status(503).json({ error: INTAKE_PAUSED_MESSAGE, code: "INTAKE_PAUSED" });
};
