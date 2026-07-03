import "dotenv/config";
import { db } from "../db";
import { urlaPersonalInfo } from "@shared/schema";
import { eq, isNotNull } from "drizzle-orm";
import { encryptSensitiveData } from "../services/encryptionService";

/**
 * One-time backfill: encrypts legacy plaintext SSNs on urla_personal_info into
 * the at-rest columns (ssn_encrypted / ssn_iv / ssn_key_id / ssn_last4,
 * AES-256-GCM via encryptionService), then nulls the plaintext column.
 *
 * Run with:  tsx server/scripts/backfillSsnEncryption.ts
 * Requires DATABASE_URL and (in production) CREDIT_ENCRYPTION_KEY.
 *
 * Idempotent: only rows with a non-empty plaintext `ssn` are touched, and the
 * plaintext is cleared in the same UPDATE, so a re-run finds nothing to do.
 * Rows that already carry ciphertext are left alone (the plaintext is simply
 * cleared) so a value written post-deploy is never overwritten by stale data.
 *
 * FOLLOW-UP: after this has run in production and MISMO exports are confirmed
 * working against the encrypted columns, drop the plaintext column in a
 * separate migration:  ALTER TABLE urla_personal_info DROP COLUMN ssn;
 * (and remove `ssn` from shared/schema/lending.ts + its remaining readers).
 */
async function backfillSsnEncryption() {
  const rows = await db
    .select({
      id: urlaPersonalInfo.id,
      ssn: urlaPersonalInfo.ssn,
      ssnEncrypted: urlaPersonalInfo.ssnEncrypted,
    })
    .from(urlaPersonalInfo)
    .where(isNotNull(urlaPersonalInfo.ssn));

  let encrypted = 0;
  let clearedOnly = 0;
  let skippedEmpty = 0;

  for (const row of rows) {
    const plaintext = row.ssn?.trim();
    if (!plaintext) {
      skippedEmpty++;
      continue;
    }

    if (row.ssnEncrypted) {
      // Ciphertext already present (written after the encryption deploy):
      // just clear the stale plaintext, don't overwrite the newer value.
      await db
        .update(urlaPersonalInfo)
        .set({ ssn: null })
        .where(eq(urlaPersonalInfo.id, row.id));
      clearedOnly++;
      continue;
    }

    const enc = encryptSensitiveData(plaintext);
    await db
      .update(urlaPersonalInfo)
      .set({
        ssnEncrypted: enc.encryptedContent,
        ssnIv: enc.iv,
        ssnKeyId: enc.keyId,
        ssnLast4: plaintext.replace(/\D/g, "").slice(-4),
        ssn: null,
      })
      .where(eq(urlaPersonalInfo.id, row.id));
    encrypted++;
  }

  console.log(
    `SSN encryption backfill complete: ${encrypted} encrypted, ` +
      `${clearedOnly} plaintext-cleared (ciphertext already present), ` +
      `${skippedEmpty} empty values skipped, ${rows.length} rows scanned.`
  );
}

backfillSsnEncryption()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SSN encryption backfill failed:", err);
    process.exit(1);
  });
