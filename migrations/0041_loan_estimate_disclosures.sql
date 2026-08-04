-- 0041: issued Loan Estimate disclosures — TRID tolerance baseline (F-4)
-- Expand-only, idempotent: a new table plus its indexes. Nothing existing is
-- altered, so the currently-deployed app is unaffected by its presence.
--
-- The Loan Estimate is regenerated from live file data on every fetch, so
-- before this table there was no record of what was actually disclosed: the
-- figures a borrower saw on day one silently became different figures on day
-- ten, and no good-faith tolerance comparison (Reg Z 1026.19(e)(3)) was
-- possible because the baseline did not exist anywhere.
--
-- One immutable row per issued disclosure. version 1 is the original LE;
-- each valid redisclosure appends and links the change-of-circumstance record
-- that authorized resetting the baseline.
CREATE TABLE IF NOT EXISTS "loan_estimate_disclosures" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "version" integer NOT NULL,
  "issued_at" timestamp DEFAULT now() NOT NULL,
  "snapshot" jsonb NOT NULL,
  "coc_id" varchar REFERENCES "change_of_circumstances"("id"),
  "tolerance_evaluation" jsonb,
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_estimate_disclosures_app_idx" ON "loan_estimate_disclosures" ("application_id", "version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loan_estimate_disclosures_app_version_key" ON "loan_estimate_disclosures" ("application_id", "version");
