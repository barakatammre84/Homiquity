-- Second-pass Fannie Mae delivery data: general FEE containers (UCD Phase 3
-- Guide Fees / Taxes & Other Government Fees job aids) and the property /
-- project attributes evaluated by the EarlyCheck origination edits
-- (89/92/1210/1829/6095/6158/6159/6439). See shared/fannieMae/.
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "fees" jsonb;
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "project_classification_identifier" varchar(2);
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "application_received_date" varchar(10);
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "subordinate_financing_exists" boolean;
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "has_mortgage_insurance" boolean;
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "financed_properties_count" integer;
ALTER TABLE "loan_delivery_data" ADD COLUMN IF NOT EXISTS "property_usage_type" varchar(30);
