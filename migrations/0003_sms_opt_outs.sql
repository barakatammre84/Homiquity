CREATE TABLE "sms_opt_outs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(40) NOT NULL,
	"opted_out" boolean DEFAULT true NOT NULL,
	"opted_out_at" timestamp,
	"resubscribed_at" timestamp,
	"last_keyword" varchar(40),
	"source" varchar(40) DEFAULT 'sms_webhook' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sms_opt_outs_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE INDEX "sms_opt_outs_phone_idx" ON "sms_opt_outs" USING btree ("phone");