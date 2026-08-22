import { describe, it, expect } from "vitest";
import {
  isLockedOut,
  isFailureRunActive,
  recordFailure,
  recordSuccess,
  LOCKOUT_THRESHOLD,
  LOCKOUT_BASE_MS,
  LOCKOUT_MAX_MS,
  FAILURE_WINDOW_MS,
  type LockoutState,
} from "../server/services/loginLockout";

const NOW = new Date("2026-07-02T12:00:00Z");
const fresh: LockoutState = { failedLoginAttempts: 0, lockoutUntil: null, lastFailedLoginAt: null };

function failTimes(state: LockoutState, n: number, now: Date = NOW): LockoutState {
  let s = state;
  for (let i = 0; i < n; i++) s = recordFailure(s, now);
  return s;
}

describe("loginLockout", () => {
  it("does not lock before the threshold", () => {
    const s = failTimes(fresh, LOCKOUT_THRESHOLD - 1);
    expect(s.failedLoginAttempts).toBe(4);
    expect(s.lockoutUntil).toBeNull();
    expect(isLockedOut(s, NOW)).toBe(false);
  });

  it("locks for 15 minutes on the 5th failure", () => {
    const s = failTimes(fresh, LOCKOUT_THRESHOLD);
    expect(s.lockoutUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_BASE_MS));
    expect(isLockedOut(s, NOW)).toBe(true);
  });

  it("expires: not locked once the window passes", () => {
    const s = failTimes(fresh, LOCKOUT_THRESHOLD);
    const after = new Date(NOW.getTime() + LOCKOUT_BASE_MS + 1000);
    expect(isLockedOut(s, after)).toBe(false);
  });

  it("doubles the window on repeated failures", () => {
    const s6 = failTimes(fresh, 6);
    expect(s6.lockoutUntil).toEqual(new Date(NOW.getTime() + 2 * LOCKOUT_BASE_MS));
    const s7 = failTimes(fresh, 7);
    expect(s7.lockoutUntil).toEqual(new Date(NOW.getTime() + 4 * LOCKOUT_BASE_MS));
  });

  it("caps the window at 24 hours", () => {
    const s = failTimes(fresh, 30);
    expect(s.lockoutUntil!.getTime() - NOW.getTime()).toBe(LOCKOUT_MAX_MS);
  });

  it("success resets everything", () => {
    const locked = failTimes(fresh, 10);
    const reset = recordSuccess();
    expect(reset.failedLoginAttempts).toBe(0);
    expect(reset.lockoutUntil).toBeNull();
    expect(reset.lastFailedLoginAt).toBeNull();
    expect(isLockedOut(reset, NOW)).toBe(false);
    // Clearing the run marker is load-bearing: leaving it set would let the
    // very next failure resume the run that just ended successfully.
    expect(isFailureRunActive(reset, NOW)).toBe(false);
  });

  it("counter climbs from a partial state", () => {
    const s = recordFailure(
      { failedLoginAttempts: 3, lockoutUntil: null, lastFailedLoginAt: NOW },
      NOW,
    );
    expect(s.failedLoginAttempts).toBe(4);
    expect(s.lockoutUntil).toBeNull();
  });

  it("stamps the run marker on every failure", () => {
    const s = recordFailure(fresh, NOW);
    expect(s.lastFailedLoginAt).toEqual(NOW);
  });
});

// ---------------------------------------------------------------------------
// The counter is CONSECUTIVE, not cumulative (2026-08-19).
//
// It used to be a lifetime total that nothing decayed, which produced two live
// defects. These tests are written so that reverting the fix breaks them:
//
//   - Delete the `isFailureRunActive(...)` guard from recordFailure (i.e. go
//     back to `state.failedLoginAttempts + 1`) and every test in this block
//     that starts from a stale state fails.
//   - Set FAILURE_WINDOW_MS <= LOCKOUT_MAX_MS and "serving the cap does not
//     buy back the ladder" fails.
// ---------------------------------------------------------------------------
describe("loginLockout — failure runs decay", () => {
  const daysMs = (n: number) => n * 24 * 60 * 60 * 1000;

  it("INVARIANT: the run window outlives the longest lockout", () => {
    // If it did not, an attacker at the 24h cap would erase their own
    // escalation just by sitting out the penalty they earned.
    expect(FAILURE_WINDOW_MS).toBeGreaterThan(LOCKOUT_MAX_MS);
  });

  it("a run that has gone quiet past the window starts over at 1", () => {
    const stale: LockoutState = {
      failedLoginAttempts: LOCKOUT_THRESHOLD - 1,
      lockoutUntil: null,
      lastFailedLoginAt: new Date(NOW.getTime() - FAILURE_WINDOW_MS - 1000),
    };
    const s = recordFailure(stale, NOW);
    expect(s.failedLoginAttempts).toBe(1);
    expect(s.lockoutUntil).toBeNull();
    expect(isLockedOut(s, NOW)).toBe(false);
  });

  it("a run still inside the window keeps counting", () => {
    const live: LockoutState = {
      failedLoginAttempts: LOCKOUT_THRESHOLD - 1,
      lockoutUntil: null,
      lastFailedLoginAt: new Date(NOW.getTime() - FAILURE_WINDOW_MS + 1000),
    };
    const s = recordFailure(live, NOW);
    expect(s.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD);
    expect(s.lockoutUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_BASE_MS));
  });

  it("DEFECT 2: one typo a year after the last one is not a 24h lockout", () => {
    // The reported shape: 12 accumulated failures put the exponent at 7, so
    // LOCKOUT_BASE_MS * 2**7 = 32h clamped to the 24h maximum, and stayed
    // there for the life of the account.
    const yearsOfTypos: LockoutState = {
      failedLoginAttempts: 12,
      lockoutUntil: null,
      lastFailedLoginAt: new Date(NOW.getTime() - daysMs(365)),
    };
    const s = recordFailure(yearsOfTypos, NOW);
    expect(s.failedLoginAttempts).toBe(1);
    expect(s.lockoutUntil).toBeNull();
  });

  it("a legacy counter with no run marker is discarded, not honoured", () => {
    // Every row written before the last_failed_login_at column existed reads
    // NULL. NULL is the honest "nobody recorded when these happened", and the
    // migration deliberately does not backfill a guess.
    const legacy: LockoutState = {
      failedLoginAttempts: 12,
      lockoutUntil: null,
      lastFailedLoginAt: null,
    };
    expect(isFailureRunActive(legacy, NOW)).toBe(false);
    const s = recordFailure(legacy, NOW);
    expect(s.failedLoginAttempts).toBe(1);
    expect(s.lockoutUntil).toBeNull();
  });

  it("serving the 24h cap does not buy back the ladder", () => {
    // Attacker sits at the maximum. They wait out the full 24h lockout and
    // fail again: the run is still live, so they get the cap again — not a
    // fresh 5-guess budget.
    const capped: LockoutState = {
      failedLoginAttempts: 12,
      lockoutUntil: new Date(NOW.getTime() + LOCKOUT_MAX_MS),
      lastFailedLoginAt: NOW,
    };
    const afterServing = new Date(NOW.getTime() + LOCKOUT_MAX_MS + 1000);
    expect(isLockedOut(capped, afterServing)).toBe(false);
    const s = recordFailure(capped, afterServing);
    expect(s.failedLoginAttempts).toBe(13);
    expect(s.lockoutUntil!.getTime() - afterServing.getTime()).toBe(LOCKOUT_MAX_MS);
  });

  it("escalation across a real lockout cycle is unchanged", () => {
    // 5 failures → 15m. Wait it out, fail once more → 30m, not 15m again.
    const fifth = recordFailure(
      { failedLoginAttempts: 4, lockoutUntil: null, lastFailedLoginAt: NOW },
      NOW,
    );
    expect(fifth.lockoutUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_BASE_MS));
    const afterServing = new Date(NOW.getTime() + LOCKOUT_BASE_MS + 1000);
    const sixth = recordFailure(fifth, afterServing);
    expect(sixth.failedLoginAttempts).toBe(6);
    expect(sixth.lockoutUntil!.getTime() - afterServing.getTime()).toBe(2 * LOCKOUT_BASE_MS);
  });

  it("the window boundary is exclusive", () => {
    const onTheBoundary: LockoutState = {
      failedLoginAttempts: 4,
      lockoutUntil: null,
      lastFailedLoginAt: new Date(NOW.getTime() - FAILURE_WINDOW_MS),
    };
    expect(isFailureRunActive(onTheBoundary, NOW)).toBe(false);
    expect(recordFailure(onTheBoundary, NOW).failedLoginAttempts).toBe(1);
  });
});
