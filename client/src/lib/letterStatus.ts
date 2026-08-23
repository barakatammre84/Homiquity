import { PRE_APPROVAL_LETTER_STATUS, type PreApprovalLetterStatus } from "@shared/statusVocabularies";

/**
 * One selector for what a borrower surface may say about their letter.
 *
 * `GET /api/loan-applications/:id/letter-status` and `.../prequal-status` both
 * answer with a `status` that is computed at read time
 * (`shared/letters.ts effectiveLetterStatus`), so the API never reports
 * "issued" on a letter past its expiration date whatever the nightly sweep's
 * timing. Every borrower-facing surface used to read `hasLetter` alone and
 * throw the rest away, so an expired or revoked letter still rendered as
 * "ready to download" — while the staff card two clicks away rendered
 * "Expired" or "Revoked" from the same field. Two surfaces, one fact, opposite
 * answers: DESIGN_SYSTEM.md §13 Agreement.
 *
 * This is the `lib/outstandingWork.ts` shape: one pure selector, consumed by
 * every surface that renders the fact, so they cannot diverge again. Derive
 * from it rather than re-reading `hasLetter` inline.
 */

/** The overlap of the two status payloads — the fields every surface may rely on. */
export interface LetterStatusResponse {
  hasLetter?: boolean;
  letterNumber?: string;
  /** A `PRE_APPROVAL_LETTER_STATUS` member; typed wide because it arrives over the wire. */
  status?: string;
  expirationDate?: string | Date | null;
  pdfAvailable?: boolean;
}

export type BorrowerLetterState =
  /** No letter has been issued for this file yet — offering to make one is honest. */
  | { kind: "none" }
  /** Issued and inside its expiration date. */
  | { kind: "current"; letterNumber?: string; expiresOn: Date | null }
  /** Issued, but past its expiration date. A fresh one can be issued. */
  | { kind: "expired"; letterNumber?: string; expiredOn: Date | null }
  /**
   * There is a letter row, but it is not something the borrower may hand to
   * anyone and not something they may re-mint themselves — `revoked` is a
   * staff credit decision, `superseded`/`draft` are lifecycle states no
   * borrower action resolves.
   */
  | { kind: "withdrawn"; letterNumber?: string; reason: "revoked" | "superseded" | "draft" | "unrecognized" }
  /** The status query failed. Never claim a letter is ready on an unanswered question. */
  | { kind: "unknown" };

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isKnownStatus(value: string | undefined): value is PreApprovalLetterStatus {
  return !!value && (PRE_APPROVAL_LETTER_STATUS as readonly string[]).includes(value);
}

export function selectBorrowerLetterState(
  data: LetterStatusResponse | undefined,
  isError = false,
): BorrowerLetterState {
  if (isError) return { kind: "unknown" };
  if (!data?.hasLetter) return { kind: "none" };

  const letterNumber = data.letterNumber;
  const expiration = toDate(data.expirationDate);

  // A payload with no `status` predates the lifecycle fields; fall back to the
  // expiration date so the surface still cannot claim an expired letter is
  // ready, and to "current" when there is nothing at all to judge on.
  const status = isKnownStatus(data.status)
    ? data.status
    : data.status === undefined
      ? expiration && expiration.getTime() < Date.now()
        ? "expired"
        : "issued"
      : "unrecognized";

  switch (status) {
    case "issued":
      return { kind: "current", letterNumber, expiresOn: expiration };
    case "expired":
      return { kind: "expired", letterNumber, expiredOn: expiration };
    case "revoked":
    case "superseded":
    case "draft":
      return { kind: "withdrawn", letterNumber, reason: status };
    default:
      return { kind: "withdrawn", letterNumber, reason: "unrecognized" };
  }
}

/** True when the borrower may be offered a download of this letter. */
export function canDownloadLetter(state: BorrowerLetterState): boolean {
  return state.kind === "current";
}

/**
 * True when the borrower may be offered a fresh letter. Deliberately false for
 * `withdrawn`: a borrower re-minting a letter their loan team revoked would
 * defeat the revocation, and `superseded`/`draft` are not theirs to resolve.
 */
export function canRequestLetter(state: BorrowerLetterState): boolean {
  return state.kind === "none" || state.kind === "expired";
}

/**
 * The one sentence a surface shows about a letter that is not currently
 * usable. The staff revocation reason is deliberately absent — the server
 * keeps that free text server-side, and so does this.
 */
export function describeUnusableLetter(state: BorrowerLetterState, formatDate: (d: Date) => string): string | null {
  switch (state.kind) {
    case "expired":
      return state.expiredOn
        ? `This letter expired on ${formatDate(state.expiredOn)}. You can get an updated one.`
        : "This letter has expired. You can get an updated one.";
    case "withdrawn":
      return state.reason === "revoked"
        ? "Your loan team withdrew this letter, so it is no longer valid. Message them for an updated one."
        : "This letter is no longer the current one for your file. Your loan team can issue an updated one.";
    case "unknown":
      return "We could not check your letter status just now.";
    default:
      return null;
  }
}
