-- 0043: who pays a rate-lock extension fee (audit finding F-10)
-- Expand-only, idempotent. The currently-deployed app tolerates the new
-- columns and vice-versa.
--
-- rate_locks.extension_fee recorded an AMOUNT with no payer. In the wholesale
-- model the lender charges the BROKER for an extension (commonly ~1-2 bps/day,
-- so a few hundred dollars per 15-day extension on a typical loan), and whether
-- that lands on our P&L or is passed to the borrower is the entire economic
-- content of the transaction. Worse, passing it to the borrower without a
-- documented changed circumstance is a TRID tolerance violation.
--
--   extension_fee_paid_by: borrower | broker | lender
--     (vocabulary: shared/schema/lendingRatesOps.ts EXTENSION_FEE_PAYERS)
--   extension_fee_coc_id:  the 1026.19(e)(3)(iv) record authorizing a
--     borrower-paid fee. Required by the route whenever paid_by = 'borrower'.
--
-- Deliberately NULLABLE and NOT backfilled: existing rows genuinely have no
-- recorded payer, and guessing one would falsify a fee record.
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "extension_fee_paid_by" varchar(20);--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "extension_fee_coc_id" varchar;
