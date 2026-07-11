-- 0017: Income path evaluations (UAL program P3 — multi-path income orchestrator)
-- Append-only ledger of every multi-path income evaluation, modeled on
-- decision_snapshots, plus a nullable link from decision_snapshots to the
-- evaluation that fed each decision.
--
-- NUMBERING: 0013 is the SE-worksheet migration (now on main); 0014-0016 are
-- reserved by the P2 tax-intelligence branch (PR #101, open). This file is
-- 0017 to avoid colliding with P2 regardless of merge order.
-- Idempotent; hand-authored (drizzle-kit generate has snapshot drift here).

CREATE TABLE IF NOT EXISTS "income_path_evaluations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "trigger" varchar(50) NOT NULL,
  "paths" jsonb NOT NULL,
  "primary_monthly_qualifying_income" numeric(12,2) NOT NULL,
  "recommended_path_id" varchar(30),
  "income_basis" varchar(30) NOT NULL,
  "requires_manual_review" boolean NOT NULL DEFAULT false,
  "inputs_fingerprint" varchar(64) NOT NULL,
  "evaluation_fingerprint" varchar(64) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_path_evaluations_application_idx" ON "income_path_evaluations" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_path_evaluations_created_at_idx" ON "income_path_evaluations" ("created_at");
--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD COLUMN IF NOT EXISTS "income_path_evaluation_id" varchar(36);
