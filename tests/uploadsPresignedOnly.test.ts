import { describe, it, expect, vi } from "vitest";
import {
  matchesKnownSignature,
  verifyFileSignature,
  upload,
} from "../server/routes/utils";

/**
 * Roadmap #1: uploads must never land on serverless disk. The multer layer is
 * memory-only (kept solely for the transient public lease extractor), and the
 * magic-byte check runs against the in-memory buffer. Persisted documents go
 * through the presigned flow, which these tests guard at the utils seam.
 */

function fakeRes() {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("upload multer instance", () => {
  it("uses memory storage — no disk destination exists", () => {
    // multer.memoryStorage() instances have no getDestination; diskStorage does.
    const storage = (upload as any).storage;
    expect(storage).toBeDefined();
    expect(storage.getDestination).toBeUndefined();
  });
});

describe("matchesKnownSignature", () => {
  it("accepts the allowed document formats by magic bytes", () => {
    expect(matchesKnownSignature(Buffer.from("%PDF-1.7 rest"))).toBe(true);
    expect(matchesKnownSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe(true); // JPEG
    expect(
      matchesKnownSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])),
    ).toBe(true); // PNG
    expect(
      matchesKnownSignature(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    ).toBe(true); // legacy .doc
    expect(matchesKnownSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBe(true); // .docx zip
  });

  it("rejects content that only claims to be an allowed type", () => {
    expect(matchesKnownSignature(Buffer.from("MZ\x90\x00 executable"))).toBe(false);
    expect(matchesKnownSignature(Buffer.from("<html><script>"))).toBe(false);
    expect(matchesKnownSignature(Buffer.alloc(0))).toBe(false);
  });
});

describe("verifyFileSignature middleware (buffer-based)", () => {
  it("passes through when no file is attached", () => {
    const res = fakeRes();
    const next = vi.fn();
    verifyFileSignature({ file: undefined } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it("accepts a real PDF buffer", () => {
    const res = fakeRes();
    const next = vi.fn();
    const req: any = { file: { buffer: Buffer.from("%PDF-1.4\n...") } };
    verifyFileSignature(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a spoofed file (declared PDF, real content executable)", () => {
    const res = fakeRes();
    const next = vi.fn();
    const req: any = {
      file: { buffer: Buffer.from("MZ not a pdf"), mimetype: "application/pdf" },
    };
    verifyFileSignature(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unsupported file content/i);
  });

  it("rejects a file that somehow has no buffer (disk-era shape)", () => {
    const res = fakeRes();
    const next = vi.fn();
    const req: any = { file: { path: "/tmp/uploads/123.pdf" } };
    verifyFileSignature(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });
});
