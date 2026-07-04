import "dotenv/config";
import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { loanPerformanceProfiles } from "@shared/schema";
import { FannieLoanAggregator, FANNIE_COLUMNS } from "../services/marketDataParsers";

/**
 * Fold a Fannie Mae Single-Family Loan Performance file (multi-GB,
 * pipe-delimited, one row per loan per month) into per-band risk aggregates.
 *
 * Streams line-by-line — memory is bounded by the number of credit×LTV×DTI
 * band combinations (a few hundred), never by file size. Assumes rows are
 * grouped by loan id, which the published files are.
 *
 * Download (free registration): Fannie Mae Data Dynamics portal →
 * Single-Family Loan Performance Data. Files may be fed in as .csv/.txt/.gz.
 *
 * Usage:
 *   npm run data:fannie -- /path/to/2023Q4.csv --dataset sf_2023q4
 *   npm run data:fannie -- /path/to/2023Q4.csv.gz --dataset sf_2023q4
 *   npm run data:fannie -- /path/to/file.csv --inspect   # print first row's
 *     fields with column indices to verify FANNIE_COLUMNS against the layout
 */

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const filePath = process.argv[2];
  if (!filePath || filePath.startsWith("--") || !fs.existsSync(filePath)) {
    console.error("Usage: npm run data:fannie -- <path-to-performance-file> --dataset <label>");
    process.exit(1);
  }

  const raw = fs.createReadStream(filePath);
  const input = filePath.endsWith(".gz") ? raw.pipe(zlib.createGunzip()) : raw;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  if (hasFlag("inspect")) {
    for await (const line of rl) {
      if (!line.trim()) continue;
      console.log("First row, indexed fields (verify against FANNIE_COLUMNS in marketDataParsers.ts):");
      line.split("|").forEach((field, i) => console.log(`  [${i}] ${field}`));
      console.log("\nExpected:", JSON.stringify(FANNIE_COLUMNS, null, 2));
      rl.close();
      raw.destroy();
      return;
    }
    console.error("File is empty.");
    process.exitCode = 1;
    return;
  }

  const dataset = arg("dataset");
  if (!dataset) {
    console.error("Missing --dataset <label> (e.g. sf_2023q4) — identifies this vintage in loan_performance_profiles");
    process.exit(1);
  }

  const aggregator = new FannieLoanAggregator();
  let lines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    aggregator.addRow(line.split("|"));
    if (++lines % 1_000_000 === 0) console.log(`  …${lines.toLocaleString()} rows streamed`);
  }

  const { cells, loansSeen, rowsSeen, skippedRows } = aggregator.finish();
  console.log(`Streamed ${rowsSeen.toLocaleString()} rows → ${loansSeen.toLocaleString()} loans → ${cells.length} band cells (${skippedRows} rows skipped).`);
  if (cells.length === 0) {
    console.error("No cells produced — wrong file layout? Rerun with --inspect.");
    process.exit(1);
  }

  // Replace this dataset's profiles wholesale so reruns are idempotent.
  await db.delete(loanPerformanceProfiles).where(eq(loanPerformanceProfiles.sourceDataset, dataset));
  await db.insert(loanPerformanceProfiles).values(cells.map((cell) => ({
    sourceDataset: dataset,
    creditBucket: cell.creditBucket,
    ltvBand: cell.ltvBand,
    dtiBand: cell.dtiBand,
    loanCount: cell.loanCount,
    defaultCount: cell.defaultCount,
    seriousDelinqCount: cell.seriousDelinqCount,
    prepaidCount: cell.prepaidCount,
    avgOrigRate: cell.rateCount > 0 ? (cell.rateSum / cell.rateCount).toFixed(3) : null,
    defaultRatePct: ((cell.defaultCount / cell.loanCount) * 100).toFixed(3),
    seriousDelinqRatePct: ((cell.seriousDelinqCount / cell.loanCount) * 100).toFixed(3),
    prepayRatePct: ((cell.prepaidCount / cell.loanCount) * 100).toFixed(3),
  })));

  console.log(`Wrote ${cells.length} loan_performance_profiles rows for dataset "${dataset}".`);
}

main()
  .catch((err) => {
    console.error("Fannie Mae ingest failed:", err);
    process.exitCode = 1;
  })
  // Close the pool instead of process.exit(): exit() can drop buffered stdout
  // and would skip the driver's clean shutdown.
  .finally(() => void pool.end().catch(() => {}));
