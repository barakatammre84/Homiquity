-- 0034: unify tasks.priority onto the canonical vocabulary
--        (low, normal, high, urgent) and retire the uppercase column default.
--
-- Sibling of 0033 (tasks.status): the column declared LOW/NORMAL/HIGH/CRITICAL
-- but no reader ever matched that set — the borrower/staff badge maps and the
-- lending dashboard's action-item sort all speak lowercase, and the pipeline
-- engine's document tasks write lowercase "high"/"normal". The only uppercase
-- producers were the task engine's createTask fallback and the column default,
-- both 'NORMAL': those rows rendered as Normal purely via the badge fallback
-- and took the default sort rank. "CRITICAL" was never written by any code
-- path; its canonical spelling is "urgent", the tier every reader styles. The
-- same PR $types the column, z.enums insertTaskSchema.priority, and retires
-- both uppercase writers, so post-deploy only canonical values can be written.
--
-- VALUE-MAPPING UPDATE + DEFAULT swap, not a contract step — nothing here can
-- abort on data. Pre-flight probe against PROD (read-only, through CI per
-- DB_MIGRATIONS.md §Contract migrations): CI run 29592579846 (2026-07-17, the
-- 0033 probe — its output covers this column too) reported:
--     prod tasks table: 0 rows total; priority distribution empty — every
--     statement below is a no-op in prod today.
--     column shape: priority nullable=YES default='NORMAL' maxlen=20.
-- Dev DB distribution (verified locally, 2026-07-17):
--     high=566, normal=449, NORMAL=268 — no NULLs, no other values. The
--     mapping below therefore rewrites 268 dev rows (and any environment
--     cloned from dev). In prod it also covers the merge→deploy window in
--     which the still-running old code's task-engine fallback could write
--     'NORMAL' (the only legacy value any writer still produces); readers
--     fall back to normal for anything written into that gap after this runs.
--
-- Idempotent — each statement matches only the legacy value it retires; the
-- LOW/HIGH/CRITICAL rows are defensive (declared, never observed anywhere).
ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'normal';--> statement-breakpoint
UPDATE "tasks" SET "priority" = 'low' WHERE "priority" = 'LOW';--> statement-breakpoint
UPDATE "tasks" SET "priority" = 'normal' WHERE "priority" = 'NORMAL';--> statement-breakpoint
UPDATE "tasks" SET "priority" = 'high' WHERE "priority" = 'HIGH';--> statement-breakpoint
UPDATE "tasks" SET "priority" = 'urgent' WHERE "priority" = 'CRITICAL';
