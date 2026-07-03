/**
 * Per-account login lockout policy — pure logic, no I/O (unit-tested in
 * tests/loginLockout.test.ts; persistence lives on the users table).
 *
 * Policy: 5 straight failures lock the account for 15 minutes; each further
 * failure while locked-or-beyond doubles the window (capped at 24h). Any
 * successful login resets the counter. The lockout response is deliberately
 * the same generic 401 body as a wrong password so it cannot be used to
 * probe whether an account exists.
 */

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_BASE_MS = 15 * 60 * 1000; // 15 minutes
export const LOCKOUT_MAX_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface LockoutState {
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
}

/** Is the account currently locked out? */
export function isLockedOut(state: LockoutState, now: Date = new Date()): boolean {
  return state.lockoutUntil !== null && state.lockoutUntil.getTime() > now.getTime();
}

/** State after a failed password attempt. */
export function recordFailure(state: LockoutState, now: Date = new Date()): LockoutState {
  const attempts = state.failedLoginAttempts + 1;
  if (attempts < LOCKOUT_THRESHOLD) {
    return { failedLoginAttempts: attempts, lockoutUntil: null };
  }
  // 5th failure → 15m, 6th → 30m, 7th → 1h … capped at 24h.
  const exponent = attempts - LOCKOUT_THRESHOLD;
  const windowMs = Math.min(LOCKOUT_BASE_MS * 2 ** exponent, LOCKOUT_MAX_MS);
  return {
    failedLoginAttempts: attempts,
    lockoutUntil: new Date(now.getTime() + windowMs),
  };
}

/** State after a successful login. */
export function recordSuccess(): LockoutState {
  return { failedLoginAttempts: 0, lockoutUntil: null };
}
