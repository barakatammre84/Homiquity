-- Lender-condition tracker: link loan_conditions rows to the wholesale-lender
-- submission that issued them (staff transcribe conditions from the lender's
-- portal; internally-generated conditions keep a NULL link).
ALTER TABLE "loan_conditions" ADD COLUMN IF NOT EXISTS "lender_submission_id" varchar REFERENCES "lender_submissions"("id");
CREATE INDEX IF NOT EXISTS "loan_conditions_lender_submission_idx" ON "loan_conditions" ("lender_submission_id");
