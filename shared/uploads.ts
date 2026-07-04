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
