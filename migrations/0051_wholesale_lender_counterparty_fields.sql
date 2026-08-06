-- Wholesale lender counterparty fields.
--
-- WHY: two parallel lender sources existed. `shared/wholesaleLenders.ts` held a
-- hardcoded Target-5 array carrying the counterparty authorization (may we send
-- a borrower's file to this company?), while the `wholesale_lenders` table held
-- the real lender/product/requirement data the pricing engine reads. Submission
-- and pricing therefore disagreed about who our lenders are. This collapses
-- them onto the table; these columns are what the table was missing.
--
-- FAIL-CLOSED BY CONSTRUCTION: `approval_status` defaults to 'target', so every
-- pre-existing row — including the seeded demo lenders — becomes NOT approved
-- the moment this lands. Nothing is silently promoted. `status = 'ACTIVE'` is a
-- row-liveness flag and was never an agreement; conflating the two would have
-- transmitted borrower PII to companies with no broker agreement.
--
-- `epo_clawback_days` is deliberately NULLable: NULL means NO AGREEMENT EXISTS
-- YET, not "no clawback". Every wholesale broker agreement contains an EPO
-- clause, so a 0 here would be a falsified record. Consumers treat NULL as an
-- explicit assumption (DEFAULT_EPO_CLAWBACK_DAYS).
--
-- Expand-only and idempotent: additive columns with defaults, safe against the
-- currently-deployed app, which simply ignores them.

ALTER TABLE "wholesale_lenders" ADD COLUMN IF NOT EXISTS "approval_status" varchar(30) DEFAULT 'target' NOT NULL;
ALTER TABLE "wholesale_lenders" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "wholesale_lenders" ADD COLUMN IF NOT EXISTS "non_qm" boolean DEFAULT false NOT NULL;
ALTER TABLE "wholesale_lenders" ADD COLUMN IF NOT EXISTS "aus_support" text[];
ALTER TABLE "wholesale_lenders" ADD COLUMN IF NOT EXISTS "epo_clawback_days" integer;
ALTER TABLE "wholesale_lenders" ADD COLUMN IF NOT EXISTS "specialty" varchar(255);

-- Mark the seeded sample counterparties. These are fictional companies that
-- exist so pricing/best-execution has something to quote in dev and the beta
-- walkthrough; they must never receive a borrower file. The submission gate
-- hard-blocks on is_demo independently of approval_status, so this flag is a
-- second, non-bypassable lock rather than a label.
UPDATE "wholesale_lenders"
   SET "is_demo" = true
 WHERE "lender_id" LIKE 'SAMPLE-%'
    OR "contact_email" LIKE '%@%.example';

CREATE INDEX IF NOT EXISTS "idx_wholesale_lenders_approval" ON "wholesale_lenders" ("approval_status");
