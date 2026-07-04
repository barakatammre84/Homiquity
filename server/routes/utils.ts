import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import type { Request, Response, NextFunction } from "express";
import { MAX_UPLOAD_BYTES } from "@shared/uploads";

// Multer staging dir. Serverless filesystems (Vercel: /var/task) are read-only
// except the OS temp dir, so an eager mkdir at import time crashes the whole
// app at boot there. Create lazily on first upload instead, preferring ./uploads
// on persistent hosts and falling back to the temp dir when cwd isn't writable.
let resolvedUploadDir: string | null = null;
function ensureUploadDir(): string {
  if (resolvedUploadDir) return resolvedUploadDir;
  const candidates = process.env.VERCEL
    ? [path.join(os.tmpdir(), "uploads")]
    : [path.join(process.cwd(), "uploads"), path.join(os.tmpdir(), "uploads")];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      resolvedUploadDir = dir;
      return dir;
    } catch {
      // read-only location — try the next candidate
    }
  }
  throw new Error("No writable upload directory available");
}

export const allowedUploadTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        cb(null, ensureUploadDir());
      } catch (err) {
        cb(err as Error, "");
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
  fileFilter: (req, file, cb) => {
    // First line of defense: client-supplied MIME type. This is spoofable, so
    // verifyFileSignature (below) must run after the upload completes to confirm
    // the file's actual magic bytes match an allowed type.
    if (allowedUploadTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Magic-byte signatures for the file types we accept. Validating these defeats
// MIME-type spoofing (e.g. an executable renamed to .pdf with a faked Content-Type).
const FILE_SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "application/msword", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // legacy OLE .doc
  { mime: "docx", bytes: [0x50, 0x4b, 0x03, 0x04] }, // .docx / OOXML are ZIP containers
  { mime: "docx", bytes: [0x50, 0x4b, 0x05, 0x06] },
  { mime: "docx", bytes: [0x50, 0x4b, 0x07, 0x08] },
];

function matchesKnownSignature(buf: Buffer): boolean {
  return FILE_SIGNATURES.some(({ bytes }) =>
    bytes.every((b, i) => buf[i] === b),
  );
}

/**
 * Express middleware that runs after multer has written the upload to disk. It
 * reads the file header and rejects anything whose real magic bytes don't match
 * an allowed type, deleting the spoofed file before it can be processed.
 */
export function verifyFileSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const file = req.file;
  if (!file) {
    return next();
  }
  try {
    const fd = fs.openSync(file.path, "r");
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);

    if (!matchesKnownSignature(header)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: "Invalid or unsupported file content" });
    }
    next();
  } catch (err) {
    if (file.path) fs.unlink(file.path, () => {});
    return res.status(400).json({ error: "Could not validate uploaded file" });
  }
}
