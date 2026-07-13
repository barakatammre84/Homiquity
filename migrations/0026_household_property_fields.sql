-- 0026: Reconcile drifted loan_applications columns (VA zero-down intake).
-- household_family_size + home_square_footage were added to shared/schema
-- (server-side commit 8063bb0 "VA zero-down decisioning") via db:push and never
-- captured in a migration, so the shared dev DB had them but PROD (migrate-only)
-- did not. The deployed code does db.select().from(loanApplications) — a
-- full-column SELECT that includes these two — so every read of the table
-- (dashboard, team-members, AI coach read + writeback) 500'd in prod with
-- `column "household_family_size" does not exist`.
--
-- Nullable integers, exactly as the schema declares them (VA residual-income
-- inputs; NULL = not asked/answered). Additive + idempotent; hand-authored.
-- (0024 = lender-condition link #147; 0025 = change_of_circumstances #148.)

ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "household_family_size" integer;
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "home_square_footage" integer;
