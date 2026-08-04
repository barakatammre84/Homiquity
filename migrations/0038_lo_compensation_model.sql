-- 0038: loan-originator compensation model per transaction (Reg Z 1026.36(d)(2))
-- Expand-only, idempotent: two nullable columns on loan_applications. The
-- currently-deployed app tolerates the new columns and vice-versa.
--
-- Deliberately NULLABLE and deliberately NOT backfilled. The compensation model
-- is a fact about how a specific transaction is papered; inventing a value for
-- existing rows would falsify a compliance record. Existing files therefore
-- read as "not elected", and the fee schedule / Loan Estimate fail closed on
-- them until staff elect a model — which is the correct outcome, not a gap.
--
--   lo_compensation_model: lender_paid | borrower_paid
--     (vocabulary: shared/compliance/loCompensation.ts COMPENSATION_MODELS)
--   lo_compensation_bps:   compensation in basis points of the loan amount
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "lo_compensation_model" varchar(20);--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "lo_compensation_bps" integer;
