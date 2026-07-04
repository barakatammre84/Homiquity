-- Wholesale lender submissions: one row per file-to-lender submission,
-- created through the readiness gate in server/services/lenderSubmission.ts.
-- Status machine lives in shared/wholesaleLenders.ts. Simulated lender leg
-- until broker agreements exist.
CREATE TABLE IF NOT EXISTS "lender_submissions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "lender_id" varchar(40) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'submitted',
  "simulated" boolean NOT NULL DEFAULT true,
  "confirmation_id" varchar(60),
  "readiness_snapshot" jsonb,
  "submitted_by" varchar NOT NULL,
  "submitted_at" timestamp NOT NULL DEFAULT now(),
  "notes" text,
  "status_updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lender_submissions_app_lender_idx"
  ON "lender_submissions" ("application_id", "lender_id");
