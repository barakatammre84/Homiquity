-- 0015: Borrower business entities (UAL program P2b — entity resolution)
-- One row per distinct business entity resolved from a borrower's extracted
-- tax forms (three Schedule Cs = three entities; a K-1 and its parent 1065
-- with the same EIN = one entity). Auto-resolved rows are refreshed by
-- upsert on (user_id, identity_key); logical_documents gains the link back.
-- Idempotent; hand-authored (no drizzle-kit generate).

CREATE TABLE IF NOT EXISTS "borrower_business_entities" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "application_id" varchar REFERENCES "loan_applications"("id"),

  -- Deterministic identity: 'ein:<last4>' when an EIN was read, else
  -- 'name:<normalized name>'. Unique per user.
  "identity_key" varchar(300) NOT NULL,
  "entity_type" varchar(30) NOT NULL,
  "name" varchar(255),
  "ein_last4" varchar(4),
  "ownership_percent" numeric(5,2),

  -- Coverage summary from the resolved source forms
  "first_tax_year" integer,
  "last_tax_year" integer,
  "source_form_count" integer NOT NULL DEFAULT 0,
  "resolution_notes" text,

  -- Auto-resolved rows may be refreshed; a human-confirmed row is not
  -- overwritten by re-resolution (P5 workbench sets this false on confirm).
  "auto_resolved" boolean NOT NULL DEFAULT true,

  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_borrower_entities_user_identity" ON "borrower_business_entities" ("user_id", "identity_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_borrower_entities_user" ON "borrower_business_entities" ("user_id");
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "business_entity_id" varchar REFERENCES "borrower_business_entities"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logical_docs_entity" ON "logical_documents" ("business_entity_id");
