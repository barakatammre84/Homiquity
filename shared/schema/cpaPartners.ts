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
 * CPA partner channel (Phase 1 of the tax-insight pipeline).
 *
 * A CPA is an **inviter-only** referral source: they share a co-branded link,
 * their client signs up and runs the consumer-direct tax-readiness flow, and
 * the CPA sees referral *progress* only. The CPA never receives the client's
 * tax return or any borrower financial data — which keeps them outside the
 * IRC §7216 disclosure flow entirely. No compensation is tracked anywhere
 * (RESPA §8): this table has no fee/commission columns by design.
 *
 * The `cpa` role is a self-registering PARTNER_ROLE — deliberately NOT a
 * STAFF_ROLE (see shared/roles.ts). Because CPAs self-register via the public
 * POST /api/cpa-partners/register, adding `cpa` to STAFF_ROLES would expose
 * every isStaffRole()-gated endpoint to anyone who signs up. Its endpoints are
 * gated by exact-role requireRole("cpa", ...) only, so a CPA can never reach a
 * borrower record through object-level authorization.
 */
export const cpaPartners = pgTable("cpa_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // The CPA's own authenticated user account (role = "cpa").
  userId: varchar("user_id").notNull().references(() => users.id),
  firmName: varchar("firm_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  // Shareable link slug, e.g. /cpa/SMITH-TAX-4821 — reusable across clients.
  referralCode: varchar("referral_code", { length: 40 }).notNull().unique(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, suspended
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cpa_partners_user").on(table.userId),
  index("idx_cpa_partners_code").on(table.referralCode),
]);

/**
 * One row per client a CPA has referred. This is the attribution record and
 * the sole basis for the CPA portal's client list. Deliberately carries NO
 * financial fields — client progress is joined live from loan_applications
 * (stage only) at read time, never persisted here.
 */
export const cpaReferrals = pgTable("cpa_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cpaPartnerId: varchar("cpa_partner_id").notNull().references(() => cpaPartners.id),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id),
  // Optional label the CPA supplied when inviting; falls back to the user's name.
  clientName: varchar("client_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cpa_referrals_partner").on(table.cpaPartnerId),
  index("idx_cpa_referrals_user").on(table.referredUserId),
  // A given client is attributed to at most one CPA (first-touch wins).
  unique("uq_cpa_referrals_user").on(table.referredUserId),
]);

export const insertCpaPartnerSchema = createInsertSchema(cpaPartners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCpaReferralSchema = createInsertSchema(cpaReferrals).omit({
  id: true,
  createdAt: true,
});

export type InsertCpaPartner = z.infer<typeof insertCpaPartnerSchema>;
export type CpaPartner = typeof cpaPartners.$inferSelect;
export type InsertCpaReferral = z.infer<typeof insertCpaReferralSchema>;
export type CpaReferral = typeof cpaReferrals.$inferSelect;
