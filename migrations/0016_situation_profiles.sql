-- 0016: Situation profiles (UAL program P2c — Situation Identification Engine)
-- Append-only, one row per classification of a borrower's tax-document
-- situation (latest row per user wins; inputs_fingerprint dedupes no-op
-- re-runs). The profile jsonb is Zod-typed (shared/situationProfile.ts);
-- the boolean/count columns exist for staff-feed queries.
-- Idempotent; hand-authored.

CREATE TABLE IF NOT EXISTS "situation_profiles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "application_id" varchar REFERENCES "loan_applications"("id"),

  "profile" jsonb NOT NULL,
  -- SHA-256 over the classification inputs (instances + entities + checks):
  -- same inputs, same profile — the reproducibility discipline the decision
  -- snapshots use.
  "inputs_fingerprint" varchar(64) NOT NULL,

  "entity_count" integer NOT NULL DEFAULT 0,
  "self_employed" boolean NOT NULL DEFAULT false,
  "multi_entity" boolean NOT NULL DEFAULT false,
  "rental_present" boolean NOT NULL DEFAULT false,
  "k1_present" boolean NOT NULL DEFAULT false,
  "variance_count" integer NOT NULL DEFAULT 0,
  "document_request_count" integer NOT NULL DEFAULT 0,

  "generated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_situation_profiles_user" ON "situation_profiles" ("user_id", "generated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_situation_profiles_flags" ON "situation_profiles" ("self_employed", "rental_present", "generated_at");
