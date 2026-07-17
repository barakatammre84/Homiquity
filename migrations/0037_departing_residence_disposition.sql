-- 0037: S-07 departing-residence intake (non-W2 plan §3.4 / scenario registry S-07)
-- Expand-only, idempotent: two nullable columns on loan_applications. The
-- currently-deployed app tolerates the new columns and vice-versa.
--   current_property_disposition: retained_as_primary | sold | converted_to_rental
--   departing_residence: { address?, estimatedMarketRent, monthlyPitia } jsonb
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "current_property_disposition" varchar(30);--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "departing_residence" jsonb;
