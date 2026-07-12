// ---------------------------------------------------------------------------
// LO communications compliance lint — deterministic lexicon (LO Advisor
// Program prompt LO-5).
//
// A DETERMINISTIC lexicon, NOT an NLP classifier (L2 I1): the same text always
// yields the same findings, so the behavior is testable and auditable. A model
// may someday *suggest* phrasing, but the lexicon decides what is flagged.
//
// Two tiers, each cited to verified eCFR text (regulatory-ledger.json, I2):
//
//   Tier 1 — Reg Z §1026.24(d) trigger terms. When outbound advertising states
//     a specific credit term — a downpayment amount/%, a payment dollar amount,
//     or a rate/finance-charge figure — §1026.24(d)(2) requires additional
//     disclosures, INCLUDING the "annual percentage rate" using that term and
//     (if it may increase) that fact. A free-text message cannot supply the
//     borrower-specific APR that (d)(2)(iii) demands, so these are BLOCKED and
//     routed to the disclosed channels (the Loan Estimate / LO-3 Advisor
//     Report), which state the APR compliantly. Blocking is stricter than the
//     rule and therefore compliant.
//
//   Tier 2 — Reg N (12 CFR Part 1014, MAP Rule) §1014.3 prohibited
//     misrepresentations: "guaranteed"/"assured" approval, superlative rate
//     claims ("lowest/best rate"), "no fees", and false government affiliation.
//     WARN, don't block: surface a compliant rewrite; a send-anyway is an
//     override that the server logs.
//
// Scoping note (ledger-documented): a bare product reference like "30-year
// fixed" is NOT treated as a standalone trigger — the (d)(1)(ii)
// period-of-repayment trigger fires only on an explicit payment COUNT
// ("360 payments"), so LOs can name products without tripping the block, while
// any specific rate/payment/downpayment figure is caught.
// ---------------------------------------------------------------------------

export type LintTier = 1 | 2;

export interface LexiconRule {
  /** Stable id for tests/audit. */
  id: string;
  tier: LintTier;
  /** Short category slug. */
  category: string;
  /** eCFR citation for this rule. */
  citation: string;
  pattern: RegExp;
  /** What the LO should do instead. */
  guidance: string;
  /** Tier-2 only: a compliant rewrite the composer can offer. */
  suggestedRewrite?: string;
}

export interface LintMatch {
  ruleId: string;
  tier: LintTier;
  category: string;
  citation: string;
  matchedText: string;
  guidance: string;
  suggestedRewrite?: string;
}

export interface LintResult {
  /** Tier-1 trigger terms — presence blocks a free-text send. */
  triggerMatches: LintMatch[];
  /** Tier-2 promise phrases — presence warns (overridable, logged). */
  promiseMatches: LintMatch[];
  hasTriggerTerms: boolean;
  hasPromisePhrases: boolean;
  /** True when nothing forces a block (no Tier-1). Tier-2 does not clear this
   *  flag — it warns — but callers use requiresOverride to gate the send. */
  blocked: boolean;
  /** True when a Tier-2 warning is present and must be acknowledged to send. */
  requiresOverride: boolean;
}

// ---------------------------------------------------------------------------
// Tier 1 — Reg Z §1026.24(d)(1) triggering terms.
// ---------------------------------------------------------------------------
export const REG_Z_TRIGGER_LEXICON: LexiconRule[] = [
  {
    id: "regz-downpayment-percent",
    tier: 1,
    category: "downpayment",
    citation: "12 CFR §1026.24(d)(1)(i)",
    // "5% down", "with 3.5 % down payment", "20% downpayment"
    pattern: /\b\d{1,2}(\.\d+)?\s?%\s*(down\b|down\s?payment)/i,
    guidance:
      "A downpayment percentage triggers Reg Z §1026.24(d)(2) disclosures. Send figures via the Loan Estimate or the Advisor Report, not a free-text message.",
  },
  {
    id: "regz-downpayment-amount",
    tier: 1,
    category: "downpayment",
    citation: "12 CFR §1026.24(d)(1)(i)",
    // "$20,000 down", "down payment of $15,000"
    pattern: /(\$[\d,]+(\.\d+)?\s*(down\b|down\s?payment)|down\s?payment\s+of\s+\$?[\d,]+)/i,
    guidance:
      "A downpayment amount triggers Reg Z §1026.24(d)(2) disclosures. Send figures via the Loan Estimate or the Advisor Report, not a free-text message.",
  },
  {
    id: "regz-payment-amount",
    tier: 1,
    category: "payment_amount",
    citation: "12 CFR §1026.24(d)(1)(iii)",
    // "$1,500/mo", "$2,000 per month", "monthly payment of $1,800", "$1,750 a month"
    pattern:
      /(\$[\d,]+(\.\d+)?\s*(\/\s*mo\b|\/\s*month|per\s+month|a\s+month|monthly|\bmo\b|\bmonth\b)|monthly\s+payment\s+(of|is|:|would\s+be)\s*\$?[\d,]+)/i,
    guidance:
      "A payment amount triggers Reg Z §1026.24(d)(2) disclosures. Send the payment via the Loan Estimate or the Advisor Report, not a free-text message.",
  },
  {
    id: "regz-rate-or-finance-charge",
    tier: 1,
    category: "rate_or_finance_charge",
    citation: "12 CFR §1026.24(d)(1)(iv)",
    // A rate figure advertised as interest/APR/rate: "6.5%", "at 6.25% rate",
    // "rate of 5.99%", "APR of 6.8%", "interest rate is 7%". Also points.
    pattern:
      /(\b\d{1,2}(\.\d{1,3})?\s?%\s*(interest|rate|apr|a\.p\.r\.)|\b(interest\s+rate|rate|apr|a\.p\.r\.)\s*(of|is|:|at|=)?\s*\d{1,2}(\.\d{1,3})?\s?%|\b\d(\.\d+)?\s+points?\b)/i,
    guidance:
      "A rate or finance-charge figure triggers Reg Z §1026.24(d)(2), which requires the APR to be stated. Send the rate via the Loan Estimate or the Advisor Report, which state the APR compliantly — not a free-text message.",
  },
  {
    id: "regz-payment-count",
    tier: 1,
    category: "repayment_period",
    citation: "12 CFR §1026.24(d)(1)(ii)",
    // An explicit payment COUNT is a credit term ("360 payments", "180 monthly
    // payments"). A bare product period ("30-year fixed") is deliberately NOT
    // matched — see the scoping note above.
    pattern: /\b\d{2,3}\s+(monthly\s+)?payments\b/i,
    guidance:
      "A number-of-payments term triggers Reg Z §1026.24(d)(2) disclosures. Send repayment terms via the Loan Estimate or the Advisor Report, not a free-text message.",
  },
];

// ---------------------------------------------------------------------------
// Tier 2 — Reg N (12 CFR Part 1014, MAP Rule) §1014.3 prohibited
// misrepresentations. Warn + suggest a compliant rewrite.
// ---------------------------------------------------------------------------
export const REG_N_PROMISE_LEXICON: LexiconRule[] = [
  {
    id: "regn-guaranteed-approval",
    tier: 2,
    category: "approval_guarantee",
    citation: "12 CFR §1014.3(i)",
    // "guaranteed approval", "approval is guaranteed", "you're guaranteed to be approved",
    // "assured approval", "approval assured", "guaranteed to qualify"
    pattern:
      /\b(guarantee[ds]?|assured?)\b[^.!?]{0,40}\b(approv\w+|qualif\w+|financ\w+|loan)\b|\b(approv\w+|qualif\w+)\b[^.!?]{0,20}\b(guarantee[ds]?|assured?|certain)\b/i,
    guidance:
      "Reg N §1014.3(i) prohibits misrepresenting the likelihood of approval. Approval is never guaranteed before underwriting.",
    suggestedRewrite:
      "Based on what you've shared, your file looks strong — final approval depends on verification and underwriting.",
  },
  {
    id: "regn-superlative-rate",
    tier: 2,
    category: "superlative_rate",
    citation: "12 CFR §1014.3(b)",
    // "lowest rate", "best rate", "cheapest rate", "unbeatable rate", "lowest APR"
    pattern: /\b(lowest|best|cheapest|unbeatable|guaranteed)\s+(rate|rates|apr|price|pricing|deal)\b/i,
    guidance:
      "Reg N §1014.3(b) prohibits misrepresenting the interest rate. Avoid superlative or absolute rate claims you can't substantiate.",
    suggestedRewrite: "a competitive rate for your profile",
  },
  {
    id: "regn-no-fees",
    tier: 2,
    category: "no_fees",
    citation: "12 CFR §1014.3(f)",
    // "no fees", "no closing costs", "fee-free", "zero cost", "no cost to you"
    pattern: /\b(no|zero)\s+(fees?|closing\s+costs?|costs?)\b|\bfee-?free\b/i,
    guidance:
      "Reg N §1014.3(f) prohibits misrepresenting fees or costs. State the actual costs or point to the Loan Estimate.",
    suggestedRewrite: "I'll send you the Loan Estimate with the exact fees and costs.",
  },
  {
    id: "regn-government-affiliation",
    tier: 2,
    category: "government_affiliation",
    citation: "12 CFR §1014.3(m), (n)",
    // Falsely implying government affiliation or a government-guaranteed loan.
    // "government guaranteed", "endorsed by the government", "we're a government",
    // "backed by the government" (implying the lender is/represents govt).
    pattern:
      /\bgovernment[-\s]?(guaranteed|endorsed|backed|approved)\b|\b(endorsed|sponsored|approved)\s+by\s+the\s+government\b|\bwe('re| are)\s+(a\s+)?government\b/i,
    guidance:
      "Reg N §1014.3(m)-(n) prohibits misrepresenting government affiliation or endorsement. Don't imply Homiquity is or speaks for a government entity.",
    suggestedRewrite:
      "FHA and VA are government loan programs; Homiquity is a private mortgage broker, not a government agency.",
  },
];

const ALL_RULES: LexiconRule[] = [...REG_Z_TRIGGER_LEXICON, ...REG_N_PROMISE_LEXICON];

/**
 * Canonical Reg Z §1026.24(d)(2) disclosure block. This is the reference text
 * the disclosed channels (the Loan Estimate / LO-3 Advisor Report) carry; it is
 * NOT appended to free-text messages, because (d)(2)(iii) requires the
 * borrower-specific APR, which those channels compute and a generic block
 * cannot. Ledger-cited (regz-1026-24d-trigger-terms).
 */
export const REG_Z_ADVERTISING_DISCLOSURE_BLOCK = `IMPORTANT DISCLOSURE (Regulation Z, 12 C.F.R. §1026.24(d))

When we quote specific loan terms, federal law requires we also state:
  • the amount or percentage of the downpayment,
  • the terms of repayment over the full loan term (including any balloon payment), and
  • the "Annual Percentage Rate" (APR) — and, if the rate may increase after closing, that fact.

Your Loan Estimate states these terms for your specific loan. Ask your loan officer to send it, or view your Advisor Report, rather than relying on figures quoted in a message.`;

/**
 * Lint an outbound LO communication. Pure and deterministic.
 * Rules are evaluated in a fixed order so findings are stable.
 */
export function lintOutboundText(text: string): LintResult {
  const triggerMatches: LintMatch[] = [];
  const promiseMatches: LintMatch[] = [];

  for (const rule of ALL_RULES) {
    // Non-global regex: one representative match per rule keeps output stable.
    const m = rule.pattern.exec(text);
    if (!m) continue;
    const match: LintMatch = {
      ruleId: rule.id,
      tier: rule.tier,
      category: rule.category,
      citation: rule.citation,
      matchedText: m[0].trim(),
      guidance: rule.guidance,
      suggestedRewrite: rule.suggestedRewrite,
    };
    if (rule.tier === 1) triggerMatches.push(match);
    else promiseMatches.push(match);
  }

  const hasTriggerTerms = triggerMatches.length > 0;
  const hasPromisePhrases = promiseMatches.length > 0;

  return {
    triggerMatches,
    promiseMatches,
    hasTriggerTerms,
    hasPromisePhrases,
    blocked: hasTriggerTerms,
    requiresOverride: hasPromisePhrases,
  };
}
