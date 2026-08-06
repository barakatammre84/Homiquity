#!/usr/bin/env node
/**
 * READ-ONLY prod probe for migration 0046 (unique index on
 * policy_profiles (profile_id, version)).
 *
 * DB_MIGRATIONS.md §Contract migrations: a unique index is a CONTRACT step —
 * it aborts if duplicates already exist, and that abort fails the post-merge
 * migrate-prod job and strands prod behind the code that just deployed. The
 * dispatch dry-run cannot pre-flight this: --dry-run prints `pending <tag>`
 * and never executes the DDL, so it would report success whether prod holds
 * zero duplicate pairs or a thousand.
 *
 * This script exists on a throwaway probe branch only. It issues SELECTs and
 * nothing else — no DDL, no DML, no transaction that could be left open — and
 * it prints counts and shape, never row contents out of prod.
 *
 * Exit code is 0 whatever it finds: the point is to REPORT, and a non-zero
 * exit would make "duplicates exist" look like a broken probe.
 */
const { Client } = require("pg");

const TABLE = "policy_profiles";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("probe: DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // --- shape: does the table exist at all? ---------------------------------
    const exists = await client.query(
      `SELECT to_regclass($1) IS NOT NULL AS present`,
      [`public.${TABLE}`],
    );
    const present = exists.rows[0]?.present === true;
    console.log(`\n=== ${TABLE} present in prod: ${present} ===`);
    if (!present) {
      // A migration adding an index to a table prod does not have would fail
      // for a completely different reason, so this is worth knowing plainly.
      console.log(
        "The table does not exist in prod. 0046 would fail on a missing relation,\n" +
          "not on duplicate data. Check whether the table's creating migration is\n" +
          "itself still pending before reading anything else into this.",
      );
      return;
    }

    // --- shape: what indexes already exist? ----------------------------------
    const indexes = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
        ORDER BY indexname`,
      [TABLE],
    );
    console.log(`\n=== existing indexes (${indexes.rowCount}) ===`);
    for (const r of indexes.rows) console.log(`  ${r.indexname}\n    ${r.indexdef}`);
    const already = indexes.rows.some((r) => r.indexname === "idx_policy_profiles_id_version");
    console.log(`\n  idx_policy_profiles_id_version already present: ${already}`);

    // --- the gate: total rows, distinct pairs, duplicates --------------------
    const totals = await client.query(
      `SELECT count(*) AS total_rows,
              count(DISTINCT (profile_id, version)) AS distinct_pairs,
              count(*) FILTER (WHERE profile_id IS NULL) AS null_profile_id,
              count(*) FILTER (WHERE version IS NULL) AS null_version
         FROM ${TABLE}`,
    );
    const t = totals.rows[0];
    console.log(`\n=== row counts ===`);
    console.log(`  total_rows      : ${t.total_rows}`);
    console.log(`  distinct_pairs  : ${t.distinct_pairs}`);
    console.log(`  null profile_id : ${t.null_profile_id}`);
    console.log(`  null version    : ${t.null_version}`);

    // The runbook's query, verbatim. Grouping keys are identifiers, not
    // borrower data, so printing them is safe and is what makes a non-zero
    // result actionable.
    const dupes = await client.query(
      `SELECT profile_id, version, COUNT(*) AS n
         FROM ${TABLE}
        GROUP BY profile_id, version
       HAVING COUNT(*) > 1
        ORDER BY n DESC, profile_id`,
    );

    console.log(`\n=== duplicate (profile_id, version) pairs: ${dupes.rowCount} ===`);
    if (dupes.rowCount === 0) {
      console.log("  none — CREATE UNIQUE INDEX has nothing to abort on.");
      console.log("\nPROBE RESULT: 0046 IS SAFE TO APPLY");
    } else {
      for (const r of dupes.rows) console.log(`  ${r.profile_id} @ ${r.version} -> ${r.n} rows`);
      console.log(
        "\nPROBE RESULT: 0046 WOULD ABORT.\n" +
          "Do NOT invent data to clear these. Which of two rows claiming the same\n" +
          "approved version is authoritative is a records question, not a code one —\n" +
          "bring the counts above to the founder and decide the resolution together.",
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("probe failed:", err.message);
  process.exit(1);
});
