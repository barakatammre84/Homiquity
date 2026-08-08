-- Verified phone ↔ user link (two-way SMS, phase 1).
--
-- WHY: `users` carries only an email. Every phone the schema already holds sits
-- on a table with no `users.id` FK — `sms_opt_outs.phone` (a ledger, keyed by
-- number precisely so it survives with no user row), `leads.phone`,
-- `calculator_profiles.phone`, `deal_team_members.external_phone`. Meanwhile
-- `team_messages.sender_id` and `.recipient_id` are both NOT NULL FKs to
-- `users.id`. So an inbound Twilio webhook, which yields nothing but a phone
-- string, cannot be attributed to a person or written to any thread. This table
-- is the missing edge.
--
-- WHY VERIFICATION IS STRUCTURAL, NOT POLISH: a self-asserted number is a claim,
-- not an identity. Routing on an unverified claim would deliver a borrower's
-- loan conversation to whoever typed the digits. `verified_at` is therefore
-- nullable and the sender is required to treat NULL as "must never receive".
--
-- WHY THE UNIQUE INDEXES ARE PARTIAL: two people can legitimately both claim one
-- number — a recycled line, a typo, a spouse's handset. Only one may ever hold
-- it VERIFIED. A plain UNIQUE on (phone) would let an unverified squatter block
-- the real owner from ever verifying; the partial index cannot.
--
-- CONSENT COLUMNS ARE NULLABLE BY DESIGN: `consent_at` / `consent_source` /
-- `consent_ip` record TCPA prior express consent. A NULL is an honest gap. Never
-- backfill a guessed value onto a consent column — a wrong value is a falsified
-- regulatory record, which is worse than a missing one.
--
-- `consent_ip` is varchar(64) to match `clientIpForRecord()`'s truncation in
-- server/clientIp.ts, which exists because Railway's edge sends X-Real-IP and
-- not X-Forwarded-For.
--
-- EXPAND-ONLY AND IDEMPOTENT: a new table plus indexes, every statement guarded
-- by IF NOT EXISTS. Nothing existing is altered, no existing row is touched, and
-- the currently-deployed app does not read this table — so this migration is
-- safe against the running release in both directions. Not a contract
-- migration: there are no pre-existing rows for a constraint to fail on, so no
-- prod data probe is required.

CREATE TABLE IF NOT EXISTS "user_phones" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "phone" varchar(40) NOT NULL,
  "verified_at" timestamp,
  "consent_at" timestamp,
  "consent_source" varchar(40),
  "consent_ip" varchar(64),
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_phones_user_idx" ON "user_phones" ("user_id");
CREATE INDEX IF NOT EXISTS "user_phones_phone_idx" ON "user_phones" ("phone");

-- One verified owner per number (see header for why this is partial).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_phones_verified_phone"
  ON "user_phones" ("phone")
  WHERE "verified_at" IS NOT NULL;

-- One primary number per user.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_phones_primary"
  ON "user_phones" ("user_id")
  WHERE "is_primary";
