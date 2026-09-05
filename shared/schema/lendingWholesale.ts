// Wholesale lenders, rate sheets + products, pricing adjustments, lender offers, lock requests, broker offer controls, offer selection/comparison.
// Split from the old shared/schema/lending.ts — ./lending re-exports all of it.
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
import { loanApplications } from "./lendingCore";
import { users } from "./core";
import { underwritingSnapshots } from "./underwriting";

export const wholesaleLenders = pgTable("wholesale_lenders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  lenderId: varchar("lender_id", { length: 100 }).notNull().unique(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  lenderCode: varchar("lender_code", { length: 20 }).notNull().unique(),
  
  primaryContact: varchar("primary_contact", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  portalUrl: varchar("portal_url", { length: 500 }),
  
  integrationTier: varchar("integration_tier", { length: 20 }).default("MANUAL").notNull(),
  
  apiConfig: jsonb("api_config").$type<{
    baseUrl?: string;
    authType?: "API_KEY" | "OAUTH" | "BASIC";
    endpoints?: {
      pricing?: string;
      lock?: string;
      productEligibility?: string;
    };
  }>(),
  
  capabilities: jsonb("capabilities").$type<{
    productTypes: string[];
    occupancyTypes: string[];
    statesLicensed: string[];
    minLoanAmount?: number;
    maxLoanAmount?: number;
    minCreditScore?: number;
  }>(),
  
  brokerCompensation: jsonb("broker_compensation").$type<{
    compensationType: "BORROWER_PAID" | "LENDER_PAID" | "EITHER";
    defaultBps?: number;
    minBps?: number;
    maxBps?: number;
  }>(),
  
  status: varchar("status", { length: 20 }).default("ACTIVE"),
  isPreferred: boolean("is_preferred").default(false),

  // --- Counterparty fields (migration 0051) -------------------------------
  // `status` answers "is this row live?"; it does NOT answer "do we have a
  // signed broker agreement?". Only `approvalStatus` does, and it is the gate
  // on transmitting a borrower's file to a third party. Defaults to "target"
  // so every existing and future row is fail-closed until someone states
  // otherwise. See evaluateLenderSubmissionEligibility in
  // shared/wholesaleLenders.ts.
  approvalStatus: varchar("approval_status", { length: 30 }).default("target").notNull(),

  // Seeded demo/sample counterparties (Summit Wholesale Lending et al.) exist
  // so pricing and the beta walkthrough have something to quote. They are not
  // real companies and must never receive a borrower file, regardless of
  // status or approvalStatus — the submission gate hard-blocks on this flag.
  isDemo: boolean("is_demo").default(false).notNull(),

  /** Runs non-QM programs (DSCR / bank-statement); drives income-package sections. */
  nonQm: boolean("non_qm").default(false).notNull(),

  /** Supported AUS engines on this lender's wholesale channel ("DU" | "LPA"). */
  ausSupport: text("aus_support").array(),

  /**
   * Early-payoff clawback window in days, from the executed broker agreement.
   * NULL means NO AGREEMENT EXISTS YET, not "no clawback" — every wholesale
   * broker agreement contains an EPO clause. Exposure for a NULL lender is
   * computed against DEFAULT_EPO_CLAWBACK_DAYS and flagged as an assumption.
   */
  epoClawbackDays: integer("epo_clawback_days"),

  /** Where this lender fits in the product box (business-development note). */
  specialty: varchar("specialty", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_wholesale_lenders_code").on(table.lenderCode),
  index("idx_wholesale_lenders_tier").on(table.integrationTier),
  index("idx_wholesale_lenders_status").on(table.status),
  index("idx_wholesale_lenders_approval").on(table.approvalStatus),
]);

export const insertWholesaleLenderSchema = createInsertSchema(wholesaleLenders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWholesaleLender = z.infer<typeof insertWholesaleLenderSchema>;

/**
 * The columns that decide whether a counterparty may be transacted with.
 *
 * These are NOT ordinary lender attributes. `approvalStatus` is the record of
 * an executed broker agreement and the gate on transmitting a borrower's file
 * to a third party; `isDemo` is what makes a fictional seeded row permanently
 * untransactable. Together they are the highest-consequence control in the
 * business, and they must move only through the audited approval endpoint —
 * never as an incidental key in a generic update body (F-22).
 */
export const LENDER_AUTHORIZATION_COLUMNS = ["approvalStatus", "isDemo"] as const;

/**
 * Columns carrying a term of the executed broker agreement.
 *
 * `epoClawbackDays` is an input to the clawback reserve on the admin financial
 * report and in the contingent-liability register, so a silent edit moves a
 * balance-sheet figure. Like the authorization columns it is kept off the
 * generic write path and moved only through an audited endpoint — captured at
 * approval, corrected through `PATCH .../contract-terms` (F-23).
 */
export const LENDER_CONTRACT_TERM_COLUMNS = ["epoClawbackDays"] as const;

/**
 * Schema for the generic lender create/update routes.
 *
 * Deliberately omits the authorization columns above, so a caller cannot set
 * them at all. Omitting rather than ignoring is the point: a body carrying
 * `approvalStatus` is silently stripped by Zod instead of quietly taking
 * effect. Seeds and storage still use `insertWholesaleLenderSchema`, which is
 * why the DEFAULTs (`target` / `false`) remain the only way a new row acquires
 * these values — fail-closed.
 */
export const writeWholesaleLenderSchema = insertWholesaleLenderSchema.omit({
  approvalStatus: true,
  isDemo: true,
  epoClawbackDays: true,
});
export type WholesaleLender = typeof wholesaleLenders.$inferSelect;

export const rateSheets = pgTable("rate_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sheetId: varchar("sheet_id", { length: 100 }).notNull().unique(),
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  
  version: varchar("version", { length: 20 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date").notNull(),
  
  uploadMethod: varchar("upload_method", { length: 20 }).default("MANUAL"),
  uploadedBy: varchar("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  sourceFileName: varchar("source_file_name", { length: 255 }),
  
  productTypes: text("product_types").array(),
  lockTerms: integer("lock_terms").array(),
  
  status: varchar("status", { length: 20 }).default("ACTIVE"),
  
  rawData: jsonb("raw_data"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_rate_sheets_lender").on(table.lenderId),
  index("idx_rate_sheets_effective").on(table.effectiveDate),
  index("idx_rate_sheets_status").on(table.status),
]);

export const insertRateSheetSchema = createInsertSchema(rateSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRateSheet = z.infer<typeof insertRateSheetSchema>;
export type RateSheet = typeof rateSheets.$inferSelect;

export const rateSheetProducts = pgTable("rate_sheet_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  rateSheetId: varchar("rate_sheet_id").references(() => rateSheets.id).notNull(),
  
  productCode: varchar("product_code", { length: 50 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  productType: varchar("product_type", { length: 30 }).notNull(),
  loanTerm: integer("loan_term").notNull(),
  amortizationType: varchar("amortization_type", { length: 20 }).default("FIXED"),
  
  baseRate: decimal("base_rate", { precision: 6, scale: 4 }).notNull(),
  
  lockTermAdjustments: jsonb("lock_term_adjustments").$type<{
    [lockDays: string]: number;
  }>(),
  
  pointsGrid: jsonb("points_grid").$type<{
    rate: number;
    points: number;
    rebate: number;
  }[]>(),
  
  eligibilityConstraints: jsonb("eligibility_constraints").$type<{
    minLoanAmount?: number;
    maxLoanAmount?: number;
    minCreditScore?: number;
    maxLTV?: number;
    maxDTI?: number;
    occupancyTypes?: string[];
    propertyTypes?: string[];
  }>(),
  
  lenderFees: jsonb("lender_fees").$type<{
    originationFee?: number;
    underwritingFee?: number;
    processingFee?: number;
    floodCertFee?: number;
    appraisalFee?: number;
    other?: { name: string; amount: number }[];
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_rate_sheet_products_sheet").on(table.rateSheetId),
  index("idx_rate_sheet_products_type").on(table.productType),
  index("idx_rate_sheet_products_code").on(table.productCode),
]);

export const insertRateSheetProductSchema = createInsertSchema(rateSheetProducts).omit({
  id: true,
  createdAt: true,
});

export type InsertRateSheetProduct = z.infer<typeof insertRateSheetProductSchema>;
export type RateSheetProduct = typeof rateSheetProducts.$inferSelect;

export const lenderPricingAdjustments = pgTable("lender_pricing_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  rateSheetId: varchar("rate_sheet_id").references(() => rateSheets.id),
  
  adjustmentType: varchar("adjustment_type", { length: 30 }).notNull(),
  adjustmentName: varchar("adjustment_name", { length: 255 }).notNull(),
  
  condition: jsonb("condition").$type<{
    creditScoreMin?: number;
    creditScoreMax?: number;
    ltvMin?: number;
    ltvMax?: number;
    occupancy?: string;
    propertyType?: string;
    loanPurpose?: string;
    productType?: string;
  }>().notNull(),
  
  adjustmentValue: decimal("adjustment_value", { precision: 6, scale: 4 }).notNull(),
  
  isStackable: boolean("is_stackable").default(true),
  
  guidelineReference: varchar("guideline_reference", { length: 255 }),
  
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_lender_pricing_adj_lender").on(table.lenderId),
  index("idx_lender_pricing_adj_type").on(table.adjustmentType),
  index("idx_lender_pricing_adj_effective").on(table.effectiveDate),
]);

export const insertLenderPricingAdjustmentSchema = createInsertSchema(lenderPricingAdjustments).omit({
  id: true,
  createdAt: true,
});

export type InsertLenderPricingAdjustment = z.infer<typeof insertLenderPricingAdjustmentSchema>;
export type LenderPricingAdjustment = typeof lenderPricingAdjustments.$inferSelect;

export const lenderOffers = pgTable("lender_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  offerId: varchar("offer_id", { length: 100 }).notNull().unique(),
  
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  productId: varchar("product_id").references(() => rateSheetProducts.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  
  rate: decimal("rate", { precision: 6, scale: 4 }).notNull(),
  apr: decimal("apr", { precision: 6, scale: 4 }),
  points: decimal("points", { precision: 6, scale: 4 }).default("0"),
  
  lenderFees: decimal("lender_fees", { precision: 12, scale: 2 }).default("0"),
  thirdPartyFees: decimal("third_party_fees", { precision: 12, scale: 2 }).default("0"),
  totalClosingCosts: decimal("total_closing_costs", { precision: 12, scale: 2 }),
  
  monthlyPrincipalInterest: decimal("monthly_pi", { precision: 12, scale: 2 }),
  monthlyMI: decimal("monthly_mi", { precision: 12, scale: 2 }).default("0"),
  monthlyTotal: decimal("monthly_total", { precision: 12, scale: 2 }),
  
  lockTerm: integer("lock_term").notNull(),
  lockExpiration: timestamp("lock_expiration"),
  
  offerExpiration: timestamp("offer_expiration").notNull(),
  
  conditions: jsonb("conditions").$type<{
    preClosing?: string[];
    postClosing?: string[];
    priorToDoc?: string[];
  }>(),
  
  brokerCompensationBps: integer("broker_compensation_bps"),
  brokerCompensationAmount: decimal("broker_compensation_amount", { precision: 12, scale: 2 }),
  
  status: varchar("status", { length: 20 }).default("PROPOSED").notNull(),
  
  selectedAt: timestamp("selected_at"),
  selectedBy: varchar("selected_by"),
  
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  lockConfirmationNumber: varchar("lock_confirmation_number", { length: 100 }),
  
  pricingBreakdown: jsonb("pricing_breakdown").$type<{
    baseRate: number;
    llpaAdjustments: { name: string; value: number }[];
    lockAdjustment: number;
    finalRate: number;
    totalAdjustments: number;
  }>(),
  
  labels: text("labels").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_lender_offers_application").on(table.applicationId),
  index("idx_lender_offers_snapshot").on(table.snapshotId),
  index("idx_lender_offers_lender").on(table.lenderId),
  index("idx_lender_offers_status").on(table.status),
  index("idx_lender_offers_expiration").on(table.offerExpiration),
]);

export const insertLenderOfferSchema = createInsertSchema(lenderOffers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLenderOffer = z.infer<typeof insertLenderOfferSchema>;
export type LenderOffer = typeof lenderOffers.$inferSelect;

export const lockRequests = pgTable("lock_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  requestId: varchar("request_id", { length: 100 }).notNull().unique(),
  
  offerId: varchar("offer_id").references(() => lenderOffers.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  requestedLockTerm: integer("requested_lock_term").notNull(),
  requestedLockExpiration: date("requested_lock_expiration").notNull(),
  
  clientAttestation: jsonb("client_attestation").$type<{
    noMaterialChanges: boolean;
    informationAccurate: boolean;
    attestedAt: string;
    attestedBy: string;
    ipAddress?: string;
  }>(),
  
  cocCheckResult: jsonb("coc_check_result").$type<{
    checkedAt: string;
    snapshotCurrent: boolean;
    materialChangesDetected: boolean;
    changes?: {
      dimension: string;
      severity: string;
      description: string;
    }[];
  }>(),
  
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  
  submittedAt: timestamp("submitted_at"),
  submittedBy: varchar("submitted_by"),
  submissionMethod: varchar("submission_method", { length: 20 }),
  
  lenderResponse: jsonb("lender_response").$type<{
    status: "CONFIRMED" | "DENIED" | "PENDING";
    confirmationNumber?: string;
    confirmedRate?: number;
    confirmedLockExpiration?: string;
    denialReason?: string;
    conditions?: string[];
    respondedAt?: string;
    respondedBy?: string;
  }>(),
  
  confirmedAt: timestamp("confirmed_at"),
  confirmationNumber: varchar("confirmation_number", { length: 100 }),
  confirmedRate: decimal("confirmed_rate", { precision: 6, scale: 4 }),
  confirmedLockExpiration: date("confirmed_lock_expiration"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_lock_requests_offer").on(table.offerId),
  index("idx_lock_requests_application").on(table.applicationId),
  index("idx_lock_requests_status").on(table.status),
]);

export const insertLockRequestSchema = createInsertSchema(lockRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLockRequest = z.infer<typeof insertLockRequestSchema>;
export type LockRequest = typeof lockRequests.$inferSelect;

export const brokerOfferControls = pgTable("broker_offer_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  
  suppressedLenderIds: text("suppressed_lender_ids").array(),
  
  offerRanking: jsonb("offer_ranking").$type<{
    offerId: string;
    rank: number;
    reason?: string;
  }[]>(),
  
  houseOverlays: jsonb("house_overlays").$type<{
    minCreditScore?: number;
    maxDTI?: number;
    maxLTV?: number;
    excludePropertyTypes?: string[];
    excludeOccupancyTypes?: string[];
    notes?: string;
  }>(),
  
  brokerCompensationType: varchar("broker_compensation_type", { length: 20 }),
  brokerCompensationBps: integer("broker_compensation_bps"),
  compensationLockedAt: timestamp("compensation_locked_at"),
  compensationLockedBy: varchar("compensation_locked_by"),
  
  displayPreferences: jsonb("display_preferences").$type<{
    maxOffersToShow?: number;
    defaultSortBy?: "PAYMENT" | "TOTAL_COST" | "RATE";
    showPointsToggle?: boolean;
  }>(),
  
  actionLog: jsonb("action_log").$type<{
    action: string;
    timestamp: string;
    performedBy: string;
    details?: Record<string, unknown>;
  }[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_broker_offer_controls_application").on(table.applicationId),
]);

export const insertBrokerOfferControlSchema = createInsertSchema(brokerOfferControls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrokerOfferControl = z.infer<typeof insertBrokerOfferControlSchema>;
export type BrokerOfferControl = typeof brokerOfferControls.$inferSelect;

export const offerSelectionEvents = pgTable("offer_selection_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  eventId: varchar("event_id", { length: 100 }).notNull().unique(),
  
  offerId: varchar("offer_id").references(() => lenderOffers.id).notNull(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  lenderId: varchar("lender_id").references(() => wholesaleLenders.id).notNull(),
  
  eventType: varchar("event_type", { length: 30 }).notNull(),
  
  selectionData: jsonb("selection_data").$type<{
    rate: number;
    points: number;
    monthlyPayment: number;
    totalClosingCosts: number;
    lockTerm: number;
    labels?: string[];
  }>(),
  
  performedBy: varchar("performed_by").notNull(),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  
  lenderVisibility: jsonb("lender_visibility").$type<{
    eligibilitySnapshotId: string;
    offerAccepted: boolean;
    acceptedAt?: string;
    noChangesPending: boolean;
    cocStatus?: string;
  }>(),
  
  clientMetadata: jsonb("client_metadata").$type<{
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_offer_selection_events_offer").on(table.offerId),
  index("idx_offer_selection_events_application").on(table.applicationId),
  index("idx_offer_selection_events_type").on(table.eventType),
  index("idx_offer_selection_events_performed_at").on(table.performedAt),
]);

export const insertOfferSelectionEventSchema = createInsertSchema(offerSelectionEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertOfferSelectionEvent = z.infer<typeof insertOfferSelectionEventSchema>;
export type OfferSelectionEvent = typeof offerSelectionEvents.$inferSelect;

export const offerComparisonSessions = pgTable("offer_comparison_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sessionId: varchar("session_id", { length: 100 }).notNull().unique(),
  applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => underwritingSnapshots.id).notNull(),
  borrowerId: varchar("borrower_id").references(() => users.id).notNull(),
  
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  
  offersShown: jsonb("offers_shown").$type<{
    offerId: string;
    lenderId: string;
    rate: number;
    points: number;
    monthlyPayment: number;
    totalCost: number;
    labels: string[];
    viewedAt?: string;
    viewDurationMs?: number;
  }[]>(),
  
  comparisonActions: jsonb("comparison_actions").$type<{
    action: "TOGGLE_POINTS" | "SORT_BY" | "EXPAND_DETAILS" | "BREAKEVEN_CALC" | "SELECT" | "DESELECT";
    timestamp: string;
    data?: Record<string, unknown>;
  }[]>(),
  
  selectedOfferId: varchar("selected_offer_id").references(() => lenderOffers.id),
  selectionReason: varchar("selection_reason", { length: 255 }),
  
  breakevenCalculations: jsonb("breakeven_calculations").$type<{
    offer1Id: string;
    offer2Id: string;
    breakevenMonths: number;
    calculatedAt: string;
  }[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_offer_comparison_sessions_application").on(table.applicationId),
  index("idx_offer_comparison_sessions_borrower").on(table.borrowerId),
  index("idx_offer_comparison_sessions_started").on(table.startedAt),
]);

export const insertOfferComparisonSessionSchema = createInsertSchema(offerComparisonSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertOfferComparisonSession = z.infer<typeof insertOfferComparisonSessionSchema>;
export type OfferComparisonSession = typeof offerComparisonSessions.$inferSelect;

export const MESSAGE_TYPES = ["text", "document_request", "document_submitted"] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

export interface DocumentRequestData {
  documentType: string;
  documentName: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "submitted" | "approved" | "rejected";
  documentId?: string;
  /** Exact borrower-visible correction. Kept inside the authenticated portal. */
  rejectionReason?: string;
  respondedAt?: string;
  reviewedAt?: string;
}
