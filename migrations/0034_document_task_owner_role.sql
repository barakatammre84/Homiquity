-- 0034: borrower-assigned document_request tasks carry owner_role 'BORROWER'.
--
-- pipelineEngine.generateDocumentTasks (and the StaffDashboard create-task
-- dialog via POST /api/tasks) created document_request tasks assigned to the
-- borrower (assigned_to_user_id = the application owner) without setting
-- owner_role, so every row inherited the column's 'PROCESSOR' default.
-- Consequence: the borrower sidebar badge (my-tasks/pending-count), the shell
-- badges endpoint, BorrowerRequests, and getBorrowerTasks — which all filter
-- on owner_role = 'BORROWER' — missed every one of these tasks, while the
-- staff processor queue (tasks/by-role) showed 1,000+ "Upload: …" items no
-- processor can act on. The same PR makes both writers stamp/derive BORROWER
-- (deriveDocumentTaskOwnerRole in shared/schema/underwritingTasks.ts).
--
-- VALUE-MAPPING UPDATE, not a contract step — no constraint is added, so this
-- cannot abort on data. Pre-flight probe against PROD (read-only, through CI
-- per DB_MIGRATIONS.md; CI run 29592579846, 2026-07-17): prod tasks table had
-- 0 rows — this UPDATE is a no-op in prod. It exists for dev/preview clones
-- and for any prod rows the still-deployed old writers create before the next
-- deploy cutover (idempotent and re-runnable if that window ever matters;
-- prod signups are beta-gated, so the realistic count is zero).
--
-- Dev DB distribution (verified locally, 2026-07-17): 1,277 document_request
-- tasks, all PROCESSOR. 1,015 are assigned to their application's owner →
-- remapped to BORROWER. The other 262 (disjoint: all carry a task_type_code)
-- are unassigned document-intelligence review items — staff work, untouched.
--
-- Predicate = the same rule the runtime now applies: a document_request whose
-- assignee IS the application owner is borrower work. owner_role = 'PROCESSOR'
-- scopes the rewrite to rows that got the default; an explicitly chosen
-- non-PROCESSOR owner survives. Lifecycle status is orthogonal — completed
-- rows are remapped too so role metrics stay honest.
UPDATE "tasks" AS t
   SET "owner_role" = 'BORROWER'
  FROM "loan_applications" AS la
 WHERE la."id" = t."application_id"
   AND t."task_type" = 'document_request'
   AND t."owner_role" = 'PROCESSOR'
   AND t."assigned_to_user_id" = la."user_id";
