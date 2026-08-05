-- 0046: admin-editable platform fee schedule (audit findings F-17 / F-19)
-- Expand-only, idempotent, NEW table only. The currently-deployed app tolerates
-- it (it simply never reads it) and the new app tolerates its absence of rows.
--
-- The platform's own charges — application fee, underwriting fee, tax service
-- fee, and the borrower-paid origination rate — were compile-time constants, so
-- re-pricing required a code change and a deploy. They are also compliance
-- relevant: they are disclosed on the Loan Estimate and they consume the QM
-- points-and-fees cap alongside originator compensation.
--
-- APPEND-ONLY BY DESIGN. A fee schedule is a fact about how a file was priced
-- at a point in time. Overwriting it would make an already-issued disclosure
-- unreproducible, so publishing a new schedule supersedes the old row rather
-- than updating it, and both are retained.
--
-- NO SEED ROW, DELIBERATELY. An empty table is valid and means "use the code
-- defaults" (DEFAULT_PLATFORM_FEE_SCHEDULE in server/services/loanCosts.ts).
-- Inserting the current constants here would fork the baseline in two places
-- and let them drift silently. The constants stay authoritative until an admin
-- deliberately publishes over them.
--
-- Every column is NOT NULL, which is safe precisely because the table is new
-- and therefore has no existing rows to fail the constraint (see CLAUDE.md on
-- contract migrations — this is not one).
CREATE TABLE IF NOT EXISTS "platform_fee_schedules" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" integer NOT NULL,
  "application_fee" numeric(10, 2) NOT NULL,
  "underwriting_fee" numeric(10, 2) NOT NULL,
  "tax_service_fee" numeric(10, 2) NOT NULL,
  "origination_fee_rate" numeric(6, 5) NOT NULL,
  "effective_from" timestamp DEFAULT now() NOT NULL,
  "superseded_at" timestamp,
  "note" text,
  "created_by" varchar,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "platform_fee_schedules_version_unique" UNIQUE ("version")
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform_fee_schedules"
    ADD CONSTRAINT "platform_fee_schedules_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_platform_fee_schedules_active"
  ON "platform_fee_schedules" ("superseded_at");--> statement-breakpoint
-- Exactly one active schedule. The publish path supersedes-then-inserts inside
-- a transaction; this index is the backstop that makes a concurrent double
-- publish fail loudly instead of leaving two rows claiming to be current.
CREATE UNIQUE INDEX IF NOT EXISTS "platform_fee_schedules_single_active"
  ON "platform_fee_schedules" ((1)) WHERE "superseded_at" IS NULL;
