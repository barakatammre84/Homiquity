-- Immutable officer-reviewed financial workpapers and memo versions. Existing
-- URLA, income-path and document records remain authoritative; these tables
-- preserve the exact safe projection and evidence versions used at signoff.
CREATE TABLE IF NOT EXISTS "financial_workpaper_versions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "workpaper_key" varchar(220) NOT NULL,
  "kind" varchar(40) NOT NULL,
  "subject_id" varchar NOT NULL,
  "subject_label" varchar(255) NOT NULL,
  "version_number" integer NOT NULL,
  "input_fingerprint" varchar(64) NOT NULL,
  "input_snapshot" jsonb NOT NULL,
  "output_snapshot" jsonb NOT NULL,
  "source_references" jsonb NOT NULL,
  "dependency_version_ids" varchar[] NOT NULL DEFAULT '{}',
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "financial_workpaper_application_key_version" UNIQUE ("application_id", "workpaper_key", "version_number"),
  CONSTRAINT "financial_workpaper_version_positive" CHECK ("version_number" > 0),
  CONSTRAINT "financial_workpaper_fingerprint_shape" CHECK ("input_fingerprint" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS "idx_financial_workpaper_application" ON "financial_workpaper_versions" ("application_id");
CREATE INDEX IF NOT EXISTS "idx_financial_workpaper_key" ON "financial_workpaper_versions" ("application_id", "workpaper_key");

CREATE TABLE IF NOT EXISTS "financial_workpaper_reviews" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "workpaper_version_id" varchar NOT NULL REFERENCES "financial_workpaper_versions"("id"),
  "action" varchar(10) NOT NULL,
  "reason" text NOT NULL,
  "reviewed_by" varchar NOT NULL REFERENCES "users"("id"),
  "reviewed_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "financial_workpaper_review_version_unique" UNIQUE ("workpaper_version_id"),
  CONSTRAINT "financial_workpaper_review_action" CHECK ("action" IN ('approve','reject'))
);

CREATE TABLE IF NOT EXISTS "credit_memo_versions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "version_number" integer NOT NULL,
  "input_fingerprint" varchar(64) NOT NULL,
  "workpaper_version_ids" varchar[] NOT NULL DEFAULT '{}',
  "sections" jsonb NOT NULL,
  "reference_index" jsonb NOT NULL,
  "package_hash" varchar(64) NOT NULL,
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "credit_memo_application_version" UNIQUE ("application_id", "version_number"),
  CONSTRAINT "credit_memo_version_positive" CHECK ("version_number" > 0),
  CONSTRAINT "credit_memo_input_fingerprint_shape" CHECK ("input_fingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "credit_memo_package_hash_shape" CHECK ("package_hash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS "idx_credit_memo_application" ON "credit_memo_versions" ("application_id");

CREATE TABLE IF NOT EXISTS "credit_memo_reviews" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "memo_version_id" varchar NOT NULL REFERENCES "credit_memo_versions"("id"),
  "action" varchar(10) NOT NULL,
  "reason" text NOT NULL,
  "reviewed_by" varchar NOT NULL REFERENCES "users"("id"),
  "reviewed_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "credit_memo_review_version_unique" UNIQUE ("memo_version_id"),
  CONSTRAINT "credit_memo_review_action" CHECK ("action" IN ('approve','reject'))
);

CREATE OR REPLACE FUNCTION prevent_financial_review_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial review history is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financial_workpaper_versions_append_only ON "financial_workpaper_versions";
CREATE TRIGGER financial_workpaper_versions_append_only
BEFORE UPDATE OR DELETE ON "financial_workpaper_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_review_mutation();

DROP TRIGGER IF EXISTS financial_workpaper_reviews_append_only ON "financial_workpaper_reviews";
CREATE TRIGGER financial_workpaper_reviews_append_only
BEFORE UPDATE OR DELETE ON "financial_workpaper_reviews"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_review_mutation();

DROP TRIGGER IF EXISTS credit_memo_versions_append_only ON "credit_memo_versions";
CREATE TRIGGER credit_memo_versions_append_only
BEFORE UPDATE OR DELETE ON "credit_memo_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_review_mutation();

DROP TRIGGER IF EXISTS credit_memo_reviews_append_only ON "credit_memo_reviews";
CREATE TRIGGER credit_memo_reviews_append_only
BEFORE UPDATE OR DELETE ON "credit_memo_reviews"
FOR EACH ROW EXECUTE FUNCTION prevent_financial_review_mutation();
