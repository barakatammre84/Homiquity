// F-0820-50 (P0) — credential material must not cross the API boundary.
//
// The defect: four storage queries joined `users` with a bare `.select()` and
// returned the joined row whole, and three routes pass that straight to
// `res.json()`. Every field crossed the wire, `passwordHash` (scrypt digest +
// salt) included — on two endpoints reachable by the external `broker` and
// `lender` roles, i.e. non-employee third-party companies.
//
// WHAT EACH LAYER HERE PROVES, AND WHAT IT DOES NOT. F-014 in the findings
// register is about grep-only suites that pass over wrong logic, so the split
// is stated rather than blurred:
//
//   1. `toPublicUser` / `publicUserColumns` — REAL runtime assertions against
//      the real Drizzle table. These prove the projection itself is correct.
//   2. The call-site scan — a source assertion. It proves no storage module
//      still returns a joined `users` row raw. It would NOT catch a leak
//      introduced through some other shape, and does not pretend to.
//
// The durable guard is neither of these: it is the type. Every fixed call site
// declares `PublicUser`, which structurally omits the auth-internal keys, so
// putting `passwordHash` back is a compile error under `pnpm check`.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  toPublicUser,
  toPublicUserOrUndefined,
  publicUserColumns,
  AUTH_INTERNAL_USER_KEYS,
} from "../server/storage/publicUser";
import type { User } from "@shared/schema";

const FIXTURE: User = {
  id: "u-1",
  email: "borrower@example.com",
  passwordHash: "scrypt$16384$8$1$aabbccdd$deadbeefcafef00d",
  authProvider: "local",
  firstName: "Dana",
  lastName: "Okonkwo",
  profileImageUrl: null,
  role: "aspiring_owner",
  isPartner: false,
  partnerCompanyName: null,
  nmlsId: null,
  referralCode: "DANA123",
  referredByUserId: null,
  lastActiveAt: new Date("2026-08-23T00:00:00Z"),
  failedLoginAttempts: 3,
  lockoutUntil: new Date("2026-08-23T01:00:00Z"),
  lastFailedLoginAt: new Date("2026-08-23T00:30:00Z"),
  emailVerifiedAt: new Date("2026-08-01T00:00:00Z"),
  createdAt: new Date("2026-07-01T00:00:00Z"),
  updatedAt: new Date("2026-08-23T00:00:00Z"),
} as User;

describe("F-0820-50 — the public user projection", () => {
  it("strips every auth-internal key", () => {
    const publicUser = toPublicUser(FIXTURE);
    for (const key of AUTH_INTERNAL_USER_KEYS) {
      expect(publicUser).not.toHaveProperty(key);
    }
  });

  it("strips the password hash specifically, by value as well as by key", () => {
    // Belt and braces: a projection that renamed the field rather than removing
    // it would pass the key check above and still ship the digest.
    expect(JSON.stringify(toPublicUser(FIXTURE))).not.toContain("scrypt");
    expect(JSON.stringify(toPublicUser(FIXTURE))).not.toContain("deadbeef");
  });

  it("preserves every field a surface actually renders", () => {
    const publicUser = toPublicUser(FIXTURE);
    expect(publicUser).toMatchObject({
      id: "u-1",
      email: "borrower@example.com",
      firstName: "Dana",
      lastName: "Okonkwo",
      role: "aspiring_owner",
      referralCode: "DANA123",
    });
  });

  it("does not mutate the row it was given", () => {
    // The storage layer hands us a live query row; stripping in place would
    // blank the hash for any caller that legitimately needs it (auth does).
    toPublicUser(FIXTURE);
    expect(FIXTURE.passwordHash).toBe("scrypt$16384$8$1$aabbccdd$deadbeefcafef00d");
  });

  it("passes an absent left-join row through as undefined", () => {
    expect(toPublicUserOrUndefined(null)).toBeUndefined();
    expect(toPublicUserOrUndefined(undefined)).toBeUndefined();
    expect(toPublicUserOrUndefined(FIXTURE)).not.toHaveProperty("passwordHash");
  });

  it("derives the Drizzle column map from the real table, minus the same keys", () => {
    const projected = Object.keys(publicUserColumns);
    for (const key of AUTH_INTERNAL_USER_KEYS) {
      expect(projected).not.toContain(key);
    }
    // Guards the other direction: a projection that dropped everything would
    // satisfy the assertions above and return empty objects to every caller.
    expect(projected).toContain("id");
    expect(projected).toContain("email");
    expect(projected.length).toBe(Object.keys(FIXTURE).length - AUTH_INTERNAL_USER_KEYS.length);
  });
});

describe("F-0820-50 — no storage module returns a joined users row raw", () => {
  // Red on origin/main: brokerReferrals.ts (x2) and pipeline.ts (x1) match.
  // A source assertion — see the header for what it does and does not prove.
  const RAW_JOIN = /:\s*(?:\w+\.)?users\b(?!\s*\.)\s*(?:\|\|[^,\n]*)?,/;

  const storageDir = join(__dirname, "..", "server", "storage");
  const files = readdirSync(storageDir).filter((f) => f.endsWith(".ts"));

  it.each(files)("%s", (file) => {
    const source = readFileSync(join(storageDir, file), "utf-8");
    const offenders = source
      .split("\n")
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => RAW_JOIN.test(line) && !line.startsWith("//"));

    expect(
      offenders,
      `${file} returns a joined \`users\` row whole. Project it through ` +
        `publicUserColumns, or map it through toPublicUser().`,
    ).toEqual([]);
  });
});
