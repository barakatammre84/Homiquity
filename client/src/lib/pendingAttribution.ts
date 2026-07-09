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
