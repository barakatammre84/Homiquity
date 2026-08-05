-- 0050: FCRA §615(a) adverse-action basis columns (finding WF5-F2, CONFIRMED-DEFECT
-- under 15 U.S.C. §1681m(a) per the 2026-08-05 compliance-auditor adjudication).
--
-- based_on_consumer_report: explicit record of whether the adverse action was
-- "based in whole or in part on any information contained in a consumer report"
-- (15 U.S.C. §1681m(a)) — the statutory trigger for every §615(a) disclosure
-- (CRA identification, score disclosure, free-report right, dispute right).
-- Before this column, a NULL bureau_name row was ambiguous between "genuinely
-- not report-based" and "the auto-deny path dropped the basis" (the defect).
--
-- fcra_compliant loses its DEFAULT true. The value is now COMPUTED per notice by
-- computeFcraCompliant() in server/services/creditAdverseActions.ts (it asserts
-- "this notice contains every §615(a) disclosure applicable to the facts of this
-- action") — a DB default that stamps true regardless of content is exactly the
-- defect being fixed. Existing row values are left untouched.
--
-- Why this cannot fail on existing rows (no prod data probe needed under
-- DB_MIGRATIONS.md §Contract migrations):
--   * ADD COLUMN: nullable, no DEFAULT, no CHECK, no FK — catalog-only change.
--   * DROP DEFAULT: metadata-only; never examines rows; a re-run is a no-op.
--   * IF NOT EXISTS makes the ADD COLUMN re-runnable.
--
-- NOT backfilled, deliberately. Rows generated before this fix cannot have
-- their §615(a) basis reconstructed after the fact, and a guessed value on a
-- compliance/audit column is a falsified record — NULL is the honest gap
-- (house rule: never backfill a guessed value on a provenance/audit column).

ALTER TABLE "adverse_actions" ADD COLUMN IF NOT EXISTS "based_on_consumer_report" boolean;--> statement-breakpoint
COMMENT ON COLUMN "adverse_actions"."based_on_consumer_report" IS 'FCRA 15 U.S.C. 1681m(a) trigger: action based in whole or in part on a consumer report. Writer contract: set explicitly by server/services/creditAdverseActions.ts on every new row; NULL means the row predates this column and its basis is unknown — never backfill.';--> statement-breakpoint
ALTER TABLE "adverse_actions" ALTER COLUMN "fcra_compliant" DROP DEFAULT;--> statement-breakpoint
COMMENT ON COLUMN "adverse_actions"."fcra_compliant" IS 'Computed per notice by computeFcraCompliant() (server/services/creditAdverseActions.ts): true only when every 615(a) disclosure applicable to the facts of the action is present in the notice. Never stamped true unconditionally.';
