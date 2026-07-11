-- 0020: Scenario runs (LO Advisor Program LO-2 — deterministic what-if simulator)
-- Append-only audit substrate for every simulator run: inputs, outputs, the
-- engine fingerprints that produced them, the rate-sheet versions quoted, the
-- simulated-data provenance flag (I10), and the LO who ran it. LO-3 (client
-- report) and LO-5 (comms rails) hang off this table — report numbers may only
-- come from a persisted row, never from editable client state.
--
-- NUMBERING: 0014-0019 are claimed by the UAL program (merged in PR #108);
-- 0020 verified free against live worktrees at claim time (2026-07-11).
-- Immutable by convention (no update storage method), like decision_snapshots.
-- Idempotent; hand-authored (drizzle-kit generate has snapshot drift here).

CREATE TABLE IF NOT EXISTS "scenario_runs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "lo_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "income_path_evaluation_id" varchar NOT NULL REFERENCES "income_path_evaluations"("id"),
  "inputs" jsonb NOT NULL,
  "outputs" jsonb NOT NULL,
  "engine_versions" jsonb NOT NULL,
  "rate_sheet_versions" jsonb NOT NULL,
  "simulated" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenario_runs_application_idx" ON "scenario_runs" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenario_runs_lo_user_idx" ON "scenario_runs" ("lo_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenario_runs_created_at_idx" ON "scenario_runs" ("created_at");
