-- TRID change-of-circumstance records (Reg Z §1026.19(e)(3)(iv) / (e)(4)(i)):
-- one row per recorded changed circumstance; an open row past its revised-LE
-- due date blocks wholesale submission until the revised LE is delivered.
CREATE TABLE IF NOT EXISTS "change_of_circumstances" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),
  "reason_type" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "information_received_at" timestamp NOT NULL,
  "revised_le_due_date" timestamp NOT NULL,
  "revised_le_delivered_at" timestamp,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "created_by_user_id" varchar NOT NULL REFERENCES "users"("id"),
  "void_reason" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "change_of_circumstances_app_idx" ON "change_of_circumstances" ("application_id", "status");
