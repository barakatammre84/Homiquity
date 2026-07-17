import { type LoanAppStatus } from "./schema/lendingCore";

/**
 * Statuses in which a borrower may generate a pre-qualification letter — the
 * pre-decision shopping tool. One list for the server gate
 * (server/routes/lending/letters.ts generate-prequal) and the client surface
 * (client/src/pages/lending/LoanOptions.tsx), so the two cannot drift.
 *
 * Scope: the file is in flight and the borrower does not yet hold a
 * full pre-approval-track decision — plus "pre_approved"/"underwriting",
 * where regenerating a prequal remains allowed for offer-letter workflows
 * (the client hides its button once "pre_approved" because the stronger
 * pre-approval letter takes over). Post-conditional and closing-track
 * statuses are excluded: the pre-approval letter supersedes.
 */
export const PREQUAL_ELIGIBLE_STATUSES: readonly LoanAppStatus[] = [
  "submitted",
  "analyzing",
  "under_review",
  "pre_approved",
  "underwriting",
];
