/**
 * Document response shaping — the single subtraction behind every route that
 * serializes documents-table rows to a browser.
 *
 * Unlike the task view (shared/borrowerTaskView.ts, a strict whitelist), this
 * is deliberately subtractive: a document row is the borrower's own uploaded
 * resource, so new columns flow through by default and only named staff/server
 * internals are withheld. Two tiers:
 *
 *  - The encrypted raw-extraction payload (extractionRawEncrypted /
 *    extractionRawIv / extractionRawKeyId) is SERVER-SIDE ONLY — same doctrine
 *    as publicExtraction() in server/routes/documents.ts. The ciphertext is
 *    useless without the server key, but there is no reason to ship it to any
 *    browser, staff included.
 *  - reviewedByUserId is staff metadata: visible to staff, dropped for
 *    client-role callers. rejectionReason is NOT dropped — it is the
 *    borrower-facing "what to re-upload" copy.
 *
 * The `satisfies (keyof Document)[]` pins guarantee a renamed column breaks
 * the build here instead of silently un-masking.
 */

import type { Document } from "./schema";
import { isStaffRole } from "./roles";

/** Never leaves the server — for any caller. */
export const SERVER_ONLY_DOCUMENT_COLUMNS = [
  "extractionRawEncrypted",
  "extractionRawIv",
  "extractionRawKeyId",
] as const satisfies readonly (keyof Document)[];

/** Withheld from client-role payloads (the trio plus staff metadata). */
export const BORROWER_EMBARGOED_DOCUMENT_COLUMNS = [
  ...SERVER_ONLY_DOCUMENT_COLUMNS,
  "reviewedByUserId",
] as const satisfies readonly (keyof Document)[];

export type StaffDocumentView = Omit<
  Document,
  (typeof SERVER_ONLY_DOCUMENT_COLUMNS)[number]
>;

export type BorrowerDocumentView = Omit<
  Document,
  (typeof BORROWER_EMBARGOED_DOCUMENT_COLUMNS)[number]
>;

export function toStaffDocumentView(doc: Document): StaffDocumentView {
  const { extractionRawEncrypted, extractionRawIv, extractionRawKeyId, ...rest } = doc;
  return rest;
}

export function toBorrowerDocumentView(doc: Document): BorrowerDocumentView {
  const { reviewedByUserId, ...rest } = toStaffDocumentView(doc);
  return rest;
}

/**
 * Role-dispatched mask for mixed-audience routes: staff (incl. deal-team
 * broker/lender — the same isStaffRole predicate the task-document views use)
 * keep reviewedByUserId; nobody gets the ciphertext trio.
 */
export function toDocumentViewForRole(
  doc: Document,
  role: string,
): StaffDocumentView | BorrowerDocumentView {
  return isStaffRole(role) ? toStaffDocumentView(doc) : toBorrowerDocumentView(doc);
}

export function toDocumentViewsForRole(
  docs: Document[],
  role: string,
): (StaffDocumentView | BorrowerDocumentView)[] {
  return docs.map((doc) => toDocumentViewForRole(doc, role));
}
