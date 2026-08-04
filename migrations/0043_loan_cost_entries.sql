-- 0042: per-file cost ledger — the unit-economics cost side (audit finding F-11)
-- Expand-only, idempotent: a new table plus its index. Nothing existing is
-- altered, so the currently-deployed app is unaffected by its presence.
--
-- The platform had a revenue side (0041) and no cost side at all: no
-- cost-per-file, no vendor invoice tracking, no commission. Gross margin per
-- loan was uncomputable, and the one recurring hard cost the platform itself
-- triggers — credit pulls, which the task engine deliberately re-runs via
-- CRD_EXPIRED — was unmetered.
--
-- Immutable by convention: a correction is a new (negative) reversal row, never
-- an edit, so the ledger stays auditable. `simulated` keeps spend behind
-- still-simulated vendor adapters out of any real margin figure.
CREATE TABLE IF NOT EXISTS "loan_cost_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "category" varchar(30) NOT NULL,
  "vendor" varchar(100),
  "amount" numeric(12, 2) NOT NULL,
  "incurred_at" timestamp DEFAULT now() NOT NULL,
  "automatic" boolean DEFAULT false NOT NULL,
  "simulated" boolean DEFAULT false NOT NULL,
  "description" text,
  "recorded_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_cost_entries_app_idx" ON "loan_cost_entries" ("application_id", "incurred_at");
