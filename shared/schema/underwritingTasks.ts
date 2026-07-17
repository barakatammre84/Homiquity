// Task engine: SLA classes, tasks, task documents/events/audit, SLA configs + mappings, escalation actions.
// Split from the old shared/schema/underwriting.ts — ./underwriting re-exports all of it.
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { loanApplications, documents } from "./lending";

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

/**
 * A document_request assigned to the borrower who owns the application is
 * borrower work — ownerRole "BORROWER" is the key every borrower-facing
 * surface filters on (sidebar badge pending-count, /api/shell/badges,
 * BorrowerRequests, getBorrowerTasks). A writer that omits ownerRole inherits
 * the column's PROCESSOR default instead, which parked 1,000+ borrower upload
 * tasks in the staff processor queue while the borrower badge read 0
 * (migration 0035 remapped the existing rows). Returns undefined when the
 * rule doesn't apply so callers can fall through to the default: staff-chase
 * document tasks (assigned to staff, or unassigned document-intelligence
 * review items) legitimately stay PROCESSOR-owned.
 */
export function deriveDocumentTaskOwnerRole(
  task: { taskType: string; assignedToUserId?: string | null },
  applicationOwnerUserId: string | null | undefined,
): Extract<TaskOwnerRole, "BORROWER"> | undefined {
  return task.taskType === "document_request" &&
    !!task.assignedToUserId &&
    task.assignedToUserId === applicationOwnerUserId
    ? "BORROWER"
    : undefined;
}

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
  // Codes the task-event emitters actually write (server/services/taskEventEmitter.ts).
  // The blocks above were declared before the emitters were built and the two
  // vocabularies never met: until 2026-07-17 every live event task carried a
  // code absent from this list. Declared must contain spoken —
  // tests/taskEngineSlaSeed.test.ts scans the emitter and fails on any new
  // code missing here or in the SLA seed. (CMP_ADVERSE_ACTION and
  // CRD_NEW_TRADELINE were already shared with the blocks above.)
  "DOC_REVIEW", "OCR_FAILED", "OCR_QUALITY", "DOC_EXPIRED", "DOC_MISSING",
  "INTAKE_REVIEW", "PA_GENERATE", "DOC_COLLECT_START", "PROC_START", "UW_START",
  "ELIG_COND_CLEAR", "CMP_CLOSING_DISC",
  "CRD_SCORE_CHANGE", "CRD_EXPIRED",
  "INC_CHANGE", "INC_VERIFY_EMP", "INC_EXPIRED",
  "AST_DECREASE", "AST_VERIFY",
] as const;

export type TaskTypeCode = typeof TASK_TYPE_CODES[number];

// Escalation levels
export const ESCALATION_LEVELS = [0, 1, 2, 3, 4] as const;
export type EscalationLevel = typeof ESCALATION_LEVELS[number];

/**
 * Task lifecycle statuses — the ONLY values tasks.status may hold.
 *
 * The column spent a year holding two vocabularies at once: the task engine
 * wrote this uppercase set while the pipeline engine's document tasks wrote
 * lowercase "pending" and the legacy upload/verify routes wrote "submitted"/
 * "verified" — so SLA sweeps skipped pipeline tasks and completed tasks kept
 * rendering as open borrower action items. Migration 0033 mapped every legacy
 * value onto this set. Do not add lowercase aliases; document-verification
 * outcomes ("pending review", "rejected") belong in verificationStatus, not here.
 */
export const TASK_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "EXPIRED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// The "still needs work" subset every SLA/escalation/count query filters on.
// Derived here once so sweeps and dashboards cannot drift apart again.
export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
];

// Terminal subset — no SLA clock, no escalation, no action item.
export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = [
  "COMPLETED",
  "EXPIRED",
];

/**
 * Document-verification outcomes for a task's submitted document — a SEPARATE
 * axis from the lifecycle status above. "pending" here means "awaiting staff
 * review", which is NOT a lifecycle state (the lifecycle stays IN_PROGRESS
 * while review is pending). The borrower dashboard once compared these values
 * against tasks.status and counted engine-COMPLETED tasks as open items.
 */
export const TASK_VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "needs_review",
] as const;
export type TaskVerificationStatus = (typeof TASK_VERIFICATION_STATUSES)[number];

/**
 * Task priorities — the ONLY values tasks.priority may hold, least to most
 * urgent.
 *
 * The column's declared vocabulary (LOW, NORMAL, HIGH, CRITICAL) was never
 * read by anything: every badge map and the lending dashboard's action-item
 * sort match this lowercase set, and the pipeline engine's document tasks
 * write it. Only the task engine's fallback and the old column default
 * produced uppercase rows ("NORMAL"), which rendered as Normal purely via
 * the badge fallback and took the default sort rank. Migration 0034 remapped
 * the legacy rows. "CRITICAL" was never written by any code path; its
 * canonical spelling is "urgent" — the tier every reader styles. Do not add
 * uppercase aliases.
 */
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// Shared sort rank for action-item/queue ordering — 0 sorts first. Keyed
// Record<TaskPriority, …> so a vocabulary change breaks the build here;
// coverage is also asserted in tests/statusVocabulary.test.ts. NOTE: "urgent"
// ranks 0 (falsy) — combine with ?? when a fallback is needed, never ||.
export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

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
  // 50 not 20: "DOCUMENT_INTELLIGENCE" is 21 chars and overflowed the column,
  // 500ing every borrower document upload via the task engine's upload event.
  triggerSource: varchar("trigger_source", { length: 50 }).default("MANUAL"), // OCR, POLICY, LENDER, SYSTEM, MANUAL, COC, DOCUMENT_INTELLIGENCE
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
  status: varchar("status", { length: 50 }).$type<TaskStatus>().default("OPEN").notNull(),
  priority: varchar("priority", { length: 20 }).$type<TaskPriority>().default("normal"), // TASK_PRIORITIES — migration 0034 retired the uppercase legacy set
  
  // Due Date
  dueDate: timestamp("due_date"),
  
  // Verification (for document tasks)
  verificationStatus: varchar("verification_status", { length: 50 }).$type<TaskVerificationStatus>(),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_tasks_application").on(table.applicationId),
  index("idx_tasks_assigned_user").on(table.assignedToUserId),
  index("idx_tasks_status").on(table.status),
  index("idx_tasks_created").on(table.createdAt),
  index("idx_tasks_sla_due").on(table.slaDueAt),
  index("idx_tasks_app_status").on(table.applicationId, table.status),
]);

// createInsertSchema derives z.string() for varchar regardless of $type, so the
// vocabulary columns are pinned to z.enum explicitly — the same closure that
// stopped the unvalidated commission-status writes (#221). Without this, the
// staff PATCH /api/tasks/:id route accepts any string into status.
export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    verificationStatus: z.enum(TASK_VERIFICATION_STATUSES).nullable().optional(),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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

