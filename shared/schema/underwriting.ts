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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { loanApplications, loanOptions, documents } from "./lending";

// ============================================================================
// TASK ENGINE - Event-driven task management with SLA enforcement
// ============================================================================

// SLA Classes (S0-S5) - defines urgency and escalation timing
export const SLA_CLASSES = [
  "S0", // Immediate: 0-1 hour, escalation at 15 min
  "S1", // Critical: 4 hours, escalation at 2 hours
  "S2", // High: 12 hours, escalation at 8 hours
  "S3", // Standard: 48 hours, escalation at 36 hours
  "S4", // Low: 72 hours, escalation at 60 hours
  "S5", // Informational: No SLA
] as const;

export type SlaClass = typeof SLA_CLASSES[number];

// Trigger sources - what created the task
export const TASK_TRIGGER_SOURCES = [
  "OCR",           // Document Intelligence triggered
  "POLICY",        // Policy rule triggered
  "LENDER",        // Lender interaction triggered
  "SYSTEM",        // System/workflow triggered
  "MANUAL",        // Staff manually created
  "COC",           // Change-of-Circumstance triggered
] as const;

export type TaskTriggerSource = typeof TASK_TRIGGER_SOURCES[number];

// Owner roles - who is responsible for the task
export const TASK_OWNER_ROLES = [
  "LO",           // Loan Officer
  "LOA",          // Loan Officer Assistant
  "PROCESSOR",    // Processor
  "UW",           // Underwriter
  "CLOSER",       // Closer
  "ADMIN",        // Admin
  "BORROWER",     // Borrower-facing task
  "SYSTEM",       // System auto-resolved
] as const;

export type TaskOwnerRole = typeof TASK_OWNER_ROLES[number];

// Task type codes for SLA mapping
export const TASK_TYPE_CODES = [
  // Intake & Identity
  "INTAKE_CONSENT_CREDIT", "INTAKE_KYC_REVIEW", "INTAKE_ID_VERIFY", "INTAKE_SSN_VERIFY",
  "INTAKE_NAME_MISMATCH", "INTAKE_RESIDENCY_VERIFY", "INTAKE_INITIAL_DISCLOSURES",
  // Document Collection
  "DOC_PAYSTUB_REQUEST", "DOC_BANK_STATEMENT_REQUEST", "DOC_BANK_MISSING_PAGE",
  "DOC_TAX_RETURN_REQUEST", "DOC_PURCHASE_CONTRACT", "DOC_INSURANCE_BINDER", "DOC_GIFT_LETTER",
  // OCR & Data Integrity
  "OCR_EXTRACTION_REVIEW", "OCR_MISSING_FIELDS", "OCR_DOC_MISCLASSIFIED",
  "OCR_NAME_MISMATCH", "OCR_DOC_TAMPER_FLAG",
  // Income & Employment
  "INC_W2_VERIFY", "INC_SELFEMP_PNL", "INC_SCHED_C", "INC_SCHED_E", "INC_ADD_BACK_REVIEW",
  "INC_DECLINING", "INC_EMP_GAP", "INC_INCOME_LOCK",
  // Assets
  "AST_BANK_ANALYSIS", "AST_LARGE_DEPOSIT", "AST_OVERDRAFT", "AST_RETIREMENT_ACCESS",
  "AST_EARNEST_MONEY", "AST_ASSET_LOCK",
  // Credit
  "CRD_CREDIT_PULL", "CRD_SCORE_REVIEW", "CRD_NEW_TRADELINE", "CRD_INQUIRY_LOE", "CRD_CREDIT_LOCK",
  // Eligibility
  "ELIG_DTI_CALC", "ELIG_DSCR_CALC", "ELIG_AUS_PRECHECK", "ELIG_EXCEPTION_REVIEW",
  // Pre-Approval
  "PA_APPROVAL_REVIEW", "PA_LETTER_GEN", "PA_EXPIRATION_SET", "PA_FREEZE_FILE", "PA_RELOCK",
  // Lender
  "LND_DEAL_PACKAGE", "LND_CONDITION_CLEAR", "LND_PRICING_EXP", "LND_ACCEPT",
  // Compliance
  "CMP_ADVERSE_ACTION", "CMP_POLICY_EXCEPTION", "CMP_AUDIT_REVIEW", "CMP_DATA_RETENTION", "CMP_INCIDENT_REVIEW",
  // General
  "DOCUMENT_REQUEST", "VERIFICATION", "REVIEW", "FOLLOW_UP", "ESCALATION",
] as const;

export type TaskTypeCode = typeof TASK_TYPE_CODES[number];

// Escalation levels
export const ESCALATION_LEVELS = [0, 1, 2, 3, 4] as const;
export type EscalationLevel = typeof ESCALATION_LEVELS[number];

// Tasks for document requests and workflow items
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  
  // Task Details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: varchar("task_type", { length: 50 }).notNull(), // document_request, verification, review, action
  taskTypeCode: varchar("task_type_code", { length: 50 }), // Specific task code for SLA mapping
  
  // Task Engine Fields
  triggerSource: varchar("trigger_source", { length: 20 }).default("MANUAL"), // OCR, POLICY, LENDER, SYSTEM, MANUAL, COC
  ownerRole: varchar("owner_role", { length: 20 }).default("PROCESSOR"), // Role responsible
  slaClass: varchar("sla_class", { length: 5 }).default("S3"), // S0-S5
  slaDueAt: timestamp("sla_due_at"), // Computed deadline based on SLA class
  escalationLevel: integer("escalation_level").default(0), // 0-4
  escalatedAt: timestamp("escalated_at"), // When last escalated
  
  // Document Request Specific
  documentCategory: varchar("document_category", { length: 50 }), // tax_return, pay_stub, bank_statement, w2, id, other
  documentYear: varchar("document_year", { length: 10 }), // e.g., "2024", "2023"
  documentInstructions: text("document_instructions"),
  
  // Requesting Team - who is requesting this document
  requestingTeam: varchar("requesting_team", { length: 50 }), // processing, underwriting, title, closing
  isCustomRequest: boolean("is_custom_request").default(false), // true for custom/unique document requests
  
  // Status
  status: varchar("status", { length: 50 }).default("OPEN").notNull(), // OPEN, IN_PROGRESS, BLOCKED, COMPLETED, EXPIRED
  priority: varchar("priority", { length: 20 }).default("NORMAL"), // LOW, NORMAL, HIGH, CRITICAL
  
  // Due Date
  dueDate: timestamp("due_date"),
  
  // Verification (for document tasks)
  verificationStatus: varchar("verification_status", { length: 50 }), // pending, verified, rejected, needs_review
  verificationNotes: text("verification_notes"),
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // Resolution
  resolutionNotes: text("resolution_notes"),
  resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id),
  completedAt: timestamp("completed_at"),
  
  // Auto-resolution tracking
  autoResolved: boolean("auto_resolved").default(false),
  autoResolveCondition: varchar("auto_resolve_condition", { length: 100 }), // What condition triggered auto-resolution
  
  // Blocking behavior
  blocksLoanProgress: boolean("blocks_loan_progress").default(false), // If true, loan cannot advance until resolved
  
  // AI Analysis Results
  aiAnalysisResult: jsonb("ai_analysis_result"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  
  // Extracted Data (for income verification, etc.)
  extractedData: jsonb("extracted_data"),
  
  // Trigger metadata (what event created this task)
  triggerMetadata: jsonb("trigger_metadata"), // Details about what triggered the task
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tasks_application").on(table.applicationId),
  index("idx_tasks_assigned_user").on(table.assignedToUserId),
  index("idx_tasks_status").on(table.status),
  index("idx_tasks_created").on(table.createdAt),
  index("idx_tasks_sla_due").on(table.slaDueAt),
  index("idx_tasks_app_status").on(table.applicationId, table.status),
]);

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Task Documents - links uploaded documents to specific tasks
export const taskDocuments = pgTable("task_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  
  // Document specific verification for this task
  isVerified: boolean("is_verified").default(false),
  verificationNotes: text("verification_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskDocumentSchema = createInsertSchema(taskDocuments).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskDocument = z.infer<typeof insertTaskDocumentSchema>;
export type TaskDocument = typeof taskDocuments.$inferSelect;

// Task Events - records what triggered task creation (event outbox)
export const taskEvents = pgTable("task_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event Details
  eventType: varchar("event_type", { length: 100 }).notNull(), // e.g., DOC_UPLOAD, CREDIT_CHANGE, WORKFLOW_TRANSITION
  eventSource: varchar("event_source", { length: 50 }).notNull(), // OCR, POLICY, LENDER, SYSTEM, COC
  
  // Context
  applicationId: varchar("application_id").references(() => loanApplications.id),
  documentId: varchar("document_id").references(() => documents.id),
  
  // Event payload
  eventPayload: jsonb("event_payload").notNull(), // Full event details
  
  // Processing
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  resultingTaskId: varchar("resulting_task_id").references(() => tasks.id),
  
  // Idempotency
  idempotencyKey: varchar("idempotency_key", { length: 255 }).unique(), // Prevents duplicate task creation
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskEventSchema = createInsertSchema(taskEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskEvent = z.infer<typeof insertTaskEventSchema>;
export type TaskEvent = typeof taskEvents.$inferSelect;

// Task Audit Log - immutable compliance audit trail
export const taskAuditLog = pgTable("task_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").references(() => tasks.id).notNull(),
  
  // Action Details
  action: varchar("action", { length: 50 }).notNull(), // created, assigned, status_change, escalated, completed, auto_resolved
  previousValue: jsonb("previous_value"), // Previous state
  newValue: jsonb("new_value"), // New state
  
  // Actor
  actorUserId: varchar("actor_user_id").references(() => users.id),
  actorRole: varchar("actor_role", { length: 50 }),
  actorType: varchar("actor_type", { length: 20 }).default("user"), // user, system, auto
  
  // Reason/Notes
  reason: text("reason"),
  
  // Compliance metadata
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskAuditLogSchema = createInsertSchema(taskAuditLog).omit({
  id: true,
  createdAt: true,
});

export type InsertTaskAuditLog = z.infer<typeof insertTaskAuditLogSchema>;
export type TaskAuditLog = typeof taskAuditLog.$inferSelect;

// SLA Class Configurations - defines timing for each SLA class
export const slaClassConfigs = pgTable("sla_class_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // SLA Class (S0-S5)
  slaClass: varchar("sla_class", { length: 5 }).notNull().unique(), // S0, S1, S2, S3, S4, S5
  name: varchar("name", { length: 50 }).notNull(), // Immediate, Critical, High, Standard, Low, Informational
  description: text("description"),
  
  // Timing (in minutes)
  targetResolutionMinutes: integer("target_resolution_minutes"), // null for S5
  escalationStartMinutes: integer("escalation_start_minutes"), // When escalation begins
  hardBreachMinutes: integer("hard_breach_minutes"), // When hard breach occurs
  
  // Behavior
  blocksLoanProgress: boolean("blocks_loan_progress").default(false), // S0-S3 typically block
  
  // Display
  displayOrder: integer("display_order").default(0),
  colorCode: varchar("color_code", { length: 20 }).default("gray"), // For UI display
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSlaClassConfigSchema = createInsertSchema(slaClassConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSlaClassConfig = z.infer<typeof insertSlaClassConfigSchema>;
export type SlaClassConfig = typeof slaClassConfigs.$inferSelect;

// Task Type SLA Mappings - maps task types to SLA classes with auto-actions
export const taskTypeSlaMapping = pgTable("task_type_sla_mapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Task type code
  taskTypeCode: varchar("task_type_code", { length: 50 }).notNull().unique(),
  taskTypeName: varchar("task_type_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }), // intake, document, ocr, income, assets, credit, eligibility, pre_approval, lender, compliance
  
  // SLA Assignment
  slaClass: varchar("sla_class", { length: 5 }).notNull(), // S0-S5
  
  // Default ownership
  defaultOwnerRole: varchar("default_owner_role", { length: 20 }).notNull(),
  
  // Auto-actions on breach
  autoActionOnBreach: jsonb("auto_action_on_breach"), // What happens when SLA is breached
  
  // Auto-resolution conditions
  autoResolveConditions: jsonb("auto_resolve_conditions"), // Conditions that auto-complete the task
  
  // Borrower visibility
  visibleToBorrower: boolean("visible_to_borrower").default(false),
  borrowerDisplayText: text("borrower_display_text"), // Simplified text for borrower
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskTypeSlaMapping = createInsertSchema(taskTypeSlaMapping).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTaskTypeSlaMapping = z.infer<typeof insertTaskTypeSlaMapping>;
export type TaskTypeSlaMapping = typeof taskTypeSlaMapping.$inferSelect;

// Escalation Actions - configurable actions at each escalation level
export const escalationActions = pgTable("escalation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Scope (can be global or task-type specific)
  taskTypeCode: varchar("task_type_code", { length: 50 }), // null = global default
  
  // Escalation level (0-4)
  escalationLevel: integer("escalation_level").notNull(),
  
  // Actions
  actionType: varchar("action_type", { length: 50 }).notNull(), // notify, reassign, freeze, alert
  actionConfig: jsonb("action_config").notNull(), // Configuration for the action
  
  // Description
  description: text("description"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEscalationActionSchema = createInsertSchema(escalationActions).omit({
  id: true,
  createdAt: true,
});

export type InsertEscalationAction = z.infer<typeof insertEscalationActionSchema>;
export type EscalationAction = typeof escalationActions.$inferSelect;

// ============================================================================
// MISMO-CANONICAL DATA MODEL (Everything feeds this)
// ============================================================================
// If it doesn't map → it doesn't exist.

// H. Income Stream (Normalized from multiple document types)
export const INCOME_TYPES = [
  "w2",
  "self_employed",
  "rental",
  "bonus",
  "commission",
  "overtime",
  "social_security",
  "pension",
  "disability",
  "alimony",
  "child_support",
  "investment",
  "other",
] as const;

export type IncomeType = typeof INCOME_TYPES[number];

export const incomeStreams = pgTable("income_streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Income type and source
  incomeType: varchar("income_type", { length: 50 }).notNull(), // From INCOME_TYPES
  employerName: varchar("employer_name", { length: 255 }),
  
  // Amounts
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  annualAmount: decimal("annual_amount", { precision: 14, scale: 2 }),
  
  // Stability assessment
  stability: varchar("stability", { length: 50 }).notNull(), // stable, variable, declining, increasing
  yearsAtEmployer: decimal("years_at_employer", { precision: 4, scale: 1 }),
  
  // === TREND & VOLATILITY ANALYZER (Enhancement #1) ===
  trendSlope: decimal("trend_slope", { precision: 8, scale: 4 }), // YoY % change
  volatilityScore: decimal("volatility_score", { precision: 5, scale: 2 }), // Std dev of monthly income
  trendDirection: varchar("trend_direction", { length: 20 }), // increasing, stable, declining
  trendAnalysisInputs: jsonb("trend_analysis_inputs"), // Raw monthly values used for trend calc
  
  // === RELIABILITY & SEASONING (Enhancement #2 & #3) ===
  reliabilityScore: decimal("reliability_score", { precision: 5, scale: 2 }), // 0-100 score
  seasoningMonths: integer("seasoning_months"), // How long this income has existed
  seasoningStatus: varchar("seasoning_status", { length: 30 }), // qualified, insufficient, pending
  
  // === QUALIFICATION STATUS ===
  qualificationStatus: varchar("qualification_status", { length: 30 }), // included, excluded, capped, prorated
  qualificationReason: text("qualification_reason"), // Why it was included/excluded
  qualifiedAmount: decimal("qualified_amount", { precision: 12, scale: 2 }), // Amount after applying rules
  
  // Source documents that support this income
  sourceDocumentIds: text("source_document_ids").array(),
  
  // Calculation details
  calculationMethod: text("calculation_method"), // How the monthly amount was derived
  calculationInputs: jsonb("calculation_inputs"), // Raw values used in calculation
  
  // MISMO Mapping (Required)
  mismoPath: varchar("mismo_path", { length: 500 }).notNull(), // e.g., "MISMO.Income.EmploymentIncome"
  
  // Verification
  verificationSource: varchar("verification_source", { length: 50 }), // ocr, plaid, voe, manual
  verificationDate: timestamp("verification_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_income_borrower").on(table.borrowerId),
  index("idx_income_loan").on(table.loanId),
  index("idx_income_type").on(table.incomeType),
  index("idx_income_qualification").on(table.qualificationStatus),
]);

// I. Assets (Normalized)
export const ASSET_TYPES = [
  "checking",
  "savings",
  "money_market",
  "cd",
  "retirement_401k",
  "retirement_ira",
  "brokerage",
  "mutual_fund",
  "stock",
  "bond",
  "gift",
  "trust",
  "real_estate_equity",
  "business_asset",
  "other",
] as const;

export type AssetType = typeof ASSET_TYPES[number];

export const canonicalAssets = pgTable("canonical_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Asset type and institution
  assetType: varchar("asset_type", { length: 50 }).notNull(), // From ASSET_TYPES
  institutionName: varchar("institution_name", { length: 255 }),
  accountNumberMasked: varchar("account_number_masked", { length: 50 }),
  
  // Values
  cashValue: decimal("cash_value", { precision: 14, scale: 2 }).notNull(),
  marketValue: decimal("market_value", { precision: 14, scale: 2 }),
  
  // For retirement accounts
  vestedAmount: decimal("vested_amount", { precision: 14, scale: 2 }),
  
  // For gifts
  giftDonorName: varchar("gift_donor_name", { length: 255 }),
  giftDonorRelationship: varchar("gift_donor_relationship", { length: 100 }),
  
  // Source documents
  sourceDocumentIds: text("source_document_ids").array(),
  
  // MISMO Mapping (Required)
  mismoPath: varchar("mismo_path", { length: 500 }).notNull(), // e.g., "MISMO.Asset.LiquidAsset"
  
  // Verification
  verificationSource: varchar("verification_source", { length: 50 }).notNull(), // ocr, plaid, manual
  verifiedAt: timestamp("verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_assets_borrower").on(table.borrowerId),
  index("idx_assets_loan").on(table.loanId),
  index("idx_assets_type").on(table.assetType),
]);

// J. Liabilities (Normalized)
export const LIABILITY_TYPES = [
  "first_mortgage",
  "second_mortgage",
  "heloc",
  "auto_loan",
  "student_loan",
  "credit_card",
  "personal_loan",
  "installment_loan",
  "child_support",
  "alimony",
  "other",
] as const;

export type LiabilityType = typeof LIABILITY_TYPES[number];

export const canonicalLiabilities = pgTable("canonical_liabilities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Liability type and creditor
  liabilityType: varchar("liability_type", { length: 50 }).notNull(), // From LIABILITY_TYPES
  creditorName: varchar("creditor_name", { length: 255 }),
  accountNumberMasked: varchar("account_number_masked", { length: 50 }),
  
  // Amounts
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 14, scale: 2 }),
  creditLimit: decimal("credit_limit", { precision: 14, scale: 2 }),
  
  // For determining if paid by closing
  willBePaidOff: boolean("will_be_paid_off").default(false),
  monthsRemaining: integer("months_remaining"),
  
  // Source (credit report or document)
  sourceType: varchar("source_type", { length: 50 }).notNull(), // credit_report, document, manual
  sourceDocumentIds: text("source_document_ids").array(),
  
  // MISMO Mapping (Required)
  mismoPath: varchar("mismo_path", { length: 500 }).notNull(), // e.g., "MISMO.Liability.MonthlyPaymentAmount"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_liabilities_borrower").on(table.borrowerId),
  index("idx_liabilities_loan").on(table.loanId),
  index("idx_liabilities_type").on(table.liabilityType),
]);

// ============================================================================
// UNDERWRITING EVENT ENGINE (This is the secret sauce)
// ============================================================================
// This replaces humans asking "what's next?"
// Event-based architecture for automatic workflow triggering

// K. Underwriting Event Definitions (Rules)
export const UNDERWRITING_TRIGGER_TYPES = [
  "document_detected",
  "field_extracted",
  "threshold_exceeded",
  "document_complete",
  "income_calculated",
  "dti_changed",
  "anomaly_detected",
  "manual_trigger",
] as const;

export const UNDERWRITING_ACTION_TYPES = [
  "request_document",
  "enable_income_logic",
  "recalculate_dti",
  "flag_for_review",
  "create_condition",
  "send_notification",
  "update_status",
] as const;

export const underwritingEventRules = pgTable("underwriting_event_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identification
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  ruleDescription: text("rule_description"),
  
  // Trigger condition
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // From UNDERWRITING_TRIGGER_TYPES
  triggerCondition: jsonb("trigger_condition").notNull(), // Expression to evaluate
  // Example: { documentType: "schedule_e" } or { fieldName: "largeDeposit", operator: ">", value: 5000 }
  
  // Actions to take when triggered
  actions: jsonb("actions").notNull(), // Array of {type, params}
  // Example: [{ type: "request_document", params: { documentType: "lease_agreement" }}]
  
  // Priority and ordering
  priority: integer("priority").default(0).notNull(),
  
  // Rule applicability
  applicableLoanTypes: text("applicable_loan_types").array(), // conventional, fha, va, etc. or null for all
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_uw_rules_trigger").on(table.triggerType),
  index("idx_uw_rules_active").on(table.isActive),
]);

// L. Underwriting Event Log (What happened)
export const underwritingEventLog = pgTable("underwriting_event_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // What rule triggered this
  ruleId: varchar("rule_id").references(() => underwritingEventRules.id),
  
  // Event details
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerData: jsonb("trigger_data"), // The data that triggered the event
  
  // Actions taken
  actionsTaken: jsonb("actions_taken").notNull(), // What was done
  
  // Result
  status: varchar("status", { length: 50 }).notNull(), // success, partial, failed
  errorMessage: text("error_message"),
  
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
}, (table) => [
  index("idx_uw_events_loan").on(table.loanId),
  index("idx_uw_events_rule").on(table.ruleId),
  index("idx_uw_events_trigger").on(table.triggerType),
]);

// ============================================================================
// DTI / DSCR CALCULATION SCHEMAS
// ============================================================================
// DTI = function(data), not function(docs)
// This allows recalculation when docs change, what-if scenarios, clean AUS submissions

// M. Underwriting Snapshot (Point-in-time calculation inputs)
export const underwritingSnapshots = pgTable("underwriting_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  // Snapshot type
  snapshotType: varchar("snapshot_type", { length: 50 }).notNull(), // initial, update, final, what_if
  
  // Aggregated income (from incomeStreams)
  totalMonthlyIncome: decimal("total_monthly_income", { precision: 12, scale: 2 }).notNull(),
  incomeBreakdown: jsonb("income_breakdown"), // {w2: x, selfEmployed: y, rental: z}
  
  // Aggregated liabilities (from canonicalLiabilities)
  totalMonthlyLiabilities: decimal("total_monthly_liabilities", { precision: 12, scale: 2 }).notNull(),
  liabilityBreakdown: jsonb("liability_breakdown"),
  
  // Housing expense
  proposedHousingExpense: decimal("proposed_housing_expense", { precision: 10, scale: 2 }).notNull(), // PITI
  
  // Aggregated assets (for reserves calculation)
  totalLiquidAssets: decimal("total_liquid_assets", { precision: 14, scale: 2 }),
  totalRetirementAssets: decimal("total_retirement_assets", { precision: 14, scale: 2 }),
  
  // Source document IDs (for audit trail)
  sourceDocumentIds: text("source_document_ids").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_uw_snapshots_loan").on(table.loanId),
  index("idx_uw_snapshots_borrower").on(table.borrowerId),
  index("idx_uw_snapshots_type").on(table.snapshotType),
]);

// N. Underwriting Result (Calculated outputs)
// Explanation is REQUIRED for regulators & lenders
export const underwritingResults = pgTable("underwriting_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // DTI Calculations
  frontEndDti: decimal("front_end_dti", { precision: 5, scale: 2 }).notNull(), // Housing / Income
  backEndDti: decimal("back_end_dti", { precision: 5, scale: 2 }).notNull(), // (Housing + Debts) / Income
  
  // DSCR (for rental/investment properties)
  dscr: decimal("dscr", { precision: 5, scale: 3 }), // Rental Income / PITIA
  
  // LTV
  ltv: decimal("ltv", { precision: 5, scale: 2 }),
  cltv: decimal("cltv", { precision: 5, scale: 2 }),
  
  // Reserves
  monthsOfReserves: decimal("months_of_reserves", { precision: 4, scale: 1 }),
  reservesRequired: decimal("reserves_required", { precision: 4, scale: 1 }),
  
  // Overall eligibility
  eligibilityStatus: varchar("eligibility_status", { length: 50 }).notNull(), // eligible, ineligible, manual_review
  
  // Confidence (How reliable is this calculation?)
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(), // Based on source field confidences
  
  // Explanation (REQUIRED - not optional)
  explanation: jsonb("explanation").notNull(), // Array of {category, message, impact}
  // Example: [{ category: "income", message: "Self-employed income requires 24-month history", impact: "warning" }]
  
  // Findings that need attention
  findings: jsonb("findings"), // Array of {type, severity, description, recommendation}
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_uw_results_snapshot").on(table.snapshotId),
  index("idx_uw_results_loan").on(table.loanId),
  index("idx_uw_results_eligibility").on(table.eligibilityStatus),
]);

// ============================================================================
// FRAUD & ANOMALY ENGINE (Passive at first)
// ============================================================================
// Build the hooks now even if rules come later

// O. Anomaly Detection
export const ANOMALY_CATEGORIES = [
  "identity",           // Name mismatch, SSN issues
  "income",             // Income inconsistencies
  "document_integrity", // Edited PDFs, font mismatches
  "asset_mismatch",     // Balance discrepancies
  "employment",         // Employer name changes
  "transaction",        // Unusual cash flows
  "address",            // Address inconsistencies
  "timing",             // Suspicious document dates
] as const;

export const ANOMALY_SEVERITY = ["low", "medium", "high", "critical"] as const;

export const anomalies = pgTable("anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // Anomaly classification
  category: varchar("category", { length: 50 }).notNull(), // From ANOMALY_CATEGORIES
  severity: varchar("severity", { length: 20 }).notNull(), // From ANOMALY_SEVERITY
  
  // Description
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  
  // Evidence
  sourceDocumentIds: text("source_document_ids").array(),
  evidenceDetails: jsonb("evidence_details"), // Specific data points that triggered anomaly
  
  // Detection method
  detectionMethod: varchar("detection_method", { length: 100 }).notNull(), // rule_based, ml_model, cross_validation
  detectionRuleId: varchar("detection_rule_id", { length: 100 }),
  
  // Resolution
  status: varchar("status", { length: 50 }).default("open").notNull(), // open, investigating, resolved, false_positive
  resolution: text("resolution"),
  resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
}, (table) => [
  index("idx_anomalies_loan").on(table.loanId),
  index("idx_anomalies_category").on(table.category),
  index("idx_anomalies_severity").on(table.severity),
  index("idx_anomalies_status").on(table.status),
]);

// ============================================================================
// AUDIT & COMPLIANCE LAYER (From Day 1)
// ============================================================================
// Required for: FCRA, SOC 2, State regulators, Lender onboarding
// Immutable storage required

// P. Audit Event Log
export const AUDIT_ACTOR_ROLES = [
  "borrower",
  "loan_officer",
  "processor",
  "underwriter",
  "admin",
  "system",       // Automated actions
  "integration",  // Third-party integrations
] as const;

export const AUDIT_EVENT_CATEGORIES = [
  "document",      // Document upload, view, delete
  "data_access",   // PII access
  "decision",      // Underwriting decisions
  "consent",       // Credit consent, disclosures
  "export",        // Data export, GSE submission
  "authentication",// Login, logout, session
  "modification",  // Data changes
] as const;

export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor identification
  actorId: varchar("actor_id").references(() => users.id), // null for system actions
  actorRole: varchar("actor_role", { length: 50 }).notNull(), // From AUDIT_ACTOR_ROLES
  actorEmail: varchar("actor_email", { length: 255 }),
  
  // What happened
  eventCategory: varchar("event_category", { length: 50 }).notNull(), // From AUDIT_EVENT_CATEGORIES
  action: varchar("action", { length: 255 }).notNull(), // e.g., "document.upload", "credit.pull", "application.submit"
  
  // Entity affected
  entityType: varchar("entity_type", { length: 100 }).notNull(), // loan_application, document, user, etc.
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  
  // Context
  loanId: varchar("loan_id").references(() => loanApplications.id), // null for non-loan events
  
  // Details (careful not to log PII)
  details: jsonb("details"), // Additional context (no PII!)
  
  // Request context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  
  // Timestamp (critical for audit)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  
  // Immutability marker (for compliance)
  eventHash: varchar("event_hash", { length: 128 }), // SHA-256 of event content
  previousEventHash: varchar("previous_event_hash", { length: 128 }), // Chain hash for tamper detection
}, (table) => [
  index("idx_audit_actor").on(table.actorId),
  index("idx_audit_category").on(table.eventCategory),
  index("idx_audit_action").on(table.action),
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_loan").on(table.loanId),
  index("idx_audit_timestamp").on(table.timestamp),
]);

// ============================================================================
// DTI/DSCR ENGINE - INSTITUTIONAL GRADE UNDERWRITING
// ============================================================================

// A. SEASONING RULES - Time-based qualification logic
export const SEASONING_ACTIONS = [
  "include",       // Full amount qualifies
  "exclude",       // Do not count this income
  "cap",           // Cap at a percentage
  "prorate",       // Prorate based on months
  "flag_review",   // Include but flag for manual review
] as const;

export type SeasoningAction = typeof SEASONING_ACTIONS[number];

export const seasoningRules = pgTable("seasoning_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identity
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  incomeType: varchar("income_type", { length: 50 }).notNull(), // From INCOME_TYPES
  productType: varchar("product_type", { length: 50 }), // null = applies to all products
  
  // Seasoning requirements
  minimumMonths: integer("minimum_months").notNull(),
  optimalMonths: integer("optimal_months"), // Full qualification threshold
  
  // Action when insufficient seasoning
  insufficientAction: varchar("insufficient_action", { length: 30 }).notNull(), // From SEASONING_ACTIONS
  insufficientCapPercent: decimal("insufficient_cap_percent", { precision: 5, scale: 2 }), // If action = cap
  
  // Additional conditions
  conditions: jsonb("conditions"), // Extra criteria (e.g., declining trend)
  
  // Rule metadata
  priority: integer("priority").default(100), // Lower = higher priority
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_seasoning_income_type").on(table.incomeType),
  index("idx_seasoning_product").on(table.productType),
  index("idx_seasoning_active").on(table.isActive),
]);

// B. BUSINESS CASH FLOW ADJUSTMENTS - Self-employed edge cases
export const CASH_FLOW_ADJUSTMENT_TYPES = [
  "depreciation_addback",
  "amortization_addback",
  "depletion_addback",
  "meals_disallowance",
  "one_time_expense",
  "one_time_income",
  "business_use_of_home",
  "owner_compensation_adjustment",
  "partnership_distribution",
  "s_corp_distribution",
] as const;

export type CashFlowAdjustmentType = typeof CASH_FLOW_ADJUSTMENT_TYPES[number];

export const cashFlowAdjustments = pgTable("cash_flow_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incomeStreamId: varchar("income_stream_id").references(() => incomeStreams.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  
  // Adjustment details
  adjustmentType: varchar("adjustment_type", { length: 50 }).notNull(), // From CASH_FLOW_ADJUSTMENT_TYPES
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(), // add, subtract
  
  // Documentation & justification
  justification: text("justification").notNull(),
  sourceDocumentIds: text("source_document_ids").array(),
  taxFormLine: varchar("tax_form_line", { length: 50 }), // e.g., "Schedule C Line 13"
  
  // Verification
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_cfa_income_stream").on(table.incomeStreamId),
  index("idx_cfa_loan").on(table.loanId),
  index("idx_cfa_type").on(table.adjustmentType),
]);

// C. PORTFOLIO STRESS TESTING - Multi-property DSCR
export const portfolioStressTests = pgTable("portfolio_stress_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  loanId: varchar("loan_id").references(() => loanApplications.id),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id),
  
  // Portfolio metrics
  totalProperties: integer("total_properties").notNull(),
  totalGrossRent: decimal("total_gross_rent", { precision: 14, scale: 2 }).notNull(),
  totalPitia: decimal("total_pitia", { precision: 14, scale: 2 }).notNull(),
  
  // Base DSCR
  baseDscr: decimal("base_dscr", { precision: 6, scale: 3 }).notNull(),
  
  // Stress scenarios
  vacancyShockPercent: decimal("vacancy_shock_percent", { precision: 5, scale: 2 }).default("10.00"),
  stressedDscrVacancy: decimal("stressed_dscr_vacancy", { precision: 6, scale: 3 }),
  
  rateShockBps: integer("rate_shock_bps").default(200), // Basis points
  stressedDscrRate: decimal("stressed_dscr_rate", { precision: 6, scale: 3 }),
  
  combinedShockDscr: decimal("combined_shock_dscr", { precision: 6, scale: 3 }),
  
  // Property-level breakdown (JSONB)
  propertyBreakdown: jsonb("property_breakdown"), // Array of per-property DSCR calculations
  
  // Assessment
  stressTestResult: varchar("stress_test_result", { length: 30 }), // pass, marginal, fail
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  recommendations: jsonb("recommendations"), // Array of improvement suggestions
  
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  index("idx_pst_borrower").on(table.borrowerId),
  index("idx_pst_loan").on(table.loanId),
  index("idx_pst_result").on(table.stressTestResult),
]);

// D. PRODUCT RULES - FHA/VA/Conv/HELOC abstraction (DO NOT HARDCODE)
export const PRODUCT_TYPES = [
  "conventional_conforming",
  "conventional_jumbo",
  "fha",
  "va",
  "usda",
  "heloc",
  "heloan",
  "dscr_investor",
  "bank_statement",
  "asset_depletion",
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

export const STUDENT_LOAN_TREATMENTS = [
  "actual_payment",           // Use payment on credit report
  "ibr_payment",              // Use IBR/PAYE payment if documented
  "one_percent_balance",      // 1% of outstanding balance
  "half_percent_balance",     // 0.5% of outstanding balance
  "fully_amortized",          // Calculate 10-year fully amortized payment
] as const;

export const RENTAL_INCOME_TREATMENTS = [
  "seventy_five_percent",     // 75% of gross rent (conventional)
  "full_offset",              // Full PITIA offset (FHA standard)
  "net_cash_flow",            // Net positive = income, negative = liability
  "dscr_only",                // Use only for DSCR, not DTI
  "excluded",                 // Do not count rental income
] as const;

export const productRules = pgTable("product_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product identification
  productType: varchar("product_type", { length: 50 }).notNull(), // From PRODUCT_TYPES
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  ruleVersion: varchar("rule_version", { length: 20 }).default("1.0"),
  
  // DTI Limits
  frontEndDtiMax: decimal("front_end_dti_max", { precision: 5, scale: 2 }), // Housing ratio
  backEndDtiMax: decimal("back_end_dti_max", { precision: 5, scale: 2 }).notNull(), // Total DTI
  dtiExceptionAllowed: boolean("dti_exception_allowed").default(false),
  dtiExceptionMax: decimal("dti_exception_max", { precision: 5, scale: 2 }),
  
  // DSCR Requirements (for investor products)
  minDscr: decimal("min_dscr", { precision: 5, scale: 2 }),
  minStressedDscr: decimal("min_stressed_dscr", { precision: 5, scale: 2 }),
  
  // Income Treatment Rules
  rentalIncomeTreatment: varchar("rental_income_treatment", { length: 50 }), // From RENTAL_INCOME_TREATMENTS
  vacancyFactor: decimal("vacancy_factor", { precision: 5, scale: 2 }).default("25.00"),
  
  studentLoanTreatment: varchar("student_loan_treatment", { length: 50 }), // From STUDENT_LOAN_TREATMENTS
  studentLoanBalancePercent: decimal("student_loan_balance_percent", { precision: 5, scale: 3 }),
  
  // Self-Employment Rules
  selfEmploymentMinMonths: integer("self_employment_min_months").default(24),
  selfEmploymentDeclineRule: varchar("self_employment_decline_rule", { length: 50 }), // use_lower, average, exclude
  
  // Reserve Requirements
  minReserveMonths: integer("min_reserve_months"),
  reserveCalculationMethod: varchar("reserve_calculation_method", { length: 50 }),
  
  // Credit Requirements
  minCreditScore: integer("min_credit_score"),
  
  // Additional Rules (flexible JSONB)
  additionalRules: jsonb("additional_rules"), // Product-specific edge cases
  
  // Metadata
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  guidelineSource: varchar("guideline_source", { length: 255 }), // e.g., "Fannie Mae Selling Guide 2024"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_product_rules_type").on(table.productType),
  index("idx_product_rules_active").on(table.isActive),
]);

// E. STRUCTURED EXPLANATIONS - Regulator & Lender gold
export const underwritingExplanations = pgTable("underwriting_explanations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  resultId: varchar("result_id").references(() => underwritingResults.id),
  
  // Explanation identity
  ruleId: varchar("rule_id", { length: 100 }).notNull(), // Which rule produced this
  category: varchar("category", { length: 50 }).notNull(), // income, liability, dti, dscr, credit
  
  // Structured explanation
  input: jsonb("input").notNull(), // What went into the calculation
  output: jsonb("output").notNull(), // What came out
  reasoning: text("reasoning").notNull(), // Human-readable explanation
  
  // Impact
  dtiImpact: decimal("dti_impact", { precision: 6, scale: 3 }), // How much this affected DTI
  dscrImpact: decimal("dscr_impact", { precision: 6, scale: 3 }), // How much this affected DSCR
  
  // Flags
  isOverride: boolean("is_override").default(false),
  overrideJustification: text("override_justification"),
  overrideApprovedBy: varchar("override_approved_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_uw_exp_snapshot").on(table.snapshotId),
  index("idx_uw_exp_result").on(table.resultId),
  index("idx_uw_exp_rule").on(table.ruleId),
  index("idx_uw_exp_category").on(table.category),
]);

// F. CONFIDENCE DECOMPOSITION - Tells reviewers WHAT is weak
export const confidenceBreakdowns = pgTable("confidence_breakdowns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  resultId: varchar("result_id").references(() => underwritingResults.id),
  
  // Component scores (0-100)
  incomeConfidence: decimal("income_confidence", { precision: 5, scale: 2 }).notNull(),
  documentConfidence: decimal("document_confidence", { precision: 5, scale: 2 }).notNull(),
  stabilityConfidence: decimal("stability_confidence", { precision: 5, scale: 2 }).notNull(),
  assetConfidence: decimal("asset_confidence", { precision: 5, scale: 2 }).notNull(),
  liabilityConfidence: decimal("liability_confidence", { precision: 5, scale: 2 }).notNull(),
  propertyConfidence: decimal("property_confidence", { precision: 5, scale: 2 }),
  
  // Composite score
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 2 }).notNull(),
  
  // Weighted factors used
  weights: jsonb("weights").notNull(), // { income: 0.3, document: 0.25, ... }
  
  // Weak points identification
  weakestComponent: varchar("weakest_component", { length: 50 }).notNull(),
  remediationSuggestions: jsonb("remediation_suggestions"), // How to improve confidence
  
  // Thresholds
  autoApproveThreshold: decimal("auto_approve_threshold", { precision: 5, scale: 2 }).default("90.00"),
  loReviewThreshold: decimal("lo_review_threshold", { precision: 5, scale: 2 }).default("80.00"),
  
  // Resulting action
  recommendedAction: varchar("recommended_action", { length: 50 }), // auto_approve, lo_review, manual_uw
  
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  index("idx_conf_snapshot").on(table.snapshotId),
  index("idx_conf_result").on(table.resultId),
  index("idx_conf_overall").on(table.overallConfidence),
  index("idx_conf_action").on(table.recommendedAction),
]);

// G. WHAT-IF SCENARIOS - Run hypotheticals without mutating loan data
export const whatIfScenarios = pgTable("what_if_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  baseSnapshotId: varchar("base_snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  
  // Scenario metadata
  scenarioName: varchar("scenario_name", { length: 100 }).notNull(),
  scenarioType: varchar("scenario_type", { length: 50 }).notNull(), // income_change, payoff, down_payment, rate_change
  
  // Hypothetical changes (delta from base)
  incomeChanges: jsonb("income_changes"), // { incomeStreamId: newAmount }
  liabilityPayoffs: jsonb("liability_payoffs"), // { liabilityId: payoffAmount }
  downPaymentChange: decimal("down_payment_change", { precision: 14, scale: 2 }),
  interestRateChange: decimal("interest_rate_change", { precision: 5, scale: 3 }),
  loanAmountChange: decimal("loan_amount_change", { precision: 14, scale: 2 }),
  
  // Calculated results
  resultingDti: decimal("resulting_dti", { precision: 6, scale: 3 }),
  resultingFrontEndDti: decimal("resulting_front_end_dti", { precision: 6, scale: 3 }),
  resultingDscr: decimal("resulting_dscr", { precision: 6, scale: 3 }),
  resultingLtv: decimal("resulting_ltv", { precision: 6, scale: 3 }),
  resultingPayment: decimal("resulting_payment", { precision: 12, scale: 2 }),
  
  // Comparison to base
  dtiDelta: decimal("dti_delta", { precision: 6, scale: 3 }),
  dscrDelta: decimal("dscr_delta", { precision: 6, scale: 3 }),
  paymentDelta: decimal("payment_delta", { precision: 12, scale: 2 }),
  
  // Would this qualify?
  wouldQualify: boolean("would_qualify"),
  qualificationIssues: jsonb("qualification_issues"), // Array of remaining issues
  
  // User interaction
  createdBy: varchar("created_by").references(() => users.id),
  sharedWithBorrower: boolean("shared_with_borrower").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_whatif_loan").on(table.loanId),
  index("idx_whatif_base_snapshot").on(table.baseSnapshotId),
  index("idx_whatif_type").on(table.scenarioType),
]);

// H. DECISION FREEZE & VERSIONING - Audit-critical
export const underwritingDecisions = pgTable("underwriting_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  resultId: varchar("result_id").references(() => underwritingResults.id).notNull(),
  
  // Version control
  decisionVersion: integer("decision_version").notNull(),
  inputsHash: varchar("inputs_hash", { length: 64 }).notNull(), // SHA-256 of all inputs
  rulesVersion: varchar("rules_version", { length: 50 }).notNull(), // Which rule set was used
  
  // Decision output (frozen)
  decision: varchar("decision", { length: 50 }).notNull(), // approved, denied, suspended, conditional
  decisionReason: text("decision_reason"),
  conditions: jsonb("conditions"), // Array of conditions if conditional
  
  // Frozen metrics at decision time
  frozenDti: decimal("frozen_dti", { precision: 6, scale: 3 }).notNull(),
  frozenDscr: decimal("frozen_dscr", { precision: 6, scale: 3 }),
  frozenLtv: decimal("frozen_ltv", { precision: 6, scale: 3 }),
  frozenCreditScore: integer("frozen_credit_score"),
  frozenTotalIncome: decimal("frozen_total_income", { precision: 14, scale: 2 }),
  frozenTotalLiabilities: decimal("frozen_total_liabilities", { precision: 14, scale: 2 }),
  
  // Full input snapshot (for dispute resolution)
  fullInputsJson: jsonb("full_inputs_json").notNull(),
  
  // Decision actor
  decidedBy: varchar("decided_by").references(() => users.id), // null = automated
  decisionType: varchar("decision_type", { length: 30 }).notNull(), // automated, manual, override
  
  // Immutability proof
  previousDecisionId: varchar("previous_decision_id"),
  decisionHash: varchar("decision_hash", { length: 64 }), // Hash of this decision
  
  decidedAt: timestamp("decided_at").defaultNow(),
}, (table) => [
  index("idx_uw_decision_loan").on(table.loanId),
  index("idx_uw_decision_snapshot").on(table.snapshotId),
  index("idx_uw_decision_result").on(table.resultId),
  index("idx_uw_decision_version").on(table.decisionVersion),
  index("idx_uw_decision_hash").on(table.inputsHash),
  index("idx_uw_decision_type").on(table.decisionType),
]);

// I. UNDERWRITING RULES DSL - Data-driven guideline management
export const RULE_TRIGGER_TYPES = [
  "income_evaluated",
  "liability_evaluated", 
  "dti_calculated",
  "dscr_calculated",
  "document_processed",
  "field_extracted",
  "threshold_exceeded",
  "seasoning_checked",
  "stability_assessed",
  "portfolio_analyzed",
] as const;

export const RULE_ACTION_TYPES = [
  "set_qualification_status",
  "apply_cap",
  "apply_proration",
  "require_document",
  "flag_for_review",
  "trigger_recalculation",
  "add_condition",
  "adjust_confidence",
  "log_explanation",
  "escalate_to_underwriter",
] as const;

export const underwritingRulesDsl = pgTable("underwriting_rules_dsl", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule identity
  ruleCode: varchar("rule_code", { length: 50 }).notNull().unique(),
  ruleName: varchar("rule_name", { length: 200 }).notNull(),
  ruleDescription: text("rule_description"),
  
  // Scope
  productTypes: text("product_types").array(), // null = all products
  incomeTypes: text("income_types").array(), // null = all income types
  
  // Trigger
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // From RULE_TRIGGER_TYPES
  triggerConditions: jsonb("trigger_conditions").notNull(), // DSL condition object
  
  // Conditions (DSL syntax stored as structured JSONB)
  conditionsDsl: jsonb("conditions_dsl").notNull(), // The actual rule logic
  /*
    Example DSL:
    {
      "operator": "AND",
      "conditions": [
        { "field": "income.seasoningMonths", "operator": "<", "value": 24 },
        { "field": "income.type", "operator": "IN", "value": ["self_employment", "commission"] }
      ]
    }
  */
  
  // Actions
  actions: jsonb("actions").notNull(), // Array of actions to execute
  /*
    Example:
    [
      { "type": "set_qualification_status", "status": "excluded", "reason": "Insufficient seasoning" },
      { "type": "log_explanation", "category": "income", "ruleId": "SE_SEASON_001" }
    ]
  */
  
  // Execution control
  priority: integer("priority").default(100), // Lower = runs first
  stopOnMatch: boolean("stop_on_match").default(false), // If true, stop processing further rules
  
  // Versioning
  version: integer("version").default(1),
  previousVersionId: varchar("previous_version_id"),
  
  // Metadata
  category: varchar("category", { length: 50 }), // income, liability, dti, dscr, document, credit
  guidelineReference: varchar("guideline_reference", { length: 255 }), // e.g., "FNMA B3-3.1-09"
  
  // Lifecycle
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rules_dsl_code").on(table.ruleCode),
  index("idx_rules_dsl_trigger").on(table.triggerType),
  index("idx_rules_dsl_category").on(table.category),
  index("idx_rules_dsl_priority").on(table.priority),
  index("idx_rules_dsl_active").on(table.isActive),
]);

// J. RULE EXECUTION LOG - Track every rule that fired
export const ruleExecutionLog = pgTable("rule_execution_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  ruleId: varchar("rule_id").references(() => underwritingRulesDsl.id).notNull(),
  
  // Execution details
  ruleCode: varchar("rule_code", { length: 50 }).notNull(),
  ruleVersion: integer("rule_version").notNull(),
  
  // What triggered it
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerContext: jsonb("trigger_context"), // The data that triggered the rule
  
  // Evaluation
  conditionsMet: boolean("conditions_met").notNull(),
  evaluationDetails: jsonb("evaluation_details"), // Step-by-step condition evaluation
  
  // Actions taken
  actionsExecuted: jsonb("actions_executed"), // What actions were performed
  actionResults: jsonb("action_results"), // Results of each action
  
  // Impact
  impactedEntities: jsonb("impacted_entities"), // Which income streams, liabilities, etc.
  
  executedAt: timestamp("executed_at").defaultNow(),
}, (table) => [
  index("idx_rule_exec_snapshot").on(table.snapshotId),
  index("idx_rule_exec_rule").on(table.ruleId),
  index("idx_rule_exec_code").on(table.ruleCode),
  index("idx_rule_exec_met").on(table.conditionsMet),
]);

// ============================================================================
// MISMO CANONICAL & UNDERWRITING - ZOD SCHEMAS
// ============================================================================

export const insertIncomeStreamSchema = createInsertSchema(incomeStreams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCanonicalAssetSchema = createInsertSchema(canonicalAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCanonicalLiabilitySchema = createInsertSchema(canonicalLiabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnderwritingEventRuleSchema = createInsertSchema(underwritingEventRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnderwritingEventLogSchema = createInsertSchema(underwritingEventLog).omit({
  id: true,
});
export const insertUnderwritingSnapshotSchema = createInsertSchema(underwritingSnapshots).omit({
  id: true,
  createdAt: true,
});
export const insertUnderwritingResultSchema = createInsertSchema(underwritingResults).omit({
  id: true,
});
export const insertAnomalySchema = createInsertSchema(anomalies).omit({
  id: true,
});
export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({
  id: true,
});

// Type exports - MISMO Canonical
export type InsertIncomeStream = z.infer<typeof insertIncomeStreamSchema>;
export type IncomeStream = typeof incomeStreams.$inferSelect;
export type InsertCanonicalAsset = z.infer<typeof insertCanonicalAssetSchema>;
export type CanonicalAsset = typeof canonicalAssets.$inferSelect;
export type InsertCanonicalLiability = z.infer<typeof insertCanonicalLiabilitySchema>;
export type CanonicalLiability = typeof canonicalLiabilities.$inferSelect;
export type InsertUnderwritingEventRule = z.infer<typeof insertUnderwritingEventRuleSchema>;
export type UnderwritingEventRule = typeof underwritingEventRules.$inferSelect;
export type InsertUnderwritingEventLog = z.infer<typeof insertUnderwritingEventLogSchema>;
export type UnderwritingEventLog = typeof underwritingEventLog.$inferSelect;
export type InsertUnderwritingSnapshot = z.infer<typeof insertUnderwritingSnapshotSchema>;
export type UnderwritingSnapshot = typeof underwritingSnapshots.$inferSelect;
export type InsertUnderwritingResult = z.infer<typeof insertUnderwritingResultSchema>;
export type UnderwritingResult = typeof underwritingResults.$inferSelect;
export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomalies.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEvents.$inferSelect;

// DTI/DSCR ENGINE - Zod Schemas
export const insertSeasoningRuleSchema = createInsertSchema(seasoningRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCashFlowAdjustmentSchema = createInsertSchema(cashFlowAdjustments).omit({
  id: true,
  createdAt: true,
});
export const insertPortfolioStressTestSchema = createInsertSchema(portfolioStressTests).omit({
  id: true,
  calculatedAt: true,
});
export const insertProductRuleSchema = createInsertSchema(productRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnderwritingExplanationSchema = createInsertSchema(underwritingExplanations).omit({
  id: true,
  createdAt: true,
});
export const insertConfidenceBreakdownSchema = createInsertSchema(confidenceBreakdowns).omit({
  id: true,
  calculatedAt: true,
});
export const insertWhatIfScenarioSchema = createInsertSchema(whatIfScenarios).omit({
  id: true,
  createdAt: true,
});
export const insertUnderwritingDecisionSchema = createInsertSchema(underwritingDecisions).omit({
  id: true,
  decidedAt: true,
});
export const insertUnderwritingRuleDslSchema = createInsertSchema(underwritingRulesDsl).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRuleExecutionLogSchema = createInsertSchema(ruleExecutionLog).omit({
  id: true,
  executedAt: true,
});

// DTI/DSCR ENGINE - Type Exports
export type InsertSeasoningRule = z.infer<typeof insertSeasoningRuleSchema>;
export type SeasoningRule = typeof seasoningRules.$inferSelect;
export type InsertCashFlowAdjustment = z.infer<typeof insertCashFlowAdjustmentSchema>;
export type CashFlowAdjustment = typeof cashFlowAdjustments.$inferSelect;
export type InsertPortfolioStressTest = z.infer<typeof insertPortfolioStressTestSchema>;
export type PortfolioStressTest = typeof portfolioStressTests.$inferSelect;
export type InsertProductRule = z.infer<typeof insertProductRuleSchema>;
export type ProductRule = typeof productRules.$inferSelect;
export type InsertUnderwritingExplanation = z.infer<typeof insertUnderwritingExplanationSchema>;
export type UnderwritingExplanation = typeof underwritingExplanations.$inferSelect;
export type InsertConfidenceBreakdown = z.infer<typeof insertConfidenceBreakdownSchema>;
export type ConfidenceBreakdown = typeof confidenceBreakdowns.$inferSelect;
export type InsertWhatIfScenario = z.infer<typeof insertWhatIfScenarioSchema>;
export type WhatIfScenario = typeof whatIfScenarios.$inferSelect;
export type InsertUnderwritingDecision = z.infer<typeof insertUnderwritingDecisionSchema>;
export type UnderwritingDecision = typeof underwritingDecisions.$inferSelect;
export type InsertUnderwritingRuleDsl = z.infer<typeof insertUnderwritingRuleDslSchema>;
export type UnderwritingRuleDsl = typeof underwritingRulesDsl.$inferSelect;
export type InsertRuleExecutionLog = z.infer<typeof insertRuleExecutionLogSchema>;
export type RuleExecutionLog = typeof ruleExecutionLog.$inferSelect;

// ============================================================================
// UNDERWRITING CONDITIONS (Stips)
// ============================================================================

export const CONDITION_CATEGORIES = [
  "income",
  "assets",
  "credit",
  "property",
  "insurance",
  "title",
  "compliance",
  "other",
] as const;

export const CONDITION_PRIORITY = ["prior_to_approval", "prior_to_docs", "prior_to_funding"] as const;

export const loanConditions = pgTable("loan_conditions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 50 }).default("prior_to_docs").notNull(),

  status: varchar("status", { length: 50 }).default("outstanding").notNull(),

  requiredDocumentTypes: text("required_document_types").array(),
  linkedTaskId: varchar("linked_task_id").references(() => tasks.id),

  clearedByUserId: varchar("cleared_by_user_id").references(() => users.id),
  clearedAt: timestamp("cleared_at"),
  clearanceNotes: text("clearance_notes"),

  isAutoGenerated: boolean("is_auto_generated").default(false),
  sourceRule: varchar("source_rule", { length: 100 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoanConditionSchema = createInsertSchema(loanConditions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLoanCondition = z.infer<typeof insertLoanConditionSchema>;
export type LoanCondition = typeof loanConditions.$inferSelect;

// Document Requirement Templates
export const documentRequirementRules = pgTable("document_requirement_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  ruleCode: varchar("rule_code", { length: 50 }).notNull().unique(),
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  description: text("description"),

  triggerConditions: jsonb("trigger_conditions").notNull(),

  requiredDocuments: jsonb("required_documents").notNull(),

  generateCondition: boolean("generate_condition").default(true),
  conditionCategory: varchar("condition_category", { length: 50 }),
  conditionTitle: varchar("condition_title", { length: 255 }),
  conditionDescription: text("condition_description"),
  conditionPriority: varchar("condition_priority", { length: 50 }).default("prior_to_docs"),

  priority: integer("priority").default(100),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDocumentRequirementRuleSchema = createInsertSchema(documentRequirementRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocumentRequirementRule = z.infer<typeof insertDocumentRequirementRuleSchema>;
export type DocumentRequirementRule = typeof documentRequirementRules.$inferSelect;

// =============================================================================
// MATERIALITY RULES DSL ENGINE
// =============================================================================
// This DSL answers ONE question: "Does this change require action to preserve pre-approval validity?"
// It NEVER: recalculates income, issues approvals, or modifies snapshots

// Enums for Materiality Rules DSL
export const MATERIALITY_CATEGORIES = ["INCOME", "EMPLOYMENT", "CREDIT", "ASSETS", "LIABILITIES"] as const;
export type MaterialityCategory = typeof MATERIALITY_CATEGORIES[number];

export const CHANGE_TYPES = ["PERCENT_INCREASE", "PERCENT_DECREASE", "ABSOLUTE_INCREASE", "ABSOLUTE_DECREASE", "BOOLEAN_CHANGE", "NEW_ENTRY"] as const;
export type ChangeType = typeof CHANGE_TYPES[number];

export const SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type SeverityLevel = typeof SEVERITY_LEVELS[number];

export const REQUIRED_ACTIONS = ["NONE", "BORROWER_ATTESTATION", "DOCUMENT_REFRESH", "CREDIT_REFRESH", "REUNDERWRITE"] as const;
export type RequiredAction = typeof REQUIRED_ACTIONS[number];

export const RULE_AUTHORITIES = ["BROKER_PRE_APPROVAL", "LENDER_SPECIFIC", "REGULATORY"] as const;
export type RuleAuthority = typeof RULE_AUTHORITIES[number];

// 1. MATERIALITY RULE SETS - Top-level versioned containers
// These group rules by product type with version control for legal compliance
export const materialityRuleSets = pgTable("materiality_rule_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Rule set identification (immutable once published)
  ruleSetId: varchar("rule_set_id", { length: 100 }).notNull().unique(), // e.g., "CONV_BASELINE_COC"
  product: varchar("product", { length: 50 }).notNull(), // CONVENTIONAL, FHA, VA, HELOC
  authority: varchar("authority", { length: 50 }).notNull(), // BROKER_PRE_APPROVAL, LENDER_SPECIFIC, REGULATORY
  
  // Version control (CRITICAL for legal compliance)
  version: varchar("version", { length: 20 }).notNull(), // semver: 1.0.0
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"), // null = still active
  
  // Description for audit
  description: text("description"),
  
  // Status
  isDraft: boolean("is_draft").default(true), // Draft until published
  isActive: boolean("is_active").default(false), // Only one active version per product
  
  // Audit
  createdBy: varchar("created_by"),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_materiality_rule_sets_product").on(table.product),
  index("idx_materiality_rule_sets_active").on(table.isActive),
  index("idx_materiality_rule_sets_effective").on(table.effectiveDate),
]);

export const insertMaterialityRuleSetSchema = createInsertSchema(materialityRuleSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 2. MATERIALITY RULES - Individual rules with full DSL schema
// Each rule defines: what to watch, when it's material, and what action is required
export const materialityRules = pgTable("materiality_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Parent rule set
  ruleSetId: varchar("rule_set_id").references(() => materialityRuleSets.id).notNull(),
  
  // Rule identification (immutable within version)
  ruleId: varchar("rule_id", { length: 100 }).notNull(), // e.g., "INCOME_DROP_10"
  category: varchar("category", { length: 50 }).notNull(), // INCOME, EMPLOYMENT, CREDIT, ASSETS, LIABILITIES
  
  // Applicability filters (optional - rules only fire if applicable)
  appliesTo: jsonb("applies_to").$type<{
    incomeType?: string[]; // W2, BONUS, SELF_EMPLOYED, RENTAL
    occupancy?: string[];  // PRIMARY, SECOND, INVESTMENT
    productType?: string[]; // CONV, FHA, VA, HELOC
  }>(),
  
  // Change condition (WHEN clause)
  whenMetric: varchar("when_metric", { length: 100 }).notNull(), // e.g., "income.qualifying"
  whenChangeType: varchar("when_change_type", { length: 50 }).notNull(), // PERCENT_DECREASE, etc.
  whenChangeValue: decimal("when_change_value", { precision: 15, scale: 4 }), // Threshold value
  whenChangeBoolValue: boolean("when_change_bool_value"), // For BOOLEAN_CHANGE type
  
  // Materiality declaration (IMPORTANT: allows explicit non-material rules)
  isMaterial: boolean("is_material").notNull(),
  severity: varchar("severity", { length: 20 }).notNull(), // LOW, MEDIUM, HIGH
  
  // Required action (THIS IS THE OUTPUT)
  requiredAction: varchar("required_action", { length: 50 }).notNull(), // NONE, BORROWER_ATTESTATION, DOCUMENT_REFRESH, CREDIT_REFRESH, REUNDERWRITE
  
  // Explanation (AUDIT-CRITICAL)
  explanationMessage: text("explanation_message").notNull(),
  guidelineReference: varchar("guideline_reference", { length: 200 }), // e.g., "Fannie Mae B3-3.1-01"
  
  // Ordering (for deterministic evaluation)
  priority: integer("priority").default(100),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_materiality_rules_rule_set").on(table.ruleSetId),
  index("idx_materiality_rules_category").on(table.category),
  index("idx_materiality_rules_metric").on(table.whenMetric),
  index("idx_materiality_rules_priority").on(table.priority),
]);

export const insertMaterialityRuleSchema = createInsertSchema(materialityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 3. CHANGE EVENTS - Normalized delta inputs for materiality evaluation
// These are the inputs: frozen snapshot vs current state deltas
export const changeEvents = pgTable("change_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Context
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  
  // Event identification
  eventType: varchar("event_type", { length: 100 }).notNull(), // e.g., "income.qualifying.decrease"
  category: varchar("category", { length: 50 }).notNull(), // INCOME, EMPLOYMENT, CREDIT, ASSETS, LIABILITIES
  
  // Change details
  metric: varchar("metric", { length: 100 }).notNull(), // e.g., "income.qualifying"
  previousValue: decimal("previous_value", { precision: 15, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 4 }),
  previousBoolValue: boolean("previous_bool_value"),
  currentBoolValue: boolean("current_bool_value"),
  previousTextValue: text("previous_text_value"),
  currentTextValue: text("current_text_value"),
  
  // Computed delta
  changeType: varchar("change_type", { length: 50 }).notNull(), // PERCENT_DECREASE, etc.
  absoluteChange: decimal("absolute_change", { precision: 15, scale: 4 }),
  percentChange: decimal("percent_change", { precision: 10, scale: 4 }),
  
  // Source tracking
  sourceDocumentId: varchar("source_document_id").references(() => documents.id),
  sourceType: varchar("source_type", { length: 100 }), // e.g., "PLAID_REFRESH", "DOCUMENT_UPLOAD", "CREDIT_REFRESH"
  
  // Status
  isProcessed: boolean("is_processed").default(false),
  processedAt: timestamp("processed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_change_events_application").on(table.applicationId),
  index("idx_change_events_snapshot").on(table.snapshotId),
  index("idx_change_events_category").on(table.category),
  index("idx_change_events_metric").on(table.metric),
  index("idx_change_events_processed").on(table.isProcessed),
]);

export const insertChangeEventSchema = createInsertSchema(changeEvents).omit({
  id: true,
  createdAt: true,
});

// 4. MATERIALITY EVALUATIONS - Audit-complete decision logs
// Every rule evaluation is logged - NO SHORT-CIRCUITING allowed for audit
export const materialityEvaluations = pgTable("materiality_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Context
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  changeEventId: varchar("change_event_id").references(() => changeEvents.id).notNull(),
  
  // Rule set used (with version for legal compliance)
  ruleSetId: varchar("rule_set_id").references(() => materialityRuleSets.id).notNull(),
  ruleSetVersion: varchar("rule_set_version", { length: 20 }).notNull(),
  
  // Individual rule evaluated
  ruleId: varchar("rule_id").references(() => materialityRules.id).notNull(),
  
  // Evaluation result
  ruleMatched: boolean("rule_matched").notNull(), // Did the when condition match?
  isMaterial: boolean("is_material").notNull(),
  severity: varchar("severity", { length: 20 }),
  requiredAction: varchar("required_action", { length: 50 }).notNull(),
  
  // Explanation (for audit trail)
  explanationMessage: text("explanation_message").notNull(),
  guidelineReference: varchar("guideline_reference", { length: 200 }),
  
  // Evaluation context (what values were compared)
  evaluationContext: jsonb("evaluation_context").$type<{
    metric: string;
    snapshotValue: number | boolean | string;
    currentValue: number | boolean | string;
    changeType: string;
    thresholdValue: number | boolean;
    changeAmount: number;
    appliesTo: Record<string, string[]>;
  }>(),
  
  // Aggregate result (rolled up from all rules evaluated for this change event)
  isAggregatedResult: boolean("is_aggregated_result").default(false),
  aggregatedMateriality: boolean("aggregated_materiality"), // true if ANY rule said material
  aggregatedRequiredAction: varchar("aggregated_required_action", { length: 50 }), // Highest action required
  
  // Action taken
  actionTaken: varchar("action_taken", { length: 50 }),
  actionTakenAt: timestamp("action_taken_at"),
  actionTakenBy: varchar("action_taken_by"),
  
  // Result status
  status: varchar("status", { length: 50 }).default("pending"), // pending, acknowledged, action_taken, dismissed
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_materiality_evaluations_application").on(table.applicationId),
  index("idx_materiality_evaluations_snapshot").on(table.snapshotId),
  index("idx_materiality_evaluations_change_event").on(table.changeEventId),
  index("idx_materiality_evaluations_rule_set").on(table.ruleSetId),
  index("idx_materiality_evaluations_rule").on(table.ruleId),
  index("idx_materiality_evaluations_material").on(table.isMaterial),
  index("idx_materiality_evaluations_action").on(table.requiredAction),
  index("idx_materiality_evaluations_status").on(table.status),
]);

export const insertMaterialityEvaluationSchema = createInsertSchema(materialityEvaluations).omit({
  id: true,
  createdAt: true,
});

// Type exports for Materiality Rules DSL
export type InsertMaterialityRuleSet = z.infer<typeof insertMaterialityRuleSetSchema>;
export type MaterialityRuleSet = typeof materialityRuleSets.$inferSelect;
export type InsertMaterialityRule = z.infer<typeof insertMaterialityRuleSchema>;
export type MaterialityRule = typeof materialityRules.$inferSelect;
export type InsertChangeEvent = z.infer<typeof insertChangeEventSchema>;
export type ChangeEvent = typeof changeEvents.$inferSelect;
export type InsertMaterialityEvaluation = z.infer<typeof insertMaterialityEvaluationSchema>;
export type MaterialityEvaluation = typeof materialityEvaluations.$inferSelect;

// =============================================================================
// POLICY PROFILE SERVICE
// =============================================================================
// This is the CRITICAL foundation for policy-driven underwriting:
// - Underwriting logic = fixed code (Rule Interpreter)
// - Guidelines = editable data (Policy Profiles)
// - Decisions = frozen, explainable, auditable
// - No future guideline change requires code changes

// Enums for Policy Profile Service
export const POLICY_AUTHORITIES = ["FANNIE", "FREDDIE", "FHA", "VA", "LENDER", "BROKER"] as const;
export type PolicyAuthority = typeof POLICY_AUTHORITIES[number];

export const POLICY_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "RETIRED"] as const;
export type PolicyStatus = typeof POLICY_STATUSES[number];

export const THRESHOLD_CATEGORIES = ["INCOME", "CREDIT", "ASSETS", "LIABILITIES", "DTI", "LTV", "RESERVES", "PROPERTY"] as const;
export type ThresholdCategory = typeof THRESHOLD_CATEGORIES[number];

// 1. POLICY PROFILES - Top-level versioned policy containers
// Store investor/GSE policy thresholds as DATA, not code
export const policyProfiles = pgTable("policy_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Policy identification
  profileId: varchar("profile_id", { length: 100 }).notNull(), // e.g., "FNMA_CONV_2026_Q1"
  authority: varchar("authority", { length: 50 }).notNull(), // FANNIE, FREDDIE, FHA, VA, LENDER, BROKER
  productType: varchar("product_type", { length: 50 }).notNull(), // CONVENTIONAL, FHA, VA, HELOC
  
  // Version control (CRITICAL for legal compliance)
  version: varchar("version", { length: 20 }).notNull(), // semver: 1.0.0
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"), // null = still active
  
  // Status workflow: DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE → RETIRED
  status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
  
  // Description and source
  description: text("description"),
  bulletinReference: varchar("bulletin_reference", { length: 200 }), // e.g., "SEL-2026-01"
  sourceUrl: varchar("source_url", { length: 500 }),
  
  // Parent profile (for cloning/versioning)
  parentProfileId: varchar("parent_profile_id"),
  
  // Audit trail
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  activatedBy: varchar("activated_by"),
  activatedAt: timestamp("activated_at"),
  retiredBy: varchar("retired_by"),
  retiredAt: timestamp("retired_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_policy_profiles_authority").on(table.authority),
  index("idx_policy_profiles_product").on(table.productType),
  index("idx_policy_profiles_status").on(table.status),
  index("idx_policy_profiles_effective").on(table.effectiveDate),
]);

export const insertPolicyProfileSchema = createInsertSchema(policyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 2. POLICY THRESHOLDS - Structured threshold values (NOT free-text logic)
// Each threshold is a controlled field with bounds, not a formula
export const policyThresholds = pgTable("policy_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Parent policy
  policyProfileId: varchar("policy_profile_id").references(() => policyProfiles.id).notNull(),
  
  // Threshold identification
  category: varchar("category", { length: 50 }).notNull(), // INCOME, CREDIT, ASSETS, DTI, LTV, etc.
  thresholdKey: varchar("threshold_key", { length: 100 }).notNull(), // e.g., "min_credit_score", "max_dti_front"
  
  // Threshold values (controlled, not formulas)
  valueNumeric: decimal("value_numeric", { precision: 15, scale: 4 }),
  valuePercent: decimal("value_percent", { precision: 6, scale: 4 }), // 0.45 = 45%
  valueBool: boolean("value_bool"),
  valueEnum: varchar("value_enum", { length: 100 }), // For predefined options
  
  // Bounds (ops cannot exceed these)
  minBound: decimal("min_bound", { precision: 15, scale: 4 }),
  maxBound: decimal("max_bound", { precision: 15, scale: 4 }),
  
  // Materiality flags (what action when threshold is breached)
  materialityAction: varchar("materiality_action", { length: 50 }).default("REVIEW"), // NONE, REVIEW, MATERIAL, INVALIDATE
  
  // Description for ops
  displayName: varchar("display_name", { length: 200 }),
  description: text("description"),
  guidelineReference: varchar("guideline_reference", { length: 200 }),
  
  // Ordering for UI
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_policy_thresholds_profile").on(table.policyProfileId),
  index("idx_policy_thresholds_category").on(table.category),
  index("idx_policy_thresholds_key").on(table.thresholdKey),
]);

export const insertPolicyThresholdSchema = createInsertSchema(policyThresholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 3. POLICY APPROVAL WORKFLOW - Audit trail for policy changes
// Every policy change must go through approval workflow
export const policyApprovalWorkflow = pgTable("policy_approval_workflow", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Policy being approved
  policyProfileId: varchar("policy_profile_id").references(() => policyProfiles.id).notNull(),
  
  // Workflow step
  fromStatus: varchar("from_status", { length: 30 }).notNull(),
  toStatus: varchar("to_status", { length: 30 }).notNull(),
  
  // Action details
  action: varchar("action", { length: 50 }).notNull(), // SUBMIT, APPROVE, REJECT, ACTIVATE, RETIRE
  actionBy: varchar("action_by").notNull(),
  actionAt: timestamp("action_at").defaultNow(),
  
  // Justification (required for approval)
  justification: text("justification"),
  bulletinReference: varchar("bulletin_reference", { length: 200 }),
  
  // Rejection reason (if rejected)
  rejectionReason: text("rejection_reason"),
  
  // Impact assessment (auto-generated)
  impactedApplicationsCount: integer("impacted_applications_count"),
  impactAssessment: jsonb("impact_assessment").$type<{
    affectedCategories: string[];
    thresholdChanges: { key: string; oldValue: number; newValue: number }[];
    estimatedImpact: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_policy_approval_profile").on(table.policyProfileId),
  index("idx_policy_approval_action").on(table.action),
  index("idx_policy_approval_by").on(table.actionBy),
  index("idx_policy_approval_at").on(table.actionAt),
]);

export const insertPolicyApprovalWorkflowSchema = createInsertSchema(policyApprovalWorkflow).omit({
  id: true,
  createdAt: true,
});

// 4. POLICY LENDER OVERLAYS - Lender-specific threshold adjustments
// Lenders can have stricter (never looser) thresholds than GSE baseline
export const policyLenderOverlays = pgTable("policy_lender_overlays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Base policy being overlayed
  basePolicyProfileId: varchar("base_policy_profile_id").references(() => policyProfiles.id).notNull(),
  
  // Lender identification
  lenderId: varchar("lender_id", { length: 100 }).notNull(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  
  // Overlay version control
  version: varchar("version", { length: 20 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"),
  
  // Status
  status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
  
  // Overlay thresholds (must be stricter than base)
  overlayThresholds: jsonb("overlay_thresholds").$type<{
    [key: string]: {
      baseValue: number;
      overlayValue: number;
      direction: "STRICTER" | "SAME"; // Never "LOOSER"
      reason?: string;
    };
  }>(),
  
  // Additional lender requirements
  additionalRequirements: jsonb("additional_requirements").$type<{
    requirement: string;
    category: string;
    description: string;
  }[]>(),
  
  // Audit trail
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_policy_lender_overlays_base").on(table.basePolicyProfileId),
  index("idx_policy_lender_overlays_lender").on(table.lenderId),
  index("idx_policy_lender_overlays_status").on(table.status),
  index("idx_policy_lender_overlays_effective").on(table.effectiveDate),
]);

export const insertPolicyLenderOverlaySchema = createInsertSchema(policyLenderOverlays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for Policy Profile Service
export type InsertPolicyProfile = z.infer<typeof insertPolicyProfileSchema>;
export type PolicyProfile = typeof policyProfiles.$inferSelect;
export type InsertPolicyThreshold = z.infer<typeof insertPolicyThresholdSchema>;
export type PolicyThreshold = typeof policyThresholds.$inferSelect;
export type InsertPolicyApprovalWorkflow = z.infer<typeof insertPolicyApprovalWorkflowSchema>;
export type PolicyApprovalWorkflow = typeof policyApprovalWorkflow.$inferSelect;
export type InsertPolicyLenderOverlay = z.infer<typeof insertPolicyLenderOverlaySchema>;
export type PolicyLenderOverlay = typeof policyLenderOverlays.$inferSelect;
