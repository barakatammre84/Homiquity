-- Per-lender MISMO package assembly (LS-10 slice 2): persist the exact MISMO
-- 3.4 XML sent at submission time as an immutable snapshot, plus a sha256
-- hash for tamper-evident audit. Additive-only, safe alongside other branches.
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "mismo_package_xml" text;
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "mismo_package_hash" varchar(64);
ALTER TABLE "lender_submissions" ADD COLUMN IF NOT EXISTS "mismo_package_generated_at" timestamp;
