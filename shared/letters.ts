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

/**
 * The status a letter should read as RIGHT NOW, expiry included.
 *
 * The stored status flips to "expired" only when the daily sweep runs
 * (server/services/letterExpiry.ts), which leaves a window where the row
 * still says "issued" on a letter past its expiration date. Read paths
 * (letter-status / prequal-status) go through this helper so the API never
 * asserts "issued" on an expired letter, whatever the sweep's timing.
 *
 * Terminal statuses (revoked, superseded) are already persisted at write
 * time and win over expiry — a revoked letter stays revoked. Expiry is
 * strict: the letter remains issued through its stored expiration instant.
 */
export function effectiveLetterStatus<S extends string>(
  letter: { status: S; expirationDate: Date | string },
  now: Date = new Date(),
): S | "expired" {
  if (letter.status === "issued" && new Date(letter.expirationDate).getTime() < now.getTime()) {
    return "expired";
  }
  return letter.status;
}
