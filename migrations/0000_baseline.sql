CREATE TYPE "public"."policy_lifecycle_status" AS ENUM('DRAFT', 'ACTIVE', 'RETIRED');--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password_hash" varchar,
	"auth_provider" varchar(20) DEFAULT 'email',
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar(50) DEFAULT 'aspiring_owner' NOT NULL,
	"is_partner" boolean DEFAULT false,
	"partner_company_name" varchar(255),
	"nmls_id" varchar(20),
	"referral_code" varchar(20),
	"referred_by_user_id" varchar,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "agent_confidence_views" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"confidence_breakdown_id" varchar NOT NULL,
	"overall_score" numeric(4, 2) NOT NULL,
	"income_score" numeric(4, 2),
	"assets_score" numeric(4, 2),
	"credit_score" numeric(4, 2),
	"documentation_score" numeric(4, 2),
	"stability_score" numeric(4, 2),
	"confidence_level" varchar(20) NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb,
	"tooltip_text" text DEFAULT 'Confidence score reflects the strength and completeness of the loan file based on preliminary analysis. It is not a lender decision.',
	"visible_to_agents" boolean DEFAULT true,
	"visible_to_borrower" boolean DEFAULT false,
	"visible_to_lo" boolean DEFAULT true,
	"visible_to_processor" boolean DEFAULT true,
	"visible_to_underwriter" boolean DEFAULT true,
	"underwriting_snapshot_id" varchar,
	"computed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"total_applications" integer DEFAULT 0,
	"applications_in_pipeline" integer DEFAULT 0,
	"applications_processing" integer DEFAULT 0,
	"applications_underwriting" integer DEFAULT 0,
	"applications_approved" integer DEFAULT 0,
	"applications_denied" integer DEFAULT 0,
	"applications_withdrawn" integer DEFAULT 0,
	"applications_closed" integer DEFAULT 0,
	"applications_funded" integer DEFAULT 0,
	"new_applications_today" integer DEFAULT 0,
	"closed_volume_today" numeric(14, 2) DEFAULT '0',
	"funded_volume_today" numeric(14, 2) DEFAULT '0',
	"avg_total_cycle_time" numeric(10, 2),
	"avg_processing_time" numeric(10, 2),
	"avg_underwriting_time" numeric(10, 2),
	"sla_compliance_rate" numeric(5, 2),
	"loans_at_risk_of_sla_breach" integer DEFAULT 0,
	"application_to_approval_rate" numeric(5, 2),
	"approval_to_close_rate" numeric(5, 2),
	"pull_through_rate" numeric(5, 2),
	"avg_loans_per_lo" numeric(5, 1),
	"avg_loans_per_processor" numeric(5, 1),
	"avg_loans_per_underwriter" numeric(5, 1),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "application_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" varchar NOT NULL,
	"referrer_type" varchar(20) NOT NULL,
	"client_name" varchar(255),
	"client_email" varchar(255),
	"client_phone" varchar(20),
	"token" varchar(64) NOT NULL,
	"message" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"clicked_at" timestamp,
	"applied_at" timestamp,
	"loan_application_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "application_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "application_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"application_received_at" timestamp,
	"document_collection_started_at" timestamp,
	"document_collection_completed_at" timestamp,
	"submitted_to_processing_at" timestamp,
	"processing_completed_at" timestamp,
	"submitted_to_underwriting_at" timestamp,
	"conditional_approval_at" timestamp,
	"clear_to_close_at" timestamp,
	"closing_scheduled_at" timestamp,
	"closed_at" timestamp,
	"funded_at" timestamp,
	"denied_at" timestamp,
	"denial_reason" text,
	"withdrawn_at" timestamp,
	"withdrawal_reason" text,
	"total_cycle_time_hours" numeric(10, 2),
	"processing_time_hours" numeric(10, 2),
	"underwriting_time_hours" numeric(10, 2),
	"closing_time_hours" numeric(10, 2),
	"sla_target_date" timestamp,
	"is_sla_met" boolean,
	"sla_breach_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "application_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"property_type" varchar(50),
	"purchase_price" numeric(12, 2) NOT NULL,
	"down_payment" numeric(12, 2),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"is_current_property" boolean DEFAULT true NOT NULL,
	"offer_amount" numeric(12, 2),
	"offer_date" timestamp,
	"offer_status" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "borrower_declarations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_sequence_number" integer DEFAULT 1,
	"will_occupy_as_primary_residence" boolean,
	"has_ownership_interest_in_past_3_years" boolean,
	"prior_property_type" varchar(50),
	"prior_property_title" varchar(50),
	"has_relationship_with_seller" boolean,
	"is_borrowing_for_down_payment" boolean,
	"borrowed_amount" numeric(12, 2),
	"has_applied_for_mortgage_on_other_property" boolean,
	"has_credit_for_mortgage_on_other_property" boolean,
	"has_priority_lien_on_subject_property" boolean,
	"has_co_maker_endorser" boolean,
	"has_outstanding_judgments" boolean,
	"is_delinquent_on_federal_debt" boolean,
	"is_party_to_lawsuit" boolean,
	"has_conveyed_title_in_lieu_of_foreclosure" boolean,
	"has_completed_short_sale" boolean,
	"has_been_foreclosed" boolean,
	"has_declared_bankruptcy" boolean,
	"bankruptcy_types" text,
	"has_undisclosed_debt" boolean,
	"undisclosed_debt_amount" numeric(12, 2),
	"has_applied_for_new_credit" boolean,
	"has_priority_lien_to_be_paid_off" boolean,
	"is_us_citizen" boolean,
	"is_permanent_resident_alien" boolean,
	"declarations_completed_at" timestamp,
	"declarations_verified_at" timestamp,
	"declarations_verified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broker_offer_controls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"suppressed_lender_ids" text[],
	"offer_ranking" jsonb,
	"house_overlays" jsonb,
	"broker_compensation_type" varchar(20),
	"broker_compensation_bps" integer,
	"compensation_locked_at" timestamp,
	"compensation_locked_by" varchar,
	"display_preferences" jsonb,
	"action_log" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_refresh_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_id" varchar NOT NULL,
	"refresh_type" varchar(10) NOT NULL,
	"reason" varchar(50) NOT NULL,
	"reason_details" text,
	"consent_id" varchar,
	"consent_obtained" boolean DEFAULT false,
	"consent_obtained_at" timestamp,
	"previous_credit_report_id" varchar,
	"previous_credit_score" integer,
	"previous_expiration_date" timestamp,
	"new_credit_report_id" varchar,
	"new_credit_score" integer,
	"new_expiration_date" timestamp,
	"score_change" integer,
	"significant_change" boolean DEFAULT false,
	"previous_snapshot_id" varchar,
	"new_snapshot_id" varchar,
	"previous_letter_id" varchar,
	"new_letter_id" varchar,
	"decision_made_by" varchar,
	"decision_made_by_system" boolean DEFAULT false,
	"decision_at" timestamp DEFAULT now(),
	"executed_at" timestamp,
	"execution_status" varchar(20),
	"execution_error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"activity_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"performed_by" varchar,
	"visible_to_roles" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_team_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"user_id" varchar,
	"team_role" varchar(50) NOT NULL,
	"external_name" varchar(255),
	"external_email" varchar(255),
	"external_phone" varchar(50),
	"external_company" varchar(255),
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now(),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disclaimer_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" varchar(20) NOT NULL,
	"disclaimer_type" varchar(50) NOT NULL,
	"text" text NOT NULL,
	"approved_by_counsel" boolean DEFAULT false,
	"counsel_approval_date" timestamp,
	"counsel_name" varchar(255),
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	CONSTRAINT "disclaimer_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "document_expirations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"document_date" timestamp NOT NULL,
	"expiration_date" timestamp NOT NULL,
	"warning_date" timestamp,
	"policy_id" varchar,
	"status" varchar(20) DEFAULT 'valid',
	"warning_notified_at" timestamp,
	"expiration_notified_at" timestamp,
	"notified_borrower" boolean DEFAULT false,
	"notified_lo" boolean DEFAULT false,
	"notified_agent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar,
	"user_id" varchar NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"storage_path" text NOT NULL,
	"status" varchar(50) DEFAULT 'uploaded',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employment_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_sequence_number" integer DEFAULT 1,
	"employment_type" varchar(50) NOT NULL,
	"employer_name" varchar(255),
	"employer_phone" varchar(20),
	"employer_street" text,
	"employer_unit" varchar(20),
	"employer_city" varchar(100),
	"employer_state" varchar(50),
	"employer_zip" varchar(20),
	"employer_country" varchar(100),
	"position_title" varchar(255),
	"start_date" varchar(10),
	"end_date" varchar(10),
	"years_in_line_of_work" integer,
	"months_in_line_of_work" integer,
	"is_self_employed" boolean DEFAULT false,
	"ownership_share_less_than_25" boolean,
	"ownership_share_25_or_more" boolean,
	"is_employed_by_family_member" boolean DEFAULT false,
	"is_employed_by_property_seller" boolean DEFAULT false,
	"base_income" numeric(12, 2),
	"overtime_income" numeric(12, 2),
	"bonus_income" numeric(12, 2),
	"commission_income" numeric(12, 2),
	"military_entitlements" numeric(12, 2),
	"other_income" numeric(12, 2),
	"total_monthly_income" numeric(12, 2),
	"monthly_income_or_loss" numeric(12, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expiration_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_name" varchar(100) NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"pre_approval_validity_days" integer DEFAULT 90 NOT NULL,
	"credit_validity_days" integer DEFAULT 120 NOT NULL,
	"income_doc_validity_days" integer DEFAULT 60 NOT NULL,
	"asset_doc_validity_days" integer DEFAULT 60 NOT NULL,
	"employment_verification_validity_days" integer DEFAULT 30,
	"pre_approval_warning_days" integer DEFAULT 14,
	"credit_warning_days" integer DEFAULT 21,
	"income_doc_warning_days" integer DEFAULT 10,
	"asset_doc_warning_days" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lender_data_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" varchar(100) NOT NULL,
	"application_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"lender_id" varchar(100) NOT NULL,
	"lender_name" varchar(255) NOT NULL,
	"lender_format_id" varchar,
	"status" varchar(30) DEFAULT 'DRAFT',
	"borrower_summary" jsonb,
	"underwriting_metrics" jsonb,
	"decision_snapshot" jsonb,
	"document_index" jsonb,
	"coc_status" jsonb,
	"explanations" jsonb,
	"submitted_at" timestamp,
	"submitted_by" varchar,
	"response_received_at" timestamp,
	"lender_response" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lender_data_packages_package_id_unique" UNIQUE("package_id")
);
--> statement-breakpoint
CREATE TABLE "lender_offers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" varchar(100) NOT NULL,
	"lender_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"application_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"rate" numeric(6, 4) NOT NULL,
	"apr" numeric(6, 4),
	"points" numeric(6, 4) DEFAULT '0',
	"lender_fees" numeric(12, 2) DEFAULT '0',
	"third_party_fees" numeric(12, 2) DEFAULT '0',
	"total_closing_costs" numeric(12, 2),
	"monthly_pi" numeric(12, 2),
	"monthly_mi" numeric(12, 2) DEFAULT '0',
	"monthly_total" numeric(12, 2),
	"lock_term" integer NOT NULL,
	"lock_expiration" timestamp,
	"offer_expiration" timestamp NOT NULL,
	"conditions" jsonb,
	"broker_compensation_bps" integer,
	"broker_compensation_amount" numeric(12, 2),
	"status" varchar(20) DEFAULT 'PROPOSED' NOT NULL,
	"selected_at" timestamp,
	"selected_by" varchar,
	"locked_at" timestamp,
	"locked_by" varchar,
	"lock_confirmation_number" varchar(100),
	"pricing_breakdown" jsonb,
	"labels" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lender_offers_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
CREATE TABLE "lender_pre_approval_formats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" varchar(100) NOT NULL,
	"lender_name" varchar(255) NOT NULL,
	"lender_logo" varchar(500),
	"show_loan_amount" boolean DEFAULT true,
	"show_dti" boolean DEFAULT false,
	"show_credit_score" boolean DEFAULT false,
	"show_asset_reserves" boolean DEFAULT false,
	"show_income_details" boolean DEFAULT false,
	"show_ltv" boolean DEFAULT false,
	"show_product_type" boolean DEFAULT true,
	"show_occupancy" boolean DEFAULT true,
	"show_property_address" boolean DEFAULT true,
	"required_fields" jsonb DEFAULT '[]'::jsonb,
	"disclaimer_overrides" jsonb,
	"branding_rules" jsonb,
	"letter_format" varchar(20) DEFAULT 'standard',
	"include_conditions" boolean DEFAULT true,
	"max_conditions_to_show" integer,
	"field_ordering" jsonb,
	"template_id" varchar(100),
	"template_version" varchar(20),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lender_pre_approval_formats_lender_id_unique" UNIQUE("lender_id")
);
--> statement-breakpoint
CREATE TABLE "lender_pricing_adjustments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" varchar NOT NULL,
	"rate_sheet_id" varchar,
	"adjustment_type" varchar(30) NOT NULL,
	"adjustment_name" varchar(255) NOT NULL,
	"condition" jsonb NOT NULL,
	"adjustment_value" numeric(6, 4) NOT NULL,
	"is_stackable" boolean DEFAULT true,
	"guideline_reference" varchar(255),
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "letter_generation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"letter_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"event_details" jsonb,
	"trigger_conditions" jsonb,
	"conditions_met" boolean,
	"failed_conditions" jsonb,
	"reanalysis_reason" varchar(100),
	"previous_snapshot_id" varchar,
	"new_snapshot_id" varchar,
	"triggered_by" varchar,
	"triggered_by_system" boolean DEFAULT false,
	"event_at" timestamp DEFAULT now(),
	"processing_time_ms" integer,
	"error_message" text,
	"error_stack" text
);
--> statement-breakpoint
CREATE TABLE "loan_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"financial_data_provenance" varchar(30) DEFAULT 'self_reported' NOT NULL,
	"financial_data_verified_at" timestamp,
	"financial_data_verified_by" varchar,
	"income_verified" boolean DEFAULT false NOT NULL,
	"assets_verified" boolean DEFAULT false NOT NULL,
	"credit_verified" boolean DEFAULT false NOT NULL,
	"aus_casefile_id" varchar(100),
	"aus_recommendation" varchar(50),
	"aus_submitted_at" timestamp,
	"aus_findings" jsonb,
	"d1c_assets_relief" boolean DEFAULT false NOT NULL,
	"d1c_income_relief" boolean DEFAULT false NOT NULL,
	"d1c_employment_relief" boolean DEFAULT false NOT NULL,
	"pre_uw_flags" jsonb,
	"annual_income" numeric(12, 2),
	"monthly_debts" numeric(10, 2),
	"credit_score" integer,
	"employment_type" varchar(50),
	"employment_years" integer,
	"employer_name" varchar(255),
	"property_address" text,
	"property_city" varchar(100),
	"property_state" varchar(50),
	"property_zip" varchar(20),
	"property_type" varchar(50),
	"property_value" numeric(12, 2),
	"purchase_price" numeric(12, 2),
	"down_payment" numeric(12, 2),
	"loan_purpose" varchar(50),
	"preferred_loan_type" varchar(50),
	"is_veteran" boolean DEFAULT false,
	"is_first_time_buyer" boolean DEFAULT false,
	"income_sources" jsonb,
	"dti_ratio" numeric(5, 2),
	"ltv_ratio" numeric(5, 2),
	"pre_approval_amount" numeric(12, 2),
	"ai_analysis" jsonb,
	"ai_analyzed_at" timestamp,
	"referring_broker_id" varchar,
	"loan_officer_id" varchar,
	"amortization_type" varchar(30),
	"arm_index_type" varchar(50),
	"arm_margin" numeric(6, 3),
	"arm_initial_rate" numeric(6, 3),
	"arm_initial_cap" numeric(6, 3),
	"arm_periodic_cap" numeric(6, 3),
	"arm_lifetime_cap" numeric(6, 3),
	"arm_adjustment_frequency_months" integer,
	"total_points_and_fees" numeric(12, 2),
	"hmda_action_taken" varchar(30),
	"hmda_denial_reasons" text[],
	"closing_date" varchar(10),
	"le_issued_date" varchar(10),
	"cd_issued_date" varchar(10),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"submitted_at" timestamp,
	"pre_approved_at" timestamp,
	"doc_collection_started_at" timestamp,
	"processing_started_at" timestamp,
	"underwriting_started_at" timestamp,
	"conditional_approved_at" timestamp,
	"clear_to_close_at" timestamp,
	"closing_scheduled_at" timestamp,
	"funded_at" timestamp,
	"denied_at" timestamp,
	"target_close_date" timestamp,
	"actual_close_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"loan_type" varchar(50) NOT NULL,
	"loan_term" integer NOT NULL,
	"interest_rate" numeric(5, 3) NOT NULL,
	"apr" numeric(5, 3) NOT NULL,
	"points" numeric(5, 3) DEFAULT '0',
	"points_cost" numeric(10, 2) DEFAULT '0',
	"monthly_payment" numeric(10, 2) NOT NULL,
	"principal_and_interest" numeric(10, 2) NOT NULL,
	"property_tax" numeric(10, 2),
	"home_insurance" numeric(10, 2),
	"pmi" numeric(10, 2),
	"hoa_fees" numeric(10, 2),
	"loan_amount" numeric(12, 2) NOT NULL,
	"closing_costs" numeric(10, 2),
	"cash_to_close" numeric(12, 2),
	"total_interest_paid" numeric(12, 2),
	"down_payment_amount" numeric(12, 2),
	"down_payment_percent" numeric(5, 2),
	"is_recommended" boolean DEFAULT false,
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"lock_expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lock_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(100) NOT NULL,
	"offer_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"application_id" varchar NOT NULL,
	"requested_lock_term" integer NOT NULL,
	"requested_lock_expiration" date NOT NULL,
	"client_attestation" jsonb,
	"coc_check_result" jsonb,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by" varchar,
	"submission_method" varchar(20),
	"lender_response" jsonb,
	"confirmed_at" timestamp,
	"confirmation_number" varchar(100),
	"confirmed_rate" numeric(6, 4),
	"confirmed_lock_expiration" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lock_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "mortgage_rate_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"term_years" integer,
	"is_adjustable" boolean DEFAULT false,
	"adjustment_period" varchar(20),
	"loan_type" varchar(50),
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "mortgage_rate_programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "mortgage_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(2),
	"zipcode" varchar(10),
	"program_id" varchar NOT NULL,
	"rate" numeric(6, 3) NOT NULL,
	"apr" numeric(6, 3) NOT NULL,
	"points" numeric(5, 2),
	"points_cost" numeric(10, 2),
	"loan_amount" numeric(12, 2) DEFAULT '160000',
	"down_payment_percent" integer DEFAULT 20,
	"credit_score_min" integer DEFAULT 760,
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "offer_comparison_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"application_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"borrower_id" varchar NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"offers_shown" jsonb,
	"comparison_actions" jsonb,
	"selected_offer_id" varchar,
	"selection_reason" varchar(255),
	"breakeven_calculations" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "offer_comparison_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "offer_selection_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"offer_id" varchar NOT NULL,
	"application_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"lender_id" varchar NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"selection_data" jsonb,
	"performed_by" varchar NOT NULL,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"lender_visibility" jsonb,
	"client_metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "offer_selection_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "other_income_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"income_source" varchar(100) NOT NULL,
	"monthly_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plaid_link_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar NOT NULL,
	"link_token" text NOT NULL,
	"verification_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pre_approval_conditions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_id" varchar NOT NULL,
	"category" varchar(50) NOT NULL,
	"condition_text" text NOT NULL,
	"auto_generated" boolean DEFAULT true,
	"source_rule_id" varchar,
	"is_standard_condition" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pre_approval_letters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_number" varchar(50) NOT NULL,
	"borrower_name" varchar(255) NOT NULL,
	"application_id" varchar NOT NULL,
	"loan_amount" numeric(14, 2) NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"occupancy" varchar(20) NOT NULL,
	"loan_purpose" varchar(50),
	"rate_locked_at" timestamp,
	"locked_rate" numeric(5, 3),
	"underwriting_snapshot_id" varchar,
	"primary_disclaimer_id" varchar,
	"broker_role_disclaimer_id" varchar,
	"document_reliance_disclaimer_id" varchar,
	"change_in_circumstance_disclaimer_id" varchar,
	"system_generated_disclaimer_id" varchar,
	"expiration_date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'issued' NOT NULL,
	"generated_by_system" boolean DEFAULT true,
	"generated_at" timestamp DEFAULT now(),
	"company_legal_name" varchar(255) NOT NULL,
	"company_nmls_id" varchar(50) NOT NULL,
	"company_contact_info" text,
	"loan_officer_id" varchar,
	"loan_officer_nmls_id" varchar(50),
	"pdf_storage_key" varchar(500),
	"pdf_generated_at" timestamp,
	"watermark_applied" boolean DEFAULT true,
	"is_locked" boolean DEFAULT true,
	"revoked_at" timestamp,
	"revoked_by" varchar,
	"revocation_reason" text,
	"superseded_at" timestamp,
	"superseded_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pre_approval_letters_letter_number_unique" UNIQUE("letter_number")
);
--> statement-breakpoint
CREATE TABLE "pre_qualification_letters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_number" varchar(50) NOT NULL,
	"borrower_name" varchar(255) NOT NULL,
	"application_id" varchar NOT NULL,
	"estimated_amount" numeric(14, 2) NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"occupancy" varchar(20) NOT NULL,
	"loan_purpose" varchar(50),
	"annual_income" numeric(12, 2),
	"credit_score_range" varchar(50),
	"employment_type" varchar(50),
	"estimated_dti" numeric(5, 2),
	"down_payment_percent" numeric(5, 2),
	"expiration_date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'issued' NOT NULL,
	"generated_at" timestamp DEFAULT now(),
	"company_legal_name" varchar(255) NOT NULL,
	"company_nmls_id" varchar(50) NOT NULL,
	"company_contact_info" text,
	"loan_officer_id" varchar,
	"loan_officer_nmls_id" varchar(50),
	"pdf_storage_key" varchar(500),
	"pdf_generated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pre_qualification_letters_letter_number_unique" UNIQUE("letter_number")
);
--> statement-breakpoint
CREATE TABLE "rate_locks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"loan_option_id" varchar NOT NULL,
	"interest_rate" numeric(5, 3) NOT NULL,
	"points" numeric(5, 3),
	"loan_amount" numeric(12, 2) NOT NULL,
	"loan_type" varchar(50) NOT NULL,
	"loan_term" integer NOT NULL,
	"lock_period_days" integer NOT NULL,
	"locked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"extension_count" integer DEFAULT 0,
	"original_expires_at" timestamp,
	"extension_fee" numeric(10, 2),
	"locked_by" varchar NOT NULL,
	"cancelled_by" varchar,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_sheet_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_sheet_id" varchar NOT NULL,
	"product_code" varchar(50) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_type" varchar(30) NOT NULL,
	"loan_term" integer NOT NULL,
	"amortization_type" varchar(20) DEFAULT 'FIXED',
	"base_rate" numeric(6, 4) NOT NULL,
	"lock_term_adjustments" jsonb,
	"points_grid" jsonb,
	"eligibility_constraints" jsonb,
	"lender_fees" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_sheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" varchar(100) NOT NULL,
	"lender_id" varchar NOT NULL,
	"version" varchar(20) NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date NOT NULL,
	"upload_method" varchar(20) DEFAULT 'MANUAL',
	"uploaded_by" varchar,
	"uploaded_at" timestamp DEFAULT now(),
	"source_file_name" varchar(255),
	"product_types" text[],
	"lock_terms" integer[],
	"status" varchar(20) DEFAULT 'ACTIVE',
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "rate_sheets_sheet_id_unique" UNIQUE("sheet_id")
);
--> statement-breakpoint
CREATE TABLE "sla_configurations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"application_to_processing_hours" integer DEFAULT 24,
	"processing_to_underwriting_hours" integer DEFAULT 48,
	"underwriting_decision_hours" integer DEFAULT 72,
	"conditional_to_ctc_hours" integer DEFAULT 48,
	"ctc_to_closing_hours" integer DEFAULT 72,
	"total_application_to_close_hours" integer DEFAULT 360,
	"loan_type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"application_id" varchar,
	"message" text NOT NULL,
	"message_type" varchar(50) DEFAULT 'text',
	"document_request_data" jsonb,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "urla_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_sequence_number" integer DEFAULT 1,
	"account_type" varchar(100) NOT NULL,
	"financial_institution" varchar(255),
	"account_number" varchar(100),
	"cash_or_market_value" numeric(12, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "urla_liabilities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_sequence_number" integer DEFAULT 1,
	"liability_type" varchar(100) NOT NULL,
	"creditor_name" varchar(255),
	"account_number" varchar(100),
	"unpaid_balance" numeric(12, 2),
	"monthly_payment" numeric(10, 2),
	"to_be_paid_off" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "urla_personal_info" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_sequence_number" integer DEFAULT 1,
	"is_primary_borrower" boolean DEFAULT true,
	"first_name" varchar(100),
	"middle_name" varchar(100),
	"last_name" varchar(100),
	"suffix" varchar(20),
	"ssn" varchar(11),
	"ssn_encrypted" text,
	"ssn_iv" varchar(32),
	"ssn_key_id" varchar(10),
	"ssn_last4" varchar(4),
	"date_of_birth" varchar(10),
	"citizenship" varchar(50),
	"alternate_names" text,
	"credit_type" varchar(50),
	"total_borrowers" integer,
	"co_borrower_names" text,
	"marital_status" varchar(50),
	"number_of_dependents" integer,
	"dependent_ages" text,
	"home_phone" varchar(20),
	"cell_phone" varchar(20),
	"work_phone" varchar(20),
	"work_phone_ext" varchar(10),
	"email" varchar(255),
	"current_street" text,
	"current_unit" varchar(20),
	"current_city" varchar(100),
	"current_state" varchar(50),
	"current_zip" varchar(20),
	"current_country" varchar(100),
	"current_address_years" integer,
	"current_address_months" integer,
	"current_housing_type" varchar(50),
	"current_rent_amount" numeric(10, 2),
	"former_street" text,
	"former_unit" varchar(20),
	"former_city" varchar(100),
	"former_state" varchar(50),
	"former_zip" varchar(20),
	"former_country" varchar(100),
	"former_address_years" integer,
	"former_address_months" integer,
	"former_housing_type" varchar(50),
	"former_rent_amount" numeric(10, 2),
	"mailing_different" boolean DEFAULT false,
	"mailing_street" text,
	"mailing_unit" varchar(20),
	"mailing_city" varchar(100),
	"mailing_state" varchar(50),
	"mailing_zip" varchar(20),
	"mailing_country" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "urla_property_info" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"property_street" text,
	"property_unit" varchar(20),
	"property_city" varchar(100),
	"property_state" varchar(50),
	"property_zip" varchar(20),
	"property_county" varchar(100),
	"property_country" varchar(100),
	"number_of_units" integer,
	"property_value" numeric(12, 2),
	"occupancy_type" varchar(50),
	"is_mixed_use" boolean DEFAULT false,
	"mixed_use_description" text,
	"is_manufactured_home" boolean DEFAULT false,
	"manufactured_width" varchar(50),
	"legal_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"verification_type" varchar(50) NOT NULL,
	"plaid_item_id" varchar(255),
	"plaid_access_token" text,
	"plaid_verification_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"verification_method" varchar(50),
	"employer_name" varchar(255),
	"employer_address" text,
	"job_title" varchar(255),
	"start_date" timestamp,
	"end_date" timestamp,
	"is_current_employer" boolean,
	"employment_status" varchar(50),
	"annual_income" numeric(12, 2),
	"pay_frequency" varchar(50),
	"last_pay_date" timestamp,
	"last_pay_amount" numeric(10, 2),
	"identity_verified" boolean DEFAULT false,
	"identity_match_score" integer,
	"address_verified" boolean DEFAULT false,
	"ssn_verified" boolean DEFAULT false,
	"date_of_birth_verified" boolean DEFAULT false,
	"raw_response" jsonb,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wholesale_lenders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" varchar(100) NOT NULL,
	"lender_name" varchar(255) NOT NULL,
	"lender_code" varchar(20) NOT NULL,
	"primary_contact" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"portal_url" varchar(500),
	"integration_tier" varchar(20) DEFAULT 'MANUAL' NOT NULL,
	"api_config" jsonb,
	"capabilities" jsonb,
	"broker_compensation" jsonb,
	"status" varchar(20) DEFAULT 'ACTIVE',
	"is_preferred" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wholesale_lenders_lender_id_unique" UNIQUE("lender_id"),
	CONSTRAINT "wholesale_lenders_lender_code_unique" UNIQUE("lender_code")
);
--> statement-breakpoint
CREATE TABLE "anomalies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar NOT NULL,
	"category" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"source_document_ids" text[],
	"evidence_details" jsonb,
	"detection_method" varchar(100) NOT NULL,
	"detection_rule_id" varchar(100),
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_user_id" varchar,
	"resolved_at" timestamp,
	"detected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" varchar,
	"actor_role" varchar(50) NOT NULL,
	"actor_email" varchar(255),
	"event_category" varchar(50) NOT NULL,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"loan_id" varchar,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(255),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"event_hash" varchar(128),
	"previous_event_hash" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "canonical_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" varchar NOT NULL,
	"loan_id" varchar,
	"asset_type" varchar(50) NOT NULL,
	"institution_name" varchar(255),
	"account_number_masked" varchar(50),
	"cash_value" numeric(14, 2) NOT NULL,
	"market_value" numeric(14, 2),
	"vested_amount" numeric(14, 2),
	"gift_donor_name" varchar(255),
	"gift_donor_relationship" varchar(100),
	"source_document_ids" text[],
	"mismo_path" varchar(500) NOT NULL,
	"verification_source" varchar(50) NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "canonical_liabilities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" varchar NOT NULL,
	"loan_id" varchar,
	"liability_type" varchar(50) NOT NULL,
	"creditor_name" varchar(255),
	"account_number_masked" varchar(50),
	"monthly_payment" numeric(10, 2) NOT NULL,
	"remaining_balance" numeric(14, 2),
	"credit_limit" numeric(14, 2),
	"will_be_paid_off" boolean DEFAULT false,
	"months_remaining" integer,
	"source_type" varchar(50) NOT NULL,
	"source_document_ids" text[],
	"mismo_path" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cash_flow_adjustments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"income_stream_id" varchar NOT NULL,
	"loan_id" varchar,
	"adjustment_type" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"justification" text NOT NULL,
	"source_document_ids" text[],
	"tax_form_line" varchar(50),
	"verified_by" varchar,
	"verified_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "change_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"metric" varchar(100) NOT NULL,
	"previous_value" numeric(15, 4),
	"current_value" numeric(15, 4),
	"previous_bool_value" boolean,
	"current_bool_value" boolean,
	"previous_text_value" text,
	"current_text_value" text,
	"change_type" varchar(50) NOT NULL,
	"absolute_change" numeric(15, 4),
	"percent_change" numeric(10, 4),
	"source_document_id" varchar,
	"source_type" varchar(100),
	"is_processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "confidence_breakdowns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"result_id" varchar,
	"income_confidence" numeric(5, 2) NOT NULL,
	"document_confidence" numeric(5, 2) NOT NULL,
	"stability_confidence" numeric(5, 2) NOT NULL,
	"asset_confidence" numeric(5, 2) NOT NULL,
	"liability_confidence" numeric(5, 2) NOT NULL,
	"property_confidence" numeric(5, 2),
	"overall_confidence" numeric(5, 2) NOT NULL,
	"weights" jsonb NOT NULL,
	"weakest_component" varchar(50) NOT NULL,
	"remediation_suggestions" jsonb,
	"auto_approve_threshold" numeric(5, 2) DEFAULT '90.00',
	"lo_review_threshold" numeric(5, 2) DEFAULT '80.00',
	"recommended_action" varchar(50),
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_requirement_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" varchar(50) NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"description" text,
	"trigger_conditions" jsonb NOT NULL,
	"required_documents" jsonb NOT NULL,
	"generate_condition" boolean DEFAULT true,
	"condition_category" varchar(50),
	"condition_title" varchar(255),
	"condition_description" text,
	"condition_priority" varchar(50) DEFAULT 'prior_to_docs',
	"priority" integer DEFAULT 100,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "document_requirement_rules_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "escalation_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type_code" varchar(50),
	"escalation_level" integer NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_config" jsonb NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "income_streams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" varchar NOT NULL,
	"loan_id" varchar,
	"income_type" varchar(50) NOT NULL,
	"employer_name" varchar(255),
	"monthly_amount" numeric(12, 2) NOT NULL,
	"annual_amount" numeric(14, 2),
	"stability" varchar(50) NOT NULL,
	"years_at_employer" numeric(4, 1),
	"trend_slope" numeric(8, 4),
	"volatility_score" numeric(5, 2),
	"trend_direction" varchar(20),
	"trend_analysis_inputs" jsonb,
	"reliability_score" numeric(5, 2),
	"seasoning_months" integer,
	"seasoning_status" varchar(30),
	"qualification_status" varchar(30),
	"qualification_reason" text,
	"qualified_amount" numeric(12, 2),
	"source_document_ids" text[],
	"calculation_method" text,
	"calculation_inputs" jsonb,
	"mismo_path" varchar(500) NOT NULL,
	"verification_source" varchar(50),
	"verification_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_conditions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" varchar(50) DEFAULT 'prior_to_docs' NOT NULL,
	"status" varchar(50) DEFAULT 'outstanding' NOT NULL,
	"required_document_types" text[],
	"linked_task_id" varchar,
	"cleared_by_user_id" varchar,
	"cleared_at" timestamp,
	"clearance_notes" text,
	"is_auto_generated" boolean DEFAULT false,
	"source_rule" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materiality_evaluations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"change_event_id" varchar NOT NULL,
	"rule_set_id" varchar NOT NULL,
	"rule_set_version" varchar(20) NOT NULL,
	"rule_id" varchar NOT NULL,
	"rule_matched" boolean NOT NULL,
	"is_material" boolean NOT NULL,
	"severity" varchar(20),
	"required_action" varchar(50) NOT NULL,
	"explanation_message" text NOT NULL,
	"guideline_reference" varchar(200),
	"evaluation_context" jsonb,
	"is_aggregated_result" boolean DEFAULT false,
	"aggregated_materiality" boolean,
	"aggregated_required_action" varchar(50),
	"action_taken" varchar(50),
	"action_taken_at" timestamp,
	"action_taken_by" varchar,
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materiality_rule_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" varchar(100) NOT NULL,
	"product" varchar(50) NOT NULL,
	"authority" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"description" text,
	"is_draft" boolean DEFAULT true,
	"is_active" boolean DEFAULT false,
	"created_by" varchar,
	"published_at" timestamp,
	"published_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "materiality_rule_sets_rule_set_id_unique" UNIQUE("rule_set_id")
);
--> statement-breakpoint
CREATE TABLE "materiality_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" varchar NOT NULL,
	"rule_id" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"applies_to" jsonb,
	"when_metric" varchar(100) NOT NULL,
	"when_change_type" varchar(50) NOT NULL,
	"when_change_value" numeric(15, 4),
	"when_change_bool_value" boolean,
	"is_material" boolean NOT NULL,
	"severity" varchar(20) NOT NULL,
	"required_action" varchar(50) NOT NULL,
	"explanation_message" text NOT NULL,
	"guideline_reference" varchar(200),
	"priority" integer DEFAULT 100,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_approval_workflow" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_profile_id" varchar NOT NULL,
	"from_status" varchar(30) NOT NULL,
	"to_status" varchar(30) NOT NULL,
	"action" varchar(50) NOT NULL,
	"action_by" varchar NOT NULL,
	"action_at" timestamp DEFAULT now(),
	"justification" text,
	"bulletin_reference" varchar(200),
	"rejection_reason" text,
	"impacted_applications_count" integer,
	"impact_assessment" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_lender_overlays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_policy_profile_id" varchar NOT NULL,
	"lender_id" varchar(100) NOT NULL,
	"lender_name" varchar(255) NOT NULL,
	"version" varchar(20) NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"status" varchar(30) DEFAULT 'DRAFT' NOT NULL,
	"overlay_thresholds" jsonb,
	"additional_requirements" jsonb,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar(100) NOT NULL,
	"authority" varchar(50) NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"status" varchar(30) DEFAULT 'DRAFT' NOT NULL,
	"description" text,
	"bulletin_reference" varchar(200),
	"source_url" varchar(500),
	"parent_profile_id" varchar,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"activated_by" varchar,
	"activated_at" timestamp,
	"retired_by" varchar,
	"retired_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "policy_thresholds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_profile_id" varchar NOT NULL,
	"category" varchar(50) NOT NULL,
	"threshold_key" varchar(100) NOT NULL,
	"value_numeric" numeric(15, 4),
	"value_percent" numeric(6, 4),
	"value_bool" boolean,
	"value_enum" varchar(100),
	"min_bound" numeric(15, 4),
	"max_bound" numeric(15, 4),
	"materiality_action" varchar(50) DEFAULT 'REVIEW',
	"display_name" varchar(200),
	"description" text,
	"guideline_reference" varchar(200),
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_stress_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" varchar NOT NULL,
	"loan_id" varchar,
	"snapshot_id" varchar,
	"total_properties" integer NOT NULL,
	"total_gross_rent" numeric(14, 2) NOT NULL,
	"total_pitia" numeric(14, 2) NOT NULL,
	"base_dscr" numeric(6, 3) NOT NULL,
	"vacancy_shock_percent" numeric(5, 2) DEFAULT '10.00',
	"stressed_dscr_vacancy" numeric(6, 3),
	"rate_shock_bps" integer DEFAULT 200,
	"stressed_dscr_rate" numeric(6, 3),
	"combined_shock_dscr" numeric(6, 3),
	"property_breakdown" jsonb,
	"stress_test_result" varchar(30),
	"risk_score" numeric(5, 2),
	"recommendations" jsonb,
	"calculated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"rule_name" varchar(100) NOT NULL,
	"rule_version" varchar(20) DEFAULT '1.0',
	"front_end_dti_max" numeric(5, 2),
	"back_end_dti_max" numeric(5, 2) NOT NULL,
	"dti_exception_allowed" boolean DEFAULT false,
	"dti_exception_max" numeric(5, 2),
	"min_dscr" numeric(5, 2),
	"min_stressed_dscr" numeric(5, 2),
	"rental_income_treatment" varchar(50),
	"vacancy_factor" numeric(5, 2) DEFAULT '25.00',
	"student_loan_treatment" varchar(50),
	"student_loan_balance_percent" numeric(5, 3),
	"self_employment_min_months" integer DEFAULT 24,
	"self_employment_decline_rule" varchar(50),
	"min_reserve_months" integer,
	"reserve_calculation_method" varchar(50),
	"min_credit_score" integer,
	"additional_rules" jsonb,
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp DEFAULT now(),
	"expiration_date" timestamp,
	"guideline_source" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rule_execution_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"rule_id" varchar NOT NULL,
	"rule_code" varchar(50) NOT NULL,
	"rule_version" integer NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_context" jsonb,
	"conditions_met" boolean NOT NULL,
	"evaluation_details" jsonb,
	"actions_executed" jsonb,
	"action_results" jsonb,
	"impacted_entities" jsonb,
	"executed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seasoning_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_name" varchar(100) NOT NULL,
	"income_type" varchar(50) NOT NULL,
	"product_type" varchar(50),
	"minimum_months" integer NOT NULL,
	"optimal_months" integer,
	"insufficient_action" varchar(30) NOT NULL,
	"insufficient_cap_percent" numeric(5, 2),
	"conditions" jsonb,
	"priority" integer DEFAULT 100,
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sla_class_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sla_class" varchar(5) NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"target_resolution_minutes" integer,
	"escalation_start_minutes" integer,
	"hard_breach_minutes" integer,
	"blocks_loan_progress" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"color_code" varchar(20) DEFAULT 'gray',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sla_class_configs_sla_class_unique" UNIQUE("sla_class")
);
--> statement-breakpoint
CREATE TABLE "task_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"action" varchar(50) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"actor_user_id" varchar,
	"actor_role" varchar(50),
	"actor_type" varchar(20) DEFAULT 'user',
	"reason" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"is_verified" boolean DEFAULT false,
	"verification_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_source" varchar(50) NOT NULL,
	"application_id" varchar,
	"document_id" varchar,
	"event_payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"resulting_task_id" varchar,
	"idempotency_key" varchar(255),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "task_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "task_type_sla_mapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type_code" varchar(50) NOT NULL,
	"task_type_name" varchar(255) NOT NULL,
	"category" varchar(50),
	"sla_class" varchar(5) NOT NULL,
	"default_owner_role" varchar(20) NOT NULL,
	"auto_action_on_breach" jsonb,
	"auto_resolve_conditions" jsonb,
	"visible_to_borrower" boolean DEFAULT false,
	"borrower_display_text" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "task_type_sla_mapping_task_type_code_unique" UNIQUE("task_type_code")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"assigned_to_user_id" varchar,
	"created_by_user_id" varchar,
	"title" varchar(255) NOT NULL,
	"description" text,
	"task_type" varchar(50) NOT NULL,
	"task_type_code" varchar(50),
	"trigger_source" varchar(50) DEFAULT 'MANUAL',
	"owner_role" varchar(20) DEFAULT 'PROCESSOR',
	"sla_class" varchar(5) DEFAULT 'S3',
	"sla_due_at" timestamp,
	"escalation_level" integer DEFAULT 0,
	"escalated_at" timestamp,
	"document_category" varchar(50),
	"document_year" varchar(10),
	"document_instructions" text,
	"requesting_team" varchar(50),
	"is_custom_request" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"priority" varchar(20) DEFAULT 'NORMAL',
	"due_date" timestamp,
	"verification_status" varchar(50),
	"verification_notes" text,
	"verified_by_user_id" varchar,
	"verified_at" timestamp,
	"resolution_notes" text,
	"resolved_by_user_id" varchar,
	"completed_at" timestamp,
	"auto_resolved" boolean DEFAULT false,
	"auto_resolve_condition" varchar(100),
	"blocks_loan_progress" boolean DEFAULT false,
	"ai_analysis_result" jsonb,
	"ai_analyzed_at" timestamp,
	"extracted_data" jsonb,
	"trigger_metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "underwriting_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"result_id" varchar NOT NULL,
	"decision_version" integer NOT NULL,
	"inputs_hash" varchar(64) NOT NULL,
	"rules_version" varchar(50) NOT NULL,
	"decision" varchar(50) NOT NULL,
	"decision_reason" text,
	"conditions" jsonb,
	"frozen_dti" numeric(6, 3) NOT NULL,
	"frozen_dscr" numeric(6, 3),
	"frozen_ltv" numeric(6, 3),
	"frozen_credit_score" integer,
	"frozen_total_income" numeric(14, 2),
	"frozen_total_liabilities" numeric(14, 2),
	"full_inputs_json" jsonb NOT NULL,
	"decided_by" varchar,
	"decision_type" varchar(30) NOT NULL,
	"previous_decision_id" varchar,
	"decision_hash" varchar(64),
	"decided_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "underwriting_event_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar NOT NULL,
	"rule_id" varchar,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_data" jsonb,
	"actions_taken" jsonb NOT NULL,
	"status" varchar(50) NOT NULL,
	"error_message" text,
	"triggered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "underwriting_event_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_name" varchar(255) NOT NULL,
	"rule_description" text,
	"trigger_type" varchar(50) NOT NULL,
	"trigger_condition" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"applicable_loan_types" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "underwriting_explanations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"result_id" varchar,
	"rule_id" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"dti_impact" numeric(6, 3),
	"dscr_impact" numeric(6, 3),
	"is_override" boolean DEFAULT false,
	"override_justification" text,
	"override_approved_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "underwriting_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" varchar NOT NULL,
	"loan_id" varchar NOT NULL,
	"front_end_dti" numeric(5, 2) NOT NULL,
	"back_end_dti" numeric(5, 2) NOT NULL,
	"dscr" numeric(5, 3),
	"ltv" numeric(5, 2),
	"cltv" numeric(5, 2),
	"months_of_reserves" numeric(4, 1),
	"reserves_required" numeric(4, 1),
	"eligibility_status" varchar(50) NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"explanation" jsonb NOT NULL,
	"findings" jsonb,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "underwriting_rules_dsl" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_code" varchar(50) NOT NULL,
	"rule_name" varchar(200) NOT NULL,
	"rule_description" text,
	"product_types" text[],
	"income_types" text[],
	"trigger_type" varchar(50) NOT NULL,
	"trigger_conditions" jsonb NOT NULL,
	"conditions_dsl" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"priority" integer DEFAULT 100,
	"stop_on_match" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"previous_version_id" varchar,
	"category" varchar(50),
	"guideline_reference" varchar(255),
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp DEFAULT now(),
	"expiration_date" timestamp,
	"created_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "underwriting_rules_dsl_rule_code_unique" UNIQUE("rule_code")
);
--> statement-breakpoint
CREATE TABLE "underwriting_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar NOT NULL,
	"borrower_id" varchar NOT NULL,
	"snapshot_type" varchar(50) NOT NULL,
	"total_monthly_income" numeric(12, 2) NOT NULL,
	"income_breakdown" jsonb,
	"total_monthly_liabilities" numeric(12, 2) NOT NULL,
	"liability_breakdown" jsonb,
	"proposed_housing_expense" numeric(10, 2) NOT NULL,
	"total_liquid_assets" numeric(14, 2),
	"total_retirement_assets" numeric(14, 2),
	"source_document_ids" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "what_if_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar NOT NULL,
	"base_snapshot_id" varchar NOT NULL,
	"scenario_name" varchar(100) NOT NULL,
	"scenario_type" varchar(50) NOT NULL,
	"income_changes" jsonb,
	"liability_payoffs" jsonb,
	"down_payment_change" numeric(14, 2),
	"interest_rate_change" numeric(5, 3),
	"loan_amount_change" numeric(14, 2),
	"resulting_dti" numeric(6, 3),
	"resulting_front_end_dti" numeric(6, 3),
	"resulting_dscr" numeric(6, 3),
	"resulting_ltv" numeric(6, 3),
	"resulting_payment" numeric(12, 2),
	"dti_delta" numeric(6, 3),
	"dscr_delta" numeric(6, 3),
	"payment_delta" numeric(12, 2),
	"would_qualify" boolean,
	"qualification_issues" jsonb,
	"created_by" varchar,
	"shared_with_borrower" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "completeness_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logical_document_id" varchar NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"missing_items" jsonb NOT NULL,
	"expected_pages" integer,
	"found_pages" integer,
	"required_fields_found" jsonb,
	"required_fields_missing" text[],
	"balance_continuity_valid" boolean,
	"date_range_continuous" boolean,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_package_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"section_name" varchar(100),
	"display_order" integer DEFAULT 0,
	"custom_label" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"name" varchar(255) NOT NULL,
	"package_type" varchar(50) NOT NULL,
	"description" text,
	"sections" jsonb,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"recipient_type" varchar(50),
	"recipient_name" varchar(255),
	"sent_at" timestamp,
	"acknowledged_at" timestamp,
	"internal_notes" text,
	"delivery_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" varchar NOT NULL,
	"page_number" integer NOT NULL,
	"image_uri" text NOT NULL,
	"thumbnail_uri" text,
	"width" integer,
	"height" integer,
	"raw_ocr_text" text,
	"ocr_confidence" numeric(5, 4),
	"ocr_engine" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_uploads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar,
	"borrower_id" varchar NOT NULL,
	"original_file_name" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size_bytes" integer,
	"upload_source" varchar(50) NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"raw_file_uri" text NOT NULL,
	"checksum" varchar(128) NOT NULL,
	"processing_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"processing_error" text,
	"page_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "extracted_fields" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logical_document_id" varchar,
	"page_id" varchar NOT NULL,
	"field_name" varchar(255) NOT NULL,
	"field_category" varchar(100),
	"value_string" text,
	"value_numeric" numeric(18, 4),
	"value_date" timestamp,
	"value_boolean" boolean,
	"value_type" varchar(50) NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"bounding_box" jsonb,
	"mismo_path" varchar(500),
	"extraction_method" varchar(50) NOT NULL,
	"model_version" varchar(100),
	"human_verified" boolean DEFAULT false,
	"human_corrected_value" text,
	"verified_by_user_id" varchar,
	"verified_at" timestamp,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logical_document_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logical_document_id" varchar NOT NULL,
	"page_id" varchar NOT NULL,
	"page_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logical_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar,
	"borrower_id" varchar NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"aggregated_confidence" numeric(5, 4) NOT NULL,
	"status" varchar(50) DEFAULT 'needs_review' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"tax_year" integer,
	"institution_name" varchar(255),
	"account_number_masked" varchar(50),
	"expected_page_count" integer,
	"actual_page_count" integer,
	"is_complete" boolean DEFAULT false,
	"verified_by_user_id" varchar,
	"verified_at" timestamp,
	"verification_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "page_classifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"alternative_types" jsonb,
	"model_version" varchar(100) NOT NULL,
	"classification_method" varchar(50) NOT NULL,
	"human_reviewed" boolean DEFAULT false,
	"human_corrected_type" varchar(100),
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"classified_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adverse_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"credit_pull_id" varchar,
	"user_id" varchar NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"primary_reason" varchar(255) NOT NULL,
	"secondary_reasons" text[],
	"credit_score_used" integer,
	"credit_score_source" varchar(50),
	"score_range_low" integer,
	"score_range_high" integer,
	"bureau_name" varchar(100),
	"bureau_address" text,
	"bureau_phone" varchar(20),
	"bureau_website" varchar(255),
	"notice_text" text NOT NULL,
	"delivery_method" varchar(50),
	"delivered_at" timestamp,
	"delivery_confirmation" varchar(255),
	"notice_date" timestamp NOT NULL,
	"fcra_compliant" boolean DEFAULT true,
	"generated_by" varchar,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "borrower_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"template_id" varchar,
	"consent_type" varchar(50) NOT NULL,
	"template_version" varchar(20),
	"consent_given" boolean NOT NULL,
	"consent_method" varchar(50) NOT NULL,
	"signature_data" text,
	"signature_type" varchar(20),
	"ip_address" varchar(45),
	"user_agent" text,
	"browser_fingerprint" varchar(64),
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"is_revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"content_hash" varchar(64),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consent_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"state" varchar(2),
	"title" varchar(255) NOT NULL,
	"short_description" text,
	"full_text" text NOT NULL,
	"regulatory_reference" varchar(255),
	"required_for_loan_types" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" timestamp NOT NULL,
	"expiration_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" varchar NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"estimated_points_gain" integer,
	"actual_points_gain" integer,
	"priority" varchar(20) DEFAULT 'medium',
	"status" varchar(50) DEFAULT 'pending',
	"completed_at" timestamp,
	"creditor_name" varchar(255),
	"account_balance" numeric(10, 2),
	"recommended_payment" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar,
	"user_id" varchar,
	"consent_id" varchar,
	"credit_pull_id" varchar,
	"adverse_action_id" varchar,
	"action" varchar(100) NOT NULL,
	"action_details" jsonb,
	"performed_by" varchar,
	"performed_by_role" varchar(50),
	"ip_address" varchar(45),
	"user_agent" text,
	"entry_hash" varchar(64) NOT NULL,
	"previous_entry_hash" varchar(64),
	"sequence_number" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"disclosure_version" varchar(50) NOT NULL,
	"disclosure_text" text NOT NULL,
	"consent_given" boolean NOT NULL,
	"consent_timestamp" timestamp NOT NULL,
	"borrower_full_name" varchar(255) NOT NULL,
	"borrower_ssn_last4" varchar(4),
	"borrower_dob" varchar(10),
	"ip_address" varchar(45),
	"user_agent" text,
	"signature_type" varchar(50) DEFAULT 'electronic',
	"is_active" boolean DEFAULT true,
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_pulls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"consent_id" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"pull_type" varchar(50) NOT NULL,
	"bureaus" text[],
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"external_request_id" varchar(255),
	"experian_score" integer,
	"equifax_score" integer,
	"transunion_score" integer,
	"representative_score" integer,
	"vantage_score_4" integer,
	"total_tradelines" integer,
	"open_tradelines" integer,
	"total_debt" numeric(12, 2),
	"monthly_payments" numeric(10, 2),
	"derogatory_count" integer,
	"inquiry_count_30_days" integer,
	"inquiry_count_90_days" integer,
	"report_storage_ref" varchar(500),
	"liabilities" jsonb,
	"encrypted_raw_response" text,
	"encryption_key_id" varchar(100),
	"encryption_iv" varchar(48),
	"vendor_request_id" varchar(255),
	"vendor_response_hash" varchar(64),
	"vendor_billing_ref" varchar(255),
	"error_code" varchar(50),
	"error_message" text,
	"requested_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"expires_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "draft_consent_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" varchar(50) DEFAULT 'hard_pull',
	"borrower_full_name" varchar(255),
	"borrower_ssn_last4" varchar(4),
	"borrower_dob" varchar(10),
	"disclosure_read" boolean DEFAULT false,
	"acknowledged" boolean DEFAULT false,
	"current_step" integer DEFAULT 1,
	"total_steps" integer DEFAULT 3,
	"state_disclosures_reviewed" text[],
	"additional_acknowledgments" jsonb,
	"last_saved_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hmda_demographics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_id" varchar NOT NULL,
	"borrower_sequence_number" integer DEFAULT 1,
	"ethnicity_hispanic_latino" boolean,
	"ethnicity_mexican" boolean DEFAULT false,
	"ethnicity_cuban" boolean DEFAULT false,
	"ethnicity_puerto_rican" boolean DEFAULT false,
	"ethnicity_other_hispanic_latino" boolean DEFAULT false,
	"ethnicity_other_text" varchar(255),
	"ethnicity_not_hispanic_latino" boolean,
	"ethnicity_not_provided" boolean DEFAULT false,
	"race_american_indian" boolean DEFAULT false,
	"race_american_indian_tribe" varchar(255),
	"race_asian" boolean DEFAULT false,
	"race_asian_indian" boolean DEFAULT false,
	"race_chinese" boolean DEFAULT false,
	"race_filipino" boolean DEFAULT false,
	"race_japanese" boolean DEFAULT false,
	"race_korean" boolean DEFAULT false,
	"race_vietnamese" boolean DEFAULT false,
	"race_other_asian" boolean DEFAULT false,
	"race_other_asian_text" varchar(255),
	"race_black" boolean DEFAULT false,
	"race_native_hawaiian" boolean DEFAULT false,
	"race_guamanian" boolean DEFAULT false,
	"race_samoan" boolean DEFAULT false,
	"race_other_pacific_islander" boolean DEFAULT false,
	"race_other_pacific_islander_text" varchar(255),
	"race_white" boolean DEFAULT false,
	"race_not_provided" boolean DEFAULT false,
	"sex_female" boolean,
	"sex_male" boolean,
	"sex_not_provided" boolean DEFAULT false,
	"age" integer,
	"age_not_provided" boolean DEFAULT false,
	"collection_method" varchar(30) DEFAULT 'borrower' NOT NULL,
	"observed_by_visual" boolean DEFAULT false,
	"observed_by_surname" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "homeownership_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"current_credit_score" integer,
	"current_monthly_savings" numeric(10, 2),
	"current_savings_balance" numeric(12, 2) DEFAULT '0',
	"monthly_income" numeric(10, 2),
	"monthly_debts" numeric(10, 2),
	"current_rent" numeric(10, 2),
	"target_credit_score" integer DEFAULT 640,
	"target_down_payment" numeric(12, 2),
	"target_home_price" numeric(12, 2),
	"target_monthly_payment" numeric(10, 2),
	"journey_start_date" timestamp DEFAULT now(),
	"current_phase" varchar(50) DEFAULT 'discovery',
	"journey_day" integer DEFAULT 1,
	"credit_score_change" integer DEFAULT 0,
	"savings_progress" numeric(12, 2) DEFAULT '0',
	"target_city" varchar(100),
	"target_state" varchar(50),
	"target_zip_code" varchar(20),
	"referring_agent_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "homeownership_goals_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "journey_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" varchar NOT NULL,
	"milestone_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"celebration_message" text,
	"achieved_at" timestamp DEFAULT now(),
	"points_awarded" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "savings_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" varchar NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" varchar(255),
	"running_balance" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(30) NOT NULL,
	"report_type" varchar(30) NOT NULL,
	"voa_report_id" varchar(255),
	"voie_report_id" varchar(255),
	"audit_copy_token" varchar(255),
	"provider_request_id" varchar(255),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"days_requested" integer,
	"gse_eligible" boolean DEFAULT false NOT NULL,
	"institution_count" integer,
	"account_count" integer,
	"total_balance" numeric(14, 2),
	"payload_storage_ref" varchar(500),
	"raw_payload" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar(200) DEFAULT 'New Conversation',
	"readiness_tier" varchar(30),
	"completion_percentage" integer,
	"financial_profile" jsonb,
	"action_plan" jsonb,
	"recommended_loan_types" jsonb,
	"document_checklist" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coach_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"structured_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coaching_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" varchar NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30,
	"topic" varchar(500),
	"notes" text,
	"action_items" jsonb,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"bio" text,
	"phone_number" varchar(20),
	"license_number" varchar(50),
	"license_expiry" varchar(10),
	"brokerage" varchar(255),
	"years_in_business" integer,
	"specialties" text[],
	"service_area" text[],
	"photo_bucket" varchar,
	"photo_url" varchar,
	"average_rating" numeric(3, 2),
	"total_reviews" integer DEFAULT 0,
	"properties_sold" integer DEFAULT 0,
	"active_listings" integer DEFAULT 0,
	"social_links" jsonb,
	"website" varchar(255),
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "equity_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homeowner_profile_id" varchar NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"estimated_value" numeric,
	"loan_balance" numeric,
	"equity_amount" numeric,
	"equity_percent" numeric(5, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "homeowner_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"original_loan_amount" numeric,
	"current_loan_balance" numeric,
	"interest_rate" numeric(5, 3),
	"monthly_payment" numeric,
	"property_value" numeric,
	"purchase_price" numeric,
	"purchase_date" timestamp,
	"loan_close_date" timestamp,
	"property_address" varchar(500),
	"next_review_date" timestamp,
	"last_review_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mls_id" varchar(100),
	"agent_id" varchar,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(50) NOT NULL,
	"zip_code" varchar(20) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"property_type" varchar(50),
	"bedrooms" integer,
	"bathrooms" numeric(3, 1),
	"square_feet" integer,
	"lot_size" numeric(10, 2),
	"year_built" integer,
	"description" text,
	"features" text[],
	"images" text[],
	"status" varchar(50) DEFAULT 'active',
	"listed_at" timestamp,
	"sold_at" timestamp,
	"sold_price" numeric(12, 2),
	"avm_value" numeric(12, 2),
	"avm_confidence" numeric(5, 4),
	"avm_provider" varchar(50),
	"avm_as_of" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refi_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homeowner_profile_id" varchar NOT NULL,
	"current_rate" numeric(5, 3) NOT NULL,
	"market_rate" numeric(5, 3) NOT NULL,
	"potential_savings_monthly" numeric,
	"potential_savings_lifetime" numeric,
	"is_actionable" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accelerator_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"program_type" varchar(50) NOT NULL,
	"current_phase" integer DEFAULT 1,
	"total_phases" integer DEFAULT 6,
	"target_date" timestamp,
	"current_credit_score" integer,
	"target_credit_score" integer,
	"current_savings" numeric,
	"target_down_payment" numeric,
	"current_dti" numeric,
	"target_dti" numeric,
	"monthly_budget" numeric,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accelerator_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" varchar NOT NULL,
	"phase" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"target_value" varchar(100),
	"current_value" varchar(100),
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_pipeline_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_user_id" varchar NOT NULL,
	"application_id" varchar NOT NULL,
	"borrower_name" varchar(255),
	"current_stage" varchar(50),
	"last_milestone" varchar(255),
	"next_step" varchar(255),
	"estimated_close_date" timestamp,
	"loan_amount" numeric,
	"property_address" varchar(500),
	"last_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_referral_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"location" varchar(255) NOT NULL,
	"buying_timeline" varchar(50) NOT NULL,
	"price_range" varchar(50),
	"property_type" varchar(50),
	"special_needs" text,
	"pre_approved" boolean DEFAULT false,
	"preferred_agent_id" varchar,
	"matched_agent_id" varchar,
	"status" varchar(30) DEFAULT 'pending',
	"referral_sent_at" timestamp,
	"agent_responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"featured_image" varchar(500),
	"category_id" varchar,
	"tags" text[],
	"meta_title" varchar(255),
	"meta_description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"author_id" varchar,
	"view_count" integer DEFAULT 0,
	"read_time_minutes" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" varchar,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" varchar,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broker_commissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" varchar NOT NULL,
	"application_id" varchar NOT NULL,
	"loan_amount" numeric(12, 2) NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"paid_by" varchar,
	"payment_reference" varchar(255),
	"payment_method" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calculator_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"annual_income" integer,
	"monthly_debts" integer,
	"credit_score" integer,
	"down_payment_saved" integer,
	"debts" jsonb,
	"calculator_inputs" jsonb,
	"calculator_results" jsonb,
	"max_home_price" integer,
	"zip_code" varchar(10),
	"converted_to_user" boolean DEFAULT false,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "calculator_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "calculator_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"calculator_type" varchar(50) NOT NULL,
	"inputs" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "closing_guarantees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"guarantee_type" varchar(50) NOT NULL,
	"target_date" timestamp NOT NULL,
	"target_hours" integer,
	"actual_date" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_at_risk" boolean DEFAULT false,
	"risk_reason" text,
	"is_met" boolean,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "co_brand_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"brand_name" varchar(255) NOT NULL,
	"tagline" varchar(500),
	"logo_url" text,
	"hero_image_url" text,
	"primary_color" varchar(20) DEFAULT '#1e3a5f',
	"accent_color" varchar(20) DEFAULT '#10b981',
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"website_url" text,
	"nmls_id" varchar(50),
	"license_number" varchar(100),
	"disclaimer_text" text,
	"bio" text,
	"specialties" text[],
	"service_areas" text[],
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(20),
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "content_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deal_desk_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"sender_user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_desk_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_user_id" varchar NOT NULL,
	"lo_user_id" varchar,
	"subject" varchar(500) NOT NULL,
	"scenario_type" varchar(50),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"loan_amount" numeric,
	"property_type" varchar(50),
	"credit_score" integer,
	"borrower_type" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "deal_rescue_escalations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar,
	"reported_by_user_id" varchar NOT NULL,
	"assigned_to_user_id" varchar,
	"urgency" varchar(20) DEFAULT 'high' NOT NULL,
	"issue_type" varchar(50) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"borrower_name" varchar(255),
	"property_address" varchar(500),
	"closing_date" timestamp,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp,
	"resolved_by_user_id" varchar,
	"sla_deadline" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dpa_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"program_type" varchar(50) NOT NULL,
	"state" varchar(2),
	"description" text NOT NULL,
	"assistance_type" varchar(50) NOT NULL,
	"max_assistance_amount" numeric,
	"max_assistance_percent" numeric,
	"min_credit_score" integer,
	"max_income" numeric,
	"max_home_price" numeric,
	"first_time_buyer_only" boolean DEFAULT false,
	"eligibility_notes" text,
	"application_url" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_captures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"source" varchar(50) DEFAULT 'website',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category_id" varchar,
	"tags" text[],
	"search_keywords" text[],
	"display_order" integer DEFAULT 0,
	"is_popular" boolean DEFAULT false,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"author_id" varchar,
	"helpful_count" integer DEFAULT 0,
	"not_helpful_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kba_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"questions_data" jsonb,
	"answers_data" jsonb,
	"score" integer,
	"total_questions" integer DEFAULT 5,
	"passing_score" integer DEFAULT 4,
	"attempt_number" integer DEFAULT 1,
	"max_attempts" integer DEFAULT 3,
	"started_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_screenings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"overall_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"ofac_status" varchar(50) DEFAULT 'pending',
	"ofac_checked_at" timestamp,
	"sanctions_status" varchar(50) DEFAULT 'pending',
	"sanctions_checked_at" timestamp,
	"pep_status" varchar(50) DEFAULT 'pending',
	"pep_checked_at" timestamp,
	"adverse_media_status" varchar(50) DEFAULT 'pending',
	"adverse_media_checked_at" timestamp,
	"risk_level" varchar(20),
	"risk_score" integer,
	"screening_notes" text,
	"reviewed_by_user_id" varchar,
	"reviewed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"status" varchar(20) DEFAULT 'unread' NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"step" varchar(100),
	"rating" integer,
	"comment" text,
	"feedback_type" varchar(50) DEFAULT 'general',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"borrower_type" varchar(50) DEFAULT 'first_time_buyer',
	"journey_status" varchar(50) DEFAULT 'not_started',
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"current_step" varchar(100),
	"identity_verified" boolean DEFAULT false,
	"kyc_cleared" boolean DEFAULT false,
	"documents_complete" boolean DEFAULT false,
	"personal_info_complete" boolean DEFAULT false,
	"progress_percent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"order_reference" varchar(100),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"result_summary" jsonb,
	"credit_score_experian" integer,
	"credit_score_equifax" integer,
	"credit_score_transunion" integer,
	"appraised_value" numeric(12, 2),
	"title_status" varchar(50),
	"fee" numeric(10, 2),
	"fee_paid_by_borrower" boolean DEFAULT true,
	"ordered_at" timestamp DEFAULT now(),
	"ordered_by" varchar NOT NULL,
	"submitted_at" timestamp,
	"completed_at" timestamp,
	"error_code" varchar(50),
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"result_document_path" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_providers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50) NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"api_base_url" varchar(255),
	"api_version" varchar(20),
	"credential_secret_key" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_test_mode" boolean DEFAULT true NOT NULL,
	"base_fee" numeric(10, 2),
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"expected_turnaround_hours" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "partner_providers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "staff_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"role" varchar(50) NOT NULL,
	"email" varchar(255),
	"created_by" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "staff_invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "strategy_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_user_id" varchar NOT NULL,
	"lo_user_id" varchar,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30,
	"session_type" varchar(50) DEFAULT 'weekly_review',
	"topic" varchar(500),
	"notes" text,
	"action_items" jsonb,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar(100),
	"activity_type" varchar(50) NOT NULL,
	"page" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(30) NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"application_id" varchar,
	"user_id" varchar,
	"actor_id" varchar,
	"actor_role" varchar(30),
	"entity_type" varchar(50),
	"entity_id" varchar(255),
	"payload" jsonb,
	"numeric_value" numeric(14, 4),
	"text_value" varchar(500),
	"previous_value" jsonb,
	"new_value" jsonb,
	"source" varchar(30) DEFAULT 'system',
	"automation_triggered" boolean DEFAULT false,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anonymized_borrower_facts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_date" timestamp NOT NULL,
	"geo_state_bucket" varchar(50),
	"geo_metro_bucket" varchar(100),
	"credit_score_bucket" varchar(20),
	"income_bucket" varchar(20),
	"age_bucket" varchar(20),
	"loan_purpose" varchar(50),
	"product_type" varchar(50),
	"property_type" varchar(50),
	"avg_dti" numeric(5, 2),
	"avg_ltv" numeric(5, 2),
	"avg_loan_amount" numeric(14, 2),
	"avg_down_payment_percent" numeric(5, 2),
	"median_credit_score" integer,
	"median_income" numeric(14, 2),
	"avg_time_to_pre_approval_days" numeric(5, 1),
	"avg_time_to_close_days" numeric(5, 1),
	"conversion_rate" numeric(5, 4),
	"fallout_rate" numeric(5, 4),
	"fallout_reasons" jsonb,
	"borrower_count" integer NOT NULL,
	"readiness_distribution" jsonb,
	"top_barriers" jsonb,
	"top_loan_types" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "borrower_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"citizenship_status" varchar(50),
	"visa_type" varchar(50),
	"visa_expiration_date" varchar(10),
	"marital_status" varchar(30),
	"number_of_dependents" integer,
	"dependent_ages" text,
	"date_of_birth" varchar(10),
	"language_preference" varchar(20) DEFAULT 'en',
	"current_housing_status" varchar(30),
	"current_monthly_housing_payment" numeric(10, 2),
	"current_address_months" integer,
	"previous_address_count" integer,
	"military_status" varchar(50),
	"military_branch" varchar(50),
	"military_service_start" varchar(10),
	"military_service_end" varchar(10),
	"va_entitlement_used" boolean DEFAULT false,
	"va_funding_fee_exempt" boolean DEFAULT false,
	"has_co_borrower" boolean DEFAULT false,
	"co_borrower_user_id" varchar,
	"co_borrower_relationship" varchar(50),
	"has_real_estate_owned" boolean DEFAULT false,
	"real_estate_owned_count" integer DEFAULT 0,
	"has_foreclosure_history" boolean DEFAULT false,
	"has_bankruptcy_history" boolean DEFAULT false,
	"foreclosure_discharge_date" varchar(10),
	"bankruptcy_discharge_date" varchar(10),
	"self_reported_credit_score" integer,
	"self_reported_annual_income" numeric(14, 2),
	"self_reported_total_assets" numeric(14, 2),
	"self_reported_total_debts" numeric(10, 2),
	"risk_tolerance" varchar(20),
	"communication_preference" varchar(20),
	"timezone_name" varchar(50),
	"analytics_consent_given" boolean DEFAULT false,
	"analytics_consent_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "borrower_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "borrower_state_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"from_state" varchar(50),
	"to_state" varchar(50) NOT NULL,
	"trigger" varchar(50) NOT NULL,
	"trigger_metadata" jsonb,
	"triggered_by_user_id" varchar,
	"triggered_by_system" boolean DEFAULT false,
	"duration_in_previous_state_minutes" integer,
	"transitioned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_confidence_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"application_id" varchar,
	"extraction_engine" varchar(30) DEFAULT 'gemini',
	"extraction_version" varchar(20),
	"overall_confidence" numeric(5, 4) NOT NULL,
	"field_confidences" jsonb,
	"human_review_required" boolean DEFAULT false,
	"human_review_completed" boolean DEFAULT false,
	"human_reviewed_by" varchar,
	"human_reviewed_at" timestamp,
	"fields_extracted" integer DEFAULT 0,
	"fields_correct" integer,
	"fields_corrected" integer,
	"fields_missed" integer,
	"field_accuracy_pct" numeric(5, 2),
	"processing_time_ms" integer,
	"file_size" integer,
	"page_count" integer,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intent_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar(100),
	"event_type" varchar(50) NOT NULL,
	"event_category" varchar(50),
	"target_type" varchar(50),
	"target_id" varchar(255),
	"target_label" varchar(255),
	"metadata" jsonb,
	"page_path" varchar(500),
	"referrer_path" varchar(500),
	"device_type" varchar(20),
	"duration_ms" integer,
	"geo_state" varchar(50),
	"geo_metro" varchar(100),
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lender_match_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"lender_product_id" varchar NOT NULL,
	"match_status" varchar(30) NOT NULL,
	"match_score" numeric(5, 2),
	"eligibility_details" jsonb,
	"disqualifying_factors" jsonb,
	"conditional_factors" jsonb,
	"estimated_rate" numeric(5, 3),
	"estimated_monthly_payment" numeric(10, 2),
	"estimated_closing_costs" numeric(10, 2),
	"borrower_snapshot_hash" varchar(64),
	"matched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lender_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lender_id" varchar(100) NOT NULL,
	"lender_name" varchar(255) NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"product_code" varchar(50),
	"product_type" varchar(50) NOT NULL,
	"loan_purposes" text[],
	"occupancy_types" text[],
	"property_types" text[],
	"allowed_states" text[],
	"excluded_states" text[],
	"min_credit_score" integer,
	"max_dti" numeric(5, 2),
	"max_ltv" numeric(5, 2),
	"max_cltv" numeric(5, 2),
	"min_loan_amount" numeric(14, 2),
	"max_loan_amount" numeric(14, 2),
	"min_down_payment_percent" numeric(5, 2),
	"min_reserve_months" integer,
	"allows_self_employed" boolean DEFAULT true,
	"allows_non_permanent_resident" boolean DEFAULT false,
	"allows_foreign_national" boolean DEFAULT false,
	"requires_escrow" boolean DEFAULT true,
	"allows_gift_funds" boolean DEFAULT true,
	"allows_interest_only" boolean DEFAULT false,
	"self_employment_min_months" integer DEFAULT 24,
	"bankruptcy_seasoning_months" integer,
	"foreclosure_seasoning_months" integer,
	"pmi_required" boolean DEFAULT false,
	"pmi_threshold_ltv" numeric(5, 2),
	"base_rate" numeric(5, 3),
	"rate_adjustments" jsonb,
	"closing_cost_range" jsonb,
	"special_programs" text[],
	"first_time_buyer_only" boolean DEFAULT false,
	"veteran_only" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"pre_approval_amount" numeric(14, 2),
	"final_loan_amount" numeric(14, 2),
	"amount_accuracy_pct" numeric(5, 2),
	"estimated_rate" numeric(5, 3),
	"final_rate" numeric(5, 3),
	"rate_accuracy_bps" numeric(6, 2),
	"estimated_closing_costs" numeric(10, 2),
	"actual_closing_costs" numeric(10, 2),
	"estimated_dti" numeric(5, 2),
	"final_dti" numeric(5, 2),
	"estimated_ltv" numeric(5, 2),
	"final_ltv" numeric(5, 2),
	"submitted_at" timestamp,
	"pre_approved_at" timestamp,
	"conditional_at" timestamp,
	"clear_to_close_at" timestamp,
	"funded_at" timestamp,
	"denied_at" timestamp,
	"withdrawn_at" timestamp,
	"days_submitted_to_pre_approval" integer,
	"days_pre_approval_to_conditional" integer,
	"days_conditional_to_ctc" integer,
	"days_ctc_to_funded" integer,
	"total_days_to_close" integer,
	"outcome" varchar(30),
	"fallout_reason" varchar(100),
	"fallout_stage" varchar(50),
	"conditions_issued_count" integer DEFAULT 0,
	"conditions_cleared_count" integer DEFAULT 0,
	"conditions_waived_count" integer DEFAULT 0,
	"avg_condition_clearance_days" numeric(5, 1),
	"uw_decision_overridden" boolean DEFAULT false,
	"uw_override_reason" varchar(255),
	"document_resubmission_count" integer DEFAULT 0,
	"automated_steps_count" integer DEFAULT 0,
	"manual_steps_count" integer DEFAULT 0,
	"loan_purpose" varchar(50),
	"product_type" varchar(50),
	"property_type" varchar(50),
	"property_state" varchar(50),
	"credit_score_bucket" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "loan_outcomes_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "predictive_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar,
	"user_id" varchar NOT NULL,
	"likelihood_to_close" numeric(5, 4),
	"estimated_days_to_fund" integer,
	"risk_of_fallout" numeric(5, 4),
	"condition_delay_risk" numeric(5, 4),
	"risk_factors" jsonb,
	"positive_factors" jsonb,
	"comparison_cohort" varchar(100),
	"cohort_avg_days_to_close" integer,
	"cohort_conversion_rate" numeric(5, 4),
	"model_version" varchar(20) DEFAULT 'v1',
	"input_hash" varchar(64),
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "readiness_checklist" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"category" varchar(50) NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"field_label" varchar(255) NOT NULL,
	"is_required" boolean DEFAULT true,
	"is_collected" boolean DEFAULT false,
	"verification_status" varchar(50) DEFAULT 'not_collected',
	"trust_tier" varchar(10),
	"source_table" varchar(100),
	"source_field" varchar(100),
	"source_record_id" varchar(100),
	"collected_at" timestamp,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"weight" numeric(5, 2) DEFAULT '1.00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "real_estate_owned" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"application_id" varchar,
	"property_address" text NOT NULL,
	"property_city" varchar(100),
	"property_state" varchar(50),
	"property_zip" varchar(20),
	"property_type" varchar(50),
	"market_value" numeric(14, 2),
	"mortgage_balance" numeric(14, 2),
	"mortgage_payment" numeric(10, 2),
	"monthly_rental_income" numeric(10, 2),
	"monthly_insurance" numeric(10, 2),
	"monthly_taxes" numeric(10, 2),
	"monthly_hoa" numeric(10, 2),
	"occupancy_type" varchar(50),
	"status" varchar(50) DEFAULT 'retained',
	"will_be_sold" boolean DEFAULT false,
	"will_be_rented" boolean DEFAULT false,
	"net_equity" numeric(14, 2),
	"net_rental_income" numeric(10, 2),
	"verification_source" varchar(50),
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lookup_matrices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_code" varchar(100) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"lifecycle_status" "policy_lifecycle_status" DEFAULT 'DRAFT' NOT NULL,
	"previous_version_id" uuid,
	"effective_date" timestamp with time zone NOT NULL,
	"expiration_date" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookup_matrix_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matrix_id" uuid NOT NULL,
	"dim1_min" numeric(14, 2),
	"dim1_max" numeric(14, 2),
	"dim2_min" numeric(14, 2),
	"dim2_max" numeric(14, 2),
	"dim3_identifier" varchar(100),
	"output_value" numeric(12, 6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar,
	"user_id" varchar,
	"workflow" varchar(100) NOT NULL,
	"user_role" varchar(50),
	"provider" varchar(30) NOT NULL,
	"model" varchar(100) NOT NULL,
	"system_prompt" text,
	"prompt" text NOT NULL,
	"response" text,
	"classification" varchar(50) NOT NULL,
	"review_status" varchar(30) DEFAULT 'not_required' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"is_error" varchar(5) DEFAULT 'false',
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"trigger" varchar(50) NOT NULL,
	"status" varchar(30) NOT NULL,
	"decision" varchar(30),
	"qualifier" varchar(20) NOT NULL,
	"dti" numeric(6, 2),
	"ltv" numeric(6, 2),
	"monthly_income" numeric(12, 2),
	"monthly_debts" numeric(12, 2),
	"monthly_piti" numeric(12, 2),
	"loan_amount" numeric(14, 2),
	"borrower_count" integer,
	"income_basis" varchar(30),
	"reasons" text[],
	"missing_items" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(100) NOT NULL,
	"source_campaign" varchar(255),
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(255),
	"external_lead_id" varchar(255),
	"raw_payload" jsonb,
	"trusted_form_cert_url" varchar(500),
	"consent_tcpa_text" text,
	"consent_captured_at" timestamp,
	"consent_ip" varchar(64),
	"consent_user_agent" text,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"opt_out_at" timestamp,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(40),
	"loan_purpose" varchar(50),
	"property_zip" varchar(20),
	"property_state" varchar(2),
	"estimated_property_value" numeric(12, 2),
	"estimated_down_payment" numeric(12, 2),
	"self_reported_credit_range" varchar(20),
	"status" varchar(30) DEFAULT 'new' NOT NULL,
	"assigned_to_id" varchar,
	"converted_user_id" varchar,
	"converted_application_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_users_id_fk" FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_confidence_views" ADD CONSTRAINT "agent_confidence_views_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_confidence_views" ADD CONSTRAINT "agent_confidence_views_confidence_breakdown_id_confidence_breakdowns_id_fk" FOREIGN KEY ("confidence_breakdown_id") REFERENCES "public"."confidence_breakdowns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_confidence_views" ADD CONSTRAINT "agent_confidence_views_underwriting_snapshot_id_underwriting_decisions_id_fk" FOREIGN KEY ("underwriting_snapshot_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_invites" ADD CONSTRAINT "application_invites_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_invites" ADD CONSTRAINT "application_invites_loan_application_id_loan_applications_id_fk" FOREIGN KEY ("loan_application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_milestones" ADD CONSTRAINT "application_milestones_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_properties" ADD CONSTRAINT "application_properties_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_declarations" ADD CONSTRAINT "borrower_declarations_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_declarations" ADD CONSTRAINT "borrower_declarations_declarations_verified_by_users_id_fk" FOREIGN KEY ("declarations_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_offer_controls" ADD CONSTRAINT "broker_offer_controls_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_consent_id_credit_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."credit_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_previous_snapshot_id_underwriting_decisions_id_fk" FOREIGN KEY ("previous_snapshot_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_new_snapshot_id_underwriting_decisions_id_fk" FOREIGN KEY ("new_snapshot_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_previous_letter_id_pre_approval_letters_id_fk" FOREIGN KEY ("previous_letter_id") REFERENCES "public"."pre_approval_letters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_new_letter_id_pre_approval_letters_id_fk" FOREIGN KEY ("new_letter_id") REFERENCES "public"."pre_approval_letters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_refresh_decisions" ADD CONSTRAINT "credit_refresh_decisions_decision_made_by_users_id_fk" FOREIGN KEY ("decision_made_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_team_members" ADD CONSTRAINT "deal_team_members_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_team_members" ADD CONSTRAINT "deal_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_team_members" ADD CONSTRAINT "deal_team_members_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclaimer_versions" ADD CONSTRAINT "disclaimer_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_expirations" ADD CONSTRAINT "document_expirations_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_expirations" ADD CONSTRAINT "document_expirations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_expirations" ADD CONSTRAINT "document_expirations_policy_id_expiration_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."expiration_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_data_packages" ADD CONSTRAINT "lender_data_packages_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_data_packages" ADD CONSTRAINT "lender_data_packages_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_data_packages" ADD CONSTRAINT "lender_data_packages_lender_format_id_lender_pre_approval_formats_id_fk" FOREIGN KEY ("lender_format_id") REFERENCES "public"."lender_pre_approval_formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_offers" ADD CONSTRAINT "lender_offers_lender_id_wholesale_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."wholesale_lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_offers" ADD CONSTRAINT "lender_offers_product_id_rate_sheet_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."rate_sheet_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_offers" ADD CONSTRAINT "lender_offers_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_offers" ADD CONSTRAINT "lender_offers_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_pricing_adjustments" ADD CONSTRAINT "lender_pricing_adjustments_lender_id_wholesale_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."wholesale_lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_pricing_adjustments" ADD CONSTRAINT "lender_pricing_adjustments_rate_sheet_id_rate_sheets_id_fk" FOREIGN KEY ("rate_sheet_id") REFERENCES "public"."rate_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_generation_logs" ADD CONSTRAINT "letter_generation_logs_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_generation_logs" ADD CONSTRAINT "letter_generation_logs_letter_id_pre_approval_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."pre_approval_letters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_generation_logs" ADD CONSTRAINT "letter_generation_logs_previous_snapshot_id_underwriting_decisions_id_fk" FOREIGN KEY ("previous_snapshot_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_generation_logs" ADD CONSTRAINT "letter_generation_logs_new_snapshot_id_underwriting_decisions_id_fk" FOREIGN KEY ("new_snapshot_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_generation_logs" ADD CONSTRAINT "letter_generation_logs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_financial_data_verified_by_users_id_fk" FOREIGN KEY ("financial_data_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_referring_broker_id_users_id_fk" FOREIGN KEY ("referring_broker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_loan_officer_id_users_id_fk" FOREIGN KEY ("loan_officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_milestones" ADD CONSTRAINT "loan_milestones_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_options" ADD CONSTRAINT "loan_options_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lock_requests" ADD CONSTRAINT "lock_requests_offer_id_lender_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."lender_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lock_requests" ADD CONSTRAINT "lock_requests_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lock_requests" ADD CONSTRAINT "lock_requests_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgage_rates" ADD CONSTRAINT "mortgage_rates_program_id_mortgage_rate_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mortgage_rate_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgage_rates" ADD CONSTRAINT "mortgage_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgage_rates" ADD CONSTRAINT "mortgage_rates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_comparison_sessions" ADD CONSTRAINT "offer_comparison_sessions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_comparison_sessions" ADD CONSTRAINT "offer_comparison_sessions_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_comparison_sessions" ADD CONSTRAINT "offer_comparison_sessions_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_comparison_sessions" ADD CONSTRAINT "offer_comparison_sessions_selected_offer_id_lender_offers_id_fk" FOREIGN KEY ("selected_offer_id") REFERENCES "public"."lender_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_selection_events" ADD CONSTRAINT "offer_selection_events_offer_id_lender_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."lender_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_selection_events" ADD CONSTRAINT "offer_selection_events_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_selection_events" ADD CONSTRAINT "offer_selection_events_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_selection_events" ADD CONSTRAINT "offer_selection_events_lender_id_wholesale_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."wholesale_lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "other_income_sources" ADD CONSTRAINT "other_income_sources_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_link_tokens" ADD CONSTRAINT "plaid_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_link_tokens" ADD CONSTRAINT "plaid_link_tokens_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_conditions" ADD CONSTRAINT "pre_approval_conditions_letter_id_pre_approval_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."pre_approval_letters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_conditions" ADD CONSTRAINT "pre_approval_conditions_source_rule_id_underwriting_rules_dsl_id_fk" FOREIGN KEY ("source_rule_id") REFERENCES "public"."underwriting_rules_dsl"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_underwriting_snapshot_id_underwriting_decisions_id_fk" FOREIGN KEY ("underwriting_snapshot_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_primary_disclaimer_id_disclaimer_versions_id_fk" FOREIGN KEY ("primary_disclaimer_id") REFERENCES "public"."disclaimer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_broker_role_disclaimer_id_disclaimer_versions_id_fk" FOREIGN KEY ("broker_role_disclaimer_id") REFERENCES "public"."disclaimer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_document_reliance_disclaimer_id_disclaimer_versions_id_fk" FOREIGN KEY ("document_reliance_disclaimer_id") REFERENCES "public"."disclaimer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_change_in_circumstance_disclaimer_id_disclaimer_versions_id_fk" FOREIGN KEY ("change_in_circumstance_disclaimer_id") REFERENCES "public"."disclaimer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_system_generated_disclaimer_id_disclaimer_versions_id_fk" FOREIGN KEY ("system_generated_disclaimer_id") REFERENCES "public"."disclaimer_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_loan_officer_id_users_id_fk" FOREIGN KEY ("loan_officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approval_letters" ADD CONSTRAINT "pre_approval_letters_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_qualification_letters" ADD CONSTRAINT "pre_qualification_letters_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_qualification_letters" ADD CONSTRAINT "pre_qualification_letters_loan_officer_id_users_id_fk" FOREIGN KEY ("loan_officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD CONSTRAINT "rate_locks_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD CONSTRAINT "rate_locks_loan_option_id_loan_options_id_fk" FOREIGN KEY ("loan_option_id") REFERENCES "public"."loan_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD CONSTRAINT "rate_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_locks" ADD CONSTRAINT "rate_locks_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_sheet_products" ADD CONSTRAINT "rate_sheet_products_rate_sheet_id_rate_sheets_id_fk" FOREIGN KEY ("rate_sheet_id") REFERENCES "public"."rate_sheets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_sheets" ADD CONSTRAINT "rate_sheets_lender_id_wholesale_lenders_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."wholesale_lenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urla_assets" ADD CONSTRAINT "urla_assets_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urla_liabilities" ADD CONSTRAINT "urla_liabilities_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urla_personal_info" ADD CONSTRAINT "urla_personal_info_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urla_property_info" ADD CONSTRAINT "urla_property_info_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_assets" ADD CONSTRAINT "canonical_assets_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_assets" ADD CONSTRAINT "canonical_assets_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_liabilities" ADD CONSTRAINT "canonical_liabilities_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_liabilities" ADD CONSTRAINT "canonical_liabilities_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_adjustments" ADD CONSTRAINT "cash_flow_adjustments_income_stream_id_income_streams_id_fk" FOREIGN KEY ("income_stream_id") REFERENCES "public"."income_streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_adjustments" ADD CONSTRAINT "cash_flow_adjustments_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_adjustments" ADD CONSTRAINT "cash_flow_adjustments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_adjustments" ADD CONSTRAINT "cash_flow_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confidence_breakdowns" ADD CONSTRAINT "confidence_breakdowns_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confidence_breakdowns" ADD CONSTRAINT "confidence_breakdowns_result_id_underwriting_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."underwriting_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_streams" ADD CONSTRAINT "income_streams_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_streams" ADD CONSTRAINT "income_streams_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_conditions" ADD CONSTRAINT "loan_conditions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_conditions" ADD CONSTRAINT "loan_conditions_linked_task_id_tasks_id_fk" FOREIGN KEY ("linked_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_conditions" ADD CONSTRAINT "loan_conditions_cleared_by_user_id_users_id_fk" FOREIGN KEY ("cleared_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiality_evaluations" ADD CONSTRAINT "materiality_evaluations_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiality_evaluations" ADD CONSTRAINT "materiality_evaluations_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiality_evaluations" ADD CONSTRAINT "materiality_evaluations_change_event_id_change_events_id_fk" FOREIGN KEY ("change_event_id") REFERENCES "public"."change_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiality_evaluations" ADD CONSTRAINT "materiality_evaluations_rule_set_id_materiality_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."materiality_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiality_evaluations" ADD CONSTRAINT "materiality_evaluations_rule_id_materiality_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."materiality_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materiality_rules" ADD CONSTRAINT "materiality_rules_rule_set_id_materiality_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."materiality_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_approval_workflow" ADD CONSTRAINT "policy_approval_workflow_policy_profile_id_policy_profiles_id_fk" FOREIGN KEY ("policy_profile_id") REFERENCES "public"."policy_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_lender_overlays" ADD CONSTRAINT "policy_lender_overlays_base_policy_profile_id_policy_profiles_id_fk" FOREIGN KEY ("base_policy_profile_id") REFERENCES "public"."policy_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_thresholds" ADD CONSTRAINT "policy_thresholds_policy_profile_id_policy_profiles_id_fk" FOREIGN KEY ("policy_profile_id") REFERENCES "public"."policy_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_stress_tests" ADD CONSTRAINT "portfolio_stress_tests_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_stress_tests" ADD CONSTRAINT "portfolio_stress_tests_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_stress_tests" ADD CONSTRAINT "portfolio_stress_tests_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_execution_log" ADD CONSTRAINT "rule_execution_log_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_execution_log" ADD CONSTRAINT "rule_execution_log_rule_id_underwriting_rules_dsl_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."underwriting_rules_dsl"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_audit_log" ADD CONSTRAINT "task_audit_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_audit_log" ADD CONSTRAINT "task_audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_resulting_task_id_tasks_id_fk" FOREIGN KEY ("resulting_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_decisions" ADD CONSTRAINT "underwriting_decisions_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_decisions" ADD CONSTRAINT "underwriting_decisions_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_decisions" ADD CONSTRAINT "underwriting_decisions_result_id_underwriting_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."underwriting_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_decisions" ADD CONSTRAINT "underwriting_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_decisions" ADD CONSTRAINT "underwriting_decisions_previous_decision_id_underwriting_decisions_id_fk" FOREIGN KEY ("previous_decision_id") REFERENCES "public"."underwriting_decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_event_log" ADD CONSTRAINT "underwriting_event_log_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_event_log" ADD CONSTRAINT "underwriting_event_log_rule_id_underwriting_event_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."underwriting_event_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_explanations" ADD CONSTRAINT "underwriting_explanations_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_explanations" ADD CONSTRAINT "underwriting_explanations_result_id_underwriting_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."underwriting_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_explanations" ADD CONSTRAINT "underwriting_explanations_override_approved_by_users_id_fk" FOREIGN KEY ("override_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_results" ADD CONSTRAINT "underwriting_results_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_results" ADD CONSTRAINT "underwriting_results_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_rules_dsl" ADD CONSTRAINT "underwriting_rules_dsl_previous_version_id_underwriting_rules_dsl_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."underwriting_rules_dsl"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_rules_dsl" ADD CONSTRAINT "underwriting_rules_dsl_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_rules_dsl" ADD CONSTRAINT "underwriting_rules_dsl_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_snapshots" ADD CONSTRAINT "underwriting_snapshots_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_snapshots" ADD CONSTRAINT "underwriting_snapshots_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "what_if_scenarios" ADD CONSTRAINT "what_if_scenarios_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "what_if_scenarios" ADD CONSTRAINT "what_if_scenarios_base_snapshot_id_underwriting_snapshots_id_fk" FOREIGN KEY ("base_snapshot_id") REFERENCES "public"."underwriting_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "what_if_scenarios" ADD CONSTRAINT "what_if_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completeness_checks" ADD CONSTRAINT "completeness_checks_logical_document_id_logical_documents_id_fk" FOREIGN KEY ("logical_document_id") REFERENCES "public"."logical_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_package_items" ADD CONSTRAINT "document_package_items_package_id_document_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."document_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_package_items" ADD CONSTRAINT "document_package_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_packages" ADD CONSTRAINT "document_packages_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_packages" ADD CONSTRAINT "document_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_upload_id_document_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."document_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_logical_document_id_logical_documents_id_fk" FOREIGN KEY ("logical_document_id") REFERENCES "public"."logical_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_page_id_document_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."document_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logical_document_pages" ADD CONSTRAINT "logical_document_pages_logical_document_id_logical_documents_id_fk" FOREIGN KEY ("logical_document_id") REFERENCES "public"."logical_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logical_document_pages" ADD CONSTRAINT "logical_document_pages_page_id_document_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."document_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logical_documents" ADD CONSTRAINT "logical_documents_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logical_documents" ADD CONSTRAINT "logical_documents_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logical_documents" ADD CONSTRAINT "logical_documents_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_classifications" ADD CONSTRAINT "page_classifications_page_id_document_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."document_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_classifications" ADD CONSTRAINT "page_classifications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_actions" ADD CONSTRAINT "adverse_actions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_actions" ADD CONSTRAINT "adverse_actions_credit_pull_id_credit_pulls_id_fk" FOREIGN KEY ("credit_pull_id") REFERENCES "public"."credit_pulls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_actions" ADD CONSTRAINT "adverse_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_actions" ADD CONSTRAINT "adverse_actions_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_actions" ADD CONSTRAINT "adverse_actions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_consents" ADD CONSTRAINT "borrower_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_consents" ADD CONSTRAINT "borrower_consents_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_consents" ADD CONSTRAINT "borrower_consents_template_id_consent_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."consent_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_actions" ADD CONSTRAINT "credit_actions_goal_id_homeownership_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."homeownership_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_audit_log" ADD CONSTRAINT "credit_audit_log_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_audit_log" ADD CONSTRAINT "credit_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_audit_log" ADD CONSTRAINT "credit_audit_log_consent_id_credit_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."credit_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_audit_log" ADD CONSTRAINT "credit_audit_log_credit_pull_id_credit_pulls_id_fk" FOREIGN KEY ("credit_pull_id") REFERENCES "public"."credit_pulls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_audit_log" ADD CONSTRAINT "credit_audit_log_adverse_action_id_adverse_actions_id_fk" FOREIGN KEY ("adverse_action_id") REFERENCES "public"."adverse_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_audit_log" ADD CONSTRAINT "credit_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_consents" ADD CONSTRAINT "credit_consents_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_consents" ADD CONSTRAINT "credit_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_pulls" ADD CONSTRAINT "credit_pulls_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_pulls" ADD CONSTRAINT "credit_pulls_consent_id_credit_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."credit_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_pulls" ADD CONSTRAINT "credit_pulls_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_consent_progress" ADD CONSTRAINT "draft_consent_progress_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_consent_progress" ADD CONSTRAINT "draft_consent_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hmda_demographics" ADD CONSTRAINT "hmda_demographics_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hmda_demographics" ADD CONSTRAINT "hmda_demographics_borrower_id_users_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeownership_goals" ADD CONSTRAINT "homeownership_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeownership_goals" ADD CONSTRAINT "homeownership_goals_referring_agent_id_agent_profiles_id_fk" FOREIGN KEY ("referring_agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_milestones" ADD CONSTRAINT "journey_milestones_goal_id_homeownership_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."homeownership_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_transactions" ADD CONSTRAINT "savings_transactions_goal_id_homeownership_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."homeownership_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_conversation_id_coach_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."coach_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_enrollment_id_accelerator_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."accelerator_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equity_snapshots" ADD CONSTRAINT "equity_snapshots_homeowner_profile_id_homeowner_profiles_id_fk" FOREIGN KEY ("homeowner_profile_id") REFERENCES "public"."homeowner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeowner_profiles" ADD CONSTRAINT "homeowner_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_agent_id_agent_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refi_alerts" ADD CONSTRAINT "refi_alerts_homeowner_profile_id_homeowner_profiles_id_fk" FOREIGN KEY ("homeowner_profile_id") REFERENCES "public"."homeowner_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accelerator_enrollments" ADD CONSTRAINT "accelerator_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accelerator_milestones" ADD CONSTRAINT "accelerator_milestones_enrollment_id_accelerator_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."accelerator_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pipeline_access" ADD CONSTRAINT "agent_pipeline_access_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pipeline_access" ADD CONSTRAINT "agent_pipeline_access_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_referral_requests" ADD CONSTRAINT "agent_referral_requests_preferred_agent_id_agent_profiles_id_fk" FOREIGN KEY ("preferred_agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_referral_requests" ADD CONSTRAINT "agent_referral_requests_matched_agent_id_agent_profiles_id_fk" FOREIGN KEY ("matched_agent_id") REFERENCES "public"."agent_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_broker_id_users_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_commissions" ADD CONSTRAINT "broker_commissions_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculator_profiles" ADD CONSTRAINT "calculator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculator_results" ADD CONSTRAINT "calculator_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_guarantees" ADD CONSTRAINT "closing_guarantees_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "co_brand_profiles" ADD CONSTRAINT "co_brand_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_desk_messages" ADD CONSTRAINT "deal_desk_messages_thread_id_deal_desk_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."deal_desk_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_desk_messages" ADD CONSTRAINT "deal_desk_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_desk_threads" ADD CONSTRAINT "deal_desk_threads_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_desk_threads" ADD CONSTRAINT "deal_desk_threads_lo_user_id_users_id_fk" FOREIGN KEY ("lo_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_rescue_escalations" ADD CONSTRAINT "deal_rescue_escalations_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_rescue_escalations" ADD CONSTRAINT "deal_rescue_escalations_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_rescue_escalations" ADD CONSTRAINT "deal_rescue_escalations_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_rescue_escalations" ADD CONSTRAINT "deal_rescue_escalations_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kba_sessions" ADD CONSTRAINT "kba_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kba_sessions" ADD CONSTRAINT "kba_sessions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_screenings" ADD CONSTRAINT "kyc_screenings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_screenings" ADD CONSTRAINT "kyc_screenings_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_screenings" ADD CONSTRAINT "kyc_screenings_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_feedback" ADD CONSTRAINT "onboarding_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_feedback" ADD CONSTRAINT "onboarding_feedback_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_orders" ADD CONSTRAINT "partner_orders_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_orders" ADD CONSTRAINT "partner_orders_provider_id_partner_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."partner_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_orders" ADD CONSTRAINT "partner_orders_ordered_by_users_id_fk" FOREIGN KEY ("ordered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_sessions" ADD CONSTRAINT "strategy_sessions_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_sessions" ADD CONSTRAINT "strategy_sessions_lo_user_id_users_id_fk" FOREIGN KEY ("lo_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_co_borrower_user_id_users_id_fk" FOREIGN KEY ("co_borrower_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_state_history" ADD CONSTRAINT "borrower_state_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_state_history" ADD CONSTRAINT "borrower_state_history_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrower_state_history" ADD CONSTRAINT "borrower_state_history_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_confidence_scores" ADD CONSTRAINT "document_confidence_scores_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_confidence_scores" ADD CONSTRAINT "document_confidence_scores_human_reviewed_by_users_id_fk" FOREIGN KEY ("human_reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intent_events" ADD CONSTRAINT "intent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_match_results" ADD CONSTRAINT "lender_match_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_match_results" ADD CONSTRAINT "lender_match_results_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lender_match_results" ADD CONSTRAINT "lender_match_results_lender_product_id_lender_products_id_fk" FOREIGN KEY ("lender_product_id") REFERENCES "public"."lender_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_outcomes" ADD CONSTRAINT "loan_outcomes_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_snapshots" ADD CONSTRAINT "predictive_snapshots_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_snapshots" ADD CONSTRAINT "predictive_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_checklist" ADD CONSTRAINT "readiness_checklist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_checklist" ADD CONSTRAINT "readiness_checklist_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_owned" ADD CONSTRAINT "real_estate_owned_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_owned" ADD CONSTRAINT "real_estate_owned_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup_matrices" ADD CONSTRAINT "lookup_matrices_previous_version_id_lookup_matrices_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."lookup_matrices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookup_matrix_cells" ADD CONSTRAINT "lookup_matrix_cells_matrix_id_lookup_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "public"."lookup_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_snapshots" ADD CONSTRAINT "decision_snapshots_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_user_id_users_id_fk" FOREIGN KEY ("converted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_application_id_loan_applications_id_fk" FOREIGN KEY ("converted_application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_agent_confidence_views_application" ON "agent_confidence_views" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_agent_confidence_views_level" ON "agent_confidence_views" USING btree ("confidence_level");--> statement-breakpoint
CREATE INDEX "idx_agent_confidence_views_computed" ON "agent_confidence_views" USING btree ("computed_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_snapshots_date" ON "analytics_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_application_invites_referrer" ON "application_invites" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_application_invites_token" ON "application_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_application_invites_status" ON "application_invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_application_milestones_app" ON "application_milestones" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_broker_offer_controls_application" ON "broker_offer_controls" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_credit_refresh_decisions_application" ON "credit_refresh_decisions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_credit_refresh_decisions_borrower" ON "credit_refresh_decisions" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_credit_refresh_decisions_type" ON "credit_refresh_decisions" USING btree ("refresh_type");--> statement-breakpoint
CREATE INDEX "idx_credit_refresh_decisions_decision_at" ON "credit_refresh_decisions" USING btree ("decision_at");--> statement-breakpoint
CREATE INDEX "idx_deal_activities_application" ON "deal_activities" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_deal_activities_created" ON "deal_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_deal_team_application" ON "deal_team_members" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_deal_team_user" ON "deal_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_deal_team_role" ON "deal_team_members" USING btree ("team_role");--> statement-breakpoint
CREATE INDEX "idx_disclaimer_versions_type_version" ON "disclaimer_versions" USING btree ("disclaimer_type","version");--> statement-breakpoint
CREATE INDEX "idx_disclaimer_versions_effective" ON "disclaimer_versions" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "idx_document_expirations_application" ON "document_expirations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_document_expirations_document" ON "document_expirations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_expirations_status" ON "document_expirations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_document_expirations_expiration" ON "document_expirations" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "idx_documents_application" ON "documents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_documents_user" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_status" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_documents_user_status" ON "documents" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_expiration_policies_product" ON "expiration_policies" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_expiration_policies_active" ON "expiration_policies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_lender_data_packages_application" ON "lender_data_packages" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_lender_data_packages_snapshot" ON "lender_data_packages" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_lender_data_packages_lender" ON "lender_data_packages" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_lender_data_packages_status" ON "lender_data_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_application" ON "lender_offers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_snapshot" ON "lender_offers" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_lender" ON "lender_offers" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_status" ON "lender_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lender_offers_expiration" ON "lender_offers" USING btree ("offer_expiration");--> statement-breakpoint
CREATE INDEX "idx_lender_pre_approval_formats_lender" ON "lender_pre_approval_formats" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_lender_pre_approval_formats_active" ON "lender_pre_approval_formats" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_lender_pricing_adj_lender" ON "lender_pricing_adjustments" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_lender_pricing_adj_type" ON "lender_pricing_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
CREATE INDEX "idx_lender_pricing_adj_effective" ON "lender_pricing_adjustments" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_letter_generation_logs_application" ON "letter_generation_logs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_letter_generation_logs_letter" ON "letter_generation_logs" USING btree ("letter_id");--> statement-breakpoint
CREATE INDEX "idx_letter_generation_logs_event" ON "letter_generation_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_letter_generation_logs_time" ON "letter_generation_logs" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "idx_loan_applications_user" ON "loan_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_loan_applications_status" ON "loan_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_loan_applications_created" ON "loan_applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_loan_applications_broker" ON "loan_applications" USING btree ("referring_broker_id");--> statement-breakpoint
CREATE INDEX "idx_loan_applications_lo" ON "loan_applications" USING btree ("loan_officer_id");--> statement-breakpoint
CREATE INDEX "idx_loan_applications_user_status" ON "loan_applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_loan_options_application" ON "loan_options" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_lock_requests_offer" ON "lock_requests" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "idx_lock_requests_application" ON "lock_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_lock_requests_status" ON "lock_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mortgage_rates_location" ON "mortgage_rates" USING btree ("state","zipcode");--> statement-breakpoint
CREATE INDEX "idx_mortgage_rates_program" ON "mortgage_rates" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_mortgage_rates_active" ON "mortgage_rates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_offer_comparison_sessions_application" ON "offer_comparison_sessions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_offer_comparison_sessions_borrower" ON "offer_comparison_sessions" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_offer_comparison_sessions_started" ON "offer_comparison_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_offer_selection_events_offer" ON "offer_selection_events" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "idx_offer_selection_events_application" ON "offer_selection_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_offer_selection_events_type" ON "offer_selection_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_offer_selection_events_performed_at" ON "offer_selection_events" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_conditions_letter" ON "pre_approval_conditions" USING btree ("letter_id");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_conditions_category" ON "pre_approval_conditions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_letters_application" ON "pre_approval_letters" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_letters_borrower" ON "pre_approval_letters" USING btree ("borrower_name");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_letters_status" ON "pre_approval_letters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_letters_expiration" ON "pre_approval_letters" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "idx_pre_approval_letters_snapshot" ON "pre_approval_letters" USING btree ("underwriting_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_pre_qual_letters_application" ON "pre_qualification_letters" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_pre_qual_letters_status" ON "pre_qualification_letters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rate_locks_application" ON "rate_locks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_rate_locks_status" ON "rate_locks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rate_locks_expires" ON "rate_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_rate_sheet_products_sheet" ON "rate_sheet_products" USING btree ("rate_sheet_id");--> statement-breakpoint
CREATE INDEX "idx_rate_sheet_products_type" ON "rate_sheet_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_rate_sheet_products_code" ON "rate_sheet_products" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "idx_rate_sheets_lender" ON "rate_sheets" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_rate_sheets_effective" ON "rate_sheets" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_rate_sheets_status" ON "rate_sheets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sla_configurations_active" ON "sla_configurations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_team_messages_sender" ON "team_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_team_messages_recipient" ON "team_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_team_messages_application" ON "team_messages" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_team_messages_created" ON "team_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "urla_personal_info_app_seq_idx" ON "urla_personal_info" USING btree ("application_id","borrower_sequence_number");--> statement-breakpoint
CREATE INDEX "idx_verifications_application" ON "verifications" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_verifications_app_type" ON "verifications" USING btree ("application_id","verification_type");--> statement-breakpoint
CREATE INDEX "idx_wholesale_lenders_code" ON "wholesale_lenders" USING btree ("lender_code");--> statement-breakpoint
CREATE INDEX "idx_wholesale_lenders_tier" ON "wholesale_lenders" USING btree ("integration_tier");--> statement-breakpoint
CREATE INDEX "idx_wholesale_lenders_status" ON "wholesale_lenders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_anomalies_loan" ON "anomalies" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_anomalies_category" ON "anomalies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_anomalies_severity" ON "anomalies" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_anomalies_status" ON "anomalies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_category" ON "audit_events" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_loan" ON "audit_events" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_audit_timestamp" ON "audit_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_assets_borrower" ON "canonical_assets" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_assets_loan" ON "canonical_assets" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_assets_type" ON "canonical_assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_liabilities_borrower" ON "canonical_liabilities" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_liabilities_loan" ON "canonical_liabilities" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_liabilities_type" ON "canonical_liabilities" USING btree ("liability_type");--> statement-breakpoint
CREATE INDEX "idx_cfa_income_stream" ON "cash_flow_adjustments" USING btree ("income_stream_id");--> statement-breakpoint
CREATE INDEX "idx_cfa_loan" ON "cash_flow_adjustments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_cfa_type" ON "cash_flow_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
CREATE INDEX "idx_change_events_application" ON "change_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_change_events_snapshot" ON "change_events" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_change_events_category" ON "change_events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_change_events_metric" ON "change_events" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "idx_change_events_processed" ON "change_events" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "idx_conf_snapshot" ON "confidence_breakdowns" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_conf_result" ON "confidence_breakdowns" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_conf_overall" ON "confidence_breakdowns" USING btree ("overall_confidence");--> statement-breakpoint
CREATE INDEX "idx_conf_action" ON "confidence_breakdowns" USING btree ("recommended_action");--> statement-breakpoint
CREATE INDEX "idx_income_borrower" ON "income_streams" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_income_loan" ON "income_streams" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_income_type" ON "income_streams" USING btree ("income_type");--> statement-breakpoint
CREATE INDEX "idx_income_qualification" ON "income_streams" USING btree ("qualification_status");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_application" ON "materiality_evaluations" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_snapshot" ON "materiality_evaluations" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_change_event" ON "materiality_evaluations" USING btree ("change_event_id");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_rule_set" ON "materiality_evaluations" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_rule" ON "materiality_evaluations" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_material" ON "materiality_evaluations" USING btree ("is_material");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_action" ON "materiality_evaluations" USING btree ("required_action");--> statement-breakpoint
CREATE INDEX "idx_materiality_evaluations_status" ON "materiality_evaluations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_materiality_rule_sets_product" ON "materiality_rule_sets" USING btree ("product");--> statement-breakpoint
CREATE INDEX "idx_materiality_rule_sets_active" ON "materiality_rule_sets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_materiality_rule_sets_effective" ON "materiality_rule_sets" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_materiality_rules_rule_set" ON "materiality_rules" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "idx_materiality_rules_category" ON "materiality_rules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_materiality_rules_metric" ON "materiality_rules" USING btree ("when_metric");--> statement-breakpoint
CREATE INDEX "idx_materiality_rules_priority" ON "materiality_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_policy_approval_profile" ON "policy_approval_workflow" USING btree ("policy_profile_id");--> statement-breakpoint
CREATE INDEX "idx_policy_approval_action" ON "policy_approval_workflow" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_policy_approval_by" ON "policy_approval_workflow" USING btree ("action_by");--> statement-breakpoint
CREATE INDEX "idx_policy_approval_at" ON "policy_approval_workflow" USING btree ("action_at");--> statement-breakpoint
CREATE INDEX "idx_policy_lender_overlays_base" ON "policy_lender_overlays" USING btree ("base_policy_profile_id");--> statement-breakpoint
CREATE INDEX "idx_policy_lender_overlays_lender" ON "policy_lender_overlays" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_policy_lender_overlays_status" ON "policy_lender_overlays" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_policy_lender_overlays_effective" ON "policy_lender_overlays" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_policy_profiles_authority" ON "policy_profiles" USING btree ("authority");--> statement-breakpoint
CREATE INDEX "idx_policy_profiles_product" ON "policy_profiles" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_policy_profiles_status" ON "policy_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_policy_profiles_effective" ON "policy_profiles" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "idx_policy_thresholds_profile" ON "policy_thresholds" USING btree ("policy_profile_id");--> statement-breakpoint
CREATE INDEX "idx_policy_thresholds_category" ON "policy_thresholds" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_policy_thresholds_key" ON "policy_thresholds" USING btree ("threshold_key");--> statement-breakpoint
CREATE INDEX "idx_pst_borrower" ON "portfolio_stress_tests" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_pst_loan" ON "portfolio_stress_tests" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_pst_result" ON "portfolio_stress_tests" USING btree ("stress_test_result");--> statement-breakpoint
CREATE INDEX "idx_product_rules_type" ON "product_rules" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_product_rules_active" ON "product_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_rule_exec_snapshot" ON "rule_execution_log" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_rule_exec_rule" ON "rule_execution_log" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_rule_exec_code" ON "rule_execution_log" USING btree ("rule_code");--> statement-breakpoint
CREATE INDEX "idx_rule_exec_met" ON "rule_execution_log" USING btree ("conditions_met");--> statement-breakpoint
CREATE INDEX "idx_seasoning_income_type" ON "seasoning_rules" USING btree ("income_type");--> statement-breakpoint
CREATE INDEX "idx_seasoning_product" ON "seasoning_rules" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_seasoning_active" ON "seasoning_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_tasks_application" ON "tasks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned_user" ON "tasks" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tasks_created" ON "tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_sla_due" ON "tasks" USING btree ("sla_due_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_app_status" ON "tasks" USING btree ("application_id","status");--> statement-breakpoint
CREATE INDEX "idx_uw_decision_loan" ON "underwriting_decisions" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_uw_decision_snapshot" ON "underwriting_decisions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_uw_decision_result" ON "underwriting_decisions" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_uw_decision_version" ON "underwriting_decisions" USING btree ("decision_version");--> statement-breakpoint
CREATE INDEX "idx_uw_decision_hash" ON "underwriting_decisions" USING btree ("inputs_hash");--> statement-breakpoint
CREATE INDEX "idx_uw_decision_type" ON "underwriting_decisions" USING btree ("decision_type");--> statement-breakpoint
CREATE INDEX "idx_uw_events_loan" ON "underwriting_event_log" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_uw_events_rule" ON "underwriting_event_log" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_uw_events_trigger" ON "underwriting_event_log" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_uw_rules_trigger" ON "underwriting_event_rules" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_uw_rules_active" ON "underwriting_event_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_uw_exp_snapshot" ON "underwriting_explanations" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_uw_exp_result" ON "underwriting_explanations" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_uw_exp_rule" ON "underwriting_explanations" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_uw_exp_category" ON "underwriting_explanations" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_uw_results_snapshot" ON "underwriting_results" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_uw_results_loan" ON "underwriting_results" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_uw_results_eligibility" ON "underwriting_results" USING btree ("eligibility_status");--> statement-breakpoint
CREATE INDEX "idx_rules_dsl_code" ON "underwriting_rules_dsl" USING btree ("rule_code");--> statement-breakpoint
CREATE INDEX "idx_rules_dsl_trigger" ON "underwriting_rules_dsl" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_rules_dsl_category" ON "underwriting_rules_dsl" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_rules_dsl_priority" ON "underwriting_rules_dsl" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_rules_dsl_active" ON "underwriting_rules_dsl" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_uw_snapshots_loan" ON "underwriting_snapshots" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_uw_snapshots_borrower" ON "underwriting_snapshots" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_uw_snapshots_type" ON "underwriting_snapshots" USING btree ("snapshot_type");--> statement-breakpoint
CREATE INDEX "idx_whatif_loan" ON "what_if_scenarios" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_whatif_base_snapshot" ON "what_if_scenarios" USING btree ("base_snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_whatif_type" ON "what_if_scenarios" USING btree ("scenario_type");--> statement-breakpoint
CREATE INDEX "idx_completeness_doc" ON "completeness_checks" USING btree ("logical_document_id");--> statement-breakpoint
CREATE INDEX "idx_completeness_status" ON "completeness_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_doc_pages_upload" ON "document_pages" USING btree ("upload_id");--> statement-breakpoint
CREATE INDEX "idx_doc_uploads_loan" ON "document_uploads" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_doc_uploads_borrower" ON "document_uploads" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_doc_uploads_status" ON "document_uploads" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_extracted_fields_doc" ON "extracted_fields" USING btree ("logical_document_id");--> statement-breakpoint
CREATE INDEX "idx_extracted_fields_page" ON "extracted_fields" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_extracted_fields_name" ON "extracted_fields" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "idx_extracted_fields_mismo" ON "extracted_fields" USING btree ("mismo_path");--> statement-breakpoint
CREATE INDEX "idx_extracted_fields_confidence" ON "extracted_fields" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_logical_doc_pages_doc" ON "logical_document_pages" USING btree ("logical_document_id");--> statement-breakpoint
CREATE INDEX "idx_logical_doc_pages_page" ON "logical_document_pages" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_logical_docs_loan" ON "logical_documents" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_logical_docs_borrower" ON "logical_documents" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_logical_docs_type" ON "logical_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_logical_docs_status" ON "logical_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_page_class_page" ON "page_classifications" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_page_class_type" ON "page_classifications" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_page_class_confidence" ON "page_classifications" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "idx_adverse_actions_application" ON "adverse_actions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_adverse_actions_user" ON "adverse_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_adverse_actions_credit_pull" ON "adverse_actions" USING btree ("credit_pull_id");--> statement-breakpoint
CREATE INDEX "idx_borrower_consents_user" ON "borrower_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_borrower_consents_application" ON "borrower_consents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_borrower_consents_type" ON "borrower_consents" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "idx_consent_templates_type" ON "consent_templates" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "idx_consent_templates_state" ON "consent_templates" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_consent_templates_active" ON "consent_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_credit_actions_goal" ON "credit_actions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_credit_actions_status" ON "credit_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_credit_audit_application" ON "credit_audit_log" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_credit_audit_timestamp" ON "credit_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_credit_audit_action" ON "credit_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_credit_audit_entry_hash" ON "credit_audit_log" USING btree ("entry_hash");--> statement-breakpoint
CREATE INDEX "idx_credit_consents_application" ON "credit_consents" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_credit_consents_user" ON "credit_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_pulls_application" ON "credit_pulls" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_credit_pulls_consent" ON "credit_pulls" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_credit_pulls_status" ON "credit_pulls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_draft_consent_application" ON "draft_consent_progress" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_draft_consent_user" ON "draft_consent_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hmda_application" ON "hmda_demographics" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_hmda_borrower" ON "hmda_demographics" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "idx_homeownership_goals_user" ON "homeownership_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_homeownership_goals_phase" ON "homeownership_goals" USING btree ("current_phase");--> statement-breakpoint
CREATE INDEX "idx_journey_milestones_goal" ON "journey_milestones" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_journey_milestones_type" ON "journey_milestones" USING btree ("milestone_type");--> statement-breakpoint
CREATE INDEX "idx_savings_transactions_goal" ON "savings_transactions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_verification_reports_application" ON "verification_reports" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_verification_reports_user" ON "verification_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_verification_reports_status" ON "verification_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_verification_reports_provider_type" ON "verification_reports" USING btree ("provider","report_type");--> statement-breakpoint
CREATE INDEX "idx_verification_reports_voa" ON "verification_reports" USING btree ("voa_report_id");--> statement-breakpoint
CREATE INDEX "idx_verification_reports_voie" ON "verification_reports" USING btree ("voie_report_id");--> statement-breakpoint
CREATE INDEX "idx_coach_conversations_user" ON "coach_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_coach_conversations_status" ON "coach_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_coach_messages_conversation" ON "coach_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_coach_messages_conv_role_created" ON "coach_messages" USING btree ("conversation_id","role","created_at");--> statement-breakpoint
CREATE INDEX "idx_coaching_sessions_enrollment" ON "coaching_sessions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_sessions_scheduled" ON "coaching_sessions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_equity_snapshots_profile" ON "equity_snapshots" USING btree ("homeowner_profile_id");--> statement-breakpoint
CREATE INDEX "idx_equity_snapshots_date" ON "equity_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_homeowner_profiles_user" ON "homeowner_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refi_alerts_profile" ON "refi_alerts" USING btree ("homeowner_profile_id");--> statement-breakpoint
CREATE INDEX "idx_accelerator_user" ON "accelerator_enrollments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_accelerator_status" ON "accelerator_enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_accelerator_milestones_enrollment" ON "accelerator_milestones" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "idx_agent_pipeline_agent" ON "agent_pipeline_access" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_pipeline_app" ON "agent_pipeline_access" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_agent_referral_status" ON "agent_referral_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_referral_agent" ON "agent_referral_requests" USING btree ("matched_agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_referral_email" ON "agent_referral_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_articles_category" ON "articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_articles_status" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_articles_published_at" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_broker_commissions_broker" ON "broker_commissions" USING btree ("broker_id");--> statement-breakpoint
CREATE INDEX "idx_broker_commissions_application" ON "broker_commissions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_broker_commissions_status" ON "broker_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_calculator_profiles_email" ON "calculator_profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_calculator_results_user" ON "calculator_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_calculator_results_type" ON "calculator_results" USING btree ("calculator_type");--> statement-breakpoint
CREATE INDEX "idx_closing_guarantees_app" ON "closing_guarantees" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_closing_guarantees_status" ON "closing_guarantees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deal_rescue_status" ON "deal_rescue_escalations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_deal_rescue_reporter" ON "deal_rescue_escalations" USING btree ("reported_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_deal_rescue_urgency" ON "deal_rescue_escalations" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "idx_email_captures_email" ON "email_captures" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_faqs_category" ON "faqs" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_faqs_status" ON "faqs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_faqs_popular" ON "faqs" USING btree ("is_popular");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_status" ON "notifications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_partner_orders_application" ON "partner_orders" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_partner_orders_provider" ON "partner_orders" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_partner_orders_status" ON "partner_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_partner_orders_type" ON "partner_orders" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_partner_providers_type" ON "partner_providers" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_partner_providers_code" ON "partner_providers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_staff_invites_code" ON "staff_invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_strategy_sessions_agent" ON "strategy_sessions" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "idx_strategy_sessions_scheduled" ON "strategy_sessions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_user_activities_user" ON "user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_activities_type" ON "user_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_analytics_domain" ON "analytics_events" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_analytics_event_name" ON "analytics_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "idx_analytics_app" ON "analytics_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_user" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_time" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_analytics_domain_event" ON "analytics_events" USING btree ("domain","event_name");--> statement-breakpoint
CREATE INDEX "idx_analytics_entity" ON "analytics_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_anon_facts_date" ON "anonymized_borrower_facts" USING btree ("cohort_date");--> statement-breakpoint
CREATE INDEX "idx_anon_facts_geo" ON "anonymized_borrower_facts" USING btree ("geo_state_bucket");--> statement-breakpoint
CREATE INDEX "idx_anon_facts_credit" ON "anonymized_borrower_facts" USING btree ("credit_score_bucket");--> statement-breakpoint
CREATE INDEX "idx_anon_facts_purpose" ON "anonymized_borrower_facts" USING btree ("loan_purpose");--> statement-breakpoint
CREATE INDEX "idx_borrower_profiles_user" ON "borrower_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_borrower_profiles_citizenship" ON "borrower_profiles" USING btree ("citizenship_status");--> statement-breakpoint
CREATE INDEX "idx_borrower_profiles_military" ON "borrower_profiles" USING btree ("military_status");--> statement-breakpoint
CREATE INDEX "idx_state_history_user" ON "borrower_state_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_state_history_app" ON "borrower_state_history" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_state_history_to_state" ON "borrower_state_history" USING btree ("to_state");--> statement-breakpoint
CREATE INDEX "idx_state_history_trigger" ON "borrower_state_history" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "idx_state_history_time" ON "borrower_state_history" USING btree ("transitioned_at");--> statement-breakpoint
CREATE INDEX "idx_doc_conf_document" ON "document_confidence_scores" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_doc_conf_type" ON "document_confidence_scores" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_doc_conf_app" ON "document_confidence_scores" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_doc_conf_confidence" ON "document_confidence_scores" USING btree ("overall_confidence");--> statement-breakpoint
CREATE INDEX "idx_doc_conf_review" ON "document_confidence_scores" USING btree ("human_review_required","human_review_completed");--> statement-breakpoint
CREATE INDEX "idx_doc_conf_time" ON "document_confidence_scores" USING btree ("extracted_at");--> statement-breakpoint
CREATE INDEX "idx_intent_events_user" ON "intent_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_intent_events_type" ON "intent_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_intent_events_time" ON "intent_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_intent_events_session" ON "intent_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_intent_events_user_type" ON "intent_events" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_lender_match_user" ON "lender_match_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_lender_match_app" ON "lender_match_results" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_lender_match_product" ON "lender_match_results" USING btree ("lender_product_id");--> statement-breakpoint
CREATE INDEX "idx_lender_match_status" ON "lender_match_results" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "idx_lender_match_score" ON "lender_match_results" USING btree ("match_score");--> statement-breakpoint
CREATE INDEX "idx_lender_products_lender" ON "lender_products" USING btree ("lender_id");--> statement-breakpoint
CREATE INDEX "idx_lender_products_type" ON "lender_products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_lender_products_active" ON "lender_products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_lender_products_credit" ON "lender_products" USING btree ("min_credit_score");--> statement-breakpoint
CREATE INDEX "idx_outcomes_app" ON "loan_outcomes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_outcomes_outcome" ON "loan_outcomes" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_outcomes_purpose" ON "loan_outcomes" USING btree ("loan_purpose");--> statement-breakpoint
CREATE INDEX "idx_outcomes_credit" ON "loan_outcomes" USING btree ("credit_score_bucket");--> statement-breakpoint
CREATE INDEX "idx_outcomes_funded" ON "loan_outcomes" USING btree ("funded_at");--> statement-breakpoint
CREATE INDEX "idx_predict_app" ON "predictive_snapshots" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_predict_user" ON "predictive_snapshots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_predict_likelihood" ON "predictive_snapshots" USING btree ("likelihood_to_close");--> statement-breakpoint
CREATE INDEX "idx_predict_time" ON "predictive_snapshots" USING btree ("computed_at");--> statement-breakpoint
CREATE INDEX "idx_readiness_user" ON "readiness_checklist" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_readiness_app" ON "readiness_checklist" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_readiness_category" ON "readiness_checklist" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_readiness_collected" ON "readiness_checklist" USING btree ("is_collected");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_readiness_user_field" ON "readiness_checklist" USING btree ("user_id","field_name");--> statement-breakpoint
CREATE INDEX "idx_reo_user" ON "real_estate_owned" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reo_application" ON "real_estate_owned" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matrix_code_version_idx" ON "lookup_matrices" USING btree ("matrix_code","version");--> statement-breakpoint
CREATE INDEX "matrix_active_temporal_idx" ON "lookup_matrices" USING btree ("matrix_code","lifecycle_status","effective_date");--> statement-breakpoint
CREATE INDEX "cell_matrix_id_idx" ON "lookup_matrix_cells" USING btree ("matrix_id");--> statement-breakpoint
CREATE INDEX "cell_multi_dim_lookup_idx" ON "lookup_matrix_cells" USING btree ("matrix_id","dim1_min","dim1_max","dim2_min","dim2_max","dim3_identifier");--> statement-breakpoint
CREATE INDEX "ai_interactions_application_idx" ON "ai_interactions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "ai_interactions_workflow_idx" ON "ai_interactions" USING btree ("workflow");--> statement-breakpoint
CREATE INDEX "ai_interactions_review_status_idx" ON "ai_interactions" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "ai_interactions_created_at_idx" ON "ai_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "decision_snapshots_application_idx" ON "decision_snapshots" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "decision_snapshots_created_at_idx" ON "decision_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_email" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_leads_phone" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_source" ON "leads" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_leads_created" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_leads_source_status" ON "leads" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "idx_leads_assigned" ON "leads" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "idx_leads_converted_user" ON "leads" USING btree ("converted_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leads_source_external" ON "leads" USING btree ("source","external_lead_id");