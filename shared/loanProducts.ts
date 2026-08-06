/**
 * Loan product taxonomy — the canonical vocabulary for "what kind of loan is
 * this?" across the platform.
 *
 * WHY THIS EXISTS
 *
 * The codebase had three overlapping ways to say the same thing: uppercase
 * strings in `wholesale_lenders.capabilities.productTypes` ("CONVENTIONAL",
 * "FHA"), lowercase strings in `mortgage_rate_programs.loanType`
 * ("conventional", "fha"), and free-text `articles.tags`. Nothing enforced any
 * of them, so an article could not be joined to a loan product at all — which
 * is why education content and the conversion funnel were unwired.
 *
 * THE SHAPE IS TWO AXES, NOT ONE LIST
 *
 * This mirrors how wholesale lenders actually publish their menus (checked
 * against UWM's and Pennymac TPO's public product pages, 2026-08): there is a
 * PRODUCT FAMILY — what the loan is, which determines the investor and the
 * guides — and, nested mostly under non-QM, a QUALIFICATION METHOD — how income
 * is proven. Pennymac makes the nesting explicit (Non-QM is the family; bank
 * statement and DSCR are programs within it); UWM flattens it in marketing but
 * the underlying split is the same.
 *
 * Collapsing them into one enum is the mistake the old de-facto vocabulary
 * made: `bank_statement` and `dscr` sat alongside `fha` as if they were peers.
 * They are not — `bank_statement` is a way to qualify for a non-QM loan, and a
 * flat list lets an FHA article be tagged `dscr`, which is meaningless.
 *
 * ADOPTION
 *
 * Article classification uses this module today. `capabilities.productTypes`
 * and `mortgage_rate_programs.loanType` still carry their historical strings;
 * `normalizeProductFamily` maps both onto this vocabulary so callers can
 * converge without a coordinated migration. New code should use these types
 * directly rather than adding a fourth spelling.
 */

// ---------------------------------------------------------------------------
// Axis 1 — product family: what the loan IS.
// ---------------------------------------------------------------------------

export const LOAN_PRODUCT_FAMILIES = [
  "conventional",
  "fha",
  "va",
  "usda",
  "jumbo",
  "non_qm",
  "home_equity",
] as const;

export type LoanProductFamily = (typeof LOAN_PRODUCT_FAMILIES)[number];

export const LOAN_PRODUCT_FAMILY_LABELS: Record<LoanProductFamily, string> = {
  conventional: "Conventional",
  fha: "FHA",
  va: "VA",
  usda: "USDA",
  jumbo: "Jumbo",
  non_qm: "Non-QM",
  // Covers both the closed-end second and the HELOC. Open- vs closed-end is a
  // real distinction but a pricing/structure one, not a content-routing one —
  // it earns its own field when we actually broker a second lien.
  home_equity: "Home Equity",
};

export function isLoanProductFamily(v: unknown): v is LoanProductFamily {
  return typeof v === "string" && (LOAN_PRODUCT_FAMILIES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Axis 2 — qualification method: how income is PROVEN.
//
// Orthogonal to family. Meaningful mainly for non-QM and self-employed
// borrowers; an agency loan is `full_doc` by definition and does not need
// tagging.
// ---------------------------------------------------------------------------

export const DOC_METHODS = [
  "full_doc",
  "bank_statement",
  "dscr",
  "asset_depletion",
  "1099",
  "wvoe",
] as const;

export type DocMethod = (typeof DOC_METHODS)[number];

export const DOC_METHOD_LABELS: Record<DocMethod, string> = {
  full_doc: "Full documentation",
  bank_statement: "Bank statement",
  dscr: "DSCR (investor cash flow)",
  asset_depletion: "Asset depletion",
  "1099": "1099 income",
  wvoe: "Written verification of employment",
};

export function isDocMethod(v: unknown): v is DocMethod {
  return typeof v === "string" && (DOC_METHODS as readonly string[]).includes(v);
}

/**
 * Families a given qualification method can actually appear under.
 *
 * Encodes the nesting rather than leaving it to convention, so a nonsensical
 * pairing (an FHA loan qualified by DSCR) is a validation failure rather than
 * silently-published content. `full_doc` is the exception: every family
 * supports it.
 */
export const DOC_METHOD_FAMILIES: Record<DocMethod, readonly LoanProductFamily[]> = {
  full_doc: LOAN_PRODUCT_FAMILIES,
  bank_statement: ["non_qm"],
  dscr: ["non_qm"],
  asset_depletion: ["non_qm", "jumbo"],
  "1099": ["non_qm"],
  wvoe: ["non_qm"],
};

/** True when this qualification method is coherent for the given family. */
export function isDocMethodValidForFamily(method: DocMethod, family: LoanProductFamily): boolean {
  return DOC_METHOD_FAMILIES[method].includes(family);
}

// ---------------------------------------------------------------------------
// Axis 3 — transaction purpose: what the borrower is DOING.
// ---------------------------------------------------------------------------

export const TRANSACTION_PURPOSES = [
  "purchase",
  "rate_term_refi",
  "cash_out_refi",
  "streamline_refi",
] as const;

export type TransactionPurpose = (typeof TRANSACTION_PURPOSES)[number];

export const TRANSACTION_PURPOSE_LABELS: Record<TransactionPurpose, string> = {
  purchase: "Purchase",
  rate_term_refi: "Rate & term refinance",
  cash_out_refi: "Cash-out refinance",
  // VA IRRRL and FHA Streamline: reduced-documentation refinances of an
  // existing government loan.
  streamline_refi: "Streamline refinance",
};

export function isTransactionPurpose(v: unknown): v is TransactionPurpose {
  return typeof v === "string" && (TRANSACTION_PURPOSES as readonly string[]).includes(v);
}

/** Streamline refinances exist only on government loans. */
export const STREAMLINE_ELIGIBLE_FAMILIES: readonly LoanProductFamily[] = ["fha", "va", "usda"];

// ---------------------------------------------------------------------------
// Normalization from the historical spellings.
// ---------------------------------------------------------------------------

/**
 * Map a legacy product string onto a family. Handles the uppercase form used in
 * `wholesale_lenders.capabilities.productTypes` and the lowercase form in
 * `mortgage_rate_programs.loanType`, plus the couple of aliases in circulation.
 *
 * Returns null rather than guessing — an unrecognised string is a data problem
 * the caller should surface, not silently bucket as "conventional".
 */
export function normalizeProductFamily(value: string | null | undefined): LoanProductFamily | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isLoanProductFamily(v)) return v;
  switch (v) {
    case "conv":
    case "conforming":
      return "conventional";
    case "nonqm":
    case "non_agency":
      return "non_qm";
    case "heloc":
    case "second_lien":
    case "closed_end_second":
      return "home_equity";
    default:
      return null;
  }
}

/** Parse a stored array column into validated families, dropping unknowns. */
export function parseProductFamilies(values: readonly string[] | null | undefined): LoanProductFamily[] {
  return (values ?? []).filter(isLoanProductFamily);
}

/** Parse a stored array column into validated purposes, dropping unknowns. */
export function parseTransactionPurposes(
  values: readonly string[] | null | undefined,
): TransactionPurpose[] {
  return (values ?? []).filter(isTransactionPurpose);
}

/** Parse a stored array column into validated doc methods, dropping unknowns. */
export function parseDocMethods(values: readonly string[] | null | undefined): DocMethod[] {
  return (values ?? []).filter(isDocMethod);
}

// ---------------------------------------------------------------------------
// Cross-axis coherence.
// ---------------------------------------------------------------------------

/**
 * Validate a classification across the axes and return human-readable problems
 * (empty array = coherent).
 *
 * Lives here rather than as a zod `.superRefine` on `insertArticleSchema`
 * because the article update route derives its body schema with
 * `.omit({...}).partial()`, and zod 4 throws ".omit() cannot be used on object
 * schemas containing refinements" at runtime while still type-checking. Keeping
 * the rules as a pure function avoids that trap entirely and makes them
 * testable without constructing a request.
 *
 * Per-axis vocabulary is already enforced by the enums on the insert schema;
 * this covers only the relationships BETWEEN axes, which no enum can express.
 */
export function articleTaxonomyIssues(input: {
  loanProductFamilies?: readonly string[] | null;
  transactionPurposes?: readonly string[] | null;
  docMethods?: readonly string[] | null;
}): string[] {
  const families = parseProductFamilies(input.loanProductFamilies);
  const methods = parseDocMethods(input.docMethods);
  const purposes = parseTransactionPurposes(input.transactionPurposes);
  const issues: string[] = [];

  // An unclassified article is a valid state — say nothing about it.
  if (families.length === 0) return issues;

  for (const m of methods) {
    if (!families.some((f) => isDocMethodValidForFamily(m, f))) {
      issues.push(
        `Qualification method "${DOC_METHOD_LABELS[m]}" is not offered under ` +
          `${families.map((f) => LOAN_PRODUCT_FAMILY_LABELS[f]).join(", ")}. ` +
          `It belongs to: ${DOC_METHOD_FAMILIES[m]
            .map((f) => LOAN_PRODUCT_FAMILY_LABELS[f])
            .join(", ")}.`,
      );
    }
  }

  if (
    purposes.includes("streamline_refi") &&
    !families.some((f) => STREAMLINE_ELIGIBLE_FAMILIES.includes(f))
  ) {
    issues.push(
      "Streamline refinances exist only on government loans " +
        `(${STREAMLINE_ELIGIBLE_FAMILIES.map((f) => LOAN_PRODUCT_FAMILY_LABELS[f]).join(", ")}).`,
    );
  }

  return issues;
}
