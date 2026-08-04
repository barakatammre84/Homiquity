-- 0042: broker compensation lifecycle on lender submissions (audit finding F-6)
-- Expand-only, idempotent. The currently-deployed app tolerates the new
-- columns and vice-versa.
--
-- Revenue was represented nowhere in the platform: the comp fields on
-- lender_offers were never written, the seeded per-lender comp plans were read
-- only by dead code, and the sole financial metric on the admin dashboard
-- summed the purchase price of PENDING applications. A funded loan earned an
-- unknown amount, and a lender paying less than the comp plan was invisible.
--
-- Two-sided by design: expected is snapshotted at submission (so a later comp
-- plan edit cannot rewrite what we believed we were owed), received is recorded
-- at funding, and the difference is the only thing that can surface a
-- short-pay. Marking a submission "funded" now requires the funding details.
--
-- Deliberately NULLABLE and NOT backfilled: submissions that predate this have
-- no captured expectation, and computing one retroactively from today's comp
-- plan would invent a revenue record. They report as "pending" — an honest gap.
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "compensation_model" varchar(20);--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "compensation_expected_bps" integer;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "compensation_expected_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "compensation_received_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "compensation_received_at" timestamp;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "compensation_recorded_by" varchar;--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "funded_loan_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "funded_at" timestamp;
