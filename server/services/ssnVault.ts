import {
  encryptSensitiveData,
  decryptSensitiveData,
  maskSSN,
} from "./encryptionService";

/**
 * SSN-at-rest handling for URLA personal info (urla_personal_info).
 *
 * Plaintext SSNs never touch the database: the write path encrypts into
 * ssn_encrypted/ssn_iv/ssn_key_id (AES-256-GCM, same scheme and key as credit
 * reports) and keeps only ssn_last4 for display. Read paths present the
 * masked form (XXX-XX-1234); the full value is decrypted only for GSE/MISMO
 * delivery and the audited staff reveal endpoint.
 *
 * The client round-trips the masked value on form save, so a masked input
 * means "unchanged" — detect it and skip the write rather than encrypting
 * the mask.
 */

/** Row shape the vault needs — a subset of the urla_personal_info columns. */
export interface SsnColumns {
  ssn: string | null;
  ssnEncrypted: string | null;
  ssnIv: string | null;
  ssnKeyId: string | null;
  ssnLast4: string | null;
}

/** True when the value is a masked SSN echoed back from the UI (XXX-XX-1234, •••-••-1234, etc.). */
export function isMaskedSsn(value: string): boolean {
  return /[Xx*•]/.test(value);
}

/**
 * Canonicalize an SSN to "DDD-DD-DDDD". Returns null when the input does not
 * contain exactly 9 digits (invalid — callers should reject, not store).
 */
export function normalizeSsn(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** Encrypt a canonical SSN into the column set stored on urla_personal_info. */
export function encryptSsnToColumns(canonicalSsn: string): SsnColumns {
  const encrypted = encryptSensitiveData(canonicalSsn);
  return {
    ssn: null,
    ssnEncrypted: encrypted.encryptedContent,
    ssnIv: encrypted.iv,
    ssnKeyId: encrypted.keyId,
    ssnLast4: canonicalSsn.slice(-4),
  };
}

/** The explicit-clear column set (borrower removed their SSN). */
export function clearedSsnColumns(): SsnColumns {
  return { ssn: null, ssnEncrypted: null, ssnIv: null, ssnKeyId: null, ssnLast4: null };
}

/**
 * Full SSN from a row, decrypting the encrypted columns. Falls back to the
 * legacy plaintext column for rows the backfill has not reached yet.
 * Returns canonical "DDD-DD-DDDD" or null when the row has no SSN.
 */
export function decryptSsnFromRow(row: Partial<SsnColumns>): string | null {
  if (row.ssnEncrypted && row.ssnIv && row.ssnKeyId) {
    return decryptSensitiveData(row.ssnEncrypted, row.ssnIv, row.ssnKeyId);
  }
  if (row.ssn && !isMaskedSsn(row.ssn)) {
    return normalizeSsn(row.ssn);
  }
  return null;
}

/** Masked display form (XXX-XX-1234) from a row, or null when no SSN is stored. */
export function maskedSsnFromRow(row: Partial<SsnColumns>): string | null {
  if (row.ssnLast4) return `XXX-XX-${row.ssnLast4}`;
  // Legacy plaintext row (pre-backfill): mask it on the way out.
  if (row.ssn && !isMaskedSsn(row.ssn)) return maskSSN(row.ssn.replace(/\D/g, ""));
  if (row.ssn) return row.ssn; // already masked
  return null;
}

/**
 * Interpret a client-supplied ssn value for an upsert:
 * - `undefined` / masked echo  → { action: "keep" }   (don't touch stored SSN)
 * - `""` or null               → { action: "clear" }  (explicit removal)
 * - 9-digit value              → { action: "set", columns }
 * - anything else              → { action: "invalid" } (caller returns 400)
 */
export function resolveSsnInput(
  value: string | null | undefined,
):
  | { action: "keep" }
  | { action: "clear" }
  | { action: "invalid" }
  | { action: "set"; columns: SsnColumns } {
  if (value === undefined) return { action: "keep" };
  if (value === null || value.trim() === "") return { action: "clear" };
  if (isMaskedSsn(value)) return { action: "keep" };
  const canonical = normalizeSsn(value);
  if (!canonical) return { action: "invalid" };
  return { action: "set", columns: encryptSsnToColumns(canonical) };
}
