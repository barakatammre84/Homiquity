/**
 * Per-account login lockout policy — pure logic, no I/O (unit-tested in
 * tests/loginLockout.test.ts; persistence lives on the users table).
 *
 * Policy: 5 failures *within FAILURE_WINDOW_MS of one another* lock the account
 * for 15 minutes; each further failure in the same run doubles the window
 * (capped at 24h). Any successful login — password OR social — resets the
 * counter, as does a password reset. A run that goes quiet for longer than
 * FAILURE_WINDOW_MS is over: the next failure starts counting from 1 again.
 * The lockout response is deliberately the same generic 401 body as a wrong
 * password so it cannot be used to probe whether an account exists.
 *
 * Why the window exists (2026-08-19). `failedLoginAttempts` used to be a
 * LIFETIME counter: nothing but a successful *password* login ever cleared it,
 * and nothing decayed it. Two things fell out of that, and both are fixed here
 * plus in the two call sites named below:
 *
 *   1. A user with a passwordHash who signs in with Google accumulated failed
 *      password attempts forever, because socialAuth never touched the counter.
 *      Fixed in integrations/auth/storage.ts `upsertSocialUser`.
 *   2. At 12 lifetime failures the exponent reaches 7, so the window clamps to
 *      LOCKOUT_MAX_MS and stays there — from then on a single typo, years after
 *      the earlier ones, locked the account for 24 hours. Fixed by the decay
 *      below.
 *
 * Rows written before the `last_failed_login_at` column existed carry NULL, and
 * NULL reads as "no run in progress" — so a legacy lifetime count is discarded
 * on its owner's next failure rather than being guessed at or backfilled.
 */

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_BASE_MS = 15 * 60 * 1000; // 15 minutes
export const LOCKOUT_MAX_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * How long a run of failures stays "current". Two constraints pin this:
 *
 *   - It MUST exceed LOCKOUT_MAX_MS. If it did not, an attacker who reached the
 *     24h cap would have the escalation erased simply by *serving* the 24h
 *     lockout, handing them a fresh 5-guess budget every day. Sitting out the
 *     maximum penalty must not be a way to buy back the ladder.
 *   - It should be short enough that unrelated typos weeks apart never compound
 *     into a lockout, which is the whole failure this constant exists to stop.
 *
 * 7 days satisfies both. It is a policy choice, not a regulatory one.
 */
export const FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface LockoutState {
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  /**
   * When the most recent failure happened. NULL means "no run in progress" —
   * either the account has never failed, or its counter predates this column.
   */
  lastFailedLoginAt: Date | null;
}

/** Is the account currently locked out? */
export function isLockedOut(state: LockoutState, now: Date = new Date()): boolean {
  return state.lockoutUntil !== null && state.lockoutUntil.getTime() > now.getTime();
}

/**
 * Does `state`'s counter still describe a live run of failures, or has it gone
 * stale? A stale counter contributes nothing to the next failure.
 */
export function isFailureRunActive(state: LockoutState, now: Date = new Date()): boolean {
  if (state.lastFailedLoginAt === null) return false;
  return now.getTime() - state.lastFailedLoginAt.getTime() < FAILURE_WINDOW_MS;
}

/** State after a failed password attempt. */
export function recordFailure(state: LockoutState, now: Date = new Date()): LockoutState {
  // Only a *live* run carries forward. This is what makes the counter
  // consecutive rather than cumulative.
  const carried = isFailureRunActive(state, now) ? state.failedLoginAttempts : 0;
  const attempts = carried + 1;
  if (attempts < LOCKOUT_THRESHOLD) {
    return { failedLoginAttempts: attempts, lockoutUntil: null, lastFailedLoginAt: now };
  }
  // 5th failure → 15m, 6th → 30m, 7th → 1h … capped at 24h.
  const exponent = attempts - LOCKOUT_THRESHOLD;
  const windowMs = Math.min(LOCKOUT_BASE_MS * 2 ** exponent, LOCKOUT_MAX_MS);
  return {
    failedLoginAttempts: attempts,
    lockoutUntil: new Date(now.getTime() + windowMs),
    lastFailedLoginAt: now,
  };
}

/**
 * State after a successful login. Every successful authentication of the
 * account owner ends the run, whichever door they came through.
 */
export function recordSuccess(): LockoutState {
  return { failedLoginAttempts: 0, lockoutUntil: null, lastFailedLoginAt: null };
}
