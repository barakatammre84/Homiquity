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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { loanApplications } from "./lending";
import { agentProfiles } from "./property";

// =============================================================================
// CREDIT & FCRA COMPLIANCE
// =============================================================================

// Credit Consents - FCRA-compliant consent capture before any credit action
export const creditConsents = pgTable("credit_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Consent Details
  consentType: varchar("consent_type", { length: 50 }).notNull(), // credit_pull, soft_pull, hard_pull, monitoring
  disclosureVersion: varchar("disclosure_version", { length: 50 }).notNull(), // e.g., "FCRA-2024-v1"
  disclosureText: text("disclosure_text").notNull(), // Full text of disclosure shown
  
  // Borrower Agreement
  consentGiven: boolean("consent_given").notNull(),
  consentTimestamp: timestamp("consent_timestamp").notNull(),
  
  // Identity Verification
  borrowerFullName: varchar("borrower_full_name", { length: 255 }).notNull(),
  borrowerSSNLast4: varchar("borrower_ssn_last4", { length: 4 }), // Last 4 digits for verification
  borrowerDOB: varchar("borrower_dob", { length: 10 }), // YYYY-MM-DD
  
  // Audit Trail
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  signatureType: varchar("signature_type", { length: 50 }).default("electronic"), // electronic, esignature
  
  // Status
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credit_consents_application").on(table.applicationId),
  index("idx_credit_consents_user").on(table.userId),
]);

export const insertCreditConsentSchema = createInsertSchema(creditConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditConsent = z.infer<typeof insertCreditConsentSchema>;
export type CreditConsent = typeof creditConsents.$inferSelect;

// Draft Consent Progress - For save & resume functionality
export const draftConsentProgress = pgTable("draft_consent_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Saved form data
  consentType: varchar("consent_type", { length: 50 }).default("hard_pull"),
  borrowerFullName: varchar("borrower_full_name", { length: 255 }),
  borrowerSSNLast4: varchar("borrower_ssn_last4", { length: 4 }),
  borrowerDOB: varchar("borrower_dob", { length: 10 }),
  
  // Progress tracking
  disclosureRead: boolean("disclosure_read").default(false),
  acknowledged: boolean("acknowledged").default(false),
  currentStep: integer("current_step").default(1),
  totalSteps: integer("total_steps").default(3),
  
  // State-specific tracking
  stateDisclosuresReviewed: text("state_disclosures_reviewed").array(),
  additionalAcknowledgments: jsonb("additional_acknowledgments"),
  
  // Timestamps
  lastSavedAt: timestamp("last_saved_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Drafts expire after 7 days
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_draft_consent_application").on(table.applicationId),
  index("idx_draft_consent_user").on(table.userId),
]);

export const insertDraftConsentProgressSchema = createInsertSchema(draftConsentProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDraftConsentProgress = z.infer<typeof insertDraftConsentProgressSchema>;
export type DraftConsentProgress = typeof draftConsentProgress.$inferSelect;

// Credit Pulls - Records of credit bureau inquiries
export const creditPulls = pgTable("credit_pulls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  consentId: varchar("consent_id").references(() => creditConsents.id).notNull(),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  
  // Pull Type
  pullType: varchar("pull_type", { length: 50 }).notNull(), // soft, hard, tri_merge
  bureaus: text("bureaus").array(), // ['experian', 'equifax', 'transunion']
  
  // Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, processing, completed, failed, expired
  
  // Credit Report Data (encrypted/tokenized in production)
  externalRequestId: varchar("external_request_id", { length: 255 }), // Credit bureau reference
  
  // Scores (when completed)
  experianScore: integer("experian_score"),
  equifaxScore: integer("equifax_score"),
  transunionScore: integer("transunion_score"),
  representativeScore: integer("representative_score"), // Middle score used for underwriting
  
  // Report Summary
  totalTradelines: integer("total_tradelines"),
  openTradelines: integer("open_tradelines"),
  totalDebt: decimal("total_debt", { precision: 12, scale: 2 }),
  monthlyPayments: decimal("monthly_payments", { precision: 10, scale: 2 }),
  derogatoryCount: integer("derogatory_count"),
  inquiryCount30Days: integer("inquiry_count_30_days"),
  inquiryCount90Days: integer("inquiry_count_90_days"),
  
  // Report Storage (reference to secure storage, not the report itself)
  reportStorageRef: varchar("report_storage_ref", { length: 500 }),
  
  // Encrypted Raw Response (AES-256-GCM encrypted)
  encryptedRawResponse: text("encrypted_raw_response"), // Base64 encoded encrypted data
  encryptionKeyId: varchar("encryption_key_id", { length: 100 }), // Reference to key used
  encryptionIV: varchar("encryption_iv", { length: 48 }), // Base64 encoded IV
  
  // Vendor Response Metadata (for reconciliation)
  vendorRequestId: varchar("vendor_request_id", { length: 255 }),
  vendorResponseHash: varchar("vendor_response_hash", { length: 64 }), // SHA-256 of raw response
  vendorBillingRef: varchar("vendor_billing_ref", { length: 255 }),
  
  // Error Handling
  errorCode: varchar("error_code", { length: 50 }),
  errorMessage: text("error_message"),
  
  // Timestamps
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // Credit reports typically valid for 120 days
  archivedAt: timestamp("archived_at"), // For FCRA retention compliance
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credit_pulls_application").on(table.applicationId),
  index("idx_credit_pulls_consent").on(table.consentId),
  index("idx_credit_pulls_status").on(table.status),
]);

export const insertCreditPullSchema = createInsertSchema(creditPulls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditPull = z.infer<typeof insertCreditPullSchema>;
export type CreditPull = typeof creditPulls.$inferSelect;

// Adverse Actions - FCRA-required notices when credit is used against applicant
export const adverseActions = pgTable("adverse_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  creditPullId: varchar("credit_pull_id").references(() => creditPulls.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Action Type
  actionType: varchar("action_type", { length: 50 }).notNull(), // denial, counteroffer, rate_adjustment, terms_change
  
  // Reasons (FCRA requires specific reasons)
  primaryReason: varchar("primary_reason", { length: 255 }).notNull(),
  secondaryReasons: text("secondary_reasons").array(),
  
  // Credit Information Used
  creditScoreUsed: integer("credit_score_used"),
  creditScoreSource: varchar("credit_score_source", { length: 50 }), // experian, equifax, transunion
  scoreRangeLow: integer("score_range_low"),
  scoreRangeHigh: integer("score_range_high"),
  
  // Required Disclosures
  bureauName: varchar("bureau_name", { length: 100 }),
  bureauAddress: text("bureau_address"),
  bureauPhone: varchar("bureau_phone", { length: 20 }),
  bureauWebsite: varchar("bureau_website", { length: 255 }),
  
  // Notice Details
  noticeText: text("notice_text").notNull(), // Full adverse action notice
  
  // Delivery
  deliveryMethod: varchar("delivery_method", { length: 50 }), // email, mail, both, in_app
  deliveredAt: timestamp("delivered_at"),
  deliveryConfirmation: varchar("delivery_confirmation", { length: 255 }),
  
  // FCRA Compliance
  noticeDate: timestamp("notice_date").notNull(), // Date notice was generated
  fcraCompliant: boolean("fcra_compliant").default(true),
  
  // Staff Actions
  generatedBy: varchar("generated_by").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_adverse_actions_application").on(table.applicationId),
  index("idx_adverse_actions_user").on(table.userId),
  index("idx_adverse_actions_credit_pull").on(table.creditPullId),
]);

export const insertAdverseActionSchema = createInsertSchema(adverseActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAdverseAction = z.infer<typeof insertAdverseActionSchema>;
export type AdverseAction = typeof adverseActions.$inferSelect;

// Credit Audit Log - Immutable record of every credit-related action
export const creditAuditLog = pgTable("credit_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // References
  applicationId: varchar("application_id").references(() => loanApplications.id),
  userId: varchar("user_id").references(() => users.id),
  consentId: varchar("consent_id").references(() => creditConsents.id),
  creditPullId: varchar("credit_pull_id").references(() => creditPulls.id),
  adverseActionId: varchar("adverse_action_id").references(() => adverseActions.id),
  
  // Action Details
  action: varchar("action", { length: 100 }).notNull(), // consent_given, consent_revoked, pull_requested, pull_completed, adverse_action_generated, etc.
  actionDetails: jsonb("action_details"), // Additional context
  
  // Actor
  performedBy: varchar("performed_by").references(() => users.id),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  
  // Audit Trail
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Cryptographic Integrity (append-only chain)
  entryHash: varchar("entry_hash", { length: 64 }).notNull(), // SHA-256 of this entry's content
  previousEntryHash: varchar("previous_entry_hash", { length: 64 }), // Hash of previous entry (chain)
  sequenceNumber: integer("sequence_number"), // Per-application sequence for ordering
  
  // Timestamp (immutable)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_audit_application").on(table.applicationId),
  index("idx_credit_audit_timestamp").on(table.timestamp),
  index("idx_credit_audit_action").on(table.action),
  index("idx_credit_audit_entry_hash").on(table.entryHash),
]);

export const insertCreditAuditLogSchema = createInsertSchema(creditAuditLog).omit({
  id: true,
});

export type InsertCreditAuditLog = z.infer<typeof insertCreditAuditLogSchema>;
export type CreditAuditLog = typeof creditAuditLog.$inferSelect;

// ===== ASPIRING OWNER JOURNEY =====

// Homeownership Goals - Main tracking for aspiring owner journey
export const homeownershipGoals = pgTable("homeownership_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Current Financial Status (entered by user or pulled from Plaid)
  currentCreditScore: integer("current_credit_score"),
  currentMonthlySavings: decimal("current_monthly_savings", { precision: 10, scale: 2 }),
  currentSavingsBalance: decimal("current_savings_balance", { precision: 12, scale: 2 }).default("0"),
  monthlyIncome: decimal("monthly_income", { precision: 10, scale: 2 }),
  monthlyDebts: decimal("monthly_debts", { precision: 10, scale: 2 }),
  currentRent: decimal("current_rent", { precision: 10, scale: 2 }),
  
  // Target Goals
  targetCreditScore: integer("target_credit_score").default(640),
  targetDownPayment: decimal("target_down_payment", { precision: 12, scale: 2 }),
  targetHomePrice: decimal("target_home_price", { precision: 12, scale: 2 }),
  targetMonthlyPayment: decimal("target_monthly_payment", { precision: 10, scale: 2 }),
  
  // Journey Status
  journeyStartDate: timestamp("journey_start_date").defaultNow(),
  currentPhase: varchar("current_phase", { length: 50 }).default("discovery"), // discovery, credit_cleanup, saving, ready
  journeyDay: integer("journey_day").default(1),
  
  // Progress Tracking
  creditScoreChange: integer("credit_score_change").default(0), // cumulative change since start
  savingsProgress: decimal("savings_progress", { precision: 12, scale: 2 }).default("0"), // total saved toward goal
  
  // Preferred location
  targetCity: varchar("target_city", { length: 100 }),
  targetState: varchar("target_state", { length: 50 }),
  targetZipCode: varchar("target_zip_code", { length: 20 }),
  
  // Linked agent (if referred)
  referringAgentId: varchar("referring_agent_id").references(() => agentProfiles.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_homeownership_goals_user").on(table.userId),
  index("idx_homeownership_goals_phase").on(table.currentPhase),
]);

export const insertHomeownershipGoalSchema = createInsertSchema(homeownershipGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHomeownershipGoal = z.infer<typeof insertHomeownershipGoalSchema>;
export type HomeownershipGoal = typeof homeownershipGoals.$inferSelect;

// Credit Actions - Track credit improvement actions
export const creditActions = pgTable("credit_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => homeownershipGoals.id).notNull(),
  
  // Action Details
  actionType: varchar("action_type", { length: 50 }).notNull(), // pay_down_card, dispute_error, authorized_user, secured_card, on_time_payment
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  // Impact
  estimatedPointsGain: integer("estimated_points_gain"),
  actualPointsGain: integer("actual_points_gain"),
  priority: varchar("priority", { length: 20 }).default("medium"), // high, medium, low
  
  // Status
  status: varchar("status", { length: 50 }).default("pending"), // pending, in_progress, completed, skipped
  completedAt: timestamp("completed_at"),
  
  // Related account info (if applicable)
  creditorName: varchar("creditor_name", { length: 255 }),
  accountBalance: decimal("account_balance", { precision: 10, scale: 2 }),
  recommendedPayment: decimal("recommended_payment", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_credit_actions_goal").on(table.goalId),
  index("idx_credit_actions_status").on(table.status),
]);

export const insertCreditActionSchema = createInsertSchema(creditActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCreditAction = z.infer<typeof insertCreditActionSchema>;
export type CreditAction = typeof creditActions.$inferSelect;

// Savings Transactions - Track savings deposits and round-ups
export const savingsTransactions = pgTable("savings_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => homeownershipGoals.id).notNull(),
  
  // Transaction Details
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // manual_deposit, round_up, recurring, bonus
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  
  // Running Total
  runningBalance: decimal("running_balance", { precision: 12, scale: 2 }).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_savings_transactions_goal").on(table.goalId),
]);

export const insertSavingsTransactionSchema = createInsertSchema(savingsTransactions).omit({
  id: true,
  createdAt: true,
});

export type InsertSavingsTransaction = z.infer<typeof insertSavingsTransactionSchema>;
export type SavingsTransaction = typeof savingsTransactions.$inferSelect;

// Journey Milestones - Track achieved milestones
export const journeyMilestones = pgTable("journey_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => homeownershipGoals.id).notNull(),
  
  // Milestone Details
  milestoneType: varchar("milestone_type", { length: 50 }).notNull(), 
  // Types: first_deposit, credit_score_up_10, credit_score_up_25, savings_500, savings_1000, 
  // savings_2500, savings_5000, day_7, day_14, day_30, target_credit_reached, target_savings_reached
  
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  celebrationMessage: text("celebration_message"),
  
  // Achievement
  achievedAt: timestamp("achieved_at").defaultNow(),
  pointsAwarded: integer("points_awarded").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_journey_milestones_goal").on(table.goalId),
  index("idx_journey_milestones_type").on(table.milestoneType),
]);

export const insertJourneyMilestoneSchema = createInsertSchema(journeyMilestones).omit({
  id: true,
  createdAt: true,
});

export type InsertJourneyMilestone = z.infer<typeof insertJourneyMilestoneSchema>;
export type JourneyMilestone = typeof journeyMilestones.$inferSelect;

// ===== ECONSENT SYSTEM =====

// Consent Types - Define available consent types
export const CONSENT_TYPES = [
  "credit_authorization",    // Authorize credit pull
  "econsent",               // Electronic signature consent  
  "privacy_policy",         // Privacy policy acknowledgment
  "terms_of_service",       // Terms acceptance
  "disclosure",             // General disclosures
  "appraisal_waiver",       // Waive right to appraisal copy timing
  "title_acknowledgment",   // Title company selection acknowledgment
  "rate_lock_agreement",    // Rate lock terms
  "intent_to_proceed",      // TRID intent to proceed
  "loan_estimate_receipt",  // Acknowledge loan estimate receipt
] as const;

export type ConsentType = typeof CONSENT_TYPES[number];

// Consent Templates - Define consent content per type/state
export const consentTemplates = pgTable("consent_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Type and Version
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  version: varchar("version", { length: 20 }).notNull(), // e.g., "1.0.0"
  
  // State-specific (null = federal/all states)
  state: varchar("state", { length: 2 }),
  
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  shortDescription: text("short_description"),
  fullText: text("full_text").notNull(), // Full legal text
  
  // Regulatory
  regulatoryReference: varchar("regulatory_reference", { length: 255 }), // e.g., "TRID Section 4", "FCRA 604"
  requiredForLoanTypes: text("required_for_loan_types").array(), // ['conventional', 'fha', 'va']
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  expirationDate: timestamp("expiration_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_consent_templates_type").on(table.consentType),
  index("idx_consent_templates_state").on(table.state),
  index("idx_consent_templates_active").on(table.isActive),
]);

export const insertConsentTemplateSchema = createInsertSchema(consentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConsentTemplate = z.infer<typeof insertConsentTemplateSchema>;
export type ConsentTemplate = typeof consentTemplates.$inferSelect;

// Borrower Consents - Audit trail of all consents given
export const borrowerConsents = pgTable("borrower_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Links
  userId: varchar("user_id").references(() => users.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id),
  templateId: varchar("template_id").references(() => consentTemplates.id),
  
  // Consent Details
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  templateVersion: varchar("template_version", { length: 20 }),
  
  // Consent Capture
  consentGiven: boolean("consent_given").notNull(),
  consentMethod: varchar("consent_method", { length: 50 }).notNull(), // 'click', 'signature', 'verbal', 'paper'
  
  // Digital Signature (if applicable)
  signatureData: text("signature_data"), // Base64 signature image or typed name
  signatureType: varchar("signature_type", { length: 20 }), // 'drawn', 'typed', 'none'
  
  // Audit Trail - Immutable
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  browserFingerprint: varchar("browser_fingerprint", { length: 64 }),
  
  // Timing
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
  
  // Revocation (if applicable)
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  
  // Hash for tamper evidence
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 of consent content at time of signing
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_borrower_consents_user").on(table.userId),
  index("idx_borrower_consents_application").on(table.applicationId),
  index("idx_borrower_consents_type").on(table.consentType),
]);

export const insertBorrowerConsentSchema = createInsertSchema(borrowerConsents).omit({
  id: true,
  createdAt: true,
});

export type InsertBorrowerConsent = z.infer<typeof insertBorrowerConsentSchema>;
export type BorrowerConsent = typeof borrowerConsents.$inferSelect;

// ===== HMDA DEMOGRAPHICS =====

export const hmdaDemographics = pgTable("hmda_demographics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),

  ethnicityHispanicLatino: boolean("ethnicity_hispanic_latino"),
  ethnicityMexican: boolean("ethnicity_mexican").default(false),
  ethnicityCuban: boolean("ethnicity_cuban").default(false),
  ethnicityPuertoRican: boolean("ethnicity_puerto_rican").default(false),
  ethnicityOtherHispanicLatino: boolean("ethnicity_other_hispanic_latino").default(false),
  ethnicityOtherText: varchar("ethnicity_other_text", { length: 255 }),
  ethnicityNotHispanicLatino: boolean("ethnicity_not_hispanic_latino"),
  ethnicityNotProvided: boolean("ethnicity_not_provided").default(false),

  raceAmericanIndian: boolean("race_american_indian").default(false),
  raceAmericanIndianTribe: varchar("race_american_indian_tribe", { length: 255 }),
  raceAsian: boolean("race_asian").default(false),
  raceAsianIndian: boolean("race_asian_indian").default(false),
  raceChinese: boolean("race_chinese").default(false),
  raceFilipino: boolean("race_filipino").default(false),
  raceJapanese: boolean("race_japanese").default(false),
  raceKorean: boolean("race_korean").default(false),
  raceVietnamese: boolean("race_vietnamese").default(false),
  raceOtherAsian: boolean("race_other_asian").default(false),
  raceOtherAsianText: varchar("race_other_asian_text", { length: 255 }),
  raceBlack: boolean("race_black").default(false),
  raceNativeHawaiian: boolean("race_native_hawaiian").default(false),
  raceGuamanian: boolean("race_guamanian").default(false),
  raceSamoan: boolean("race_samoan").default(false),
  raceOtherPacificIslander: boolean("race_other_pacific_islander").default(false),
  raceOtherPacificIslanderText: varchar("race_other_pacific_islander_text", { length: 255 }),
  raceWhite: boolean("race_white").default(false),
  raceNotProvided: boolean("race_not_provided").default(false),

  sexFemale: boolean("sex_female"),
  sexMale: boolean("sex_male"),
  sexNotProvided: boolean("sex_not_provided").default(false),

  age: integer("age"),
  ageNotProvided: boolean("age_not_provided").default(false),

  collectionMethod: varchar("collection_method", { length: 30 }).notNull().default("borrower"),
  observedByVisual: boolean("observed_by_visual").default(false),
  observedBySurname: boolean("observed_by_surname").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_hmda_application").on(table.applicationId),
  index("idx_hmda_borrower").on(table.borrowerId),
]);

export const insertHmdaDemographicsSchema = createInsertSchema(hmdaDemographics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHmdaDemographics = z.infer<typeof insertHmdaDemographicsSchema>;
export type HmdaDemographics = typeof hmdaDemographics.$inferSelect;
