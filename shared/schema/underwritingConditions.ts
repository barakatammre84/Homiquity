// Rule execution log, loan conditions + CONDITION_CATEGORIES, document requirement rules, materiality rule sets/rules/evaluations, change events.
// Split from the old shared/schema/underwriting.ts — ./underwriting re-exports all of it.
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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { tasks } from "./underwritingTasks";
import { incomeStreams, canonicalAssets, canonicalLiabilities } from "./underwritingFinancials";
import {
  anomalies,
  auditEvents,
  cashFlowAdjustments,
  confidenceBreakdowns,
  portfolioStressTests,
  productRules,
  seasoningRules,
  underwritingDecisions,
  underwritingEventLog,
  underwritingEventRules,
  underwritingExplanations,
  underwritingResults,
  underwritingRulesDsl,
  underwritingSnapshots,
  whatIfScenarios,
} from "./underwritingCore";
import { users } from "./core";
import { loanApplications, documents } from "./lending";
import { lenderSubmissions } from "./delivery";

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

  /**
   * Set when this condition was issued by a wholesale lender on a specific
   * submission — staff transcribe them from the lender's portal (no lender
   * feed exists until broker agreements). Null = internally generated.
   * Lender conditions ride every existing conditions surface (pipeline,
   * clearing UI, metrics); this link only scopes them to their submission.
   */
  lenderSubmissionId: varchar("lender_submission_id").references(() => lenderSubmissions.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
