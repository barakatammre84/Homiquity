/**
 * One-shot backfill: encrypt legacy plaintext SSNs in urla_personal_info.
 *
 * For every row with a plaintext `ssn`, this encrypts it into
 * ssn_encrypted/ssn_iv/ssn_key_id (+ ssn_last4) and nulls the plaintext
 * column. Rows that are already encrypted or have no SSN are skipped, so the
 * script is idempotent and safe to re-run.
 *
 * Run (uses DATABASE_URL + CREDIT_ENCRYPTION_KEY from the environment):
 *   npx tsx server/scripts/backfillSsnEncryption.ts           # dry run
 *   npx tsx server/scripts/backfillSsnEncryption.ts --apply   # write changes
 *
 * Run this in every environment (local, preview, production) BEFORE dropping
 * the plaintext ssn column from the schema.
 */
import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { urlaPersonalInfo } from "@shared/schema";
import { isMaskedSsn, normalizeSsn, encryptSsnToColumns } from "../services/ssnVault";

const apply = process.argv.includes("--apply");

async function main() {
  const rows = await db
    .select({
      id: urlaPersonalInfo.id,
      applicationId: urlaPersonalInfo.applicationId,
      ssn: urlaPersonalInfo.ssn,
      ssnEncrypted: urlaPersonalInfo.ssnEncrypted,
    })
    .from(urlaPersonalInfo)
    .where(isNotNull(urlaPersonalInfo.ssn));

  console.log(`${rows.length} row(s) with a non-null plaintext ssn`);
  let encrypted = 0;
  let skipped = 0;

  for (const row of rows) {
    const value = row.ssn!;
    if (isMaskedSsn(value)) {
      // A masked value was stored before the write path learned to ignore
      // masked echoes. There is no plaintext to recover — null it out and
      // keep the encrypted columns (if any) as the source of truth.
      console.warn(`- row ${row.id} (app ${row.applicationId}): stored value is masked; clearing plaintext column`);
      if (apply) {
        await db.update(urlaPersonalInfo).set({ ssn: null }).where(eq(urlaPersonalInfo.id, row.id));
      }
      skipped++;
      continue;
    }

    const canonical = normalizeSsn(value);
    if (!canonical) {
      console.warn(`- row ${row.id} (app ${row.applicationId}): plaintext ssn is not 9 digits; leaving for manual review`);
      skipped++;
      continue;
    }

    if (apply) {
      await db
        .update(urlaPersonalInfo)
        .set(encryptSsnToColumns(canonical))
        .where(eq(urlaPersonalInfo.id, row.id));
    }
    encrypted++;
  }

  console.log(`${apply ? "Encrypted" : "Would encrypt"} ${encrypted} row(s); ${skipped} skipped.`);
  if (!apply) console.log("Dry run — re-run with --apply to write changes.");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
