CREATE TABLE "tax_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"document_id" varchar,
	"tax_year" integer NOT NULL,
	"wages_w2" numeric(14, 2),
	"gross_income" numeric(14, 2),
	"adjusted_gross_income" numeric(14, 2),
	"schedule_c_net_profit" numeric(14, 2),
	"schedule_e_net_rental" numeric(14, 2),
	"schedule_e_gross_rents" numeric(14, 2),
	"rental_property_count" integer,
	"self_employed" boolean DEFAULT false NOT NULL,
	"dscr_candidate" boolean DEFAULT false NOT NULL,
	"confidence" varchar(10) NOT NULL,
	"model_id" varchar(100),
	"prompt_version" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tax_insights_user_year" UNIQUE("user_id","tax_year"),
	CONSTRAINT "tax_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
	CONSTRAINT "tax_insights_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id")
);
--> statement-breakpoint
CREATE INDEX "idx_tax_insights_user" ON "tax_insights" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_tax_insights_dscr" ON "tax_insights" USING btree ("dscr_candidate","created_at");
