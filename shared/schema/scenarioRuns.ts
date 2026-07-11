import { sql } from "drizzle-orm";
import { pgTable, varchar, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { loanApplications } from "./lending";
import { users } from "./core";
import { incomePathEvaluations } from "./incomePathEvaluations";

// =============================================================================
// SCENARIO RUNS — the LO-2 what-if simulator's immutable audit substrate.
// Modeled on decision_snapshots / income_path_evaluations: append-only,
// time-ordered, no update path. Every simulator run persists here BEFORE the
// response returns, recording exactly what the LO saw and which engine
// versions produced it:
//   - inputs:  the scenario the LO dialed in (price, down payment, product
//              filters, hypothetical FICO, tax/HOA overrides, address context)
//   - outputs: evaluated offers (qualification + APR + cash-to-close), the
//              §1026.36(e)(3) anti-steering option ids, and the income summary
//   - engine_versions: income evaluation id + fingerprints and the per-offer
//              resolved-policy fingerprints (reproducibility)
//   - rate_sheet_versions: the active sheets quoted ({sheetId, version,
//              effectiveDate, lenderId})
//   - simulated: I10 provenance — true until the PPE contract replaces the
//              simulated rate sheets
// LO-3's client report may only render numbers from a persisted row here.
// Stores derived financials and engine inputs only — never SSN/account
// numbers (I4).
// =============================================================================

export const scenarioRuns = pgTable(
  "scenario_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    applicationId: varchar("application_id").references(() => loanApplications.id).notNull(),
    loUserId: varchar("lo_user_id").references(() => users.id).notNull(),
    incomePathEvaluationId: varchar("income_path_evaluation_id")
      .references(() => incomePathEvaluations.id)
      .notNull(),

    inputs: jsonb("inputs").notNull(),
    outputs: jsonb("outputs").notNull(),
    engineVersions: jsonb("engine_versions").notNull(),
    rateSheetVersions: jsonb("rate_sheet_versions").notNull(),

    simulated: boolean("simulated").notNull().default(true),
    createdAt: timestamp("created_at").notNull().default(sql`now()`),
  },
  (table) => ({
    applicationIdx: index("scenario_runs_application_idx").on(table.applicationId),
    loUserIdx: index("scenario_runs_lo_user_idx").on(table.loUserId),
    createdAtIdx: index("scenario_runs_created_at_idx").on(table.createdAt),
  }),
);

export const insertScenarioRunSchema = createInsertSchema(scenarioRuns).omit({
  id: true,
  createdAt: true,
});

export type ScenarioRun = typeof scenarioRuns.$inferSelect;
export type InsertScenarioRun = typeof scenarioRuns.$inferInsert;
