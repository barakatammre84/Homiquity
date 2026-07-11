import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
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
