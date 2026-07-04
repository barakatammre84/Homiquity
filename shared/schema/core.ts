import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  decimal,
  jsonb,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Role system — the definitions live in shared/roles.ts (dependency-free so
// the client can import role helpers without pulling drizzle-orm into the
// browser bundle). Re-exported here so `@shared/schema` consumers are
// unchanged.
export {
  STAFF_ROLES,
  CLIENT_ROLES,
  ALL_ROLES,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
  INTERNAL_STAFF_ROLES,
  isStaffRole,
  isInternalStaffRole,
  isClientRole,
  type UserRole,
} from "../roles";

// Session storage table for express-session (connect-pg-simple)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  authProvider: varchar("auth_provider", { length: 20 }).default("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).default("aspiring_owner").notNull(), // See ALL_ROLES constant
  // Partner tracking - for external loan officers using the platform
  isPartner: boolean("is_partner").default(false),
  partnerCompanyName: varchar("partner_company_name", { length: 255 }),
  nmlsId: varchar("nmls_id", { length: 20 }), // NMLS license number for loan officers
  // Referral link system for LOs
  referralCode: varchar("referral_code", { length: 20 }).unique(), // Unique code for LO referral links (e.g., "JOHN-SMITH-LO")
  referredByUserId: varchar("referred_by_user_id").references((): AnyPgColumn => users.id), // Who referred this user (references users.id)
  // Presence tracking - for online/away status
  lastActiveAt: timestamp("last_active_at"),
  // Per-account brute-force lockout. The IP rate limiter is per-instance on
  // serverless, so this DB-backed counter is the durable control.
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockoutUntil: timestamp("lockout_until"),
  // Null until the user confirms ownership of their email via a verification
  // link. Social-auth users are considered verified by their provider.
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

// Single-use, expiring tokens for password reset and email verification.
// We store only a SHA-256 hash of the token — the raw value lives solely in the
// emailed link, so a database read never yields a usable token. Rows are
// consumed (usedAt set) on first use and ignored past expiresAt.
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references((): AnyPgColumn => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(), // 'password_reset' | 'email_verification'
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("auth_tokens_token_hash_idx").on(table.tokenHash),
    index("auth_tokens_user_type_idx").on(table.userId, table.type),
  ],
);

export type AuthToken = typeof authTokens.$inferSelect;
export type AuthTokenType = "password_reset" | "email_verification";

// Canonical SMS opt-out ledger, keyed by normalized phone. A STOP keyword flips
// optedOut=true; START/UNSTOP re-subscribes. This is the source of truth an
// outbound sender/dialer must check — it persists even when no lead/user row
// exists for the number yet, so a future contact with that phone is born
// suppressed. Required before any outbound SMS feature ships (TCPA / CTIA).
export const smsOptOuts = pgTable(
  "sms_opt_outs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    // Normalized to digits-only (E.164 national form, e.g. "15551234567").
    phone: varchar("phone", { length: 40 }).notNull().unique(),
    optedOut: boolean("opted_out").default(true).notNull(),
    optedOutAt: timestamp("opted_out_at"),
    resubscribedAt: timestamp("resubscribed_at"),
    lastKeyword: varchar("last_keyword", { length: 40 }),
    source: varchar("source", { length: 40 }).default("sms_webhook").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [index("sms_opt_outs_phone_idx").on(table.phone)],
);

export type SmsOptOut = typeof smsOptOuts.$inferSelect;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
