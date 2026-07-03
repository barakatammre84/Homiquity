import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  decimal,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// MARKET DATA (Free public-data moat: CFPB HMDA + Fannie Mae loan performance)
//
// Everything in this file is derived from PUBLIC datasets — no borrower PII.
// hmda_competitor_loans holds raw competitor LAR rows; benchmarks are the
// pre-aggregated medians the app actually queries (millisecond lookups).
// Benchmark cells with fewer than MIN_BENCHMARK_CELL_SIZE loans are never
// materialized: thin cells are statistical noise and, at the extreme, could
// re-identify individual transactions.
// ============================================================================

export const MIN_BENCHMARK_CELL_SIZE = 5;

/** HMDA public LAR codes we care about (see ffiec.cfpb.gov documentation). */
export const HMDA_ACTION_ORIGINATED = 1;
export const HMDA_LOAN_TYPES = {
  CONVENTIONAL: 1,
  FHA: 2,
  VA: 3,
  USDA: 4,
} as const;
export const HMDA_LOAN_PURPOSES = {
  PURCHASE: 1,
  HOME_IMPROVEMENT: 2,
  REFINANCE: 31,
  CASH_OUT_REFINANCE: 32,
  OTHER: 4,
  NOT_APPLICABLE: 5,
} as const;

export const hmdaCompetitorLoans = pgTable("hmda_competitor_loans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  lei: varchar("lei", { length: 20 }).notNull(),
  lenderName: varchar("lender_name", { length: 255 }).notNull(),
  activityYear: integer("activity_year").notNull(),

  stateCode: varchar("state_code", { length: 2 }),
  countyFips: varchar("county_fips", { length: 5 }),
  censusTract: varchar("census_tract", { length: 11 }),

  loanType: integer("loan_type"),
  loanPurpose: integer("loan_purpose"),
  actionTaken: integer("action_taken"),
  derivedProduct: varchar("derived_product", { length: 100 }),

  loanAmount: decimal("loan_amount", { precision: 14, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 6, scale: 3 }),
  propertyValue: decimal("property_value", { precision: 14, scale: 2 }),
  ltvRatio: decimal("ltv_ratio", { precision: 6, scale: 2 }),
  // Public HMDA discloses DTI as a bucket string ("<20%", "36", "50%-60%"…),
  // never an exact figure below 36 or above 49 — store it verbatim.
  dtiBucket: varchar("dti_bucket", { length: 20 }),

  ingestBatchId: varchar("ingest_batch_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_hmda_loans_geo").on(table.stateCode, table.countyFips),
  index("idx_hmda_loans_lender_year").on(table.lei, table.activityYear),
  index("idx_hmda_loans_rate").on(table.interestRate),
]);

export const insertHmdaCompetitorLoanSchema = createInsertSchema(hmdaCompetitorLoans).omit({
  id: true,
  createdAt: true,
});

export type InsertHmdaCompetitorLoan = z.infer<typeof insertHmdaCompetitorLoanSchema>;
export type HmdaCompetitorLoan = typeof hmdaCompetitorLoans.$inferSelect;

// ----------------------------------------------------------------------------
// Pre-aggregated competitor rate benchmarks (what the app queries at runtime).
// Rebuilt wholesale after every HMDA ingest. geoLevel fallback chain:
// county → state → national. stateCode/countyFips use "" (not NULL) when not
// applicable so the unique index actually enforces one row per cell.
// ----------------------------------------------------------------------------

export const BENCHMARK_GEO_LEVELS = ["county", "state", "national"] as const;
export type BenchmarkGeoLevel = typeof BENCHMARK_GEO_LEVELS[number];

export const competitorRateBenchmarks = pgTable("competitor_rate_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  geoLevel: varchar("geo_level", { length: 10 }).notNull(),
  stateCode: varchar("state_code", { length: 2 }).notNull().default(""),
  countyFips: varchar("county_fips", { length: 5 }).notNull().default(""),

  loanType: integer("loan_type").notNull(),
  loanPurpose: integer("loan_purpose").notNull(),
  activityYear: integer("activity_year").notNull(),

  loanCount: integer("loan_count").notNull(),
  medianRate: decimal("median_rate", { precision: 6, scale: 3 }).notNull(),
  p25Rate: decimal("p25_rate", { precision: 6, scale: 3 }),
  p75Rate: decimal("p75_rate", { precision: 6, scale: 3 }),
  medianLoanAmount: decimal("median_loan_amount", { precision: 14, scale: 2 }),

  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_rate_bench_cell").on(
    table.geoLevel, table.stateCode, table.countyFips,
    table.loanType, table.loanPurpose, table.activityYear,
  ),
  index("idx_rate_bench_geo").on(table.stateCode, table.countyFips),
]);

export const insertCompetitorRateBenchmarkSchema = createInsertSchema(competitorRateBenchmarks).omit({
  id: true,
  computedAt: true,
});

export type InsertCompetitorRateBenchmark = z.infer<typeof insertCompetitorRateBenchmarkSchema>;
export type CompetitorRateBenchmark = typeof competitorRateBenchmarks.$inferSelect;

// ----------------------------------------------------------------------------
// Historical loan performance profiles (Fannie Mae Single-Family Loan
// Performance dataset, aggregated by credit/LTV/DTI band). One row per band
// combination per source dataset — a few hundred rows total, so risk lookups
// are indexed point reads no matter how many source loans were folded in.
// ----------------------------------------------------------------------------

export const loanPerformanceProfiles = pgTable("loan_performance_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  /** Operator-supplied label for the ingested vintage, e.g. "sf_2019q1-2023q4". */
  sourceDataset: varchar("source_dataset", { length: 60 }).notNull(),

  creditBucket: varchar("credit_bucket", { length: 20 }).notNull(),
  ltvBand: varchar("ltv_band", { length: 20 }).notNull(),
  dtiBand: varchar("dti_band", { length: 20 }).notNull(),

  loanCount: integer("loan_count").notNull(),
  /** Terminal credit events (zero-balance codes 02/03/09/15). */
  defaultCount: integer("default_count").notNull().default(0),
  /** Ever reached 90+ days delinquent (includes loans that later cured). */
  seriousDelinqCount: integer("serious_delinq_count").notNull().default(0),
  /** Voluntary payoff (zero-balance code 01). */
  prepaidCount: integer("prepaid_count").notNull().default(0),

  avgOrigRate: decimal("avg_orig_rate", { precision: 6, scale: 3 }),
  defaultRatePct: decimal("default_rate_pct", { precision: 6, scale: 3 }),
  seriousDelinqRatePct: decimal("serious_delinq_rate_pct", { precision: 6, scale: 3 }),
  prepayRatePct: decimal("prepay_rate_pct", { precision: 6, scale: 3 }),

  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_perf_profile_cell").on(
    table.sourceDataset, table.creditBucket, table.ltvBand, table.dtiBand,
  ),
  index("idx_perf_profile_buckets").on(table.creditBucket, table.ltvBand, table.dtiBand),
]);

export const insertLoanPerformanceProfileSchema = createInsertSchema(loanPerformanceProfiles).omit({
  id: true,
  computedAt: true,
});

export type InsertLoanPerformanceProfile = z.infer<typeof insertLoanPerformanceProfileSchema>;
export type LoanPerformanceProfile = typeof loanPerformanceProfiles.$inferSelect;
