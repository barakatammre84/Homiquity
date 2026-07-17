/**
 * Document review-status vocabulary — the single source of truth for
 * `documents.status` values (shared/schema/lendingCore.ts).
 *
 * Lifecycle (MR-2 invariant): registration writes "uploaded"; AI extraction
 * may at most stage a document as "verifying" for a human; ONLY the human
 * review endpoint (POST /api/documents/:id/verify) writes "verified" or
 * "rejected". Nothing automated may ever verify or reject a document.
 *
 * Zero runtime dependencies (like shared/roles.ts) so the client can import
 * it without dragging the ORM into the browser bundle. Display labels live in
 * client/src/lib/formatters.ts (getDocumentStatusLabel) — not here.
 */

export const DOCUMENT_STATUSES = ["uploaded", "verifying", "verified", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS = {
  /** Registered via POST /api/documents/upload; extraction may still stage it. */
  UPLOADED: "uploaded",
  /** AI extraction cleared its confidence threshold — staged for HUMAN review. */
  VERIFYING: "verifying",
  /** Human reviewer accepted the document. Never set automatically. */
  VERIFIED: "verified",
  /** Human reviewer rejected the document; rejection_reason is required. */
  REJECTED: "rejected",
} as const;

export function isDocumentStatus(value: string): value is DocumentStatus {
  return (DOCUMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Derived per-item status for the borrower document checklist: the document
 * statuses plus "needed" (nothing uploaded yet for the requirement).
 */
export const CHECKLIST_ITEM_STATUSES = [
  "needed",
  "uploaded",
  "verifying",
  "verified",
  "rejected",
] as const;
export type ChecklistItemStatus = (typeof CHECKLIST_ITEM_STATUSES)[number];

/**
 * Roles allowed to verify/reject a borrower document. Mirrors the server gate
 * on POST /api/documents/:id/verify (server/routes/documents.ts) — the client
 * uses it only to decide whether to RENDER review controls; authorization is
 * always enforced server-side. Deliberately narrower than INTERNAL_STAFF_ROLES
 * (no closer) and never includes external partners (broker/lender).
 */
export const DOCUMENT_REVIEW_ROLES = ["admin", "lo", "loa", "processor", "underwriter"] as const;

export function canReviewDocuments(role: string | null | undefined): boolean {
  return !!role && (DOCUMENT_REVIEW_ROLES as readonly string[]).includes(role);
}
