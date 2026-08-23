// The API boundary for a `users` row.
//
// WHY THIS EXISTS (F-0820-50, P0). Four storage queries joined `users` and
// returned the joined row whole — `.select()` with no projection, then
// `borrower: r.users` / `broker: c.users` / `user: row.users`. Three routes
// pass those straight to `res.json()`, so every field of the row crossed the
// wire, **including `passwordHash`** (the scrypt digest AND its salt). Two of
// the affected endpoints are reachable by the external `broker` and `lender`
// roles — non-employee third-party companies. Reproduced live at HTTP 200:
// `GET /api/broker/referrals` as `lo` returned 2,949 bytes carrying the hash.
//
// THE GUARD IS THE TYPE, NOT A GREP. `PublicUser` structurally omits the
// auth-internal keys, and every one of those call sites now declares it as its
// return type. Re-introducing `passwordHash` there is a compile error, which is
// the property a source-scanning test cannot give you (see F-014 on why the
// grep-only suites in this repo pass over wrong logic).
//
// WHAT IS OMITTED, AND WHY THESE FOUR. `passwordHash` is credential material.
// The other three are auth-internal lockout state: no surface renders them, and
// exposing them tells an attacker whether an address is being guessed at and how
// close it is to locking. They are the login machinery's private state, so the
// boundary is "auth-internal", not "the password field".
import { getTableColumns } from "drizzle-orm";
import { users, type User } from "@shared/schema";

/** Keys of `users` that must never cross the API boundary. */
export const AUTH_INTERNAL_USER_KEYS = [
  "passwordHash",
  "failedLoginAttempts",
  "lockoutUntil",
  "lastFailedLoginAt",
] as const satisfies readonly (keyof User)[];

export type AuthInternalUserKey = (typeof AUTH_INTERNAL_USER_KEYS)[number];

/** A `users` row with every auth-internal field removed. Safe to serialise. */
export type PublicUser = Omit<User, AuthInternalUserKey>;

/**
 * Strip the auth-internal fields off a `users` row.
 *
 * Deletes by iterating `AUTH_INTERNAL_USER_KEYS` rather than destructuring, so
 * adding a key to that list is the only edit needed to close a new field — a
 * destructure would silently keep leaking it.
 */
export function toPublicUser(user: User): PublicUser {
  const copy = { ...user } as User & Partial<Record<AuthInternalUserKey, unknown>>;
  for (const key of AUTH_INTERNAL_USER_KEYS) {
    delete copy[key];
  }
  return copy as PublicUser;
}

/** `toPublicUser` for an outer/left join, where the row may be absent. */
export function toPublicUserOrUndefined(user: User | null | undefined): PublicUser | undefined {
  return user ? toPublicUser(user) : undefined;
}

/**
 * The same projection as a Drizzle select shape, for queries that would
 * otherwise `select()` the whole row.
 *
 * Derived from `AUTH_INTERNAL_USER_KEYS` rather than hand-listed, so the column
 * map and `PublicUser` cannot drift apart — and the annotation ties it to
 * `PublicUser`, so if they ever did, this stops compiling.
 */
export const publicUserColumns: { [K in keyof PublicUser]: (typeof users)[K] } = (() => {
  const columns = { ...getTableColumns(users) } as Record<string, unknown>;
  for (const key of AUTH_INTERNAL_USER_KEYS) {
    delete columns[key];
  }
  return columns as { [K in keyof PublicUser]: (typeof users)[K] };
})();
