/**
 * Roadmap CS2: automated trigger-phrase scan for borrower messages alleging
 * discrimination or credit-reporting errors.
 *
 * The trigger vocabulary comes from the escalation playbook
 * (knowledge-base/runbooks/support-playbooks/discrimination-credit-error-escalation.md),
 * which defines the procedure this scan automates: immediate founder
 * visibility, verbatim logging, and no substantive reply beyond the scripted
 * acknowledgment.
 *
 * Direction of error: OVER-flag. A false positive costs the founder a glance
 * at a normal message; a miss means a Reg B/ECOA discrimination claim or an
 * FCRA dispute sits unnoticed in a support inbox. So broad playbook terms
 * ("unfair", "dispute") are kept broad on purpose. The scan gates an internal
 * escalation only — it never blocks, edits, or answers the borrower's
 * message, so over-flagging has no borrower-visible cost.
 *
 * Pure and deterministic: no I/O, no clock, same text → same result.
 */

export type ComplaintCategory = "discrimination" | "credit_reporting_error";

export interface ComplaintScan {
  flagged: boolean;
  /** Deduplicated categories, stable order: discrimination first. */
  categories: ComplaintCategory[];
}

// ECOA §1002.2(z) / FHA protected-ground vocabulary, plus the playbook's
// plain-language trigger list.
const DISCRIMINATION_PATTERNS: RegExp[] = [
  /discriminat/i, // discriminate / discriminated / discrimination / discriminatory
  /\bunfair(?:ly)?\b/i, // playbook-listed, deliberately broad
  /\bbecause (?:i'?m|i am|of my) (?:race|color|religion|nationality|national origin|sex|gender|age|marital status|disabilit|familial status|ethnicity)/i,
  /\bprotected class\b/i,
  /\bredlin/i, // redline / redlining
];

// FCRA dispute vocabulary: "my credit report is wrong", "this score isn't
// mine", "I want to dispute this decision", identity theft.
const CREDIT_ERROR_PATTERNS: RegExp[] = [
  /\bcredit (?:report|file|history)\b[^.?!]*\b(?:wrong|incorrect|error|errors|mistake|inaccurate)/i,
  /\b(?:wrong|incorrect|error|errors|mistake|inaccurate)\b[^.?!]*\bcredit (?:report|file|history)\b/i,
  /\bscore\b[^.?!]*\b(?:isn'?t|is not|not)\s+(?:mine|right|correct)\b/i,
  /\bnot my (?:account|debt|loan|address|balance)\b/i,
  /\bdispute\b/i, // playbook-listed, deliberately broad
  /\bidentity theft\b/i,
  /\bfraud(?:ulent)?\b[^.?!]*\b(?:account|tradeline|inquiry)\b/i,
];

export function scanForEscalationTriggers(text: string): ComplaintScan {
  const categories: ComplaintCategory[] = [];
  if (DISCRIMINATION_PATTERNS.some((p) => p.test(text))) {
    categories.push("discrimination");
  }
  if (CREDIT_ERROR_PATTERNS.some((p) => p.test(text))) {
    categories.push("credit_reporting_error");
  }
  return { flagged: categories.length > 0, categories };
}
