/**
 * Single source of truth for the document upload size cap, shared by the client
 * pre-flight check and the server enforcement points (multer + the presigned-URL
 * guard). Keeping one constant prevents the client and server limits from
 * drifting apart — the previous client cap (25MB) was more than double the
 * server's (10MB), so a 15MB file passed the client check and then failed at the
 * server with a generic "please try again" that could never succeed.
 *
 * If real mortgage documents (multi-page scanned PDFs) routinely exceed this,
 * raising it is a product/infra decision: bump this one constant, then confirm
 * the object-storage and serverless request limits allow the larger size.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "10MB";

// Cloud Storage's XML API treats generation-match zero as create-only. The
// header is signed into every production upload URL and returned to the client,
// so a successful PUT cannot be replayed to overwrite bytes after registration.
export const UPLOAD_CREATE_ONLY_HEADER = "x-goog-if-generation-match";
export const UPLOAD_CREATE_ONLY_VALUE = "0";

/**
 * The accepted document MIME types — one list shared by the server allow-list
 * (server/routes/utils.ts re-exports it), the presigned-URL guard, and every
 * client pre-flight/dropzone, so what the client accepts can never drift from
 * what the server enforces (the same drift the size cap above had).
 */
export const ACCEPTED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** For <input accept> and drag-source extension fallback. Keep in sync with the MIME list. */
export const ACCEPTED_UPLOAD_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

/** Human copy for upload affordances ("PDF, JPG, PNG, or Word up to 10MB"). */
export const ACCEPTED_UPLOAD_LABEL = "PDF, JPG, PNG, or Word";

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; reason: "type" | "size"; message: string };

/**
 * Client pre-flight for a picked/dropped file. Some OS drag sources deliver an
 * empty `type`, so extension is the fallback signal — the server re-verifies
 * real content (magic bytes / storage metadata) regardless.
 */
export function validateUploadFile(file: {
  name: string;
  size: number;
  type: string;
}): UploadValidationResult {
  const extension = file.name.includes(".")
    ? `.${file.name.split(".").pop()!.toLowerCase()}`
    : "";
  const typeOk = file.type
    ? ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type)
    : ACCEPTED_UPLOAD_EXTENSIONS.split(",").includes(extension);
  if (!typeOk) {
    return {
      ok: false,
      reason: "type",
      message: `That file type isn't supported — please upload ${ACCEPTED_UPLOAD_LABEL}.`,
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: `That file is over the ${MAX_UPLOAD_LABEL} limit — try compressing it or splitting it into parts.`,
    };
  }
  return { ok: true };
}
