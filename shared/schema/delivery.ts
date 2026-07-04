import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { loanApplications } from "./lending";

// =============================================================================
// GSE LOAN DELIVERY DATA (ULDD / UCD)
//
// Closing-stage data points required for Fannie Mae loan delivery that do not
// belong on the application row: the Regulation Z / QM datapoints enforced by
// the UCD Phase 1/3/3a/4 critical edits, the closing-cost containers the
// Phase 3 edits inspect, and the Special Feature Code set reported at
// delivery. One row per application, written by internal staff during
// closing/post-closing. Evaluated by shared/fannieMae/loanDeliveryEdits.ts.
//
// Sources: docs/fannie-mae/ QM Edits Job Aid (2026), UCD Phase 3 job aids,
// UCD Phase 4 LPQIRP job aid, Special Feature Codes 2026-05-06.
// =============================================================================

export const loanDeliveryData = pgTable(
  "loan_delivery_data",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

    // Note / loan identity
    noteDate: varchar("note_date", { length: 10 }), // YYYY-MM-DD; selects the QM threshold year
    originalLoanAmount: decimal("original_loan_amount", { precision: 12, scale: 2 }),
    lienPriorityType: varchar("lien_priority_type", { length: 30 }), // FirstLien | SecondLien
    noteRatePercent: decimal("note_rate_percent", { precision: 6, scale: 4 }),
    manufacturedHome: boolean("manufactured_home"),

    // Regulation Z / QM (UCD Phase 1 critical datapoints)
    aprPercent: decimal("apr_percent", { precision: 7, scale: 4 }),
    averagePrimeOfferRatePercent: decimal("average_prime_offer_rate_percent", { precision: 7, scale: 4 }),
    currentRateSetDate: varchar("current_rate_set_date", { length: 10 }), // YYYY-MM-DD
    regulationZTotalLoanAmount: decimal("regulation_z_total_loan_amount", { precision: 12, scale: 2 }),
    regulationZTotalPointsAndFeesAmount: decimal("regulation_z_total_points_and_fees_amount", { precision: 12, scale: 2 }),
    regulationZTotalAffiliateFeesAmount: decimal("regulation_z_total_affiliate_fees_amount", { precision: 12, scale: 2 }),
    abilityToRepayMethodType: varchar("ability_to_repay_method_type", { length: 20 }), // General | Exempt
    abilityToRepayExemptionReasonType: varchar("ability_to_repay_exemption_reason_type", { length: 20 }), // LoanProgram | PropertyUsage
    excludedBonaFideDiscountPointsIndicator: boolean("excluded_bona_fide_discount_points_indicator"),
    excludedBonaFideDiscountPointsPercent: decimal("excluded_bona_fide_discount_points_percent", { precision: 7, scale: 4 }),
    loanPriceQuoteInterestRatePercent: decimal("loan_price_quote_interest_rate_percent", { precision: 7, scale: 4 }),

    // Short-reset ARM (UCD Phase 3a)
    firstRateChangeMonthsCount: integer("first_rate_change_months_count"),
    qmShortResetArmAprPercent: decimal("qm_short_reset_arm_apr_percent", { precision: 7, scale: 4 }),

    // UCD Phase 3 closing-cost containers.
    // fees: FeeItemEntry[] — general FEE containers for CD sections A/B/C/E/H
    // (see shared/fannieMae/loanDeliveryEdits.ts)
    fees: jsonb("fees"),
    // discountPoints: { feeTotalPercent, feePaidToType, feePaidToTypeOtherDescription,
    //                   actualPaymentAmount, feePaymentPaidByType } | null (null = fee line absent)
    discountPoints: jsonb("discount_points"),
    discountPointsOccurrenceCount: integer("discount_points_occurrence_count"),
    // lenderCredits: { amount, toleranceCureAmount } | null
    lenderCredits: jsonb("lender_credits"),
    // escrowItems: EscrowItemEntry[] — see shared/fannieMae/loanDeliveryEdits.ts
    escrowItems: jsonb("escrow_items"),
    // prepaidItems: PrepaidItemEntry[]
    prepaidItems: jsonb("prepaid_items"),

    // Property / project (EarlyCheck origination edits; ULDD SID 42)
    projectClassificationIdentifier: varchar("project_classification_identifier", { length: 2 }),
    applicationReceivedDate: varchar("application_received_date", { length: 10 }), // YYYY-MM-DD
    subordinateFinancingExists: boolean("subordinate_financing_exists"),
    hasMortgageInsurance: boolean("has_mortgage_insurance"),
    financedPropertiesCount: integer("financed_properties_count"),
    propertyUsageType: varchar("property_usage_type", { length: 30 }), // PrimaryResidence | SecondHome | Investment

    // Investor (EarlyCheck MISMO 3.4 edits 144/1700)
    mortgageFunderFullName: varchar("mortgage_funder_full_name", { length: 255 }),

    // Special Feature Codes assigned manually by staff (deterministic
    // derivation adds auto-derived codes on top at evaluation time).
    manualSpecialFeatureCodes: text("manual_special_feature_codes").array(),

    // SFC derivation attributes with no application-level source of truth yet.
    // Keys mirror SfcDerivationInput in shared/fannieMae/specialFeatureCodes.ts.
    sfcAttributes: jsonb("sfc_attributes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("loan_delivery_data_application_idx").on(table.applicationId),
  ],
);

export const insertLoanDeliveryDataSchema = createInsertSchema(loanDeliveryData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoanDeliveryData = typeof loanDeliveryData.$inferSelect;
export type InsertLoanDeliveryData = z.infer<typeof insertLoanDeliveryDataSchema>;
