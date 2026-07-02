import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.CREDIT_ENCRYPTION_KEY;
  
  if (keyEnv) {
    const keyBuffer = Buffer.from(keyEnv, "base64");
    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error("CREDIT_ENCRYPTION_KEY must be 32 bytes (256 bits) base64 encoded");
    }
    return keyBuffer;
  }
  
  if (isProduction()) {
    throw new Error(
      "CREDIT_ENCRYPTION_KEY is not set. A dedicated 32-byte (256-bit) base64-encoded key is required in production to protect sensitive borrower data (SSNs). Refusing to start with a weak derived fallback key."
    );
  }
  
  const derivedKey = crypto.scryptSync(
    process.env.SESSION_SECRET || "default-dev-key",
    "credit-encryption-salt",
    KEY_LENGTH
  );
  return derivedKey;
}

export function assertEncryptionConfig(): void {
  if (!isProduction()) return;

  const missing: string[] = [];
  if (!process.env.CREDIT_ENCRYPTION_KEY) missing.push("CREDIT_ENCRYPTION_KEY");
  if (!process.env.PII_HASH_SALT) missing.push("PII_HASH_SALT");

  if (missing.length > 0) {
    throw new Error(
      `Missing required production security secrets: ${missing.join(", ")}. ` +
        `These protect sensitive borrower data (SSNs/PII). Set them before deploying. ` +
        `CREDIT_ENCRYPTION_KEY must be a 32-byte (256-bit) base64-encoded value.`
    );
  }

  getEncryptionKey();
}

export interface EncryptedData {
  encryptedContent: string;
  iv: string;
  keyId: string;
}

export function encryptSensitiveData(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([
    Buffer.from(encrypted, "base64"),
    authTag,
  ]);
  
  return {
    encryptedContent: combined.toString("base64"),
    iv: iv.toString("base64"),
    keyId: "v1",
  };
}

export function decryptSensitiveData(
  encryptedContent: string,
  iv: string,
  keyId: string
): string {
  if (keyId !== "v1") {
    throw new Error(`Unknown key version: ${keyId}`);
  }
  
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, "base64");
  const combined = Buffer.from(encryptedContent, "base64");
  
  const authTag = combined.slice(-AUTH_TAG_LENGTH);
  const encrypted = combined.slice(0, -AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString("utf8");
}

export function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export interface AuditEntryHashInput {
  applicationId: string | null;
  userId: string | null;
  action: string;
  actionDetails: Record<string, any> | null;
  timestamp: Date;
  previousEntryHash: string | null;
}

export function computeAuditEntryHash(entry: AuditEntryHashInput): string {
  const canonical = JSON.stringify({
    applicationId: entry.applicationId,
    userId: entry.userId,
    action: entry.action,
    actionDetails: entry.actionDetails,
    timestamp: entry.timestamp.toISOString(),
    previousHash: entry.previousEntryHash || "GENESIS",
  });
  
  return computeHash(canonical);
}

export function verifyHashChain(
  entries: Array<{
    entryHash: string;
    previousEntryHash: string | null;
    applicationId: string | null;
    userId: string | null;
    action: string;
    actionDetails: Record<string, any> | null;
    timestamp: Date;
  }>
): { valid: boolean; brokenAt?: number; reason?: string } {
  if (entries.length === 0) {
    return { valid: true };
  }
  
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    const expectedHash = computeAuditEntryHash({
      applicationId: entry.applicationId,
      userId: entry.userId,
      action: entry.action,
      actionDetails: entry.actionDetails,
      timestamp: entry.timestamp,
      previousEntryHash: entry.previousEntryHash,
    });
    
    if (entry.entryHash !== expectedHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Entry ${i} hash mismatch: expected ${expectedHash}, got ${entry.entryHash}`,
      };
    }
    
    if (i > 0 && entry.previousEntryHash !== entries[i - 1].entryHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Chain broken at entry ${i}: previous hash doesn't match`,
      };
    }
  }
  
  return { valid: true };
}

export function maskSSN(ssn: string): string {
  if (!ssn || ssn.length < 4) return "XXX-XX-XXXX";
  return `XXX-XX-${ssn.slice(-4)}`;
}

export function hashPII(piiValue: string): string {
  const salt = process.env.PII_HASH_SALT;

  if (!salt) {
    if (isProduction()) {
      throw new Error(
        "PII_HASH_SALT is not set. A dedicated random salt is required in production to securely hash personal data. Refusing to use a weak hardcoded fallback salt."
      );
    }
    return crypto.createHash("sha256").update(piiValue + "mortgage-pii-salt").digest("hex");
  }

  return crypto.createHash("sha256").update(piiValue + salt).digest("hex");
}
