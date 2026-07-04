import "dotenv/config";
import { pool } from "../db";
import {
  resolveFilersByName,
  ingestHmdaCompetitor,
  recomputeCompetitorBenchmarks,
} from "../services/hmdaIngestService";

/**
 * Ingest competitor originations from the public CFPB HMDA data-browser API
 * and rebuild the competitor rate benchmarks.
 *
 * Usage:
 *   npm run data:hmda -- --year 2024 --lender "Better Mortgage"
 *   npm run data:hmda -- --year 2024 --lei 549300... --lender-name "Better Mortgage Corporation"
 *   npm run data:hmda -- --year 2024 --lender "Better" --list-only     # resolve LEIs only
 *   npm run data:hmda -- --year 2024 --lender "Rocket" --states MI,OH  # limit geography
 *
 * HMDA is released annually; use the latest published activity year.
 * No API key required — this is public data.
 */

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const year = parseInt(arg("year") ?? "", 10);
  if (!year) {
    console.error("Missing --year (e.g. --year 2024, the latest published HMDA activity year)");
    process.exit(1);
  }

  let lei = arg("lei");
  let lenderName = arg("lender-name") ?? arg("lender");
  const lenderQuery = arg("lender");
  const states = arg("states")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  if (!lei) {
    if (!lenderQuery) {
      console.error("Provide --lender \"Name\" (resolved via the HMDA filers list) or --lei <LEI>");
      process.exit(1);
    }
    console.log(`Resolving "${lenderQuery}" against the ${year} HMDA filers list…`);
    const matches = await resolveFilersByName(year, lenderQuery);
    if (matches.length === 0) {
      console.error(`No ${year} HMDA filer matches "${lenderQuery}". Try a shorter query.`);
      process.exit(1);
    }
    if (hasFlag("list-only") || matches.length > 1) {
      console.log(`${matches.length} filer(s) matched:`);
      for (const m of matches) console.log(`  ${m.lei}  ${m.name}`);
      if (matches.length > 1 && !hasFlag("list-only")) {
        console.error("\nAmbiguous — rerun with --lei <LEI> to pick one.");
        process.exitCode = 1;
      }
      if (hasFlag("list-only") || matches.length > 1) return;
    }
    lei = matches[0].lei;
    lenderName = matches[0].name;
    console.log(`Resolved: ${lenderName} (${lei})`);
  }

  console.log(`Ingesting ${year} originations for ${lenderName}${states?.length ? ` in ${states.join(",")}` : ""}…`);
  const result = await ingestHmdaCompetitor({
    lei,
    lenderName: lenderName ?? lei,
    year,
    states,
    onProgress: (n) => {
      if (n % 5000 === 0) console.log(`  …${n.toLocaleString()} rows`);
    },
  });
  console.log(`Ingested ${result.rowsIngested.toLocaleString()} rows (${result.rowsSkipped} skipped), batch ${result.batchId}`);

  console.log("Rebuilding competitor rate benchmarks…");
  const { cells } = await recomputeCompetitorBenchmarks();
  console.log(`Done: ${cells.toLocaleString()} benchmark cells (county/state/national medians).`);
}

main()
  .catch((err) => {
    console.error("HMDA ingest failed:", err);
    process.exitCode = 1;
  })
  // Close the pool instead of process.exit(): exit() can drop buffered stdout
  // and would skip the driver's clean shutdown.
  .finally(() => void pool.end().catch(() => {}));
