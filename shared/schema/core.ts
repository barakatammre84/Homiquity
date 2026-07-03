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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
