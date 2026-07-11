-- 0018: Income review workbench + bank-statement capture (UAL program P5)
-- review_items: the exception-only workbench's actionable findings (only the
-- one_click/flagged tiers persist; auto-accepted data never becomes a row).
-- bank_statement_analyses: the capture surface for the cited Angel Oak
-- bank-statement income math (P4's named gap), append-only, latest row wins.
-- Idempotent; hand-authored.

CREATE TABLE IF NOT EXISTS "review_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "application_id" varchar REFERENCES "loan_applications"("id"),

  "natural_key" varchar(300) NOT NULL,
  "item_type" varchar(40) NOT NULL,
  "tier" varchar(20) NOT NULL,

  "title" varchar(300) NOT NULL,
  "detail" text NOT NULL,
  "evidence" jsonb,

  "status" varchar(20) NOT NULL DEFAULT 'open',
  "corrected_value" text,
  "resolution_note" text,
  "resolved_by" varchar REFERENCES "users"("id"),
  "resolved_at" timestamp,

  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_review_items_user_key" ON "review_items" ("user_id", "natural_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_review_items_user_status" ON "review_items" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_review_items_app_status" ON "review_items" ("application_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bank_statement_analyses" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),

  "months" integer NOT NULL,
  "total_eligible_deposits" numeric(14,2) NOT NULL,
  "expense_factor" numeric(5,4),
  "has_third_party_expense_statement" boolean NOT NULL DEFAULT false,
  "notes" text,

  "entered_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bank_stmt_analyses_app" ON "bank_statement_analyses" ("application_id", "created_at");
