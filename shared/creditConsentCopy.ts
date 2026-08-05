/**
 * Consent copy that is BOTH displayed to the borrower and persisted as the
 * evidence of what they were shown.
 *
 * Why this lives in `shared/` rather than in the page that renders it:
 * `credit_consents.disclosure_text`'s schema contract is "Full text of
 * disclosure shown". Honouring that means the string the server records and the
 * string the client renders must be the same object, not two copies that can
 * drift. Before finding F-034 they were not even copies — the server hardcoded
 * the full ~1,700-character FCRA authorization onto every consent regardless of
 * source, so a borrower who saw only the one-line soft-inquiry checkbox below
 * had a both-inquiry-types authorization recorded against them, complete with
 * IP, user agent and `signatureType: "electronic"` as e-signature evidence.
 *
 * Rule for anyone editing this file: if you change the text, bump the version.
 * The version is what lets an examiner tie a stored row back to the exact words
 * on screen at the time. Never let the rendered copy and the recorded copy
 * diverge — that is the defect this module exists to prevent.
 */

/**
 * The pre-approval funnel's soft-pull authorization. This is the ENTIRE
 * disclosure in that path — there is no modal, scroll-box or expandable behind
 * it, which is precisely why it must be recorded verbatim.
 *
 * Scope note: this authorizes a SOFT inquiry only. `consentCoversPullType` in
 * server/services/creditConsents.ts enforces that scope; do not widen this copy
 * to mention hard inquiries without also widening the coverage map, and do not
 * widen the coverage map without the ratified answer tracked in escalation U-12.
 */
export const FUNNEL_SOFT_PULL_CONSENT_TEXT =
  "I authorize Homiquity to obtain my credit report using a soft inquiry, which will not " +
  "affect my credit score. This authorization is required by the Fair Credit Reporting Act " +
  "(FCRA) and is not an application for credit.";

/** Bump whenever FUNNEL_SOFT_PULL_CONSENT_TEXT changes. */
export const FUNNEL_SOFT_PULL_CONSENT_VERSION = "FUNNEL-SOFT-2026-v1";
