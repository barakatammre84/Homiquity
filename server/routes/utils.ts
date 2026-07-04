import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { MAX_UPLOAD_BYTES } from "@shared/uploads";

export const allowedUploadTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Memory-only multer, kept for exactly one consumer: the public lease
// extractor (/api/calculators/extract-lease), which processes the file within
// the request and persists nothing. Every PERSISTED document goes through the
// presigned-URL flow (/api/uploads/request-url → direct PUT to object storage
// → JSON registration on /api/documents/upload) — there is deliberately no
// disk storage here, because serverless disk (Vercel) is ephemeral and files
// written to it vanish on redeploy.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
  fileFilter: (req, file, cb) => {
    // First line of defense: client-supplied MIME type. This is spoofable, so
    // verifyFileSignature (below) must run after multer to confirm the file's
    // actual magic bytes match an allowed type.
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

export function matchesKnownSignature(buf: Buffer): boolean {
  return FILE_SIGNATURES.some(({ bytes }) =>
    bytes.every((b, i) => buf[i] === b),
  );
}

/**
 * Express middleware that runs after multer has buffered the upload in memory.
 * It checks the buffer's magic bytes and rejects anything whose real content
 * doesn't match an allowed type, regardless of the declared Content-Type.
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
  if (!file.buffer || !matchesKnownSignature(file.buffer)) {
    return res.status(400).json({ error: "Invalid or unsupported file content" });
  }
  next();
}
