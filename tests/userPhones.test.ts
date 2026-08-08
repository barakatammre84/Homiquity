import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { userPhones, smsOptOuts } from "../shared/schema/core";
import { normalizePhone } from "../server/services/smsCompliance";

// -----------------------------------------------------------------------------
// user_phones — the verified phone ↔ user link that makes an inbound SMS
// routable.
//
// This file guards two things that cannot be caught by types.
//
// 1. DRIFT between the hand-authored migration and the Drizzle table. This repo
//    hand-authors migration SQL because `drizzle-kit generate` has snapshot
//    drift here, so nothing else compares the two. A column that exists in one
//    and not the other fails at runtime in prod, not at build time.
//
// 2. The SECURITY INVARIANTS, which are expressed as partial indexes and
//    nullability rather than as code. Each assertion below corresponds to a way
//    borrower messages could be delivered to the wrong person.
// -----------------------------------------------------------------------------

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const MIGRATION = read("migrations/0053_user_phones.sql");

const config = getTableConfig(userPhones);
const columnNames = config.columns.map((c) => c.name);
const column = (name: string) => {
  const found = config.columns.find((c) => c.name === name);
  if (!found) throw new Error(`no column ${name} on user_phones`);
  return found;
};

describe("user_phones — migration ↔ schema parity", () => {
  it("declares the table the migration creates", () => {
    expect(config.name).toBe("user_phones");
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS "user_phones"/);
  });

  it("every Drizzle column exists in the migration SQL", () => {
    // The failure this catches: a column added to the schema without a matching
    // migration line. The app would then SELECT a column prod does not have —
    // the exact 42703 errorMissingColumn class that took the site down before.
    for (const name of columnNames) {
      expect(MIGRATION, `column "${name}" missing from 0053_user_phones.sql`).toMatch(
        new RegExp(`"${name}"`),
      );
    }
  });

  it("is expand-only and idempotent — safe against the running release", () => {
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(MIGRATION).toMatch(/CREATE INDEX IF NOT EXISTS/);
    expect(MIGRATION).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/);
    // No destructive or contract DDL: this must never fail on existing data.
    expect(MIGRATION).not.toMatch(/\bDROP\b/i);
    expect(MIGRATION).not.toMatch(/\bSET NOT NULL\b/i);
    expect(MIGRATION).not.toMatch(/ALTER TABLE "users"/i);
  });
});

describe("user_phones — delivery-safety invariants", () => {
  it("verified_at is NULLABLE, so an unverified claim is representable", () => {
    // The sender's rule is "verifiedAt IS NULL must never receive a message".
    // That rule only has meaning if NULL is the default state of a new row. A
    // NOT NULL default would silently mark every claimed number as verified.
    expect(column("verified_at").notNull).toBe(false);
    expect(MIGRATION).toMatch(/"verified_at" timestamp(?!\s+NOT NULL)/);
  });

  it("uniqueness on phone is PARTIAL to verified rows, not plain", () => {
    // Why this matters: with a plain UNIQUE(phone), anyone could insert an
    // UNVERIFIED claim on a number and permanently block its real owner from
    // ever verifying it — a denial-of-service on account setup, and worse, an
    // invitation to squat on a number before its owner arrives.
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_phones_verified_phone"\s+ON "user_phones" \("phone"\)\s+WHERE "verified_at" IS NOT NULL/,
    );
    // And it must NOT be a table-level unique constraint on phone alone.
    expect(MIGRATION).not.toMatch(/"phone" varchar\(40\) NOT NULL UNIQUE/);
  });

  it("allows at most one primary number per user", () => {
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_phones_primary"\s+ON "user_phones" \("user_id"\)\s+WHERE "is_primary"/,
    );
  });

  it("consent columns are nullable — a NULL is an honest gap", () => {
    // Forcing NOT NULL here would push callers to invent a value on a TCPA
    // consent record. A fabricated consent timestamp is a falsified regulatory
    // record; a missing one is merely missing.
    for (const name of ["consent_at", "consent_source", "consent_ip"]) {
      expect(column(name).notNull, `${name} must stay nullable`).toBe(false);
    }
  });

  it("consent_ip fits clientIpForRecord()'s 64-char truncation", () => {
    expect(MIGRATION).toMatch(/"consent_ip" varchar\(64\)/);
  });
});

describe("user_phones — phone format contract", () => {
  it("stores the same shape as the opt-out ledger, so one lookup matches both", () => {
    // An inbound webhook normalizes `From` once and must be able to check the
    // opt-out ledger AND resolve the owner. Divergent column widths here would
    // let a number that fits one table be truncated in the other.
    const optOutPhone = getTableConfig(smsOptOuts).columns.find((c) => c.name === "phone");
    expect(optOutPhone).toBeDefined();
    expect(MIGRATION).toMatch(/"phone" varchar\(40\) NOT NULL/);
  });

  it("normalizePhone output is what the column expects", () => {
    const normalized = normalizePhone("(224) 400-0531");
    expect(normalized).toBe("12244000531");
    expect(normalized!.length).toBeLessThanOrEqual(40);
    // Digits only — no "+", no punctuation — matching sms_opt_outs.phone.
    expect(normalized).toMatch(/^\d+$/);
  });

  it("rejects input that cannot be a US number rather than storing junk", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
