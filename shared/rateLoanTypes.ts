// Which mortgage-rate products may be advertised under which product heading.
//
// WHY THIS IS SHARED, AND WHY THE SERVER ENFORCES IT
// --------------------------------------------------
// /rates/* pages are public advertising surfaces. A rate printed under a
// product heading is a representation that the rate IS that product, so
// "HELOC rates today" must never list a conventional first mortgage
// (Reg Z advertising / Reg N misrepresentation — kb/L2_COMPLIANCE_AND_LOGIC.md).
//
// That invariant used to live in a per-page `.filter()` in the render path,
// which made it opt-in: /rates/heloc simply never opted in and advertised six
// conventional programs, an FHA and a VA loan as HELOCs. Filtering now happens
// once, in SQL, keyed off this table — a page cannot forget to apply it,
// because it never receives the wrong products in the first place.
//
// `mortgage_rate_programs.loan_type` is nullable, so this maps a requested
// loan type to a *predicate* rather than to a bare equality.

/** Loan types a public rate page may request. Values are program loan types. */
export const RATE_LOAN_TYPES = ["conventional", "fha", "va", "heloc"] as const;

export type RateLoanType = (typeof RATE_LOAN_TYPES)[number];

export function isRateLoanType(value: unknown): value is RateLoanType {
  return typeof value === "string" && (RATE_LOAN_TYPES as readonly string[]).includes(value);
}

/**
 * Loan types that also match programs with no `loan_type` set.
 *
 * An unclassified program is a conforming first mortgage by default: that is
 * what the purchase/refinance/cash-out pages have always shown, and those are
 * transaction purposes rather than products, so a generic "30-yr fixed" with a
 * null loan type genuinely belongs under them.
 *
 * The government and equity products are deliberately absent. Calling a program
 * FHA, VA or HELOC is a specific claim about who backs it and how it is
 * secured, and an unclassified row is not evidence of that claim — so a program
 * missing its loan_type is never advertised as one. Add a loan type here only
 * if "unclassified" is genuinely indistinguishable from it.
 */
const MATCHES_UNCLASSIFIED: ReadonlySet<RateLoanType> = new Set<RateLoanType>(["conventional"]);

/** Whether a null `loan_type` should be treated as the requested loan type. */
export function rateLoanTypeIncludesUnclassified(loanType: RateLoanType): boolean {
  return MATCHES_UNCLASSIFIED.has(loanType);
}

/**
 * The in-memory twin of the SQL predicate in
 * `storage.getMortgageRatesForLocation` — same rule, for tests and for any
 * caller holding rates it did not fetch itself.
 */
export function rateMatchesLoanType(
  programLoanType: string | null | undefined,
  loanType: RateLoanType,
): boolean {
  if (programLoanType == null) return rateLoanTypeIncludesUnclassified(loanType);
  return programLoanType === loanType;
}
