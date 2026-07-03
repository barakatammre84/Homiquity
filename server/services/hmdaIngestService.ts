import readline from "node:readline";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { sql, and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  hmdaCompetitorLoans,
  MIN_BENCHMARK_CELL_SIZE,
  type InsertHmdaCompetitorLoan,
} from "@shared/schema";
import { indexHeader, parseCsvLine, numericOrNull } from "./marketDataParsers";

// =============================================================================
// HMDA COMPETITOR INGEST
//
// Pulls competitor origination records from the CFPB HMDA data-browser API
// (public, no key) and materializes county/state/national median-rate
// benchmarks. HMDA is published annually — "the last 12 months" in practice
// means the most recent activity year the Bureau has released.
// =============================================================================

const HMDA_FILERS_URL = "https://ffiec.cfpb.gov/v2/reporting/filers";
const HMDA_CSV_URL = "https://ffiec.cfpb.gov/v2/data-browser-api/view/csv";

export interface HmdaFiler {
  lei: string;
  name: string;
}

/**
 * Resolve a lender's LEI from its name via the public HMDA filers list.
 * Returns all matches so ambiguous names ("Better" matches several filers)
 * surface instead of silently ingesting the wrong institution.
 */
export async function resolveFilersByName(year: number, nameQuery: string): Promise<HmdaFiler[]> {
  const response = await fetch(`${HMDA_FILERS_URL}/${year}`);
  if (!response.ok) {
    throw new Error(`HMDA filers API returned ${response.status} for year ${year}`);
  }
  const payload: any = await response.json();
  const institutions: any[] = payload?.institutions ?? payload ?? [];
  const query = nameQuery.toLowerCase();
  return institutions
    .filter((inst) => typeof inst?.name === "string" && inst.name.toLowerCase().includes(query))
    .map((inst) => ({ lei: inst.lei, name: inst.name }));
}

export interface HmdaIngestOptions {
  lei: string;
  lenderName: string;
  year: number;
  /** Optional 2-letter state filter(s) to keep the pull small, e.g. ["CA","TX"]. */
  states?: string[];
  onProgress?: (rowsIngested: number) => void;
}

export interface HmdaIngestResult {
  batchId: string;
  rowsIngested: number;
  rowsSkipped: number;
}

/** Try several header spellings — the Bureau has shifted field names between releases. */
function col(header: Map<string, number>, ...names: string[]): number | undefined {
  for (const name of names) {
    const idx = header.get(name);
    if (idx !== undefined) return idx;
  }
  return undefined;
}

const INSERT_BATCH_SIZE = 500;

/**
 * Stream the public LAR CSV for one lender-year straight into
 * hmda_competitor_loans. Replaces any prior ingest for the same (lei, year)
 * so reruns are idempotent. Only originated loans (action_taken=1) are kept —
 * we benchmark against loans that actually closed, not offers.
 */
export async function ingestHmdaCompetitor(options: HmdaIngestOptions): Promise<HmdaIngestResult> {
  const params = new URLSearchParams({
    years: String(options.year),
    leis: options.lei,
    actions_taken: "1",
  });
  if (options.states?.length) params.set("states", options.states.join(","));

  // Drop any previous ingest of this lender-year before writing the new one.
  await db.delete(hmdaCompetitorLoans).where(and(
    eq(hmdaCompetitorLoans.lei, options.lei),
    eq(hmdaCompetitorLoans.activityYear, options.year),
  ));

  const url = `${HMDA_CSV_URL}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HMDA data-browser API returned ${response.status} for ${url}`);
  }

  // No awaits between creating the interface and iterating it: readline
  // consumes eagerly, and lines emitted before iteration starts are lost.
  const rl = readline.createInterface({
    input: Readable.fromWeb(response.body as any),
    crlfDelay: Infinity,
  });

  const batchId = randomUUID();
  let header: Map<string, number> | null = null;
  let cols: Record<string, number | undefined> = {};
  let batch: InsertHmdaCompetitorLoan[] = [];
  let rowsIngested = 0;
  let rowsSkipped = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await db.insert(hmdaCompetitorLoans).values(batch);
    rowsIngested += batch.length;
    batch = [];
    options.onProgress?.(rowsIngested);
  };

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!header) {
      header = indexHeader(line);
      cols = {
        actionTaken: col(header, "action_taken"),
        stateCode: col(header, "state_code"),
        countyFips: col(header, "county_code"),
        censusTract: col(header, "census_tract"),
        loanType: col(header, "loan_type"),
        loanPurpose: col(header, "loan_purpose"),
        derivedProduct: col(header, "derived_loan_product_type"),
        loanAmount: col(header, "loan_amount"),
        interestRate: col(header, "interest_rate"),
        propertyValue: col(header, "property_value"),
        ltv: col(header, "loan_to_value_ratio", "combined_loan_to_value_ratio"),
        dti: col(header, "debt_to_income_ratio"),
      };
      if (cols.interestRate === undefined || cols.loanAmount === undefined) {
        throw new Error(
          `HMDA CSV header missing expected fields (got: ${[...header.keys()].slice(0, 20).join(", ")}…)`,
        );
      }
      continue;
    }

    const fields = parseCsvLine(line);
    const at = (idx: number | undefined) => (idx === undefined ? undefined : fields[idx]);

    const interestRate = numericOrNull(at(cols.interestRate));
    const loanAmount = numericOrNull(at(cols.loanAmount));
    if (loanAmount === null) {
      rowsSkipped++;
      continue;
    }

    batch.push({
      lei: options.lei,
      lenderName: options.lenderName,
      activityYear: options.year,
      stateCode: at(cols.stateCode)?.trim() || null,
      countyFips: at(cols.countyFips)?.trim() || null,
      censusTract: at(cols.censusTract)?.trim() || null,
      loanType: numericOrNull(at(cols.loanType)),
      loanPurpose: numericOrNull(at(cols.loanPurpose)),
      actionTaken: numericOrNull(at(cols.actionTaken)),
      derivedProduct: at(cols.derivedProduct)?.trim() || null,
      loanAmount: loanAmount.toFixed(2),
      interestRate: interestRate === null ? null : interestRate.toFixed(3),
      propertyValue: (() => {
        const v = numericOrNull(at(cols.propertyValue));
        return v === null ? null : v.toFixed(2);
      })(),
      ltvRatio: (() => {
        const v = numericOrNull(at(cols.ltv));
        return v === null ? null : v.toFixed(2);
      })(),
      dtiBucket: at(cols.dti)?.trim() || null,
      ingestBatchId: batchId,
    });

    if (batch.length >= INSERT_BATCH_SIZE) await flush();
  }
  await flush();

  return { batchId, rowsIngested, rowsSkipped };
}

/**
 * Rebuild the pre-aggregated benchmark table from the raw HMDA rows.
 * Full delete-and-rebuild: the source table is small enough (one lender-year
 * at a time) that incremental maintenance isn't worth the complexity.
 * Cells under MIN_BENCHMARK_CELL_SIZE loans are dropped (noise + privacy).
 */
export async function recomputeCompetitorBenchmarks(): Promise<{ cells: number }> {
  await db.execute(sql`DELETE FROM competitor_rate_benchmarks`);

  const levels = [
    { level: "county", state: sql`state_code`, county: sql`county_fips`, groupBy: sql`state_code, county_fips` },
    { level: "state", state: sql`state_code`, county: sql`''`, groupBy: sql`state_code` },
    { level: "national", state: sql`''`, county: sql`''`, groupBy: null as any },
  ];

  for (const { level, state, county, groupBy } of levels) {
    const geoNotNull = level === "national"
      ? sql`TRUE`
      : sql`state_code IS NOT NULL AND state_code <> ''${level === "county" ? sql` AND county_fips IS NOT NULL AND county_fips <> ''` : sql``}`;

    await db.execute(sql`
      INSERT INTO competitor_rate_benchmarks
        (geo_level, state_code, county_fips, loan_type, loan_purpose, activity_year,
         loan_count, median_rate, p25_rate, p75_rate, median_loan_amount)
      SELECT
        ${level},
        ${state},
        ${county},
        loan_type,
        loan_purpose,
        activity_year,
        count(*)::int,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY interest_rate::float8))::numeric(6,3),
        (percentile_cont(0.25) WITHIN GROUP (ORDER BY interest_rate::float8))::numeric(6,3),
        (percentile_cont(0.75) WITHIN GROUP (ORDER BY interest_rate::float8))::numeric(6,3),
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY loan_amount::float8))::numeric(14,2)
      FROM hmda_competitor_loans
      WHERE interest_rate IS NOT NULL
        AND action_taken = 1
        AND loan_type IS NOT NULL
        AND loan_purpose IS NOT NULL
        AND ${geoNotNull}
      GROUP BY ${groupBy ? sql`${groupBy}, ` : sql``}loan_type, loan_purpose, activity_year
      HAVING count(*) >= ${MIN_BENCHMARK_CELL_SIZE}
    `);
  }

  const result: any = await db.execute(sql`SELECT count(*)::int AS n FROM competitor_rate_benchmarks`);
  const rows = result?.rows ?? result;
  return { cells: Number(rows?.[0]?.n ?? 0) };
}
