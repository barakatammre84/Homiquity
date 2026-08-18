// The FCRA gate for the MCP soft-pull tool, and the cached-pull read it guards.
//
// F-042: the tool used to return a cached bureau report BEFORE reaching its
// consent check — the cached-pull branch sat above the gate in index.ts, so a
// borrower who revoked consent still had scores/debt/DTI re-disclosed to any
// agent for as long as the cached pull stayed unexpired (up to 90 days). The
// gate also matched ANY active consent regardless of `consentType`, despite the
// tool's own description promising it "refuses to pull without an active
// soft-pull consent".
//
// The fix is structural, not just a reorder: `readCachedSoftPull` takes the
// AUTHORIZED consent as a parameter, so there is no way to reach cached bureau
// data without `authorizeSoftPull` having granted it first. `evaluateSoftPull`
// is the single composition index.ts calls — gate, then cache — and is what
// the unit tests drive.
//
// Scope semantics deliberately mirror requestCreditPull (fix 02a4d8a, F-035):
// the NEWEST active consent decides, and it must cover the pull type via
// consentCoversPullType — deny by default, `hard_pull` covering soft as
// lesser-included. An older active consent that would have covered the pull
// does not resurrect authorization; that matches getActiveConsent's
// newest-first semantics everywhere else in the credit subsystem.
import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "../db";
import { creditConsents, creditPulls, type CreditPull } from "@shared/schema";
import { consentCoversPullType } from "../services/creditConsents";

/** The consent that authorized this evaluation — proof the gate ran. */
export interface AuthorizedConsent {
  id: string;
  consentType: string;
}

export type SoftPullRefusal =
  | { outcome: "refused"; reason: "no_active_consent" }
  | { outcome: "refused"; reason: "consent_scope_mismatch"; consent: AuthorizedConsent };

export type SoftPullEvaluation =
  | SoftPullRefusal
  | { outcome: "cached"; consent: AuthorizedConsent; pull: CreditPull }
  | { outcome: "pull_required"; consent: AuthorizedConsent };

/**
 * FCRA gate: the borrower's newest active consent must exist AND authorize a
 * soft pull. Runs before any bureau data — cached or fresh — is read.
 */
export async function authorizeSoftPull(
  borrowerUserId: string,
): Promise<SoftPullRefusal | { outcome: "authorized"; consent: AuthorizedConsent }> {
  const [consent] = await db
    .select({ id: creditConsents.id, consentType: creditConsents.consentType })
    .from(creditConsents)
    .where(
      and(
        eq(creditConsents.userId, borrowerUserId),
        eq(creditConsents.consentGiven, true),
        eq(creditConsents.isActive, true),
      ),
    )
    .orderBy(desc(creditConsents.consentTimestamp))
    .limit(1);

  if (!consent) {
    return { outcome: "refused", reason: "no_active_consent" };
  }
  if (!consentCoversPullType(consent.consentType, "soft")) {
    return { outcome: "refused", reason: "consent_scope_mismatch", consent };
  }
  return { outcome: "authorized", consent };
}

/**
 * Cached, non-expired, completed soft pull for the application. Requires the
 * authorized consent as an argument on purpose: cached bureau data is still an
 * FCRA disclosure, so it must be unreachable without the gate having granted
 * access — the parameter makes gate-after-cache unrepresentable.
 */
export async function readCachedSoftPull(
  applicationId: string,
  _consent: AuthorizedConsent,
): Promise<CreditPull | null> {
  const [existing] = await db
    .select()
    .from(creditPulls)
    .where(
      and(
        eq(creditPulls.applicationId, applicationId),
        eq(creditPulls.pullType, "soft"),
        eq(creditPulls.status, "completed"),
        gt(creditPulls.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(creditPulls.requestedAt))
    .limit(1);
  return existing ?? null;
}

/**
 * The composed flow the MCP tool runs: consent gate FIRST, cache second.
 * A refusal here means no bureau data of any freshness was read.
 */
export async function evaluateSoftPull(input: {
  borrowerUserId: string;
  applicationId: string;
}): Promise<SoftPullEvaluation> {
  const gate = await authorizeSoftPull(input.borrowerUserId);
  if (gate.outcome === "refused") return gate;

  const cached = await readCachedSoftPull(input.applicationId, gate.consent);
  if (cached) return { outcome: "cached", consent: gate.consent, pull: cached };

  return { outcome: "pull_required", consent: gate.consent };
}
