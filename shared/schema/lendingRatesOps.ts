// Rate programs/rates, application invites, rate locks, application milestones, SLA configurations, analytics snapshots.
// Split from the old shared/schema/lending.ts — ./lending re-exports all of it.
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { loanApplications, loanOptions } from "./lendingCore";
import { users } from "./core";

export const mortgageRatePrograms = pgTable("mortgage_rate_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  termYears: integer("term_years"),
  isAdjustable: boolean("is_adjustable").default(false),
  adjustmentPeriod: varchar("adjustment_period", { length: 20 }),
  loanType: varchar("loan_type", { length: 50 }),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export const insertMortgageRateProgramSchema = createInsertSchema(mortgageRatePrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMortgageRateProgram = z.infer<typeof insertMortgageRateProgramSchema>;
export type MortgageRateProgram = typeof mortgageRatePrograms.$inferSelect;

export const mortgageRates = pgTable("mortgage_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  state: varchar("state", { length: 2 }),
  zipcode: varchar("zipcode", { length: 10 }),
  
  programId: varchar("program_id").references(() => mortgageRatePrograms.id).notNull(),
  
  rate: decimal("rate", { precision: 6, scale: 3 }).notNull(),
  apr: decimal("apr", { precision: 6, scale: 3 }).notNull(),
  points: decimal("points", { precision: 5, scale: 2 }),
  pointsCost: decimal("points_cost", { precision: 10, scale: 2 }),
  
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).default("160000"),
  downPaymentPercent: integer("down_payment_percent").default(20),
  creditScoreMin: integer("credit_score_min").default(760),
  
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expiresAt: timestamp("expires_at"),
  
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_mortgage_rates_location").on(table.state, table.zipcode),
  index("idx_mortgage_rates_program").on(table.programId),
  index("idx_mortgage_rates_active").on(table.isActive),
]);

export const insertMortgageRateSchema = createInsertSchema(mortgageRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMortgageRate = z.infer<typeof insertMortgageRateSchema>;
export type MortgageRate = typeof mortgageRates.$inferSelect;

// Application Invites - Referral links for LOs and agents to send to affluent clients
export const applicationInvites = pgTable("application_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referrerType: varchar("referrer_type", { length: 20 }).notNull(),
  
  clientName: varchar("client_name", { length: 255 }),
  clientEmail: varchar("client_email", { length: 255 }),
  clientPhone: varchar("client_phone", { length: 20 }),
  
  token: varchar("token", { length: 64 }).unique().notNull(),
  message: text("message"),
  
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  
  expiresAt: timestamp("expires_at").notNull(),
  clickedAt: timestamp("clicked_at"),
  appliedAt: timestamp("applied_at"),
  loanApplicationId: varchar("loan_application_id").references(() => loanApplications.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_application_invites_referrer").on(table.referrerId),
  index("idx_application_invites_token").on(table.token),
  index("idx_application_invites_status").on(table.status),
]);

export const insertApplicationInviteSchema = createInsertSchema(applicationInvites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationInvite = z.infer<typeof insertApplicationInviteSchema>;
export type ApplicationInvite = typeof applicationInvites.$inferSelect;

// ===== RATE LOCK SYSTEM =====

export const rateLocks = pgTable("rate_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  loanOptionId: varchar("loan_option_id").references(() => loanOptions.id).notNull(),
  
  interestRate: decimal("interest_rate", { precision: 5, scale: 3 }).notNull(),
  points: decimal("points", { precision: 5, scale: 3 }),
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  loanType: varchar("loan_type", { length: 50 }).notNull(),
  loanTerm: integer("loan_term").notNull(),
  
  lockPeriodDays: integer("lock_period_days").notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  status: varchar("status", { length: 50 }).default("active").notNull(),
  
  extensionCount: integer("extension_count").default(0),
  originalExpiresAt: timestamp("original_expires_at"),
  extensionFee: decimal("extension_fee", { precision: 10, scale: 2 }),
  
  lockedBy: varchar("locked_by").references(() => users.id).notNull(),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_rate_locks_application").on(table.applicationId),
  index("idx_rate_locks_status").on(table.status),
  index("idx_rate_locks_expires").on(table.expiresAt),
]);

export const insertRateLockSchema = createInsertSchema(rateLocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRateLock = z.infer<typeof insertRateLockSchema>;
export type RateLock = typeof rateLocks.$inferSelect;

// ===== ANALYTICS & SLA TRACKING =====

export const applicationMilestones = pgTable("application_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  applicationReceivedAt: timestamp("application_received_at"),
  documentCollectionStartedAt: timestamp("document_collection_started_at"),
  documentCollectionCompletedAt: timestamp("document_collection_completed_at"),
  submittedToProcessingAt: timestamp("submitted_to_processing_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  submittedToUnderwritingAt: timestamp("submitted_to_underwriting_at"),
  conditionalApprovalAt: timestamp("conditional_approval_at"),
  clearToCloseAt: timestamp("clear_to_close_at"),
  closingScheduledAt: timestamp("closing_scheduled_at"),
  closedAt: timestamp("closed_at"),
  fundedAt: timestamp("funded_at"),
  
  deniedAt: timestamp("denied_at"),
  denialReason: text("denial_reason"),
  
  withdrawnAt: timestamp("withdrawn_at"),
  withdrawalReason: text("withdrawal_reason"),
  
  totalCycleTimeHours: decimal("total_cycle_time_hours", { precision: 10, scale: 2 }),
  processingTimeHours: decimal("processing_time_hours", { precision: 10, scale: 2 }),
  underwritingTimeHours: decimal("underwriting_time_hours", { precision: 10, scale: 2 }),
  closingTimeHours: decimal("closing_time_hours", { precision: 10, scale: 2 }),
  
  slaTargetDate: timestamp("sla_target_date"),
  isSlaMet: boolean("is_sla_met"),
  slaBreachReason: text("sla_breach_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_application_milestones_app").on(table.applicationId),
]);

export const insertApplicationMilestoneSchema = createInsertSchema(applicationMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationMilestone = z.infer<typeof insertApplicationMilestoneSchema>;
export type ApplicationMilestone = typeof applicationMilestones.$inferSelect;

// SLA Configurations - Define SLA targets
export const slaConfigurations = pgTable("sla_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  applicationToProcessingHours: integer("application_to_processing_hours").default(24),
  processingToUnderwritingHours: integer("processing_to_underwriting_hours").default(48),
  underwritingDecisionHours: integer("underwriting_decision_hours").default(72),
  conditionalToCtcHours: integer("conditional_to_ctc_hours").default(48),
  ctcToClosingHours: integer("ctc_to_closing_hours").default(72),
  totalApplicationToCloseHours: integer("total_application_to_close_hours").default(360),
  
  loanType: varchar("loan_type", { length: 50 }),
  
  isActive: boolean("is_active").default(true).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_sla_configurations_active").on(table.isActive),
]);

export const insertSlaConfigurationSchema = createInsertSchema(slaConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSlaConfiguration = z.infer<typeof insertSlaConfigurationSchema>;
export type SlaConfiguration = typeof slaConfigurations.$inferSelect;

// Daily Analytics Snapshots - Pre-computed metrics for dashboard
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  totalApplications: integer("total_applications").default(0),
  applicationsInPipeline: integer("applications_in_pipeline").default(0),
  applicationsProcessing: integer("applications_processing").default(0),
  applicationsUnderwriting: integer("applications_underwriting").default(0),
  applicationsApproved: integer("applications_approved").default(0),
  applicationsDenied: integer("applications_denied").default(0),
  applicationsWithdrawn: integer("applications_withdrawn").default(0),
  applicationsClosed: integer("applications_closed").default(0),
  applicationsFunded: integer("applications_funded").default(0),
  
  newApplicationsToday: integer("new_applications_today").default(0),
  closedVolumeToday: decimal("closed_volume_today", { precision: 14, scale: 2 }).default("0"),
  fundedVolumeToday: decimal("funded_volume_today", { precision: 14, scale: 2 }).default("0"),
  
  avgTotalCycleTime: decimal("avg_total_cycle_time", { precision: 10, scale: 2 }),
  avgProcessingTime: decimal("avg_processing_time", { precision: 10, scale: 2 }),
  avgUnderwritingTime: decimal("avg_underwriting_time", { precision: 10, scale: 2 }),
  
  slaComplianceRate: decimal("sla_compliance_rate", { precision: 5, scale: 2 }),
  loansAtRiskOfSlaBreach: integer("loans_at_risk_of_sla_breach").default(0),
  
  applicationToApprovalRate: decimal("application_to_approval_rate", { precision: 5, scale: 2 }),
  approvalToCloseRate: decimal("approval_to_close_rate", { precision: 5, scale: 2 }),
  pullThroughRate: decimal("pull_through_rate", { precision: 5, scale: 2 }),
  
  avgLoansPerLO: decimal("avg_loans_per_lo", { precision: 5, scale: 1 }),
  avgLoansPerProcessor: decimal("avg_loans_per_processor", { precision: 5, scale: 1 }),
  avgLoansPerUnderwriter: decimal("avg_loans_per_underwriter", { precision: 5, scale: 1 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analytics_snapshots_date").on(table.snapshotDate),
]);

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

// ============================================================================
// PRE-APPROVAL LETTER GENERATOR (Lender-Grade, Broker-Safe)
// ============================================================================

