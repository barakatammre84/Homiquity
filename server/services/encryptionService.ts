import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// ===========================================================================
// KEYED ENCRYPTION WITH ROTATION + OPTIONAL CLOUD KMS ENVELOPE ENCRYPTION
//
// Ciphertext is tagged with a `keyId`. That id resolves to a 32-byte AES key
// held in the in-memory registry below, so multiple key versions can coexist:
// new writes use the *active* key, while historical rows keep decrypting under
// whatever key encrypted them. This is the rotation path.
//
// Two kinds of keys register into the same table:
//   • App-level keys ("v1", "v2", …) from CREDIT_ENCRYPTION_KEY[_V2…]. "v1" is
//     the original single static key — every pre-existing row is tagged "v1",
//     so it must keep resolving to exactly that key. Multiple versions give a
//     rotation path even without KMS.
//   • KMS Data Encryption Keys ("kms-1", …). With PII_KMS_KEY_NAME set, DEKs are
//     stored *wrapped* by a Cloud KMS key (the KEK, which never leaves KMS) and
//     unwrapped once at boot (initEncryption) into the registry. This is
//     envelope encryption: the KEK is HSM-backed and rotates in KMS; rotating
//     the DEK is appending a new "kms-N" entry. Field ops stay synchronous
//     because the unwrap happens once at startup, not per record.
//
// Active-key precedence: ENCRYPTION_ACTIVE_KEY_ID (explicit pin) > newest KMS
// DEK > highest app-level version. Everything registered stays available for
// decryption regardless of which key is active.
// ===========================================================================

const keyRegistry = new Map<string, Buffer>();
let activeKeyId: string | null = null;
let initialized = false;

function parseBase64Key(raw: string, label: string): Buffer {
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`${label} must be 32 bytes (256 bits) base64 encoded`);
  }
  return buf;
}

// Resolution for the original app-level key (keyId "v1"). Preserves the prior
// single-key behavior exactly so already-encrypted rows keep decrypting.
function getStaticV1Key(): Buffer {
  const keyEnv = process.env.CREDIT_ENCRYPTION_KEY;
  if (keyEnv) return parseBase64Key(keyEnv, "CREDIT_ENCRYPTION_KEY");

  if (isProduction()) {
    throw new Error(
      "CREDIT_ENCRYPTION_KEY is not set. A dedicated 32-byte (256-bit) base64-encoded key is required in production to protect sensitive borrower data (SSNs). Refusing to start with a weak derived fallback key."
    );
  }

  return crypto.scryptSync(
    process.env.SESSION_SECRET || "default-dev-key",
    "credit-encryption-salt",
    KEY_LENGTH
  );
}

function registerStaticKeys(): void {
  keyRegistry.set("v1", getStaticV1Key());
  // Optional additional app-level versions enable rotation without KMS.
  for (let v = 2; v <= 9; v++) {
    const raw = process.env[`CREDIT_ENCRYPTION_KEY_V${v}`];
    if (raw) keyRegistry.set(`v${v}`, parseBase64Key(raw, `CREDIT_ENCRYPTION_KEY_V${v}`));
  }
}

function highestStaticKeyId(): string {
  let best = 1;
  for (const id of keyRegistry.keys()) {
    const m = /^v(\d+)$/.exec(id);
    if (m && Number(m[1]) > best) best = Number(m[1]);
  }
  return `v${best}`;
}

interface WrappedDekEntry {
  keyId: string;
  wrappedDek: string; // base64 of the KMS-wrapped 32-byte DEK
}

// Unwraps the KMS-protected Data Encryption Keys once, at boot. Returns the
// newest keyId (last entry) so it can become active, or null when KMS is not
// configured. Throws (fail-closed) if KMS is configured but unusable.
async function registerKmsKeys(): Promise<string | null> {
  const kmsKeyName = process.env.PII_KMS_KEY_NAME;
  if (!kmsKeyName) return null;

  const wrappedJson = process.env.PII_KMS_WRAPPED_DEKS;
  if (!wrappedJson) {
    throw new Error(
      "PII_KMS_KEY_NAME is set but PII_KMS_WRAPPED_DEKS is missing. Provide the wrapped Data Encryption Keys as JSON: [{\"keyId\":\"kms-1\",\"wrappedDek\":\"<base64>\"}] (oldest first, newest last)."
    );
  }

  let entries: WrappedDekEntry[];
  try {
    entries = JSON.parse(wrappedJson);
  } catch {
    throw new Error('PII_KMS_WRAPPED_DEKS must be JSON: [{"keyId":"kms-1","wrappedDek":"<base64>"}]');
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("PII_KMS_WRAPPED_DEKS must be a non-empty JSON array of {keyId, wrappedDek}.");
  }

  // Dynamic, non-literal specifier so the compiler/runtime don't require the
  // optional @google-cloud/kms dependency unless a deployment actually uses KMS.
  // It is intentionally NOT in package.json (keeps installs lean and lockfiles
  // stable); a KMS-enabled deployment runs `npm i @google-cloud/kms` as part of
  // enabling KMS. Boot fails closed with a clear error if it's missing.
  const kmsModuleSpecifier = "@google-cloud/kms";
  // @ts-ignore optional dependency, installed only in KMS-enabled deployments
  const kms = await import(kmsModuleSpecifier);
  const client = new kms.KeyManagementServiceClient();

  let newest: string | null = null;
  for (const { keyId, wrappedDek } of entries) {
    if (!keyId || !wrappedDek) {
      throw new Error("Each PII_KMS_WRAPPED_DEKS entry needs a keyId and wrappedDek.");
    }
    const ciphertext = Buffer.from(wrappedDek, "base64");
    const [res] = await client.decrypt({ name: kmsKeyName, ciphertext });
    const raw = res.plaintext;
    const dek = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
    if (dek.length !== KEY_LENGTH) {
      throw new Error(`KMS-unwrapped DEK ${keyId} is not 32 bytes — check the wrapped value and KEK.`);
    }
    keyRegistry.set(keyId, dek);
    newest = keyId;
  }
  return newest;
}

/**
 * Populate the key registry and choose the active key. Idempotent. Awaited once
 * at boot (after assertEncryptionConfig) because the KMS unwrap is async; all
 * field-level encrypt/decrypt afterwards is synchronous against the cache.
 */
export async function initEncryption(): Promise<void> {
  if (initialized) return;
  registerStaticKeys();
  const kmsActive = await registerKmsKeys();
  activeKeyId =
    process.env.ENCRYPTION_ACTIVE_KEY_ID || kmsActive || highestStaticKeyId();
  if (!keyRegistry.has(activeKeyId)) {
    throw new Error(
      `Active encryption key "${activeKeyId}" is not registered. Check ENCRYPTION_ACTIVE_KEY_ID / PII_KMS_WRAPPED_DEKS.`
    );
  }
  initialized = true;
}

// Test-only: clear registry + active key so a suite can exercise rotation
// scenarios with different env. No-op in production.
export function __resetEncryptionStateForTests(): void {
  if (isProduction()) return;
  keyRegistry.clear();
  activeKeyId = null;
  initialized = false;
}

function resolveKey(keyId: string): Buffer {
  const existing = keyRegistry.get(keyId);
  if (existing) return existing;
  // Lazy path for code that encrypts before initEncryption() ran (e.g. a unit
  // test): "v1" always resolves to the static key, preserving prior behavior.
  if (keyId === "v1") {
    const key = getStaticV1Key();
    keyRegistry.set("v1", key);
    return key;
  }
  throw new Error(`Unknown key version: ${keyId}`);
}

function keyForEncryption(): { keyId: string; key: Buffer } {
  if (activeKeyId && keyRegistry.has(activeKeyId)) {
    return { keyId: activeKeyId, key: keyRegistry.get(activeKeyId)! };
  }
  // Not initialized yet — default to v1 (unchanged from the original behavior).
  return { keyId: "v1", key: resolveKey("v1") };
}

/** The keyId new encryptions are currently tagged with. */
export function getActiveKeyId(): string {
  return keyForEncryption().keyId;
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

  // CREDIT_ENCRYPTION_KEY ("v1") is required even when KMS is enabled, because
  // rows encrypted before KMS was introduced are tagged "v1".
  getStaticV1Key();
}

export interface EncryptedData {
  encryptedContent: string;
  iv: string;
  keyId: string;
}

export function encryptSensitiveData(plaintext: string): EncryptedData {
  const { keyId, key } = keyForEncryption();
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
    keyId,
  };
}

export function decryptSensitiveData(
  encryptedContent: string,
  iv: string,
  keyId: string
): string {
  const key = resolveKey(keyId);
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
