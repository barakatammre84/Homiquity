#!/usr/bin/env node
/**
 * Apply pending Drizzle migrations to a Postgres database over a plain `pg`
 * client — the reliable path for prod Neon, which has a documented
 * drizzle-kit-migrate pooler gotcha (the Neon serverless pool used by
 * server/db.ts is deliberately NOT used here).
 *
 * Run by the post-merge `migrate-prod` job in .github/workflows/ci.yml so PROD
 * catches up automatically the moment a schema change lands on `main`. This
 * closes the "migration file exists but was never applied to prod" gap that
 * took prod down on 2026-07-13 (migrations 0026/0027). Idempotent: a clean
 * no-op when nothing is pending, safe to re-run on every merge.
 *
 * Journal-compatible with `drizzle-kit migrate` AND
 * server/scripts/markMigrationsApplied.ts — same drizzle.__drizzle_migrations
 * table, same sha256-of-raw-file hash, same created_at (journal `when`). So the
 * three tools interoperate and none double-applies what another recorded.
 *
 *   DATABASE_URL=postgres://... node scripts/migrate-prod.cjs             # apply
 *   DATABASE_URL=postgres://... node scripts/migrate-prod.cjs --dry-run   # list pending, apply nothing
 *
 * DATABASE_URL must be the Neon DIRECT (unpooled) URL with sslmode=require.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

const DRY_RUN = process.argv.includes("--dry-run");
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

function loadJournalEntries() {
  const journalPath = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  // Apply strictly in ledger order.
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("migrate-prod: DATABASE_URL is not set — refusing to run.");
    process.exit(1);
  }
  if (!/sslmode=require/.test(url)) {
    console.warn(
      "migrate-prod: warning — DATABASE_URL has no sslmode=require; expected the Neon DIRECT (unpooled) URL.",
    );
  }

  const entries = loadJournalEntries();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Same objects drizzle-kit's migrator creates on first run.
    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (' +
        "id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
    );

    const { rows } = await client.query(
      'SELECT hash, created_at FROM "drizzle"."__drizzle_migrations"',
    );
    const appliedHashes = new Set(rows.map((r) => r.hash));
    // Also dedupe by created_at (= journal `when`), mirroring
    // server/scripts/markMigrationsApplied.ts. A migration whose file content
    // drifted after it was recorded hashes differently but is still applied —
    // matching on `when` keeps the first prod run a clean no-op instead of
    // re-running (and re-journaling) migrations prod already has.
    const appliedWhens = new Set(rows.map((r) => Number(r.created_at)));

    let pending = 0;
    for (const entry of entries) {
      const sql = fs.readFileSync(
        path.join(MIGRATIONS_DIR, `${entry.tag}.sql`),
        "utf8",
      );
      // drizzle's migrator hashes the raw file content with sha256.
      const hash = crypto.createHash("sha256").update(sql).digest("hex");
      if (appliedHashes.has(hash) || appliedWhens.has(entry.when)) continue;

      pending++;
      if (DRY_RUN) {
        console.log(`pending  ${entry.tag}`);
        continue;
      }

      process.stdout.write(`applying ${entry.tag} ... `);
      try {
        await client.query("BEGIN");
        // The whole file runs as one simple query. drizzle's
        // `--> statement-breakpoint` markers are SQL line comments, so
        // multi-statement files execute correctly in a single call.
        await client.query(sql);
        await client.query(
          'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
          [hash, entry.when],
        );
        await client.query("COMMIT");
        console.log("done");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.log("FAILED");
        throw new Error(
          `Migration ${entry.tag} failed and was rolled back: ${err.message}`,
        );
      }
    }

    if (pending === 0) {
      console.log("migrate-prod: up to date — no pending migrations.");
    } else if (DRY_RUN) {
      console.log(`migrate-prod: ${pending} pending migration(s) [dry run].`);
    } else {
      console.log(`migrate-prod: applied ${pending} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`migrate-prod: ${err.message}`);
  process.exit(1);
});
