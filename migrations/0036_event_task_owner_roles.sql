-- 0036: align existing event-task rows with the seeded per-code default owners.
--
-- task_type_sla_mapping shipped EMPTY for the task engine's whole life, so
-- taskEngine.createTask's mapping lookup never fired and every event-emitted
-- task (DOC_REVIEW, PA_GENERATE, CMP_ADVERSE_ACTION, …) fell back to
-- owner_role 'PROCESSOR'. The same PR seeds the mapping table boot-time
-- (server/seedData/taskEngineSla.ts), which fixes FUTURE tasks; this remaps
-- the rows already written for the codes whose seeded default is not
-- PROCESSOR, so role queues and metrics stop misattributing them.
--
-- VALUE-MAPPING UPDATE, not a contract step — no constraint is added, so this
-- cannot abort on data. Prod probe evidence (read-only through CI per
-- DB_MIGRATIONS.md; run 29592579846, 2026-07-17): prod tasks table had 0 rows,
-- and the table only gains rows via gated-beta traffic — every statement below
-- is a no-op in prod today. Dev distribution (verified locally, 2026-07-17):
-- task-coded rows are DOC_REVIEW=218, OCR_QUALITY=44 (both stay PROCESSOR),
-- PA_GENERATE=4 (→LO), CMP_ADVERSE_ACTION=2 (→ADMIN); the other codes below
-- have no rows yet and are covered for completeness (and for any environment
-- cloned from dev after they appear).
--
-- The code→role pairs MIRROR the seed's defaultOwnerRole exactly
-- (tests/taskEngineSlaSeed.test.ts asserts this file and the seed agree).
-- owner_role = 'PROCESSOR' scopes each statement to rows that got the old
-- fallback; an explicitly assigned owner survives. slaDueAt is deliberately
-- NOT backfilled: fabricating deadlines for months-old rows would mark them
-- all breached; deadlines start at the first task created after the seed.
UPDATE "tasks" SET "owner_role" = 'LO'     WHERE "owner_role" = 'PROCESSOR' AND "task_type_code" IN ('INTAKE_REVIEW', 'PA_GENERATE');--> statement-breakpoint
UPDATE "tasks" SET "owner_role" = 'UW'     WHERE "owner_role" = 'PROCESSOR' AND "task_type_code" IN ('UW_START', 'ELIG_COND_CLEAR', 'CRD_SCORE_CHANGE', 'CRD_NEW_TRADELINE', 'INC_CHANGE', 'AST_DECREASE');--> statement-breakpoint
UPDATE "tasks" SET "owner_role" = 'CLOSER' WHERE "owner_role" = 'PROCESSOR' AND "task_type_code" = 'CMP_CLOSING_DISC';--> statement-breakpoint
UPDATE "tasks" SET "owner_role" = 'ADMIN'  WHERE "owner_role" = 'PROCESSOR' AND "task_type_code" = 'CMP_ADVERSE_ACTION';
