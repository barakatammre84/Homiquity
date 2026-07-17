// Underwriting engine surface: event rules/log, snapshots, results, anomalies, audit events, seasoning, cash-flow adjustments, stress tests, product rules, explanations, confidence, what-if, decisions, rules DSL.
// Split from the old shared/schema/underwriting.ts — ./underwriting re-exports all of it.
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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { incomeStreams } from "./underwritingFinancials";
import { users } from "./core";
import { loanApplications } from "./lending";

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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  previousDecisionId: varchar("previous_decision_id").references((): AnyPgColumn => underwritingDecisions.id),
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
  previousVersionId: varchar("previous_version_id").references((): AnyPgColumn => underwritingRulesDsl.id),
  
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_rules_dsl_code").on(table.ruleCode),
  index("idx_rules_dsl_trigger").on(table.triggerType),
  index("idx_rules_dsl_category").on(table.category),
  index("idx_rules_dsl_priority").on(table.priority),
  index("idx_rules_dsl_active").on(table.isActive),
]);

// J. RULE EXECUTION LOG - Track every rule that fired
