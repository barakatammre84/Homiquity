-- 0032: Persist the human document-review decision (borrower document portal,
-- review-loop PR). Previously POST /api/documents/:id/verify recorded the
-- rejection reason only in the audit log, so the borrower could never see WHY
-- a document bounced and no reviewer/timestamp was queryable.
--
-- Expand-only + idempotent: new nullable columns, no backfill, no constraint
-- changes — the currently-deployed app tolerates the new shape and vice versa.
-- `documents.notes` remains reserved for AI-extraction lineage.
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" varchar REFERENCES "users"("id");
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
