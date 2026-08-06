-- Audit FA-20 / FA-21 (2026-08-06 financial re-audit).
--
-- FA-20 — pin the platform fee schedule to a file at first Loan Estimate
-- issuance. Fees became admin-editable at runtime in #385, and four of the
-- lines they set are ZERO-tolerance under §1026.19(e)(3)(i). Because every
-- consumer resolved the schedule late, publishing a new schedule raised those
-- lines on every file already in flight — and a creditor re-pricing itself is
-- not a §1026.19(e)(3)(iv) changed circumstance, so each affected file became
-- a dollar-for-dollar cure. Measured on the repo's own functions, a modest
-- re-price produced $546–$1,300 per file on borrower-paid compensation.
--
-- FA-21 — record which charges a change of circumstance actually affects.
-- The tolerance evaluator took a bare boolean, so any open CoC authorised
-- every increase on the file.
--
-- Both columns are ADDITIVE and NULLABLE (expand phase). NULL is meaningful in
-- both cases and is never backfilled with a guessed value:
--   * fee_schedule_version NULL = a disclosure issued before pinning existed;
--     that file keeps resolving the active schedule, exactly as it did before.
--   * affected_charge_ids  NULL = unscoped, preserving historical behaviour.
--
-- No data migration, no constraint that can fail on existing rows, so there is
-- nothing here for a contract-migration data probe to check.

ALTER TABLE "loan_estimate_disclosures"
  ADD COLUMN IF NOT EXISTS "fee_schedule_version" integer;

ALTER TABLE "change_of_circumstances"
  ADD COLUMN IF NOT EXISTS "affected_charge_ids" jsonb;
