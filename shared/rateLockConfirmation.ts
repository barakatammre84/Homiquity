// ---------------------------------------------------------------------------
// What makes a rate lock a lock.
//
// Homiquity is a broker. A broker cannot lock a rate — only the wholesale
// lender funding the loan can. A `rate_locks` row with no lender confirmation
// is therefore a QUOTE the platform produced from its own rate sheet: nobody
// outside this system is obliged to honor it, and the difference between the
// quoted rate and the market on the day the lender is actually asked is a loss
// somebody eats.
//
// This module is the single place that answers "is this a real commitment?",
// so no surface can decide for itself. Rows created before the confirmation
// columns existed have no confirmation and resolve to `unconfirmed_quote` —
// they were never locks, and calling them locks now would repeat the mistake.
// ---------------------------------------------------------------------------

export type RateLockKind = "confirmed_lock" | "unconfirmed_quote";

/** The fields a lock must carry to be a lender commitment. */
export interface LenderLockConfirmation {
  lenderId: string;
  lockConfirmationNumber: string;
  confirmedRate: number;
  confirmedExpiresAt: Date;
  /** True while the lender leg is the deterministic simulation. */
  simulated: boolean;
}

/** Structural shape of a persisted lock, as far as confirmation is concerned. */
export interface ConfirmableLock {
  lenderId?: string | null;
  lockConfirmationNumber?: string | null;
  confirmedRate?: string | number | null;
  confirmedExpiresAt?: Date | string | null;
}

function present(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * A lock is confirmed only with a lender, that lender's confirmation number,
 * and the rate and expiration the lender confirmed. Partial evidence is not
 * evidence: a confirmation number with no confirmed expiration cannot tell a
 * borrower when their rate runs out.
 */
export function isLenderConfirmed(lock: ConfirmableLock): boolean {
  return (
    present(lock.lenderId) &&
    present(lock.lockConfirmationNumber) &&
    present(lock.confirmedRate) &&
    present(lock.confirmedExpiresAt)
  );
}

export function rateLockKind(lock: ConfirmableLock): RateLockKind {
  return isLenderConfirmed(lock) ? "confirmed_lock" : "unconfirmed_quote";
}

/**
 * Borrower- and staff-facing noun. Never call an unconfirmed row a "lock" in
 * copy — that is the representation the audit flagged, not a wording nit.
 */
export function rateLockNoun(lock: ConfirmableLock): string {
  return isLenderConfirmed(lock) ? "rate lock" : "indicative quote (not locked)";
}

/** Activity-log / notification line for a lock event. */
export function rateLockDescription(lock: ConfirmableLock, ratePct: number, days: number): string {
  if (!isLenderConfirmed(lock)) {
    return (
      `Indicative quote recorded at ${ratePct}% for ${days} days — NOT a lender-confirmed lock. ` +
      `The rate is not committed until the wholesale lender confirms it.`
    );
  }
  return `Rate locked at ${ratePct}% for ${days} days, confirmed by the lender (${lock.lockConfirmationNumber}).`;
}
