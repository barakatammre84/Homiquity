-- 0022: Partner progress-sharing consent (PH-2 — knowledge-base/specs/PARTNER_HUB_PROGRAM.md).
-- Borrower-directed, default-OFF opt-in to share loan PROGRESS STAGES (never financials,
-- documents, or amounts — charter §5-C6) with the partner who referred them. PH-1's hub
-- showed every referred borrower's stage; this table gates that behind explicit consent.
-- Kept separate from the regulated-consent ledger (borrower_consents) — this is a togglable
-- GLBA/Reg P privacy preference, one current-state row per (borrower, partner) pair.
CREATE TABLE "partner_progress_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_user_id" varchar NOT NULL REFERENCES "users"("id"),
	"partner_user_id" varchar NOT NULL REFERENCES "users"("id"),
	"shared" boolean DEFAULT false NOT NULL,
	"granted_at" timestamp,
	"revoked_at" timestamp,
	"consent_method" varchar(30) DEFAULT 'toggle' NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_partner_progress_consent" UNIQUE("borrower_user_id","partner_user_id")
);
--> statement-breakpoint
CREATE INDEX "idx_partner_progress_consent_partner" ON "partner_progress_consents" ("partner_user_id","shared");
--> statement-breakpoint
CREATE INDEX "idx_partner_progress_consent_borrower" ON "partner_progress_consents" ("borrower_user_id");
