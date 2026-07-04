/**
 * PII encryption migration — SSNs and bank account numbers.
 *
 * Run with:  npx tsx scripts/migrate-encrypt-pii.ts
 * Requires:  DATABASE_URL and (in production) CREDIT_ENCRYPTION_KEY in the env.
 *
 * What it does, idempotently:
 *   1. Adds the encrypted columns (ADD COLUMN IF NOT EXISTS — deliberately NOT
 *      drizzle-kit push, which stalls on unrelated interactive prompts in this
 *      repo; see .agents/memory/db-push-blocker.md).
 *   2. Backfills: encrypts every legacy plaintext value (urla_personal_info.ssn,
 *      urla_assets.account_number, urla_liabilities.account_number) into the
 *      new columns via AES-256-GCM (server/services/encryptionService.ts).
 *   3. Nulls the plaintext columns. The empty legacy columns are left in place
 *      so this script stays re-runnable; drop them once verified:
 *        ALTER TABLE urla_personal_info DROP COLUMN IF EXISTS ssn;
 *        ALTER TABLE urla_assets DROP COLUMN IF EXISTS account_number;
 *        ALTER TABLE urla_liabilities DROP COLUMN IF EXISTS account_number;
 */
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { encryptPiiField, encryptToken } from "../server/services/piiVault";

interface ColumnSpec {
  table: string;
  plaintextColumn: string;
  prefix: string; // encrypted column prefix, e.g. "ssn" or "account_number"
  normalizeDigitsOnly: boolean;
}

const TARGETS: ColumnSpec[] = [
  { table: "urla_personal_info", plaintextColumn: "ssn", prefix: "ssn", normalizeDigitsOnly: true },
  { table: "urla_assets", plaintextColumn: "account_number", prefix: "account_number", normalizeDigitsOnly: false },
  { table: "urla_liabilities", plaintextColumn: "account_number", prefix: "account_number", normalizeDigitsOnly: false },
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `);
  return (result as any).rows?.length > 0 || (Array.isArray(result) && result.length > 0);
}

async function migrateTarget(spec: ColumnSpec): Promise<void> {
  const { table, plaintextColumn, prefix } = spec;

  // 1. Guarded DDL — non-destructive, idempotent.
  await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${prefix}_encrypted text`));
  await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${prefix}_iv varchar(32)`));
  await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${prefix}_key_id varchar(20)`));
  await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${prefix}_last4 varchar(4)`));

  // 2. Backfill — only when the legacy plaintext column still exists.
  if (!(await columnExists(table, plaintextColumn))) {
    console.log(`[${table}] legacy column ${plaintextColumn} already dropped — nothing to backfill`);
    return;
  }

  const pending = await db.execute(sql.raw(`
    SELECT id, ${plaintextColumn} AS plaintext FROM ${table}
    WHERE ${plaintextColumn} IS NOT NULL AND ${plaintextColumn} <> ''
      AND ${prefix}_encrypted IS NULL
  `));
  const rows: Array<{ id: string; plaintext: string }> =
    (pending as any).rows ?? (Array.isArray(pending) ? (pending as any) : []);

  let migrated = 0;
  for (const row of rows) {
    const value = spec.normalizeDigitsOnly ? row.plaintext.replace(/\D/g, "") : row.plaintext.trim();
    if (!value) continue;
    const enc = encryptPiiField(value);
    await db.execute(sql`
      UPDATE ${sql.raw(table)}
      SET ${sql.raw(`${prefix}_encrypted`)} = ${enc.encrypted},
          ${sql.raw(`${prefix}_iv`)} = ${enc.iv},
          ${sql.raw(`${prefix}_key_id`)} = ${enc.keyId},
          ${sql.raw(`${prefix}_last4`)} = ${enc.last4}
      WHERE id = ${row.id}
    `);
    migrated++;
  }

  // 3. Null the plaintext now that ciphertext exists.
  const cleared = await db.execute(sql.raw(`
    UPDATE ${table} SET ${plaintextColumn} = NULL
    WHERE ${plaintextColumn} IS NOT NULL AND ${prefix}_encrypted IS NOT NULL
  `));
  const clearedCount = (cleared as any).rowCount ?? "?";

  console.log(`[${table}] encrypted ${migrated} value(s), nulled ${clearedCount} plaintext cell(s)`);
}

/** Plaid access tokens: encrypt in place into the "encv1:..." envelope. */
async function migratePlaidTokens(): Promise<void> {
  if (!(await columnExists("verifications", "plaid_access_token"))) {
    console.log("[verifications] plaid_access_token column not found — skipping");
    return;
  }
  const pending = await db.execute(sql.raw(`
    SELECT id, plaid_access_token AS token FROM verifications
    WHERE plaid_access_token IS NOT NULL AND plaid_access_token <> ''
      AND plaid_access_token NOT LIKE 'encv1:%'
  `));
  const rows: Array<{ id: string; token: string }> =
    (pending as any).rows ?? (Array.isArray(pending) ? (pending as any) : []);
  for (const row of rows) {
    await db.execute(sql`
      UPDATE verifications SET plaid_access_token = ${encryptToken(row.token)} WHERE id = ${row.id}
    `);
  }
  console.log(`[verifications] encrypted ${rows.length} Plaid access token(s)`);
}

async function main() {
  for (const spec of TARGETS) {
    await migrateTarget(spec);
  }
  await migratePlaidTokens();

  // Verify: no plaintext left behind.
  for (const spec of TARGETS) {
    if (!(await columnExists(spec.table, spec.plaintextColumn))) continue;
    const remaining = await db.execute(sql.raw(
      `SELECT count(*)::int AS n FROM ${spec.table} WHERE ${spec.plaintextColumn} IS NOT NULL AND ${spec.plaintextColumn} <> ''`
    ));
    const n = ((remaining as any).rows?.[0] ?? (remaining as any)[0])?.n ?? "?";
    console.log(`[verify] ${spec.table}.${spec.plaintextColumn}: ${n} plaintext value(s) remaining (expect 0)`);
  }

  console.log("PII encryption migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
