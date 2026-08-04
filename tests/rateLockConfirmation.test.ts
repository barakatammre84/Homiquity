// Audit finding F-3 — a rate lock is a LENDER commitment, not something the
// broker's own system can manufacture. These tests pin the distinction between
// a confirmed lock and an indicative quote.
import { describe, it, expect } from "vitest";
import {
  isLenderConfirmed,
  rateLockKind,
  rateLockNoun,
  rateLockDescription,
} from "../shared/rateLockConfirmation";

const CONFIRMED = {
  lenderId: "uwm",
  lockConfirmationNumber: "UWM-88213004",
  confirmedRate: "6.250",
  confirmedExpiresAt: new Date("2026-09-15T00:00:00Z"),
};

describe("F-3 — lender confirmation is what makes a lock a lock", () => {
  it("recognizes a fully confirmed lock", () => {
    expect(isLenderConfirmed(CONFIRMED)).toBe(true);
    expect(rateLockKind(CONFIRMED)).toBe("confirmed_lock");
    expect(rateLockNoun(CONFIRMED)).toBe("rate lock");
  });

  it("treats a legacy row with no confirmation as a quote, not a lock", () => {
    // Exactly the shape rows written before migration 0039 have.
    const legacy = {
      lenderId: null,
      lockConfirmationNumber: null,
      confirmedRate: null,
      confirmedExpiresAt: null,
    };
    expect(isLenderConfirmed(legacy)).toBe(false);
    expect(rateLockKind(legacy)).toBe("unconfirmed_quote");
    expect(rateLockNoun(legacy)).toMatch(/not locked/i);
  });

  it("rejects partial confirmation — every field or none", () => {
    const partials = [
      { ...CONFIRMED, lenderId: null },
      { ...CONFIRMED, lockConfirmationNumber: null },
      { ...CONFIRMED, confirmedRate: null },
      { ...CONFIRMED, confirmedExpiresAt: null },
      // A confirmation number with no confirmed expiration cannot tell a
      // borrower when the rate runs out — that is not a commitment.
      { ...CONFIRMED, confirmedExpiresAt: undefined },
    ];
    for (const partial of partials) {
      expect(isLenderConfirmed(partial)).toBe(false);
    }
  });

  it("treats blank strings as absent, not as evidence", () => {
    expect(isLenderConfirmed({ ...CONFIRMED, lockConfirmationNumber: "   " })).toBe(false);
    expect(isLenderConfirmed({ ...CONFIRMED, lenderId: "" })).toBe(false);
  });

  it("never calls an unconfirmed record a lock in borrower-facing copy", () => {
    const unconfirmed = { lenderId: null, lockConfirmationNumber: null, confirmedRate: null, confirmedExpiresAt: null };
    const copy = rateLockDescription(unconfirmed, 6.25, 30);
    expect(copy).toMatch(/NOT a lender-confirmed lock/);
    expect(copy).toMatch(/not committed/i);
    // The old string was "Rate locked at X% for N days" — that exact claim is
    // what the audit flagged. It must not reappear for an unconfirmed row.
    expect(copy).not.toMatch(/^Rate locked at/);
  });

  it("names the lender's confirmation number in confirmed copy", () => {
    const copy = rateLockDescription(CONFIRMED, 6.25, 30);
    expect(copy).toMatch(/Rate locked at 6.25%/);
    expect(copy).toContain("UWM-88213004");
  });
});
