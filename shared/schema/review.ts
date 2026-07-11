import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { loanApplications } from "./lending";

// =============================================================================
// INCOME REVIEW WORKBENCH (UAL program P5 — the accuracy loop)
// =============================================================================

/**
 * Actionable review items for the exception-only workbench. Only the two
 * actionable tiers persist ("one_click" and "flagged") — auto-accepted data is
 * the collapsed green majority and never becomes a row. Items are generated
 * deterministically by reviewTriage from extraction confidence, tie-out
 * variances, and income-path review flags; the natural key embeds the
 * offending values, so a CHANGED input mints a NEW item while a resolved item
 * stays resolved (append-only truth, human decisions never overwritten).
 *
 * Resolutions are the accuracy loop's labeled data (what the machine read vs
 * what a human confirmed) — measurement and extraction-prompt iteration only,
 * never model retraining inside underwriting (L2 I1).
 */
export const REVIEW_ITEM_TIERS = ["one_click", "flagged"] as const;
export type ReviewItemTier = (typeof REVIEW_ITEM_TIERS)[number];

export const REVIEW_ITEM_STATUSES = ["open", "confirmed", "overridden", "dismissed"] as const;
export type ReviewItemStatus = (typeof REVIEW_ITEM_STATUSES)[number];

export const REVIEW_ITEM_TYPES = [
  "extraction_low_confidence",
  "tieout_variance",
  "se_income_review",
  "dscr_review",
  "bank_statement_review",
] as const;
export type ReviewItemType = (typeof REVIEW_ITEM_TYPES)[number];

export const reviewItems = pgTable(
  "review_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    applicationId: varchar("application_id").references(() => loanApplications.id),

    /** Deterministic identity: same finding (incl. its values) → same key. */
    naturalKey: varchar("natural_key", { length: 300 }).notNull(),
    itemType: varchar("item_type", { length: 40 }).notNull(), // REVIEW_ITEM_TYPES
    tier: varchar("tier", { length: 20 }).notNull(), // REVIEW_ITEM_TIERS

    title: varchar("title", { length: 300 }).notNull(),
    detail: text("detail").notNull(),
    /** Provenance refs: { logicalDocumentId?, fieldName?, checkId?, pathId?, taxYear?, entityName?, machineValue? } */
    evidence: jsonb("evidence"),

    status: varchar("status", { length: 20 }).default("open").notNull(), // REVIEW_ITEM_STATUSES
    /** Set on "overridden": the human-corrected value, as text. */
    correctedValue: text("corrected_value"),
    resolutionNote: text("resolution_note"),
    resolvedBy: varchar("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("uq_review_items_user_key").on(table.userId, table.naturalKey),
    index("idx_review_items_user_status").on(table.userId, table.status),
    index("idx_review_items_app_status").on(table.applicationId, table.status),
  ],
);

export const insertReviewItemSchema = createInsertSchema(reviewItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReviewItem = z.infer<typeof insertReviewItemSchema>;
export type ReviewItem = typeof reviewItems.$inferSelect;

/**
 * Bank-statement deposit analyses (UAL P4's named capture gap, closed in P5).
 * Append-only; the latest row per application is the current analysis the
 * income orchestrator feeds to the cited Angel Oak bank-statement calculator.
 * The eligible-deposit total is entered by staff who attest the AE
 * deposit-eligibility screening (those rules are portal-gated, not in-repo) —
 * every downstream figure flags manual review regardless.
 */
export const bankStatementAnalyses = pgTable(
  "bank_statement_analyses",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

    /** 12 or 24 — the program's only citable periods. */
    months: integer("months").notNull(),
    totalEligibleDeposits: decimal("total_eligible_deposits", { precision: 14, scale: 2 }).notNull(),
    /** Null → the program default applies (50%). */
    expenseFactor: decimal("expense_factor", { precision: 5, scale: 4 }),
    hasThirdPartyExpenseStatement: boolean("has_third_party_expense_statement").default(false).notNull(),
    notes: text("notes"),

    enteredBy: varchar("entered_by").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_bank_stmt_analyses_app").on(table.applicationId, table.createdAt)],
);

/** Request-body validation for the capture endpoint. */
export const bankStatementAnalysisInputSchema = z
  .object({
    months: z.union([z.literal(12), z.literal(24)]),
    totalEligibleDeposits: z.number().positive().max(1_000_000_000),
    expenseFactor: z.number().min(0).max(0.99).optional(),
    hasThirdPartyExpenseStatement: z.boolean().default(false),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type BankStatementAnalysisRequest = z.infer<typeof bankStatementAnalysisInputSchema>;
export type BankStatementAnalysis = typeof bankStatementAnalyses.$inferSelect;
