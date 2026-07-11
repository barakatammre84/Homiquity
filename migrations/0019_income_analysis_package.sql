-- 0019: Income analysis package on lender submissions (UAL program P6)
-- Additive trio on lender_submissions mirroring the immutable MISMO package
-- columns: the cited income narrative sent to the wholesale lender alongside
-- the MISMO 3.4 XML, hashed for tamper-evident audit. Idempotent; hand-authored.

ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "income_package_json" jsonb;
--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "income_package_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "income_package_generated_at" timestamp;
