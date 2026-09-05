-- Additive document provenance for the existing upload flow. Existing documents
-- remain readable; new and subsequently mapped versions gain immutable byte and
-- ownership metadata without copying borrower values or file contents.
CREATE TABLE IF NOT EXISTS "document_lineage" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "document_id" varchar NOT NULL REFERENCES "documents"("id"),
  "lineage_id" varchar NOT NULL,
  "version_number" integer NOT NULL,
  "replaces_document_id" varchar REFERENCES "documents"("id"),
  "content_sha256" varchar(64),
  "subject_type" varchar(30) NOT NULL,
  "subject_id" varchar NOT NULL,
  "period_start" varchar(10),
  "period_end" varchar(10),
  "tax_year" integer,
  "recorded_by_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "document_lineage_document_unique" UNIQUE ("document_id"),
  CONSTRAINT "document_lineage_version_unique" UNIQUE ("application_id", "lineage_id", "version_number"),
  CONSTRAINT "document_lineage_version_positive" CHECK ("version_number" > 0),
  CONSTRAINT "document_lineage_subject_type" CHECK ("subject_type" IN ('application','borrower','business','property')),
  CONSTRAINT "document_lineage_hash_shape" CHECK ("content_sha256" IS NULL OR "content_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "document_lineage_period_order" CHECK ("period_start" IS NULL OR "period_end" IS NULL OR "period_start" <= "period_end")
);
CREATE INDEX IF NOT EXISTS "idx_document_lineage_application" ON "document_lineage" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_document_lineage_lineage" ON "document_lineage" ("lineage_id");
CREATE INDEX IF NOT EXISTS "idx_document_lineage_subject" ON "document_lineage" ("application_id", "subject_type", "subject_id");
