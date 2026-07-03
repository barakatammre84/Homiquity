import { encryptSensitiveData, decryptSensitiveData } from "./encryptionService";

// =============================================================================
// PII VAULT — field-level encryption for direct identifiers
//
// SSNs and bank account numbers are stored ONLY as AES-256-GCM ciphertext
// (encryptionService) plus a last-4 display fragment. The plaintext value is
// write-only from the API's perspective: clients submit it, the storage layer
// encrypts it here, and only `*Last4` ever leaves the server. Decryption is
// reserved for server-side consumers with a regulatory need for the full value
// (MISMO 3.4 loan delivery, future AUS submission) — never for API responses.
// =============================================================================

export interface EncryptedPiiField {
  encrypted: string;
  iv: string;
  keyId: string;
  last4: string;
}

/** Encrypt a PII value (SSN, account number). Digits-only last4 for display. */
export function encryptPiiField(plaintext: string): EncryptedPiiField {
  const { encryptedContent, iv, keyId } = encryptSensitiveData(plaintext);
  const digits = plaintext.replace(/\D/g, "");
  return {
    encrypted: encryptedContent,
    iv,
    keyId,
    last4: digits.slice(-4),
  };
}

/** Decrypt a PII field triple; returns null when the field was never set. */
export function decryptPiiField(
  record: { encrypted?: string | null; iv?: string | null; keyId?: string | null },
): string | null {
  if (!record.encrypted || !record.iv || !record.keyId) return null;
  return decryptSensitiveData(record.encrypted, record.iv, record.keyId);
}

// --- Opaque credential tokens (e.g. Plaid access tokens) --------------------
// Stored as a single self-describing string in the existing text column:
// "encv1:<keyId>:<iv>:<ciphertext>" (base64 never contains ":"). Legacy rows
// written before encryption are returned as-is by decryptToken.

const TOKEN_ENVELOPE_PREFIX = "encv1";

/** Encrypt a bearer credential for at-rest storage in a single text column. */
export function encryptToken(plaintext: string): string {
  const { encryptedContent, iv, keyId } = encryptSensitiveData(plaintext);
  return [TOKEN_ENVELOPE_PREFIX, keyId, iv, encryptedContent].join(":");
}

/** Decrypt a stored credential; passes through legacy plaintext rows. */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length === 4 && parts[0] === TOKEN_ENVELOPE_PREFIX) {
    return decryptSensitiveData(parts[3], parts[2], parts[1]);
  }
  return stored; // legacy plaintext token — migrate via scripts/migrate-encrypt-pii.ts
}

/**
 * Strip ciphertext/IV/key columns from a record before it is serialized into
 * an API response. Last-4 fragments stay; everything else about the encrypted
 * field is server-only.
 */
export function stripEncryptedFields<T extends Record<string, any>>(record: T): Omit<T, never> {
  const clone: Record<string, any> = { ...record };
  for (const key of Object.keys(clone)) {
    // Matches ssnEncrypted/ssnIv/ssnKeyId, accountNumberEncrypted/-Iv/-KeyId, etc.
    if (/(Encrypted|Iv|KeyId)$/.test(key)) {
      delete clone[key];
    }
  }
  return clone as T;
}
