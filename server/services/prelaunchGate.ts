import type { RequestHandler } from "express";
import { isCompanyNmlsPending } from "@shared/companyIdentity";

/**
 * Pre-license launch gate (server).
 *
 * The mirror of the client flag (client/src/lib/prelaunch.ts). Blocks the
 * server-side surfaces that would solicit a mortgage transaction — public rate
 * displays and new-application creation — so no soliciting data is reachable
 * even by direct API call while we are unlicensed (roadmap F1 / LS-1).
 *
 * Gated when PRELAUNCH_GATED is explicitly truthy, OR (fail-safe, when the env
 * var is unset) whenever we run in production while the company NMLS id is
 * still PENDING. That interlock keys the gate to the real licensing state, so
 * the soliciting surface cannot be served in production while unlicensed even
 * if someone forgets to set the flag. Set PRELAUNCH_GATED=false to open on F1
 * day (alongside the real NMLS id + VITE_PRELAUNCH_GATED=false).
 *
 * Blocked requests get 404 { code: "PRELAUNCH_GATED" } — pre-license, these
 * surfaces simply do not exist to the public.
 */
const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "no", "off"]);

export function isPrelaunchGated(): boolean {
  const raw = (process.env.PRELAUNCH_GATED ?? "").trim().toLowerCase();
  if (TRUTHY.has(raw)) return true;
  if (FALSY.has(raw)) return false;
  // Unset: fail-safe to the licensing state — gated in prod while unlicensed.
  return process.env.NODE_ENV === "production" && isCompanyNmlsPending();
}

export const PRELAUNCH_GATED_MESSAGE =
  "This isn't available yet. Homiquity is launching soon — join the waitlist and we'll let you know the moment we open.";

/** Mount before a soliciting endpoint: app.get(path, prelaunchGate, handler). */
export const prelaunchGate: RequestHandler = (_req, res, next) => {
  if (!isPrelaunchGated()) return next();
  return res.status(404).json({ error: PRELAUNCH_GATED_MESSAGE, code: "PRELAUNCH_GATED" });
};
