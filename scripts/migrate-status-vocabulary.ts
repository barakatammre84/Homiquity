/**
 * One-time data migration: normalize legacy loan-application status values to
 * the canonical vocabulary (shared/schema/lending.ts LOAN_APP_STATUSES).
 *
 * Legacy values were written by the old staff status endpoint, which used a
 * different vocabulary than the pipeline engine (the "status split-brain"
 * fixed in the backend→UI optimization sprint):
 *
 *   in_review            → processing
 *   conditional_approval → conditional
 *   approved             → clear_to_close   (final approval ≈ CTC in the
 *                                            pipeline model; milestone
 *                                            semantics match clearToCloseAt)
 *
 * Idempotent — rows already in canonical form are untouched. Run with:
 *   npx tsx scripts/migrate-status-vocabulary.ts          (dry run)
 *   npx tsx scripts/migrate-status-vocabulary.ts --apply  (write)
 */
import { db } from "../server/db";
import { loanApplications, LOAN_APP_STATUSES } from "../shared/schema";
import { eq, notInArray, sql } from "drizzle-orm";

const LEGACY_MAP: Record<string, string> = {
  in_review: "processing",
  conditional_approval: "conditional",
  approved: "clear_to_close",
  closed: "funded",
  declined: "denied",
  pending: "submitted",
  under_review: "processing",
};

async function main() {
  const apply = process.argv.includes("--apply");

  const stray = await db
    .select({
      status: loanApplications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(loanApplications)
    .where(notInArray(loanApplications.status, [...LOAN_APP_STATUSES]))
    .groupBy(loanApplications.status);

  if (stray.length === 0) {
    console.log("✓ All loan_applications.status values are canonical — nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${stray.length} non-canonical status value(s):`);
  for (const row of stray) {
    const target = LEGACY_MAP[row.status];
    console.log(
      `  ${row.status} (${row.count} rows) → ${target ?? "!! NO MAPPING — resolve manually"}`,
    );
  }

  const unmapped = stray.filter((r) => !LEGACY_MAP[r.status]);
  if (unmapped.length > 0) {
    console.error(
      `\n✗ ${unmapped.length} status value(s) have no mapping. Add them to LEGACY_MAP before applying.`,
    );
    process.exit(1);
  }

  if (!apply) {
    console.log("\nDry run — re-run with --apply to write these changes.");
    process.exit(0);
  }

  for (const row of stray) {
    const target = LEGACY_MAP[row.status];
    const result = await db
      .update(loanApplications)
      .set({ status: target })
      .where(eq(loanApplications.status, row.status));
    console.log(`✓ ${row.status} → ${target}`);
  }
  console.log("\nMigration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
