-- 0040: lender-side confirmation on rate locks (audit finding F-3)
-- Expand-only, idempotent. The currently-deployed app tolerates the new
-- columns and vice-versa.
--
-- A broker cannot lock a rate; only the wholesale lender can. Before this,
-- POST /api/rate-locks created a 15-90 day rate commitment purely from an
-- internal loan option — no lender, no confirmation number, nothing anyone
-- outside this system was obliged to honor.
--
-- The six confirmation columns are deliberately NULLABLE and deliberately NOT
-- backfilled. Rows written before this migration genuinely have no lender
-- confirmation; inventing a confirmation number would falsify a commitment
-- record. They resolve to "unconfirmed quote" via
-- shared/rateLockConfirmation.ts, which is what they always were. New locks
-- cannot be created without these fields.
--
-- `simulated` is the one exception, and it IS written to every pre-existing
-- row: it is NOT NULL DEFAULT true. That is not a guess dressed as a fact —
-- before this migration no lock could be lender-confirmed at all, so `true`
-- is the provably correct value for every historical row rather than an
-- invented one. Defaulting it to false, or leaving it nullable, would let an
-- unconfirmed legacy quote read as a real lender lock. PG11+ materializes a
-- constant default without rewriting the table, so this is still safe on a
-- populated table.
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "lender_id" varchar(40);--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "lock_confirmation_number" varchar(60);--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "confirmed_rate" numeric(5, 3);--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "confirmed_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "confirmed_by" varchar;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD COLUMN IF NOT EXISTS "simulated" boolean DEFAULT true NOT NULL;
