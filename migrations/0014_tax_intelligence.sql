-- 0014: Situation Identification Engine (UAL program P2a)
-- Wires the orphaned Document Intelligence tables (baseline 0000) into the live
-- upload flow: a tax_extraction_runs ledger for multi-form extraction runs, a
-- bridge from logical_documents to the `documents` row + per-form lineage, and
-- page attribution on extracted_fields without requiring rasterized page rows.
--
-- NOTE ON NUMBERING: 0013 is reserved by the self-employment worksheet
-- migration on branch worktree-se-income-references (UAL program P1) — this
-- file is numbered 0014 to avoid colliding with it regardless of merge order.
-- Hand-authored (drizzle-kit generate has snapshot drift in this repo) and
-- idempotent so it can be applied to the shared dev database as targeted ALTERs.

CREATE TABLE IF NOT EXISTS "tax_extraction_runs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" varchar NOT NULL REFERENCES "documents"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "application_id" varchar REFERENCES "loan_applications"("id"),

  "status" varchar(20) NOT NULL DEFAULT 'running',
  "simulated" boolean NOT NULL DEFAULT false,
  "error" text,

  "model_id" varchar(100),
  "prompt_version" varchar(50),
  "classification_response_hash" varchar(64),
  "classification_raw_encrypted" text,
  "classification_raw_iv" varchar(32),
  "classification_raw_key_id" varchar(20),

  "page_count" integer,
  "form_count" integer,
  "overall_confidence" numeric(5,4),

  "started_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_extraction_runs_document" ON "tax_extraction_runs" ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_extraction_runs_user" ON "tax_extraction_runs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tax_extraction_runs_status" ON "tax_extraction_runs" ("status");
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "source_document_id" varchar REFERENCES "documents"("id");
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "extraction_run_id" varchar REFERENCES "tax_extraction_runs"("id");
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "page_start" integer;
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "page_end" integer;
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "k1_variant" varchar(10);
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "model_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "prompt_version" varchar(50);
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "raw_response_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "raw_response_encrypted" text;
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "raw_response_iv" varchar(32);
--> statement-breakpoint
ALTER TABLE "logical_documents" ADD COLUMN IF NOT EXISTS "raw_response_key_id" varchar(20);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logical_docs_source_doc" ON "logical_documents" ("source_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_logical_docs_run" ON "logical_documents" ("extraction_run_id");
--> statement-breakpoint
ALTER TABLE "extracted_fields" ALTER COLUMN "page_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD COLUMN IF NOT EXISTS "page_number" integer;
