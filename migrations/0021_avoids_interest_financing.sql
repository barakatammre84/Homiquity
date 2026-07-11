-- 0021: Interest-avoiding financing preference (UAL program P7, funder-agnostic)
-- Borrower-declared intake answer to "Do you require financing that avoids
-- interest?" — a product-preference ROUTING signal (feeds
-- SituationProfile.halalNeed), never an underwriting input or a faith
-- classification. Nullable: NULL = not asked/answered (pre-existing
-- applications and API callers that omit it), distinct from an explicit "no".
-- Additive + idempotent; hand-authored. (0020 is reserved by the LO-2
-- scenario_runs branch, PR #114.)

ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "avoids_interest_financing" boolean;
