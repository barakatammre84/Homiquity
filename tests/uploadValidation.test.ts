import { describe, expect, it } from "vitest";

import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  validateUploadFile,
} from "../shared/uploads";

const MB = 1024 * 1024;

describe("validateUploadFile (shared client pre-flight)", () => {
  it("accepts every server-allowed MIME type under the cap", () => {
    for (const type of ACCEPTED_UPLOAD_MIME_TYPES) {
      expect(validateUploadFile({ name: "statement.bin", size: MB, type })).toEqual({ ok: true });
    }
  });

  it("rejects a disallowed MIME type with the type message", () => {
    const result = validateUploadFile({ name: "notes.txt", size: 1000, type: "text/plain" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("type");
  });

  it("falls back to the extension when the drag source gives no MIME type", () => {
    expect(validateUploadFile({ name: "W2_2025.PDF", size: MB, type: "" })).toEqual({ ok: true });
    const bad = validateUploadFile({ name: "statement.tiff", size: MB, type: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("type");
  });

  it("a valid extension never overrides a disallowed declared MIME type", () => {
    const result = validateUploadFile({ name: "fake.pdf", size: MB, type: "application/x-msdownload" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("type");
  });

  it("enforces the shared size cap exactly", () => {
    expect(
      validateUploadFile({ name: "big.pdf", size: MAX_UPLOAD_BYTES, type: "application/pdf" }).ok,
    ).toBe(true);
    const over = validateUploadFile({
      name: "big.pdf",
      size: MAX_UPLOAD_BYTES + 1,
      type: "application/pdf",
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe("size");
  });

  it("extension list and MIME list stay in sync (every extension maps to an allowed MIME)", () => {
    const extToMime: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    for (const ext of ACCEPTED_UPLOAD_EXTENSIONS.split(",")) {
      expect(extToMime[ext], `extension ${ext} has no allowed MIME`).toBeTruthy();
      expect(ACCEPTED_UPLOAD_MIME_TYPES).toContain(extToMime[ext]);
    }
  });
});
