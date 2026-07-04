import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import {
  encryptSensitiveData,
  decryptSensitiveData,
  initEncryption,
  getActiveKeyId,
  __resetEncryptionStateForTests,
} from "../server/services/encryptionService";

// Exercises the keyed-registry rotation logic (the KMS envelope path shares the
// same registry; its live unwrap needs a real keyring and is verified in a
// KMS-enabled environment, not here).

const KEY_V1 = crypto.randomBytes(32).toString("base64");
const KEY_V2 = crypto.randomBytes(32).toString("base64");

const ENV_KEYS = [
  "CREDIT_ENCRYPTION_KEY",
  "CREDIT_ENCRYPTION_KEY_V2",
  "ENCRYPTION_ACTIVE_KEY_ID",
  "PII_KMS_KEY_NAME",
  "PII_KMS_WRAPPED_DEKS",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  __resetEncryptionStateForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetEncryptionStateForTests();
});

describe("encryption key rotation", () => {
  it("tags new ciphertext with v1 when only the base key is configured", async () => {
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    await initEncryption();

    expect(getActiveKeyId()).toBe("v1");
    const enc = encryptSensitiveData("ssn-123456789");
    expect(enc.keyId).toBe("v1");
    expect(decryptSensitiveData(enc.encryptedContent, enc.iv, enc.keyId)).toBe("ssn-123456789");
  });

  it("rotates the active key to v2 while v1 rows still decrypt", async () => {
    // Phase 1: only v1 exists — encrypt a "legacy" row.
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    await initEncryption();
    const legacy = encryptSensitiveData("legacy-secret");
    expect(legacy.keyId).toBe("v1");

    // Phase 2: rotate — add v2 and make it active.
    __resetEncryptionStateForTests();
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    process.env.CREDIT_ENCRYPTION_KEY_V2 = KEY_V2;
    process.env.ENCRYPTION_ACTIVE_KEY_ID = "v2";
    await initEncryption();

    expect(getActiveKeyId()).toBe("v2");
    const fresh = encryptSensitiveData("new-secret");
    expect(fresh.keyId).toBe("v2");

    // Both decrypt: the old row under v1, the new one under v2.
    expect(decryptSensitiveData(legacy.encryptedContent, legacy.iv, legacy.keyId)).toBe("legacy-secret");
    expect(decryptSensitiveData(fresh.encryptedContent, fresh.iv, fresh.keyId)).toBe("new-secret");
  });

  it("defaults active to the highest app-level version when no override is set", async () => {
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    process.env.CREDIT_ENCRYPTION_KEY_V2 = KEY_V2;
    await initEncryption();
    expect(getActiveKeyId()).toBe("v2");
  });

  it("rejects decryption under an unknown key version", async () => {
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    await initEncryption();
    const enc = encryptSensitiveData("x");
    expect(() => decryptSensitiveData(enc.encryptedContent, enc.iv, "kms-99")).toThrow(/Unknown key version/);
  });

  it("fails closed when the pinned active key is not registered", async () => {
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    process.env.ENCRYPTION_ACTIVE_KEY_ID = "v2"; // not configured
    await expect(initEncryption()).rejects.toThrow(/not registered/);
  });

  it("requires wrapped DEKs when a KMS key name is configured", async () => {
    process.env.CREDIT_ENCRYPTION_KEY = KEY_V1;
    process.env.PII_KMS_KEY_NAME = "projects/p/locations/l/keyRings/r/cryptoKeys/k";
    // PII_KMS_WRAPPED_DEKS intentionally absent
    await expect(initEncryption()).rejects.toThrow(/PII_KMS_WRAPPED_DEKS/);
  });
});
