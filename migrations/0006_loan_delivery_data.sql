-- GSE loan delivery data (ULDD / UCD): Regulation Z / QM datapoints enforced
-- by the UCD Phase 1/3/3a/4 critical edits, Phase 3 closing-cost containers,
-- and the Special Feature Code set reported at delivery. One row per
-- application. Evaluated by shared/fannieMae/loanDeliveryEdits.ts.
CREATE TABLE IF NOT EXISTS "loan_delivery_data" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" varchar NOT NULL REFERENCES "loan_applications"("id"),

  "note_date" varchar(10),
  "original_loan_amount" numeric(12, 2),
  "lien_priority_type" varchar(30),
  "note_rate_percent" numeric(6, 4),
  "manufactured_home" boolean,

  "apr_percent" numeric(7, 4),
  "average_prime_offer_rate_percent" numeric(7, 4),
  "current_rate_set_date" varchar(10),
  "regulation_z_total_loan_amount" numeric(12, 2),
  "regulation_z_total_points_and_fees_amount" numeric(12, 2),
  "regulation_z_total_affiliate_fees_amount" numeric(12, 2),
  "ability_to_repay_method_type" varchar(20),
  "ability_to_repay_exemption_reason_type" varchar(20),
  "excluded_bona_fide_discount_points_indicator" boolean,
  "excluded_bona_fide_discount_points_percent" numeric(7, 4),
  "loan_price_quote_interest_rate_percent" numeric(7, 4),

  "first_rate_change_months_count" integer,
  "qm_short_reset_arm_apr_percent" numeric(7, 4),

  "discount_points" jsonb,
  "discount_points_occurrence_count" integer,
  "lender_credits" jsonb,
  "escrow_items" jsonb,
  "prepaid_items" jsonb,

  "mortgage_funder_full_name" varchar(255),
  "manual_special_feature_codes" text[],
  "sfc_attributes" jsonb,

  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_delivery_data_application_idx"
  ON "loan_delivery_data" ("application_id");
