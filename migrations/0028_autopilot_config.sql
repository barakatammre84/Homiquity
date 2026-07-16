-- 0028: Autopilot operator control surface (Autopilot Phase 1 —
-- knowledge-base plan review-the-following / Homiquity Autopilot).
-- Single global config row: master kill switch (default OFF), independent
-- capability toggles, and an optional LO pilot allowlist. The `singleton`
-- column is always TRUE and UNIQUE, so at most one row can ever exist.
CREATE TABLE "autopilot_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"follow_up_generation_enabled" boolean DEFAULT true NOT NULL,
	"application_data_updates_enabled" boolean DEFAULT true NOT NULL,
	"loan_officer_allowlist" jsonb,
	"guideline_mode" varchar(30) DEFAULT 'fannie_mae' NOT NULL,
	"updated_by" varchar REFERENCES "users"("id"),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_autopilot_config_singleton" UNIQUE("singleton")
);
--> statement-breakpoint
-- Seed the disabled default row so the config surface always reads a known
-- state (kill switch OFF; nothing runs until an operator activates it).
INSERT INTO "autopilot_config" ("singleton", "enabled") VALUES (true, false)
	ON CONFLICT ("singleton") DO NOTHING;
