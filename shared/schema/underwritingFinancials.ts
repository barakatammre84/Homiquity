// Canonical financial model: income streams, canonical assets + liabilities.
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
} from "drizzle-orm/pg-core";
import { users } from "./core";
import { loanApplications } from "./lending";

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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
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

