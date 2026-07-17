-- 0033: unify tasks.status onto the declared canonical vocabulary
--        (OPEN, IN_PROGRESS, BLOCKED, COMPLETED, EXPIRED).
--
-- The column held two live vocabularies: the task engine wrote the canonical
-- uppercase set while pipelineEngine.generateDocumentTasks wrote lowercase
-- "pending" and the legacy upload/verify routes wrote "submitted"/"verified".
-- Consequence: SLA/escalation sweeps (inArray on the uppercase set) never saw
-- legacy rows, and the borrower dashboard — which compared lowercase literals,
-- some of them verification_status values — kept rendering engine-COMPLETED
-- tasks as open action items. The same PR retires every lowercase writer and
-- $types the column, so post-deploy only canonical values can be written.
--
-- VALUE-MAPPING UPDATE, not a contract step — no constraint is added, so this
-- cannot abort on data. Pre-flight probe against PROD (read-only, through CI
-- per DB_MIGRATIONS.md §Contract migrations; CI run 29592579846, 2026-07-17):
--     prod tasks table: 0 rows total — every UPDATE below is a no-op in prod.
--     column shape: status nullable=NO default='OPEN' maxlen=50 (ledger current).
-- Dev DB distribution (verified locally, 2026-07-17): "pending"=1015, "OPEN"=268;
-- verification_status all NULL. The mapping below therefore rewrites dev (and
-- any environment cloned from it); prod is covered for the merge→deploy race
-- window in which the still-running old code could write one of the three
-- legacy values ("pending" on intake, "submitted" on doc link, "verified" on
-- doc verify — the only lowercase values any writer ever produced).
--
-- Semantic mapping (lifecycle vs verification axis):
--   pending   → OPEN         (borrower still has to act)
--   submitted → IN_PROGRESS  + verification_status 'pending' (doc uploaded,
--               staff verdict outstanding — that verdict is verification_status
--               data, not a lifecycle state)
--   verified  → COMPLETED    + verification_status 'verified'; completed_at is
--               backfilled from verified_at ONLY (the moment verification
--               completed the task — never a guessed timestamp).
-- Idempotent: each UPDATE matches only the legacy value it retires.
UPDATE "tasks" SET "status" = 'OPEN' WHERE "status" = 'pending';--> statement-breakpoint
UPDATE "tasks"
   SET "status" = 'IN_PROGRESS',
       "verification_status" = COALESCE("verification_status", 'pending')
 WHERE "status" = 'submitted';--> statement-breakpoint
UPDATE "tasks"
   SET "status" = 'COMPLETED',
       "verification_status" = COALESCE("verification_status", 'verified'),
       "completed_at" = COALESCE("completed_at", "verified_at")
 WHERE "status" = 'verified';
