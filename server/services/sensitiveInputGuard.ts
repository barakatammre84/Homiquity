/**
 * Input-side sensitive-data guard for borrower chat (coach safety pass,
 * 2026-07-17 external-artifacts adjudication gap B).
 *
 * The coach's compliance rails are output-side (loCommsLint hard-block +
 * streaming guard); nothing policed what the BORROWER pastes. Without this,
 * a pasted SSN enters model context, the persisted conversation history, and
 * the ai_interactions prompt log verbatim. The guard runs BEFORE
 * prepareCoachTurn persists anything: on a hit the routes redact the stored
 * user message and answer with a canned secure-channel reply instead of
 * calling the model.
 *
 * Pure and dependency-free so the detection matrix is unit-testable
 * (tests/sensitiveInputGuard.test.ts).
 */

export type SensitiveInputKind = "ssn" | "dob";

/** What prepareCoachTurn persists in place of the borrower's raw text. */
export const SENSITIVE_INPUT_REDACTED_PLACEHOLDER =
  "[message withheld — it appeared to contain a sensitive personal number and was not processed]";

/**
 * Canned coach replies (CS tone, coach-2.2.0 register). Deterministic, never
 * model-generated — this is a security response, not a conversation.
 */
export const SENSITIVE_INPUT_MESSAGES: Record<SensitiveInputKind, string> = {
  ssn:
    "I stopped that message before it was processed — please don't share your Social " +
    "Security number in chat. Chat isn't the secure channel for it: when your SSN is " +
    "needed, the application collects it through an encrypted form, and identity " +
    "documents go through the secure upload on your dashboard. The message wasn't read " +
    "or saved with the number in it — send it again without the SSN and we'll pick up " +
    "right where we left off.",
  dob:
    "I stopped that message before it was processed — please don't share your date of " +
    "birth in chat. Chat isn't the secure channel for it: when it's needed, the " +
    "application collects it through an encrypted form. The message wasn't read or " +
    "saved with the date in it — send it again without your date of birth and we'll " +
    "pick up right where we left off.",
};

// Words that mark a bare 9-digit run as something other than an SSN (account,
// routing/ABA, phone extension blocks, reference ids, amounts, …). Checked in
// the ~24 characters before the digits.
const NON_SSN_CONTEXT =
  /(account|acct|routing|aba|phone|fax|zip|nmls|licen[cs]e|case|loan|member|id|ref(erence)?|confirmation|amount|invoice|order)\s*(number|no\.?|#)?\s*(is|was|[:=#])?\s*$/i;

const SSN_DASHED = /\b\d{3}-\d{2}-\d{4}\b/;
const SSN_SPACED = /\b\d{3}[ ]\d{2}[ ]\d{4}\b/;
const NINE_DIGITS = /(?<!\d)\d{9}(?!\d)/g;

const DOB_CONTEXTUAL =
  /(date\s*of\s*birth|d\.?\s*o\.?\s*b\.?|born\s*(on|in)?|birth\s*date|my\s*birthday)\s*(is|was|[:=])?\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/i;

/**
 * Returns the kind of sensitive personal number the text appears to contain,
 * or null when it looks safe. Deliberately conservative: dashed/spaced SSN
 * shapes always trip it; bare 9-digit runs trip it only without a
 * non-SSN context word; dates trip it only alongside a birth-date keyword.
 */
export function detectSensitiveInput(text: string): { kind: SensitiveInputKind } | null {
  if (!text) return null;

  if (SSN_DASHED.test(text) || SSN_SPACED.test(text)) {
    return { kind: "ssn" };
  }

  for (const match of text.matchAll(NINE_DIGITS)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 24), match.index ?? 0);
    if (!NON_SSN_CONTEXT.test(before)) {
      return { kind: "ssn" };
    }
  }

  if (DOB_CONTEXTUAL.test(text)) {
    return { kind: "dob" };
  }

  return null;
}
