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

// `simulated: false` is part of what makes this confirmed, not decoration on
// the fixture: it is the recorded fact that the counterparty was an approved,
// non-demo lender when the lock was taken (F-20).
const CONFIRMED = {
  lenderId: "uwm",
  lockConfirmationNumber: "UWM-88213004",
  confirmedRate: "6.250",
  confirmedExpiresAt: new Date("2026-09-15T00:00:00Z"),
  simulated: false,
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

describe("F-20 — confirmation is a counterparty test, not a presence test", () => {
  // The defect: a lock keyed against a seeded DEMO lender, or any lender with
  // no executed broker agreement, filled in all four confirmation columns and
  // was therefore booked as a real lender commitment — told to the borrower as
  // "rate lock", and excluded from the contingent-liability register's honor
  // exposure on the reasoning that a confirmed lock is the lender's problem.
  const FICTIONAL = { ...CONFIRMED, lenderId: "summit", simulated: true };

  it("refuses a complete confirmation from a counterparty that owes us nothing", () => {
    expect(isLenderConfirmed(FICTIONAL)).toBe(false);
    expect(rateLockKind(FICTIONAL)).toBe("unconfirmed_quote");
    expect(rateLockNoun(FICTIONAL)).toMatch(/not locked/i);
  });

  it("does not call it a lock in borrower-facing copy either", () => {
    const copy = rateLockDescription(FICTIONAL, 6.25, 30);
    expect(copy).toMatch(/NOT a lender-confirmed lock/);
    expect(copy).not.toMatch(/^Rate locked at/);
  });

  it("fails closed when the counterparty fact is missing entirely", () => {
    // Missing evidence is not evidence of a commitment. Legacy rows and any
    // hand-built object without `simulated` resolve to a quote rather than
    // inheriting the benefit of the doubt.
    const { simulated: _omitted, ...noCounterpartyFact } = CONFIRMED;
    expect(isLenderConfirmed(noCounterpartyFact)).toBe(false);
    expect(isLenderConfirmed({ ...CONFIRMED, simulated: null })).toBe(false);
    expect(isLenderConfirmed({ ...CONFIRMED, simulated: undefined })).toBe(false);
  });

  it("still requires the confirmation columns — an approved lender is not enough", () => {
    // The counterparty test is additional to the presence test, not a
    // replacement for it: a real lender with no confirmation number has made
    // no commitment.
    expect(isLenderConfirmed({ ...CONFIRMED, lockConfirmationNumber: null })).toBe(false);
  });
});
