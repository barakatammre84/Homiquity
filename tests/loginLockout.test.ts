import { describe, it, expect } from "vitest";
import {
  isLockedOut,
  recordFailure,
  recordSuccess,
  LOCKOUT_THRESHOLD,
  LOCKOUT_BASE_MS,
  LOCKOUT_MAX_MS,
  type LockoutState,
} from "../server/services/loginLockout";

const NOW = new Date("2026-07-02T12:00:00Z");
const fresh: LockoutState = { failedLoginAttempts: 0, lockoutUntil: null };

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
    expect(isLockedOut(reset, NOW)).toBe(false);
  });

  it("counter climbs from a partial state", () => {
    const s = recordFailure({ failedLoginAttempts: 3, lockoutUntil: null }, NOW);
    expect(s.failedLoginAttempts).toBe(4);
    expect(s.lockoutUntil).toBeNull();
  });
});
