/**
 * Adopt versioned migrations on a database that ALREADY has the schema.
 *
 * Databases that were built with `drizzle-kit push` (local dev, current
 * production) already contain every object in migrations/0000_baseline.sql.
 * Running `drizzle-kit migrate` there would try to re-create them and fail.
 * This script records the existing migration files as applied — in the same
 * journal table drizzle-kit uses (drizzle.__drizzle_migrations) — WITHOUT
 * executing any SQL from them. After running it once, future migrations apply
 * normally with `npm run db:migrate`.
 *
 * Only run this against a database whose schema already matches the code.
 * Fresh/empty databases should run `npm run db:migrate` instead.
 *
 *   npx tsx server/scripts/markMigrationsApplied.ts           # dry run
 *   npx tsx server/scripts/markMigrationsApplied.ts --apply   # write journal
 */
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pool } from "../db";

const apply = process.argv.includes("--apply");
const migrationsDir = path.resolve(import.meta.dirname, "../../migrations");

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function main() {
  const journal = JSON.parse(
    fs.readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  // Same DDL drizzle's migrator creates on first run.
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await pool.query(`CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`);

  const { rows: existing } = await pool.query<{ hash: string; created_at: string }>(
    `SELECT hash, created_at FROM "drizzle"."__drizzle_migrations"`,
  );

  let recorded = 0;
  for (const entry of journal.entries) {
    const sql = fs.readFileSync(path.join(migrationsDir, `${entry.tag}.sql`), "utf8");
    // drizzle's migrator hashes the raw file content with sha256.
    const hash = crypto.createHash("sha256").update(sql).digest("hex");

    if (existing.some((row) => row.hash === hash || Number(row.created_at) === entry.when)) {
      console.log(`= ${entry.tag} already recorded`);
      continue;
    }

    console.log(`+ ${entry.tag} (${entry.when})${apply ? "" : " [dry run]"}`);
    if (apply) {
      await pool.query(
        `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when],
      );
    }
    recorded++;
  }

  console.log(`${apply ? "Recorded" : "Would record"} ${recorded} migration(s) as applied.`);
  if (!apply && recorded > 0) console.log("Re-run with --apply to write the journal.");
}

main()
  .catch((err) => {
    console.error("Adoption failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
