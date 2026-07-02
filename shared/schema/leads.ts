import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  decimal,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { loanApplications } from "./lending";

/**
 * Inbound lead capture — the top of the funnel, upstream of users/applications.
 *
 * Design constraints:
 * - No SSN/DOB at this stage by design (soft-pull-first strategy; see kb docs).
 * - Every lead carries its own consent evidence (TCPA text + TrustedForm cert)
 *   because aggregator leads arrive with consent captured on THEIR forms and
 *   we must be able to prove it per-lead, not per-account.
 * - rawPayload preserves the aggregator webhook body verbatim for disputes,
 *   attribution audits, and replaying against future parsers.
 */
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Source attribution
  source: varchar("source", { length: 100 }).notNull(), // zillow_connect, zillow_quotes, lendingtree, organic, referral, direct, other
  sourceCampaign: varchar("source_campaign", { length: 255 }),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  externalLeadId: varchar("external_lead_id", { length: 255 }), // aggregator's id for dedupe/disputes
  rawPayload: jsonb("raw_payload"), // verbatim webhook body

  // Compliance evidence (TCPA / lead-consent)
  trustedFormCertUrl: varchar("trusted_form_cert_url", { length: 500 }),
  consentTcpaText: text("consent_tcpa_text"),
  consentCapturedAt: timestamp("consent_captured_at"),
  consentIp: varchar("consent_ip", { length: 64 }),
  consentUserAgent: text("consent_user_agent"),
  doNotContact: boolean("do_not_contact").default(false).notNull(),
  optOutAt: timestamp("opt_out_at"),

  // Contact (intentionally no SSN/DOB pre-qualification)
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 40 }),

  // Self-reported qualification signals
  loanPurpose: varchar("loan_purpose", { length: 50 }), // purchase, refinance, cash_out_refinance, heloc
  propertyZip: varchar("property_zip", { length: 20 }),
  propertyState: varchar("property_state", { length: 2 }),
  estimatedPropertyValue: decimal("estimated_property_value", { precision: 12, scale: 2 }),
  estimatedDownPayment: decimal("estimated_down_payment", { precision: 12, scale: 2 }),
  selfReportedCreditRange: varchar("self_reported_credit_range", { length: 20 }), // excellent, good, fair, poor

  // Lifecycle
  status: varchar("status", { length: 30 }).default("new").notNull(), // new, contacted, qualified, converted, rejected, duplicate, unsubscribed
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  convertedUserId: varchar("converted_user_id").references(() => users.id),
  convertedApplicationId: varchar("converted_application_id").references(() => loanApplications.id),
  convertedAt: timestamp("converted_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_leads_email").on(table.email),
  index("idx_leads_phone").on(table.phone),
  index("idx_leads_status").on(table.status),
  index("idx_leads_source").on(table.source),
  index("idx_leads_created").on(table.createdAt),
  index("idx_leads_source_status").on(table.source, table.status),
  index("idx_leads_assigned").on(table.assignedToId),
  index("idx_leads_converted_user").on(table.convertedUserId),
  // One row per aggregator lead id per source (NULLs exempt, so organic leads
  // without an external id are unaffected).
  uniqueIndex("uq_leads_source_external").on(table.source, table.externalLeadId),
]);

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
