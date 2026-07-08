import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "crypto";
import {
  isValidObjectId,
  createLocalUpload,
  writeLocalObject,
  localObjectExists,
  isLocalFallbackEnabled,
  isObjectStorageConfigured,
} from "../server/integrations/object_storage/localObjectStorage";

// Dev-only local upload fallback (re-implementation of the useful part of #67 on
// current main — the rest, presigned migration / 5xx masking / scrypt guard, was
// already landed). Prod still requires GCS and fails loud.
describe("localObjectStorage (dev-only upload fallback)", () => {
  const orig = { ...process.env };
  afterEach(() => {
    process.env = { ...orig };
  });

  it("isValidObjectId accepts a server UUID, rejects traversal/garbage", () => {
    expect(isValidObjectId(randomUUID())).toBe(true);
    expect(isValidObjectId("../../etc/passwd")).toBe(false);
    expect(isValidObjectId("not-a-uuid")).toBe(false);
  });

  it("createLocalUpload mints matching upload + object paths", () => {
    const { uploadURL, objectPath } = createLocalUpload();
    const id = objectPath.replace("/objects/", "");
    expect(isValidObjectId(id)).toBe(true);
    expect(uploadURL).toBe(`/api/uploads/local/${id}`);
  });

  it("write → exists round-trips; rejects an invalid (traversal) id", () => {
    const { objectPath } = createLocalUpload();
    const id = objectPath.replace("/objects/", "");
    writeLocalObject(id, Buffer.from("hello"));
    expect(localObjectExists(objectPath)).toBe(true);
    expect(() => writeLocalObject("../evil", Buffer.from("x"))).toThrow();
  });

  it("fallback is dev-only: off in production and when GCS is configured", () => {
    delete process.env.PRIVATE_OBJECT_DIR;
    process.env.NODE_ENV = "development";
    expect(isLocalFallbackEnabled()).toBe(true);

    process.env.NODE_ENV = "production";
    expect(isLocalFallbackEnabled()).toBe(false);

    process.env.NODE_ENV = "development";
    process.env.PRIVATE_OBJECT_DIR = "/some/bucket";
    expect(isObjectStorageConfigured()).toBe(true);
    expect(isLocalFallbackEnabled()).toBe(false);
  });
});
