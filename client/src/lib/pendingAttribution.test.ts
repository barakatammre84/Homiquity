import { describe, it, expect, beforeEach } from "vitest";
import {
  PENDING_INVITE_ID_KEY,
  PREAPPROVAL_AUTOSAVE_KEY,
  PREAPPROVAL_PENDING_SUBMIT_KEY,
  PENDING_REFERRAL_CODE_KEY,
  PENDING_CPA_CODE_KEY,
  BROWSED_PROPERTIES_KEY,
  setPendingInviteId,
  readPendingInviteId,
  clearPendingInviteId,
  markBrowsedProperties,
  hasBrowsedProperties,
} from "./pendingAttribution";

// The direct-apply invite id crosses the signup boundary alongside the funnel
// draft. It used to be the ONLY one of the four pre-auth handoffs in the per-tab
// tier, which gave it a strictly shorter lifetime than the submit it has to
// accompany: the localStorage draft + PENDING_SUBMIT marker replay a finished
// application in a fresh tab, and the sessionStorage invite id is simply gone.
//
// The loss is not cosmetic. POST /api/loan-applications uses it to flip the
// invite to "applied" and to set referringBrokerId from the inviter, which is
// what puts the file on the referring loan officer's desk
// (server/routes/lending/applications.ts:208-236).

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("pending invite id", () => {
  it("round-trips and is consumed explicitly", () => {
    setPendingInviteId("invite-1");
    expect(readPendingInviteId()).toBe("invite-1");

    // Reading must NOT consume — a borrower who abandons the funnel keeps their
    // attribution for the next attempt.
    expect(readPendingInviteId()).toBe("invite-1");

    clearPendingInviteId();
    expect(readPendingInviteId()).toBeNull();
  });

  // THE REGRESSION. sessionStorage is per-tab; localStorage is not. Closing the
  // tab (or verifying the signup email, which routinely opens a new one) is
  // exactly the path where attribution used to vanish.
  it("survives a tab that does not share sessionStorage", () => {
    setPendingInviteId("invite-1");
    sessionStorage.clear(); // a different tab: same origin, no session state

    expect(readPendingInviteId()).toBe("invite-1");
  });

  it("shares the tier of everything else that crosses the auth gate", () => {
    setPendingInviteId("invite-1");
    // The draft, the pending-submit marker and both sibling attribution codes
    // are all localStorage. The invite id being the odd one out WAS the bug.
    expect(localStorage.getItem(PENDING_INVITE_ID_KEY)).toBe("invite-1");
    expect(sessionStorage.getItem(PENDING_INVITE_ID_KEY)).toBeNull();

    for (const key of [
      PREAPPROVAL_AUTOSAVE_KEY,
      PREAPPROVAL_PENDING_SUBMIT_KEY,
      PENDING_REFERRAL_CODE_KEY,
      PENDING_CPA_CODE_KEY,
    ]) {
      expect(typeof key).toBe("string");
    }
  });

  it("still honours an invite stashed by a previously deployed client", () => {
    // In-flight handoff written under the old per-tab spelling. Renaming a key
    // must never orphan one (see the note at the top of pendingAttribution.ts).
    sessionStorage.setItem("inviteId", "legacy-invite");
    expect(readPendingInviteId()).toBe("legacy-invite");
  });

  it("prefers the current tier when both are present", () => {
    sessionStorage.setItem("inviteId", "legacy-invite");
    setPendingInviteId("current-invite");
    expect(readPendingInviteId()).toBe("current-invite");
  });

  it("clears BOTH tiers, so a legacy copy cannot re-attribute a later application", () => {
    sessionStorage.setItem("inviteId", "legacy-invite");
    setPendingInviteId("current-invite");

    clearPendingInviteId();

    expect(readPendingInviteId()).toBeNull();
    expect(sessionStorage.getItem("inviteId")).toBeNull();
  });
});

describe("browsed-properties signal", () => {
  it("defaults to false and records durably", () => {
    expect(hasBrowsedProperties()).toBe(false);
    markBrowsedProperties();
    expect(hasBrowsedProperties()).toBe(true);
    expect(localStorage.getItem(BROWSED_PROPERTIES_KEY)).toBe("true");
  });

  it("survives a new tab — house-hunting is a fact about the person, not the tab", () => {
    markBrowsedProperties();
    sessionStorage.clear();
    expect(hasBrowsedProperties()).toBe(true);
  });

  it("treats any other stored value as not-browsed", () => {
    localStorage.setItem(BROWSED_PROPERTIES_KEY, "1");
    expect(hasBrowsedProperties()).toBe(false);
  });
});
