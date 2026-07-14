-- 0029: independent capability toggle for the Autopilot decision relay
-- (lender decision → borrower approval / staff adverse-action). Defaults FALSE:
-- even with Autopilot enabled, the relay stays OFF until an operator turns it on
-- — it's borrower-facing outbound messaging on a credit decision (Reg N / ECOA
-- §1002.9) and gets counsel sign-off before activation.
-- Expand/contract + idempotent (CLAUDE.md §"Schema changes are migration-gated"):
-- IF NOT EXISTS keeps the currently-deployed app tolerant of the new DB and
-- vice-versa, and makes a re-run a no-op.
ALTER TABLE "autopilot_config"
	ADD COLUMN IF NOT EXISTS "decision_relay_enabled" boolean DEFAULT false NOT NULL;
