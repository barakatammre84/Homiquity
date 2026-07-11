-- 0020: PartnerHub identity spine (PH-1 — knowledge-base/specs/PARTNER_HUB_PROGRAM.md).
-- partner_profiles: one row per external referral partner (realtor now; cpa converges later).
-- No compensation columns by design (RESPA §8, charter §5-C1); license verification is a
-- manual admin queue (§5-C10). referral_slug mirrors users.referral_code (one code, both rails).
CREATE TABLE "partner_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"persona" varchar(20) NOT NULL,
	"firm_name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"license_number" varchar(60),
	"license_state" varchar(2),
	"license_verification_status" varchar(20) DEFAULT 'pending_review' NOT NULL,
	"referral_slug" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"source" varchar(20) DEFAULT 'self_service' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_partner_profiles_user" UNIQUE("user_id"),
	CONSTRAINT "uq_partner_profiles_slug" UNIQUE("referral_slug")
);
--> statement-breakpoint
CREATE INDEX "idx_partner_profiles_persona" ON "partner_profiles" ("persona","status");
--> statement-breakpoint
CREATE INDEX "idx_partner_profiles_license_review" ON "partner_profiles" ("license_verification_status");
--> statement-breakpoint
-- Waitlist → activation conversion (PH-1): stamped when an admin sends the join invite.
ALTER TABLE "partner_waitlist" ADD COLUMN "invited_at" timestamp;
