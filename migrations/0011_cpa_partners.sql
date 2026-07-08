CREATE TABLE "cpa_partners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"firm_name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"referral_code" varchar(40) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cpa_partners_referral_code_unique" UNIQUE("referral_code"),
	CONSTRAINT "cpa_partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE TABLE "cpa_referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cpa_partner_id" varchar NOT NULL,
	"referred_user_id" varchar NOT NULL,
	"client_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_cpa_referrals_user" UNIQUE("referred_user_id"),
	CONSTRAINT "cpa_referrals_cpa_partner_id_cpa_partners_id_fk" FOREIGN KEY ("cpa_partner_id") REFERENCES "cpa_partners"("id"),
	CONSTRAINT "cpa_referrals_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX "idx_cpa_partners_user" ON "cpa_partners" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_cpa_partners_code" ON "cpa_partners" USING btree ("referral_code");
--> statement-breakpoint
CREATE INDEX "idx_cpa_referrals_partner" ON "cpa_referrals" USING btree ("cpa_partner_id");
--> statement-breakpoint
CREATE INDEX "idx_cpa_referrals_user" ON "cpa_referrals" USING btree ("referred_user_id");
