import { sql } from "drizzle-orm";
import { pgTable, varchar, boolean, decimal, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { loanApplications } from "./lending";

// =============================================================================
// INCOME PATH EVALUATIONS — the multi-path income orchestrator's history
// (UAL program P3). Modeled on decision_snapshots: append-only, time-ordered,
// carrying an inputs + evaluation SHA-256 fingerprint for reproducibility
// (the orchestrator is deterministic, but its policy citations and the SE
// worksheet can change, so a past evaluation must be reconstructable).
//
// One row per evaluation (on income change / on demand). The latest row is
// the current view; decision_snapshots.income_path_evaluation_id records
// which path-set fed each decision.
// =============================================================================

export const incomePathEvaluations = pgTable(
  "income_path_evaluations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),

    // What triggered this evaluation: "income_updated", "worksheet_confirmed",
    // "instant_decision", "manual", etc.
    trigger: varchar("trigger", { length: 50 }).notNull(),

    // Full path set (Zod-typed: shared/incomePaths.ts incomePathsSchema).
    paths: jsonb("paths").notNull(),

    // The full-doc DTI income fed to the underwriting engine.
    primaryMonthlyQualifyingIncome: decimal("primary_monthly_qualifying_income", {
      precision: 12,
      scale: 2,
    }).notNull(),
    // Highest-qualifying alternative METHOD, when one is enabled and higher; else null.
    recommendedPathId: varchar("recommended_path_id", { length: 30 }),
    incomeBasis: varchar("income_basis", { length: 30 }).notNull(), // urla_line_items | application_summary
    requiresManualReview: boolean("requires_manual_review").default(false).notNull(),

    // Reproducibility fingerprints (mirror the ResolvedPolicy fingerprint pattern).
    inputsFingerprint: varchar("inputs_fingerprint", { length: 64 }).notNull(),
    evaluationFingerprint: varchar("evaluation_fingerprint", { length: 64 }).notNull(),

    createdAt: timestamp("created_at").notNull().default(sql`now()`),
  },
  (table) => ({
    applicationIdx: index("income_path_evaluations_application_idx").on(table.applicationId),
    createdAtIdx: index("income_path_evaluations_created_at_idx").on(table.createdAt),
  }),
);

export const insertIncomePathEvaluationSchema = createInsertSchema(incomePathEvaluations).omit({
  id: true,
  createdAt: true,
});

export type IncomePathEvaluation = typeof incomePathEvaluations.$inferSelect;
export type InsertIncomePathEvaluation = typeof incomePathEvaluations.$inferInsert;
