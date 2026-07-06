import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  decimal,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";
import { documents } from "./lending";

/**
 * Derived, borrower-visible signals from a self-uploaded tax return — one row
 * per (user, tax year), refreshed on re-upload.
 *
 * Design constraints:
 * - Derived aggregates only: no taxpayer name, SSN, or raw model output here.
 *   The encrypted raw extraction already lives on documents (extraction_raw_*
 *   columns); document_id keeps the lineage chain intact.
 * - Consumer-direct uploads only (the taxpayer's own return), so IRC §7216
 *   preparer-disclosure rules never attach to this table's data flow.
 * - dscr_candidate/self_employed are marketing/readiness signals, NOT
 *   underwriting inputs — qualification figures are re-verified from source
 *   documents during an application.
 */
export const taxInsights = pgTable("tax_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  documentId: varchar("document_id").references(() => documents.id),
  taxYear: integer("tax_year").notNull(),

  // Income aggregates (from the validated extraction; nulls = not on the return)
  wagesW2: decimal("wages_w2", { precision: 14, scale: 2 }),
  grossIncome: decimal("gross_income", { precision: 14, scale: 2 }),
  adjustedGrossIncome: decimal("adjusted_gross_income", { precision: 14, scale: 2 }),
  scheduleCNetProfit: decimal("schedule_c_net_profit", { precision: 14, scale: 2 }),
  scheduleENetRental: decimal("schedule_e_net_rental", { precision: 14, scale: 2 }),
  scheduleEGrossRents: decimal("schedule_e_gross_rents", { precision: 14, scale: 2 }),
  rentalPropertyCount: integer("rental_property_count"),

  // Derived flags
  selfEmployed: boolean("self_employed").default(false).notNull(),
  dscrCandidate: boolean("dscr_candidate").default(false).notNull(),

  // Extraction lineage (mirrors the values persisted on the source document)
  confidence: varchar("confidence", { length: 10 }).notNull(), // high, medium, low
  modelId: varchar("model_id", { length: 100 }),
  promptVersion: varchar("prompt_version", { length: 50 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tax_insights_user").on(table.userId),
  index("idx_tax_insights_dscr").on(table.dscrCandidate, table.createdAt),
  unique("uq_tax_insights_user_year").on(table.userId, table.taxYear),
]);

export const insertTaxInsightSchema = createInsertSchema(taxInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTaxInsight = z.infer<typeof insertTaxInsightSchema>;
export type TaxInsight = typeof taxInsights.$inferSelect;
