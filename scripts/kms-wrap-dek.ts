/**
 * Generate a new Data Encryption Key (DEK) and wrap it with the Cloud KMS key
 * (KEK) named in PII_KMS_KEY_NAME. Prints the base64 wrapped DEK to append to
 * PII_KMS_WRAPPED_DEKS. This is the key-rotation tool for the envelope
 * encryption in server/services/encryptionService.ts.
 *
 * Usage:
 *   PII_KMS_KEY_NAME=projects/P/locations/L/keyRings/R/cryptoKeys/K \
 *     npx tsx scripts/kms-wrap-dek.ts [newKeyId]
 *
 * Requires @google-cloud/kms installed and GCP credentials with
 * cloudkms.cryptoKeyVersions.useToEncrypt on the KEK (GOOGLE_APPLICATION_CREDENTIALS
 * or workload identity). The plaintext DEK is generated locally, wrapped, and
 * never printed — only the wrapped form is emitted.
 *
 * Rotation runbook:
 *   1. Run this with the next keyId (e.g. "kms-2").
 *   2. Append the printed {keyId, wrappedDek} to the PII_KMS_WRAPPED_DEKS JSON
 *      array (oldest first, newest LAST — the last entry becomes active).
 *   3. Redeploy. New writes use the new DEK; old rows still decrypt under their
 *      original DEK, which stays in the array.
 *   4. (Optional) Re-encrypt historical rows to fully retire an old DEK, then
 *      drop its entry.
 */
import crypto from "crypto";

async function main() {
  const kmsKeyName = process.env.PII_KMS_KEY_NAME;
  if (!kmsKeyName) {
    console.error("PII_KMS_KEY_NAME is required (the KMS KEK resource name).");
    process.exit(1);
  }
  const newKeyId = process.argv[2] || "kms-1";

  const dek = crypto.randomBytes(32); // 256-bit Data Encryption Key

  // Dynamic specifier so this repo type-checks without the optional dep present.
  const kmsModuleSpecifier = "@google-cloud/kms";
  // @ts-ignore optional dependency, installed only in KMS-enabled environments
  const kms = await import(kmsModuleSpecifier);
  const client = new kms.KeyManagementServiceClient();

  const [res] = await client.encrypt({ name: kmsKeyName, plaintext: dek });
  const wrapped = Buffer.isBuffer(res.ciphertext)
    ? res.ciphertext
    : Buffer.from(res.ciphertext as Uint8Array);

  const entry = { keyId: newKeyId, wrappedDek: wrapped.toString("base64") };
  console.log("New wrapped DEK entry — append to PII_KMS_WRAPPED_DEKS (as the last element):\n");
  console.log(JSON.stringify(entry, null, 2));
  console.log(
    `\nExample full value:\n[${JSON.stringify(entry)}]\n` +
      "If you already have entries, keep them and add this one at the end."
  );
}

main().catch((err) => {
  console.error("Failed to wrap DEK:", err);
  process.exit(1);
});
