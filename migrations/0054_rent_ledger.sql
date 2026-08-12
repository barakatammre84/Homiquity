-- Rent ledger: leases, rent payments, and the bureau-furnishing queue.
--
-- WHY: before this, the only borrower-paid rent in the schema was
-- `homeownership_goals.current_rent` — one self-entered decimal, consumed as a
-- tier-3 DTI liability in server/services/borrowerGraph.ts. That is rent as a
-- DEBT. Reporting rent as a credit positive needs the opposite: a per-period
-- record that knows how it came to exist. Hence `provenance`.
--
-- WHY `provenance` IS NOT NULL AND HAS NO DEFAULT: it is the column that decides
-- whether a row may ever be sent to a credit bureau, so there is no safe value to
-- assume on insert. A default would let a caller that forgot to think about
-- evidence silently produce a furnishable-looking record. Per CLAUDE.md, a
-- provenance column is never backfilled with a guessed value — a NULL is an
-- honest gap, a wrong value is a falsified record, and here the record is a
-- statement about a real person's credit.
--
-- WHY THE FURNISHING QUEUE IS A SEPARATE TABLE: the two lifecycles are genuinely
-- independent. A lease can end while its tradeline is still under dispute, and a
-- consumer can withdraw reporting without ending their lease. Folding the state
-- onto `leases` would make "stopped reporting" and "moved out" the same fact.
--
-- WHY `rent_furnishing_queue.state` DEFAULTS TO 'pending_authority': nothing in
-- this repo may furnish anything today. docs/cdia-metro2/ and docs/fcra/ are
-- README-only, so neither the Metro 2 format authority nor the FCRA §1681s-2 /
-- Reg V accuracy authority exists locally. The default is the honest terminus,
-- not a placeholder — see the four flagged entries in
-- data/regulatory/regulatory-ledger.json.
--
-- WHY THE PII COLUMNS COME IN THREES: landlord email and property address are
-- encrypted at rest on the encryptionService pattern — content + iv + key_id.
-- key_id is what makes key rotation possible; storing only content+iv is how a
-- vault becomes unrotatable. Landlord NAME is deliberately plaintext: it is a
-- business counterparty (usually a management company) and staff need it to
-- reconcile a payment without a decrypt.
--
-- WHY (lease_id, due_date) IS UNIQUE: a re-run importer must not double-count a
-- month into a payment history that will eventually be furnished. Duplicated
-- months would inflate a consumer's apparent payment record.
--
-- EXPAND-ONLY AND IDEMPOTENT: three new tables plus indexes, every statement
-- guarded by IF NOT EXISTS. Nothing existing is altered and no existing row is
-- touched, so this is safe against the running release in both directions. NOT a
-- contract migration — there are no pre-existing rows for a constraint to fail
-- on, so no prod data probe is required.

CREATE TABLE IF NOT EXISTS "leases" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "landlord_name" varchar(255),
  "landlord_email_encrypted" text,
  "landlord_email_iv" varchar(32),
  "landlord_email_key_id" varchar(20),
  "property_address_encrypted" text,
  "property_address_iv" varchar(32),
  "property_address_key_id" varchar(20),
  "monthly_rent_amount" numeric(10, 2) NOT NULL,
  "lease_start_date" timestamp,
  "lease_end_date" timestamp,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "verification_status" varchar(32) DEFAULT 'unverified' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_leases_user" ON "leases" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_leases_status" ON "leases" ("status");

CREATE TABLE IF NOT EXISTS "rent_payments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "lease_id" varchar NOT NULL REFERENCES "leases"("id"),
  "due_date" timestamp NOT NULL,
  "paid_date" timestamp,
  "amount_due" numeric(10, 2) NOT NULL,
  "amount_paid" numeric(10, 2),
  "status" varchar(32) DEFAULT 'scheduled' NOT NULL,
  "provenance" varchar(32) NOT NULL,
  "processor_reference" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_rent_payments_lease" ON "rent_payments" ("lease_id");
CREATE INDEX IF NOT EXISTS "idx_rent_payments_status" ON "rent_payments" ("status");

-- One row per lease per period (see header).
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rent_payments_lease_due"
  ON "rent_payments" ("lease_id", "due_date");

CREATE TABLE IF NOT EXISTS "rent_furnishing_queue" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "lease_id" varchar NOT NULL REFERENCES "leases"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "state" varchar(32) DEFAULT 'pending_authority' NOT NULL,
  "state_reason" text,
  "entered_state_at" timestamp DEFAULT now() NOT NULL,
  "consumer_authorized_at" timestamp,
  "furnished_at" timestamp,
  "suppressed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- One queue row per lease.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rent_furnishing_lease"
  ON "rent_furnishing_queue" ("lease_id");
CREATE INDEX IF NOT EXISTS "idx_rent_furnishing_state" ON "rent_furnishing_queue" ("state");
CREATE INDEX IF NOT EXISTS "idx_rent_furnishing_user" ON "rent_furnishing_queue" ("user_id");
