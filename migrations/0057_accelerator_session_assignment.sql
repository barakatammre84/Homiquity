-- 0057: name the loan officer who owns a 1:1 accelerator session.
--
-- The borrower-facing flow used to write a `coaching_sessions` row with the
-- table's default status ("scheduled") and tell the borrower "Coaching session
-- has been scheduled." Nothing on the staff side ever read that table:
-- storage.getCoachingSessions had exactly one caller in the whole codebase, the
-- borrower's own page. So the borrower held an appointment nobody at Homiquity
-- knew existed.
--
-- The fix separates the two facts that were being conflated — the borrower ASKS
-- ("requested"), a loan officer ACCEPTS ("confirmed") — which mirrors the intake
-- inbox for self-serve applicants who arrive with no LO
-- (/api/pipeline/unassigned -> claim -> assignLoanOfficer). That needs somewhere
-- to record WHICH loan officer accepted, and the table has no such column.
--
-- Expand-only and idempotent:
--   * ADD COLUMN, nullable, no DEFAULT / NOT NULL / CHECK — catalog-only, so
--     there is no table rewrite and no existing row can violate it.
--   * NULL is the honest value for every existing row and for every session a
--     loan officer has not accepted yet. Nothing is backfilled: no prior row
--     records who would have taken the meeting, and inventing one would falsify
--     an assignment record.
--   * CREATE INDEX IF NOT EXISTS is a no-op on re-run.
--
-- The status vocabulary itself stays uncontrained at the DB level, exactly as it
-- was: it is a varchar(20) with a default, and adding a CHECK would be a
-- contract migration that could fail on existing rows. shared/acceleratorProgram.ts
-- holds the vocabulary and the route validates against it.

ALTER TABLE "coaching_sessions" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" varchar;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_coaching_sessions_status" ON "coaching_sessions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_coaching_sessions_assigned" ON "coaching_sessions" ("assigned_to_user_id");
