import { and, eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  competitorRateBenchmarks,
  loanPerformanceProfiles,
  HMDA_LOAN_TYPES,
  HMDA_LOAN_PURPOSES,
  type CompetitorRateBenchmark,
  type LoanPerformanceProfile,
} from "@shared/schema";
import type { IStorage } from "../storage";
import { computeOffers, type BorrowerPricingProfile, type ComputedOffer } from "./pricingAdapter";
import { creditBucket, ltvBand, dtiBand } from "./marketDataParsers";

// =============================================================================
// COMPETITOR RATE + HISTORICAL RISK LOOKUPS
//
// Read side of the free-data moat. Benchmarks are pre-aggregated at ingest
// time, so every lookup here is an indexed point read.
//
// IMPORTANT (Reg Z / pricing authority): the undercut quote is ADVISORY.
// It reports where our best executable rate sits relative to the competitor
// median; it never mutates rate sheets or advertised rates. The deterministic
// pricing engine (rate sheets + LLPA matrices) remains the only source of a
// quotable rate — advertising a rate the desk cannot execute is a Reg Z
// problem, not a marketing win (same invariant as syncBestExecutionRates).
// =============================================================================

export interface BenchmarkQuery {
  state?: string;
  countyFips?: string;
  loanType?: number;
  loanPurpose?: number;
  /** Defaults to the most recent activity year present in the data. */
  activityYear?: number;
}

export interface BenchmarkResult extends CompetitorRateBenchmark {
  /** Which fallback level actually answered: county, state, or national. */
  resolvedLevel: string;
}

/**
 * Median competitor rate for a geography, walking county → state → national
 * until a benchmark cell exists. Returns null when nothing has been ingested.
 */
export async function getCompetitorBenchmark(query: BenchmarkQuery): Promise<BenchmarkResult | null> {
  const loanType = query.loanType ?? HMDA_LOAN_TYPES.CONVENTIONAL;
  const loanPurpose = query.loanPurpose ?? HMDA_LOAN_PURPOSES.PURCHASE;

  const attempts: Array<{ level: string; state: string; county: string } | null> = [
    query.state && query.countyFips
      ? { level: "county", state: query.state.toUpperCase(), county: query.countyFips }
      : null,
    query.state
      ? { level: "state", state: query.state.toUpperCase(), county: "" }
      : null,
    { level: "national", state: "", county: "" },
  ];

  for (const attempt of attempts) {
    if (!attempt) continue;
    const conditions = [
      eq(competitorRateBenchmarks.geoLevel, attempt.level),
      eq(competitorRateBenchmarks.stateCode, attempt.state),
      eq(competitorRateBenchmarks.countyFips, attempt.county),
      eq(competitorRateBenchmarks.loanType, loanType),
      eq(competitorRateBenchmarks.loanPurpose, loanPurpose),
    ];
    if (query.activityYear) {
      conditions.push(eq(competitorRateBenchmarks.activityYear, query.activityYear));
    }
    const [row] = await db
      .select()
      .from(competitorRateBenchmarks)
      .where(and(...conditions))
      .orderBy(desc(competitorRateBenchmarks.activityYear))
      .limit(1);
    if (row) return { ...row, resolvedLevel: attempt.level };
  }
  return null;
}

/**
 * Historical performance (Fannie Mae) for the band this borrower falls into.
 * Falls back to "unknown" DTI/LTV bands only if the exact cell is missing.
 */
export async function getRiskProfile(input: {
  creditScore: number;
  ltv: number;
  dti?: number;
}): Promise<LoanPerformanceProfile | null> {
  const bands = [
    { c: creditBucket(input.creditScore), l: ltvBand(input.ltv), d: dtiBand(input.dti ?? null) },
    { c: creditBucket(input.creditScore), l: ltvBand(input.ltv), d: "unknown" },
  ];
  for (const band of bands) {
    const [row] = await db
      .select()
      .from(loanPerformanceProfiles)
      .where(and(
        eq(loanPerformanceProfiles.creditBucket, band.c),
        eq(loanPerformanceProfiles.ltvBand, band.l),
        eq(loanPerformanceProfiles.dtiBand, band.d),
      ))
      .orderBy(desc(loanPerformanceProfiles.computedAt))
      .limit(1);
    if (row) return row;
  }
  return null;
}

/** Map our wholesale product types onto HMDA loan_type codes. */
const PRODUCT_TYPE_TO_HMDA: Record<string, number> = {
  CONVENTIONAL: HMDA_LOAN_TYPES.CONVENTIONAL,
  JUMBO: HMDA_LOAN_TYPES.CONVENTIONAL,
  ARM: HMDA_LOAN_TYPES.CONVENTIONAL,
  FHA: HMDA_LOAN_TYPES.FHA,
  VA: HMDA_LOAN_TYPES.VA,
  USDA: HMDA_LOAN_TYPES.USDA,
};

const PURPOSE_TO_HMDA: Record<string, number> = {
  purchase: HMDA_LOAN_PURPOSES.PURCHASE,
  refinance: HMDA_LOAN_PURPOSES.REFINANCE,
  cash_out_refinance: HMDA_LOAN_PURPOSES.CASH_OUT_REFINANCE,
};

export interface UndercutQuote {
  ourBestOffer: {
    lenderName: string;
    productName: string;
    productType: string;
    adjustedRate: number;
  } | null;
  benchmark: {
    medianRate: number;
    p25Rate: number | null;
    p75Rate: number | null;
    loanCount: number;
    activityYear: number;
    resolvedLevel: string;
    lenders: string;
  } | null;
  /** ourBestRate − competitorMedian, in basis points. Negative = we win. */
  deltaBps: number | null;
  beatsMedian: boolean | null;
  note: string;
}

/**
 * Where does our best executable rate sit vs. the ingested competitor median
 * for this borrower's geography and product? Advisory output for pricing/
 * marketing decisions — see the module header for why this never writes back.
 */
export async function getUndercutQuote(
  storage: IStorage,
  profile: BorrowerPricingProfile & { state?: string; countyFips?: string },
): Promise<UndercutQuote> {
  const offers = await computeOffers(storage, profile);
  const best: ComputedOffer | undefined = offers[0]; // computeOffers sorts by adjustedRate

  const benchmark = await getCompetitorBenchmark({
    state: profile.state,
    countyFips: profile.countyFips,
    loanType: best ? PRODUCT_TYPE_TO_HMDA[best.productType] : undefined,
    loanPurpose: PURPOSE_TO_HMDA[profile.loanPurpose ?? "purchase"],
  });

  if (!best) {
    return {
      ourBestOffer: null,
      benchmark: benchmark && toBenchmarkSummary(benchmark),
      deltaBps: null,
      beatsMedian: null,
      note: "No executable offers: no active wholesale rate sheets matched this profile.",
    };
  }
  if (!benchmark) {
    return {
      ourBestOffer: toOfferSummary(best),
      benchmark: null,
      deltaBps: null,
      beatsMedian: null,
      note: "No competitor benchmark ingested yet — run the HMDA ingest script.",
    };
  }

  const median = parseFloat(benchmark.medianRate);
  const deltaBps = Math.round((best.adjustedRate - median) * 100);
  return {
    ourBestOffer: toOfferSummary(best),
    benchmark: toBenchmarkSummary(benchmark),
    deltaBps,
    beatsMedian: deltaBps < 0,
    note: deltaBps < 0
      ? `Our best executable rate beats the ${benchmark.resolvedLevel} competitor median by ${Math.abs(deltaBps)} bps (HMDA ${benchmark.activityYear}).`
      : `Our best executable rate is ${deltaBps} bps above the ${benchmark.resolvedLevel} competitor median (HMDA ${benchmark.activityYear}). Pricing changes go through rate sheets, not this endpoint.`,
  };
}

function toOfferSummary(offer: ComputedOffer): UndercutQuote["ourBestOffer"] {
  return {
    lenderName: offer.lenderName,
    productName: offer.productName,
    productType: offer.productType,
    adjustedRate: offer.adjustedRate,
  };
}

function toBenchmarkSummary(benchmark: BenchmarkResult): NonNullable<UndercutQuote["benchmark"]> {
  return {
    medianRate: parseFloat(benchmark.medianRate),
    p25Rate: benchmark.p25Rate === null ? null : parseFloat(benchmark.p25Rate),
    p75Rate: benchmark.p75Rate === null ? null : parseFloat(benchmark.p75Rate),
    loanCount: benchmark.loanCount,
    activityYear: benchmark.activityYear,
    resolvedLevel: benchmark.resolvedLevel,
    lenders: "ingested HMDA competitor set",
  };
}
