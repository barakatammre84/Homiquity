import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Login lockout — does the policy actually REACH the database? (2026-08-19)
//
// tests/loginLockout.test.ts covers the pure policy. It cannot see the defect
// that made the policy wrong in production, which was not in the arithmetic at
// all: the counter was only ever cleared by a successful PASSWORD login, so a
// user with a passwordHash who always signs in with Google accumulated failed
// attempts that nothing on any code path ever reset.
//
// That is the repo's dominant defect class — an operation that does not happen
// while everything reports success. The social login returned 200 and redirected
// to the dashboard the entire time the counter was climbing behind it. So these
// tests assert on the columns the storage layer WRITES, captured off a mocked
// db, rather than on anything the service returns.
//
// Mutation checks (each of these reverts the fix and reddens a named test):
//   - drop `...recordSuccess()` from upsertSocialUser's onConflictDoUpdate
//     → "a social login clears a run of failed password attempts" fails.
//   - drop `lastFailedLoginAt` from setLockoutState's .set()
//     → "setLockoutState persists the run marker" fails.
//   - revert setPassword to `{ failedLoginAttempts: 0, lockoutUntil: null }`
//     → "a password reset clears the run marker too" fails.
// ---------------------------------------------------------------------------

type Captured = { table: string; vals: Record<string, unknown> };

const updates: Captured[] = [];
const upserts: Array<{ values: Record<string, unknown>; set: Record<string, unknown> }> = [];

const tableName = (t: any) => String(t?.[Symbol.for("drizzle:Name")] ?? "unknown");

vi.mock("../server/db", () => ({
  db: {
    update: (table: any) => ({
      set: (vals: any) => ({
        where: async (_cond: any) => {
          updates.push({ table: tableName(table), vals });
          return undefined;
        },
      }),
    }),
    insert: (_table: any) => ({
      values: (values: any) => ({
        onConflictDoUpdate: (cfg: any) => ({
          returning: async () => {
            upserts.push({ values, set: cfg.set });
            return [{ id: "user-1", ...values }];
          },
        }),
      }),
    }),
    select: () => ({ from: () => ({ where: async () => [] }) }),
  },
}));

import { authStorage } from "../server/integrations/auth/storage";
import { recordFailure, type LockoutState } from "../server/services/loginLockout";

const NOW = new Date("2026-08-19T09:00:00Z");

beforeEach(() => {
  updates.length = 0;
  upserts.length = 0;
});

describe("login lockout persistence", () => {
  it("a social login clears a run of failed password attempts", async () => {
    await authStorage.upsertSocialUser({
      email: "borrower@example.com",
      firstName: "Sam",
      lastName: null,
      profileImageUrl: null,
      authProvider: "google",
    });

    expect(upserts).toHaveLength(1);
    const { set } = upserts[0];
    // DEFECT 1: before the fix these three keys were simply absent from the
    // conflict-update, so an existing row's counter survived every Google login.
    expect(set).toHaveProperty("failedLoginAttempts", 0);
    expect(set).toHaveProperty("lockoutUntil", null);
    expect(set).toHaveProperty("lastFailedLoginAt", null);
  });

  it("setLockoutState persists the run marker, not just the count", async () => {
    const next = recordFailure(
      { failedLoginAttempts: 0, lockoutUntil: null, lastFailedLoginAt: null },
      NOW,
    );
    await authStorage.setLockoutState("user-1", next);

    expect(updates).toHaveLength(1);
    expect(updates[0].vals).toMatchObject({
      failedLoginAttempts: 1,
      lockoutUntil: null,
      lastFailedLoginAt: NOW,
    });
  });

  it("every field of the policy state is written — none silently dropped", async () => {
    // The old signature took an inline `{ failedLoginAttempts; lockoutUntil }`.
    // TypeScript does not flag extra properties on a non-literal argument, so a
    // field added to the policy would have been dropped on the way to the
    // database with no error anywhere. Assert the write covers the whole state.
    const state = recordFailure(
      { failedLoginAttempts: 4, lockoutUntil: null, lastFailedLoginAt: NOW },
      NOW,
    );
    await authStorage.setLockoutState("user-1", state);

    const written = updates[0].vals;
    for (const key of Object.keys(state) as Array<keyof LockoutState>) {
      expect(Object.keys(written)).toContain(key);
      expect(written[key]).toEqual(state[key]);
    }
  });

  it("a password reset clears the run marker too", async () => {
    await authStorage.setPassword("user-1", "new-hash");

    expect(updates).toHaveLength(1);
    expect(updates[0].vals).toMatchObject({
      passwordHash: "new-hash",
      failedLoginAttempts: 0,
      lockoutUntil: null,
      // Without this the next failure would resume the run the reset ended.
      lastFailedLoginAt: null,
    });
  });
});
