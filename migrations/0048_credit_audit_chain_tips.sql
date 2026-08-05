-- F-038: external end-marker for each credit audit chain.
--
-- The tamper-evident chain could not detect truncation of its own tail: delete
-- the last K entries and the remainder verifies perfectly, because every
-- surviving link still points at a surviving predecessor. Detecting that needs a
-- record of where the chain last ended kept OUTSIDE the chain. This is it,
-- written in the same transaction as each append.
--
-- EXPAND ONLY. Creates a new table; touches no existing row and no existing
-- column, so the currently-deployed app tolerates this schema and vice-versa.
-- No constraint is applied to existing data, so there is no contract-migration
-- data check to record here.
--
-- DELIBERATELY NOT BACKFILLED. Chains that already exist get a tip row on their
-- next append, not one synthesized from their current contents. A backfilled tip
-- would assert "this is where the chain ended" on the basis of whatever the table
-- happened to hold at migration time — including, if the log had already been
-- truncated, the truncated end. That is a guessed value on a provenance record;
-- an absent tip is an honest gap and verification reports it as one.
CREATE TABLE IF NOT EXISTS "credit_audit_chain_tips" (
	"scope_key" varchar PRIMARY KEY NOT NULL,
	"tip_entry_hash" varchar(64) NOT NULL,
	"tip_sequence_number" integer NOT NULL,
	"tracking_started_at_sequence" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE "credit_audit_chain_tips" IS 'F-038: external end-marker per audit chain scope, so tail truncation of credit_audit_log is detectable. Same-database, so not a cryptographic guarantee — it makes a deletion require a coordinated two-table write and catches all non-adversarial loss.';
--> statement-breakpoint
COMMENT ON COLUMN "credit_audit_chain_tips"."tracking_started_at_sequence" IS 'Sequence number at which tip tracking began for this scope. Entries before it are NOT tail-anchored; verification reports that rather than implying full coverage. Never backfilled (F-038).';
