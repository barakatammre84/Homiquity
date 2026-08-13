// Single source of truth for the browser-storage keys that carry a consumer's
// pre-authentication state across the signup boundary.
//
// Two distinct things get stashed before a consumer has an account:
//   1. The pre-approval funnel draft + a "pending submit" marker, so a completed
//      application survives the auth gate and replays after sign-in.
//   2. An attribution code (LO /ref/:code or CPA /cpa/:code), so a referred
//      consumer is connected to their originator once they authenticate.
//
// The string values below must never change — altering them would orphan any
// in-flight draft or stashed code written by a previously deployed client.

// localStorage — pre-approval funnel autosave (owned by PreApproval.tsx).
export const PREAPPROVAL_AUTOSAVE_KEY = "homiquity_preapproval_draft";
export const PREAPPROVAL_STEP_KEY = "homiquity_preapproval_step";
export const PREAPPROVAL_PENDING_SUBMIT_KEY = "homiquity_preapproval_pending_submit";

// localStorage — stashed attribution codes, consumed post-auth by usePendingAttribution.
export const PENDING_REFERRAL_CODE_KEY = "pendingReferralCode";
export const PENDING_CPA_CODE_KEY = "pendingCpaCode";

/**
 * localStorage — the direct-apply invite id, stashed by /apply/:token and sent
 * with the funnel's submit.
 *
 * 🚨 THIS WAS sessionStorage, AND THAT WAS THE BUG. It is the fourth thing that
 * crosses the signup boundary, and it was the only one in the per-tab tier: the
 * draft, the pending-submit marker and both sibling attribution codes above are
 * all localStorage, precisely because they must outlive the tab.
 *
 * So the attribution had a strictly SHORTER lifetime than the submit it has to
 * accompany. Close the tab and come back — or verify the signup email, which
 * routinely opens a new one — and the localStorage draft plus PENDING_SUBMIT
 * marker replay the finished application while the invite id is simply gone.
 *
 * That is not a cosmetic loss. `POST /api/loan-applications` uses it to flip the
 * invite to `status: "applied"` and, when no /ref attribution exists, to set
 * `referringBrokerId` from the inviter — which is what routes the file onto the
 * referring loan officer's desk with pipeline visibility and no admin step
 * (server/routes/lending/applications.ts:208-236). Without it the invite reads
 * as never-accepted forever and the client's file lands unassigned.
 */
export const PENDING_INVITE_ID_KEY = "pendingInviteId";

/**
 * The pre-migration spelling, in the wrong tier. Read-only and clear-only: an
 * invite stashed by a previously-deployed client is still in a live tab, and
 * per the note at the top of this file an in-flight handoff must never be
 * orphaned by a rename. Nothing writes it any more; delete this once no client
 * older than 2026-08-12 can still be running.
 */
const LEGACY_SESSION_INVITE_ID_KEY = "inviteId";

/** Stash the invite id for the funnel to pick up after the auth gate. */
export function setPendingInviteId(inviteId: string): void {
  try {
    localStorage.setItem(PENDING_INVITE_ID_KEY, inviteId);
  } catch {
    /* private mode / quota — attribution is best-effort, never blocking */
  }
}

/**
 * Read the stashed invite id, preferring the current tier and falling back to
 * the legacy per-tab one. Does NOT clear: the funnel reads this at mount and
 * only consumes it once the application actually POSTs, so a borrower who
 * abandons the funnel keeps their attribution for the next attempt.
 */
export function readPendingInviteId(): string | null {
  try {
    const current = localStorage.getItem(PENDING_INVITE_ID_KEY);
    if (current) return current;
    return sessionStorage.getItem(LEGACY_SESSION_INVITE_ID_KEY);
  } catch {
    return null;
  }
}

/** Consume it — both tiers, so a legacy copy can't re-attribute a later application. */
export function clearPendingInviteId(): void {
  try {
    localStorage.removeItem(PENDING_INVITE_ID_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_INVITE_ID_KEY);
  } catch {
    /* private mode / storage disabled */
  }
}

/**
 * localStorage — "this visitor has looked at listings".
 *
 * Not attribution, but the same shape of problem: a bare string key written by
 * two property pages and read by the dashboard, with nothing tying the three
 * spellings together. It feeds `getReadinessPercent`, so a typo on either side
 * silently costs every borrower a readiness step rather than throwing.
 *
 * Deliberately a durable, cross-tab signal: "have you started house-hunting" is
 * a fact about the person, not about this tab.
 */
export const BROWSED_PROPERTIES_KEY = "homiquity_browsed_properties";

/** Record that the visitor reached a listings surface. */
export function markBrowsedProperties(): void {
  try {
    localStorage.setItem(BROWSED_PROPERTIES_KEY, "true");
  } catch {
    /* private mode / quota — the readiness nudge just stays unset */
  }
}

/** Has the visitor looked at listings? */
export function hasBrowsedProperties(): boolean {
  try {
    return localStorage.getItem(BROWSED_PROPERTIES_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * True when the consumer completed the pre-approval funnel but deferred the
 * submit behind the auth gate. Used to route them back to /apply after auth so
 * the replay effect can finish the submit (instead of stranding them on the
 * dashboard). Guarded so a storage-access error never breaks routing.
 */
export function hasPendingPreApprovalSubmit(): boolean {
  try {
    return localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY) === "true";
  } catch {
    return false;
  }
}
