-- Additive only: existing applications, accounts and documents remain authoritative.
-- Checkpoints contain counts/digests, never copied borrower values or file bytes.
CREATE TABLE IF NOT EXISTS "file_review_checkpoints" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "version" integer NOT NULL CHECK ("version" > 0),
  "revision" varchar(64) NOT NULL,
  "manifest" jsonb NOT NULL,
  "reviewed_by" varchar NOT NULL REFERENCES "users"("id"),
  "reviewed_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "file_review_application_version" UNIQUE ("application_id", "version")
);
