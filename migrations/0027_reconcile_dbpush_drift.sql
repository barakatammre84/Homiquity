-- 0027: Reconcile the rest of the db:push schema drift the 0026 fix uncovered.
-- The schema-migration guard (scripts/schema-migration-guard.cjs) found that many
-- columns reached shared/schema via db:push but were never migrated, so prod
-- (migrate-only) lacks them. Verified missing in prod on 2026-07-13; all are on
-- request paths that 500 when hit. Additive + idempotent; hand-authored.
--
--   loan_applications.trid_triggered_at — in the dashboard/team-members/coach
--     select list; the 0026 fix cleared household_family_size + home_square_footage
--     but this third missing column kept those endpoints 500ing.
--   documents.extraction_* — AI-extraction raw-response persistence; extraction is
--     now live (ANTHROPIC_API_KEY set), so a document upload would 500 without these.
--   urla_assets/urla_liabilities.account_number_* — encrypted account-number vault
--     columns written during URLA asset/liability entry.
--   credit_pulls.is_simulated — simulated-vendor flag on credit-pull records.
--   decision_snapshots.resolved_policy / policy_fingerprint — decision-engine audit.

ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "trid_triggered_at" timestamp;

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_response_hash" varchar(64);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_raw_encrypted" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_raw_iv" varchar(32);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_raw_key_id" varchar(20);

ALTER TABLE "urla_assets" ADD COLUMN IF NOT EXISTS "account_number_encrypted" text;
ALTER TABLE "urla_assets" ADD COLUMN IF NOT EXISTS "account_number_iv" varchar(32);
ALTER TABLE "urla_assets" ADD COLUMN IF NOT EXISTS "account_number_key_id" varchar(20);
ALTER TABLE "urla_assets" ADD COLUMN IF NOT EXISTS "account_number_last4" varchar(4);

ALTER TABLE "urla_liabilities" ADD COLUMN IF NOT EXISTS "account_number_encrypted" text;
ALTER TABLE "urla_liabilities" ADD COLUMN IF NOT EXISTS "account_number_iv" varchar(32);
ALTER TABLE "urla_liabilities" ADD COLUMN IF NOT EXISTS "account_number_key_id" varchar(20);
ALTER TABLE "urla_liabilities" ADD COLUMN IF NOT EXISTS "account_number_last4" varchar(4);

ALTER TABLE "credit_pulls" ADD COLUMN IF NOT EXISTS "is_simulated" boolean NOT NULL DEFAULT false;

ALTER TABLE "decision_snapshots" ADD COLUMN IF NOT EXISTS "resolved_policy" jsonb;
ALTER TABLE "decision_snapshots" ADD COLUMN IF NOT EXISTS "policy_fingerprint" varchar(64);
