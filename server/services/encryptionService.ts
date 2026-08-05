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

/**
 * Audit entry hash algorithm versions (F-046).
 *
 * v1 hashes the entry's content and its backpointer, but NOT its
 * `sequenceNumber` — so the sequence could be rewritten without invalidating
 * anything, and an attacker who deleted rows could renumber the survivors to
 * defeat F-038's contiguity check.
 *
 * v2 folds `sequenceNumber` into the hash, which is what closes the finding.
 *
 * A **downgrade attack** — flipping a v2 row's `hashVersion` to 1 to get it
 * verified under the algorithm that ignores the sequence — fails because the v1
 * payload lacks `sequenceNumber` entirely and therefore digests to something
 * other than what is stored. That protection comes from the field's presence,
 * not from the marker.
 *
 * The version marker is nonetheless part of the payload, for a narrower reason:
 * it makes the digest self-describing, so two algorithm versions can never agree
 * on a digest for the same logical content. Today's v1→v2 difference happens to
 * be a field addition, which would be distinguishable anyway; a future version
 * that changes only how existing fields are *interpreted* would not be. Paying
 * one field now avoids a silent cross-version collision later.
 *
 * v1 is kept and still honoured because every entry ever written used it.
 * Re-hashing history to retire it would rewrite the audit log to make it
 * verify — the exact move an audit log exists to make impossible.
 */
export const AUDIT_HASH_V1 = 1;
export const AUDIT_HASH_V2_SEQUENCED = 2;
export const AUDIT_HASH_VERSION_CURRENT = AUDIT_HASH_V2_SEQUENCED;

/** A stored entry with no `hashVersion` predates versioning and is v1. */
export function resolveHashVersion(stored: number | null | undefined): number {
  return stored ?? AUDIT_HASH_V1;
}

export interface AuditEntryHashInput {
  applicationId: string | null;
  userId: string | null;
  action: string;
  actionDetails: Record<string, any> | null;
  timestamp: Date;
  previousEntryHash: string | null;
  /** Required by v2. Ignored by v1, which is why v1 was forgeable. */
  sequenceNumber?: number | null;
  /** Defaults to v1 so every existing caller keeps its current behaviour. */
  hashVersion?: number;
}

// Deterministic canonicalization for audit hashing: object keys sorted
// recursively. actionDetails round-trips through a Postgres jsonb column,
// and jsonb does NOT preserve key order (it sorts by length, then bytes) —
// hashing insertion-ordered JSON would never re-verify after a read.
function sortKeysDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeysDeep(value[k])])
    );
  }
  return value;
}

export function computeAuditEntryHash(entry: AuditEntryHashInput): string {
  const version = entry.hashVersion ?? AUDIT_HASH_V1;

  // v1 payload, byte-for-byte as originally written. Do not touch: every
  // pre-versioning entry in the database re-verifies through this exact shape.
  const payload: Record<string, unknown> = {
    applicationId: entry.applicationId,
    userId: entry.userId,
    action: entry.action,
    actionDetails: entry.actionDetails,
    timestamp: entry.timestamp.toISOString(),
    previousHash: entry.previousEntryHash || "GENESIS",
  };

  if (version >= AUDIT_HASH_V2_SEQUENCED) {
    // `sequenceNumber` is the field being protected — this line IS the fix, and
    // it is also what makes a claimed downgrade to v1 fail, since the v1 payload
    // does not contain it. `hashVersion` is the cheaper insurance described
    // above: it keeps the digest self-describing across future versions.
    payload.hashVersion = version;
    payload.sequenceNumber = entry.sequenceNumber ?? null;
  }

  return computeHash(JSON.stringify(sortKeysDeep(payload)));
}

/**
 * How much of the chain the verification was actually able to attest (F-038).
 *
 * `verifyHashChain` used to return a bare `{valid: true}`, which read as "this
 * log is intact" when it only ever meant "the entries I was handed link to each
 * other". Those are very different claims, and the gap between them was the
 * whole finding. The coverage flags make the difference legible to the caller
 * instead of leaving it to be inferred.
 */
export interface HashChainCoverage {
  /** The chain starts at a genuine genesis entry (`previousEntryHash === null`). */
  headAnchored: boolean;
  /**
   * Sequence numbers were present on every entry and ran 1..N with no gaps.
   * "unavailable" means at least one entry predates sequence numbering (they are
   * nullable, and legacy rows written before the re-anchor may not carry one) —
   * NOT that the check passed.
   */
  sequenceCoverage: "verified" | "unavailable";
  /**
   * Whether the sequence numbers are themselves protected by the hash (F-046).
   *
   *  - `hashed`   — every entry is v2+, so renumbering breaks its own digest.
   *  - `mixed`    — some entries predate v2; those remain renumberable.
   *  - `unhashed` — every entry is v1. Contiguity is a real check against loss
   *                 and mistakes, but not against a determined attacker.
   *
   * Reported rather than assumed, because "the sequence is contiguous" and
   * "the sequence cannot have been forged" are different claims.
   */
  sequenceIntegrity: "hashed" | "mixed" | "unhashed";
}

export interface HashChainResult {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
  coverage: HashChainCoverage;
}

/**
 * Verify a tamper-evident audit chain (F-038).
 *
 * What this detects, and — just as importantly — what it does not:
 *
 *   ✔ mutation of any entry's content (own-hash check)
 *   ✔ mutation of a link (linkage check)
 *   ✔ deletion of the chain HEAD, and any contiguous mid-chain window, because
 *     entry 0 must now carry `previousEntryHash === null`. Previously the
 *     linkage check was guarded by `if (i > 0 …)`, so entry 0's backpointer was
 *     never examined at all: lopping off the first K entries left entry K+1
 *     pointing at a row that no longer existed and the chain still verified.
 *     A SINGLE surviving mid-chain entry verified clean for the same reason.
 *   ✔ mid-chain deletion that renumbers nothing (sequence contiguity)
 *
 *   ✘ TAIL truncation. Nothing inside a chain can detect the removal of its own
 *     end — the remainder is perfectly self-consistent. That needs an external
 *     record of where the chain last ended, which is why the caller pairs this
 *     with the persisted per-scope tip; see `verifyAuditLogIntegrity`.
 *   ~ deletion by an attacker who also renumbers the survivors. Closed for v2
 *     entries, whose `sequenceNumber` is inside the hash (F-046); still open for
 *     v1 entries written before versioning, which cannot be retrofitted without
 *     re-hashing history — i.e. without rewriting the audit log to make it
 *     verify. `coverage.sequenceIntegrity` says which case a given chain is in.
 */
export function verifyHashChain(
  entries: Array<{
    entryHash: string;
    previousEntryHash: string | null;
    applicationId: string | null;
    userId: string | null;
    action: string;
    actionDetails: Record<string, any> | null;
    timestamp: Date;
    /** Optional: when present on EVERY entry, contiguity is enforced. */
    sequenceNumber?: number | null;
    /** Null/absent means the entry predates versioning and is v1 (F-046). */
    hashVersion?: number | null;
  }>
): HashChainResult {
  const sequenced = entries.every((e) => typeof e.sequenceNumber === "number");
  const versions = entries.map((e) => resolveHashVersion(e.hashVersion));
  const allSequenceHashed = versions.every((v) => v >= AUDIT_HASH_V2_SEQUENCED);
  const noneSequenceHashed = versions.every((v) => v < AUDIT_HASH_V2_SEQUENCED);
  const coverage: HashChainCoverage = {
    // An empty chain has no head to anchor; treated as anchored so a scope with
    // no entries is not reported as a defect.
    headAnchored: true,
    sequenceCoverage: sequenced ? "verified" : "unavailable",
    // An empty chain reports `hashed`: there is nothing unprotected in it, and
    // calling it `unhashed` would flag every untouched scope as a weakness.
    sequenceIntegrity: allSequenceHashed ? "hashed" : noneSequenceHashed ? "unhashed" : "mixed",
  };

  if (entries.length === 0) {
    return { valid: true, coverage };
  }

  // The chain must begin at genesis. This is the F-038 fix: without it, ANY
  // contiguous window of a valid chain verifies as a valid chain.
  if (entries[0].previousEntryHash !== null) {
    return {
      valid: false,
      brokenAt: 0,
      reason:
        `Chain head missing: entry 0 references predecessor ` +
        `${entries[0].previousEntryHash} which is not present. The start of ` +
        `this chain has been removed, or this is a partial window.`,
      coverage: { ...coverage, headAnchored: false },
    };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify under the entry's OWN declared version. A v2 row downgraded to v1
    // fails here, because the v1 payload omits the two fields v2 folded in and
    // therefore hashes to something else (F-046).
    const expectedHash = computeAuditEntryHash({
      applicationId: entry.applicationId,
      userId: entry.userId,
      action: entry.action,
      actionDetails: entry.actionDetails,
      timestamp: entry.timestamp,
      previousEntryHash: entry.previousEntryHash,
      sequenceNumber: entry.sequenceNumber,
      hashVersion: versions[i],
    });

    if (entry.entryHash !== expectedHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Entry ${i} hash mismatch: expected ${expectedHash}, got ${entry.entryHash}`,
        coverage,
      };
    }

    if (i > 0 && entry.previousEntryHash !== entries[i - 1].entryHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Chain broken at entry ${i}: previous hash doesn't match`,
        coverage,
      };
    }

    // Sequence numbers run 1..N. A gap is a deletion that left the hash links
    // intact — possible because the deleted rows' successors were re-pointed,
    // or simply because rows were lost rather than tampered with.
    if (sequenced) {
      const expectedSeq = i + 1;
      if (entry.sequenceNumber !== expectedSeq) {
        return {
          valid: false,
          brokenAt: i,
          reason:
            `Sequence gap at entry ${i}: expected sequenceNumber ${expectedSeq}, ` +
            `got ${entry.sequenceNumber}. Entries are missing from this chain.`,
          coverage,
        };
      }
    }
  }

  return { valid: true, coverage };
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
