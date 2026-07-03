/**
 * Additive, idempotent DDL for the model-governance columns. Run with:
 *   npx tsx scripts/migrate-governance-columns.ts
 *
 * Uses ADD COLUMN IF NOT EXISTS (nullable / defaulted, non-destructive) rather
 * than drizzle-kit push, which stalls on unrelated interactive prompts in this
 * repo (see .agents/memory/db-push-blocker.md). Safe to re-run.
 *
 * Columns added:
 *   credit_pulls.is_simulated            — flag fabricated (non-bureau) pulls
 *   decision_snapshots.resolved_policy   — thresholds/matrix cells used (JSONB)
 *   decision_snapshots.policy_fingerprint— hash of the above (reproducibility)
 *   documents.extraction_response_hash   — SHA-256 of the raw model output
 *   documents.extraction_raw_encrypted   — raw model output, encrypted at rest
 *   documents.extraction_raw_iv / _key_id
 */
import { sql } from "drizzle-orm";
import { db } from "../server/db";

const STATEMENTS: string[] = [
  `ALTER TABLE credit_pulls ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false`,
  `ALTER TABLE decision_snapshots ADD COLUMN IF NOT EXISTS resolved_policy jsonb`,
  `ALTER TABLE decision_snapshots ADD COLUMN IF NOT EXISTS policy_fingerprint varchar(64)`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_response_hash varchar(64)`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_raw_encrypted text`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_raw_iv varchar(32)`,
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_raw_key_id varchar(20)`,
];

const CHECKS: Array<{ table: string; column: string }> = [
  { table: "credit_pulls", column: "is_simulated" },
  { table: "decision_snapshots", column: "resolved_policy" },
  { table: "decision_snapshots", column: "policy_fingerprint" },
  { table: "documents", column: "extraction_response_hash" },
  { table: "documents", column: "extraction_raw_encrypted" },
  { table: "documents", column: "extraction_raw_iv" },
  { table: "documents", column: "extraction_raw_key_id" },
];

async function main() {
  for (const stmt of STATEMENTS) {
    await db.execute(sql.raw(stmt));
    console.log(`ok: ${stmt}`);
  }

  let allPresent = true;
  for (const { table, column } of CHECKS) {
    const res = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = ${column}
    `);
    const present = ((res as any).rows?.length ?? (res as any).length ?? 0) > 0;
    console.log(`[verify] ${table}.${column}: ${present ? "present" : "MISSING"}`);
    if (!present) allPresent = false;
  }

  console.log(allPresent ? "Governance columns migration complete." : "Migration incomplete — see MISSING above.");
  process.exit(allPresent ? 0 : 1);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
