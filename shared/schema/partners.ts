import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";

/**
 * PartnerHub identity spine (PH-1 of knowledge-base/specs/PARTNER_HUB_PROGRAM.md).
 *
 * One row per external referral partner. The CPA channel's doctrine
 * (shared/schema/cpaPartners.ts) is program law and applies to every persona:
 * a partner is an **inviter-only** referral source — no financial data, no
 * borrower PII, no compensation tracked anywhere (RESPA §8: this table has no
 * fee/commission columns by design, charter §5-C1).
 *
 * Personas are self-registering PARTNER_ROLES (shared/roles.ts) — deliberately
 * never STAFF_ROLES; endpoints gate by exact role only. `referralSlug` is the
 * partner's public co-brand handle (/p/:slug) AND is written to
 * users.referral_code on the same account, so the existing consumer
 * attribution rail (users.referred_by_user_id via /api/apply-referral) works
 * unchanged — one code, both rails.
 *
 * `licenseVerificationStatus` is a manual admin review queue behind an adapter
 * seam: no public real-time NMLS/state-license lookup API exists, and we never
 * render "verified" from a lookup we didn't perform (charter §5-C10).
 *
 * The `cpa` persona keeps its operational table (cpa_partners) and routes for
 * now; this table holds new personas (realtor) and is the convergence target —
 * admin surfaces read a union until the CPA lane migrates in a later prompt.
 */
export const PARTNER_PERSONAS = [
  "realtor", // Real-estate agent partner (PH-1)
  "cpa",     // Reserved for the cpa_partners convergence — not yet written here
] as const;
export type PartnerPersona = (typeof PARTNER_PERSONAS)[number];

export const LICENSE_VERIFICATION_STATUSES = [
  "pending_review", // default on self-registration — awaiting the admin queue
  "verified",       // an admin manually confirmed the license identifier
  "rejected",       // an admin could not confirm it (partner stays contactable)
] as const;
export type LicenseVerificationStatus = (typeof LICENSE_VERIFICATION_STATUSES)[number];

export const PARTNER_PROFILE_STATUSES = ["active", "suspended"] as const;
export type PartnerProfileStatus = (typeof PARTNER_PROFILE_STATUSES)[number];

export const PARTNER_PROFILE_SOURCES = ["self_service", "waitlist_invite"] as const;
export type PartnerProfileSource = (typeof PARTNER_PROFILE_SOURCES)[number];

export const partnerProfiles = pgTable("partner_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // The partner's own authenticated user account (role = persona).
  userId: varchar("user_id").notNull().references(() => users.id),
  persona: varchar("persona", { length: 20 }).notNull(),
  firmName: varchar("firm_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  // Business license identifier only (e.g. a state real-estate license number)
  // — never a personal government id; not PII-vault material.
  licenseNumber: varchar("license_number", { length: 60 }),
  licenseState: varchar("license_state", { length: 2 }),
  licenseVerificationStatus: varchar("license_verification_status", { length: 20 })
    .default("pending_review")
    .notNull(),
  // Public co-brand handle: /p/:slug. Kept ≤20 chars so the identical value
  // fits users.referral_code (varchar(20)) — one code drives both rails.
  referralSlug: varchar("referral_slug", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  source: varchar("source", { length: 20 }).default("self_service").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_partner_profiles_user").on(table.userId),
  unique("uq_partner_profiles_slug").on(table.referralSlug),
  index("idx_partner_profiles_persona").on(table.persona, table.status),
  index("idx_partner_profiles_license_review").on(table.licenseVerificationStatus),
]);

export const insertPartnerProfileSchema = createInsertSchema(partnerProfiles, {
  persona: z.enum(PARTNER_PERSONAS),
  licenseVerificationStatus: z.enum(LICENSE_VERIFICATION_STATUSES).optional(),
  status: z.enum(PARTNER_PROFILE_STATUSES).optional(),
  source: z.enum(PARTNER_PROFILE_SOURCES).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPartnerProfile = z.infer<typeof insertPartnerProfileSchema>;
export type PartnerProfile = typeof partnerProfiles.$inferSelect;

/**
 * Progress-sharing consent (PH-2 of knowledge-base/specs/PARTNER_HUB_PROGRAM.md).
 *
 * Borrower-directed opt-in to share loan *progress stages* (never financials,
 * documents, or amounts — charter §5-C6) with the partner who referred them.
 * DEFAULT OFF: PH-1's hub shows every referred borrower's stage; PH-2 gates
 * that so a partner sees real progression only for borrowers who explicitly
 * opted in — non-consented referrals collapse to an existence-only "Invited".
 *
 * This is a togglable GLBA/Reg P-style privacy preference, deliberately kept
 * OUT of the regulated-consent ledger (`borrower_consents`, which is immutable
 * point-in-time credit/TRID consent with signatures + template versioning).
 * One current-state row per (borrower, partner) pair, toggled in place; every
 * transition also writes a server/auditLog.ts entry for the immutable trail.
 *
 * NOTE: the final borrower-facing consent copy is a counsel gate (charter §8);
 * the wording here and in the UI is a conservative placeholder pending sign-off.
 */
export const partnerProgressConsents = pgTable("partner_progress_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // The borrower granting (or withholding) the share.
  borrowerUserId: varchar("borrower_user_id").notNull().references(() => users.id),
  // The referring partner the progress would be shared WITH.
  partnerUserId: varchar("partner_user_id").notNull().references(() => users.id),
  // Current state. False = withheld/revoked (existence-only in the hub).
  shared: boolean("shared").default(false).notNull(),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  // Light GLBA-style capture (not the signature-grade compliance ledger).
  consentMethod: varchar("consent_method", { length: 30 }).default("toggle").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // One consent record per borrower↔partner pair; toggled in place.
  unique("uq_partner_progress_consent").on(table.borrowerUserId, table.partnerUserId),
  index("idx_partner_progress_consent_partner").on(table.partnerUserId, table.shared),
  index("idx_partner_progress_consent_borrower").on(table.borrowerUserId),
]);

export type PartnerProgressConsent = typeof partnerProgressConsents.$inferSelect;
