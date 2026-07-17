// Team messages, loan milestones, Plaid link tokens, verifications.
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
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { loanApplications } from "./lendingCore";
import { users } from "./core";

export const teamMessages = pgTable("team_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  recipientId: varchar("recipient_id").references(() => users.id).notNull(),
  
  applicationId: varchar("application_id").references(() => loanApplications.id),
  
  message: text("message").notNull(),
  
  messageType: varchar("message_type", { length: 50 }).default("text"),
  documentRequestData: jsonb("document_request_data"),
  
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_team_messages_sender").on(table.senderId),
  index("idx_team_messages_recipient").on(table.recipientId),
  index("idx_team_messages_application").on(table.applicationId),
  index("idx_team_messages_created").on(table.createdAt),
]);

export const insertTeamMessageSchema = createInsertSchema(teamMessages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;
export type TeamMessage = typeof teamMessages.$inferSelect;

// ============================================================================
// LOAN PIPELINE TRACKING (Fast Closing Optimization)
// ============================================================================

export const LOAN_STAGES = [
  "draft",
  "submitted",
  "pre_approved",
  "doc_collection",
  "processing",
  "underwriting",
  "conditional",
  "clear_to_close",
  "closing",
  "funded",
  "denied",
] as const;

export type LoanStage = typeof LOAN_STAGES[number];

export const loanMilestones = pgTable("loan_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

  submittedAt: timestamp("submitted_at"),
  preApprovedAt: timestamp("pre_approved_at"),
  docCollectionStartedAt: timestamp("doc_collection_started_at"),
  processingStartedAt: timestamp("processing_started_at"),
  underwritingStartedAt: timestamp("underwriting_started_at"),
  conditionalApprovedAt: timestamp("conditional_approved_at"),
  clearToCloseAt: timestamp("clear_to_close_at"),
  closingScheduledAt: timestamp("closing_scheduled_at"),
  fundedAt: timestamp("funded_at"),
  deniedAt: timestamp("denied_at"),

  targetCloseDate: timestamp("target_close_date"),
  actualCloseDate: timestamp("actual_close_date"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export const insertLoanMilestoneSchema = createInsertSchema(loanMilestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanMilestone = z.infer<typeof insertLoanMilestoneSchema>;
export type LoanMilestone = typeof loanMilestones.$inferSelect;

// ============================================================================
// PLAID VERIFICATION SYSTEM
// ============================================================================

export const plaidLinkTokens = pgTable("plaid_link_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

  linkToken: text("link_token").notNull(),
  verificationType: varchar("verification_type", { length: 50 }).notNull(),

  status: varchar("status", { length: 50 }).default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPlaidLinkTokenSchema = createInsertSchema(plaidLinkTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPlaidLinkToken = z.infer<typeof insertPlaidLinkTokenSchema>;
export type PlaidLinkToken = typeof plaidLinkTokens.$inferSelect;

export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),

  verificationType: varchar("verification_type", { length: 50 }).notNull(),

  plaidItemId: varchar("plaid_item_id", { length: 255 }),
  // Encrypted at rest ("encv1:keyId:iv:ciphertext" envelope, piiVault.encryptToken).
  // Never returned in API responses; decrypt server-side only for Plaid calls.
  plaidAccessToken: text("plaid_access_token"),
  plaidVerificationId: varchar("plaid_verification_id", { length: 255 }),

  status: varchar("status", { length: 50 }).default("pending").notNull(),
  verificationMethod: varchar("verification_method", { length: 50 }),

  employerName: varchar("employer_name", { length: 255 }),
  employerAddress: text("employer_address"),
  jobTitle: varchar("job_title", { length: 255 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isCurrentEmployer: boolean("is_current_employer"),
  employmentStatus: varchar("employment_status", { length: 50 }),

  annualIncome: decimal("annual_income", { precision: 12, scale: 2 }),
  payFrequency: varchar("pay_frequency", { length: 50 }),
  lastPayDate: timestamp("last_pay_date"),
  lastPayAmount: decimal("last_pay_amount", { precision: 10, scale: 2 }),

  identityVerified: boolean("identity_verified").default(false),
  identityMatchScore: integer("identity_match_score"),
  addressVerified: boolean("address_verified").default(false),
  ssnVerified: boolean("ssn_verified").default(false),
  dateOfBirthVerified: boolean("date_of_birth_verified").default(false),

  rawResponse: jsonb("raw_response"),

  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),

  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_verifications_application").on(table.applicationId),
  index("idx_verifications_app_type").on(table.applicationId, table.verificationType),
]);

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verifications.$inferSelect;
