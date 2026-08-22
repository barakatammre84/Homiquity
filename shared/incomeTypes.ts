/**
 * Other-income type catalog — the ONE vocabulary for URLA Section 1e income.
 *
 * WHY THIS EXISTS. Until this module, the twenty income types a borrower can
 * declare lived only as display strings in a client-only constant
 * (`client/src/pages/borrower/urla/types.ts`), were written into a free-text
 * `other_income_sources.income_source varchar(100)`, and reached the engine as
 * opaque text. The consequence is in `server/services/income/paths/agencyWage.ts`:
 * every source is summed at 100% of face value because nothing downstream can
 * tell Social Security from Child Support from Capital Gains.
 *
 * That single fact blocks four separate capabilities at once — non-taxable
 * gross-up, continuance testing, a capital-gains path, and any per-type
 * document request. None of them can be built on a string a human typed into a
 * picker; all of them are one `switch` away once the type is a value.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO: decide how any type qualifies.
 * `qualifyingAuthority` is `null` for every entry today, and that is the honest
 * state, not an oversight — `docs/fannie-mae/` holds reference documents for
 * self-employment (B3-3.5/B3-3.6) and rental income only. There is no Selling
 * Guide income chapter in-repo, so there is no in-repo authority for grossing up
 * non-taxable income or for a continuance requirement, and this repo's standing
 * rule is that a regulated figure with no citation is flagged, never computed
 * (CLAUDE.md; the same rule that hard-blocks the DSCR and bank-statement paths).
 *
 * So the catalog states the gap in a form the machine can read. Filling one in
 * is a three-part change, in this order and never fewer:
 *   1. the authority document lands under `docs/fannie-mae/`;
 *   2. a `data/regulatory/regulatory-ledger.json` entry cites it;
 *   3. `qualifyingAuthority` points at the doc and section, and the calculator
 *      that consumes it ships in the same commit.
 * `tests/incomeTypes.test.ts` enforces step 3 mechanically: a citation naming a
 * file that is not on disk fails the suite.
 */

export const OTHER_INCOME_TYPE_IDS = [
  "alimony",
  "child_support",
  "interest_and_dividends",
  "notes_receivable",
  "royalty_payments",
  "unemployment_benefits",
  "automobile_allowance",
  "disability",
  "mortgage_credit_certificate",
  "public_assistance",
  "retirement",
  "social_security",
  "boarder_income",
  "foster_care",
  "housing_or_parsonage",
  "separate_maintenance",
  "trust",
  "va_compensation",
  "capital_gains",
  "other",
] as const;

export type OtherIncomeTypeId = (typeof OTHER_INCOME_TYPE_IDS)[number];

/** An in-repo authority for how an income type qualifies. Never a URL, never a memory. */
export interface IncomeTypeCitation {
  /** Repo-relative path to a document that exists on disk. */
  doc: string;
  /** The section within it, e.g. "B3-3.1-09". */
  section: string;
}

export interface OtherIncomeTypeDefinition {
  id: OtherIncomeTypeId;
  /**
   * The EXACT string the URLA picker writes and `other_income_sources.income_source`
   * stores. Changing one of these orphans every row already written with the old
   * text, so treat it as data, not copy — `classifyOtherIncomeSource` is the only
   * safe way to read the column, and the drift test pins this list.
   */
  label: string;
  /**
   * In-repo authority for this type's qualifying treatment (gross-up eligibility,
   * continuance requirement, history requirement). `null` means NOT IN REPO: the
   * declared amount is used at face value and the fact is surfaced, never adjusted
   * by a guessed factor.
   */
  qualifyingAuthority: IncomeTypeCitation | null;
}

export const OTHER_INCOME_TYPES: readonly OtherIncomeTypeDefinition[] = [
  { id: "alimony", label: "Alimony", qualifyingAuthority: null },
  { id: "child_support", label: "Child Support", qualifyingAuthority: null },
  { id: "interest_and_dividends", label: "Interest and Dividends", qualifyingAuthority: null },
  { id: "notes_receivable", label: "Notes Receivable", qualifyingAuthority: null },
  { id: "royalty_payments", label: "Royalty Payments", qualifyingAuthority: null },
  { id: "unemployment_benefits", label: "Unemployment Benefits", qualifyingAuthority: null },
  { id: "automobile_allowance", label: "Automobile Allowance", qualifyingAuthority: null },
  { id: "disability", label: "Disability", qualifyingAuthority: null },
  { id: "mortgage_credit_certificate", label: "Mortgage Credit Certificate", qualifyingAuthority: null },
  { id: "public_assistance", label: "Public Assistance", qualifyingAuthority: null },
  { id: "retirement", label: "Retirement (e.g., Pension, IRA)", qualifyingAuthority: null },
  { id: "social_security", label: "Social Security", qualifyingAuthority: null },
  { id: "boarder_income", label: "Boarder Income", qualifyingAuthority: null },
  { id: "foster_care", label: "Foster Care", qualifyingAuthority: null },
  { id: "housing_or_parsonage", label: "Housing or Parsonage", qualifyingAuthority: null },
  { id: "separate_maintenance", label: "Separate Maintenance", qualifyingAuthority: null },
  { id: "trust", label: "Trust", qualifyingAuthority: null },
  { id: "va_compensation", label: "VA Compensation", qualifyingAuthority: null },
  { id: "capital_gains", label: "Capital Gains", qualifyingAuthority: null },
  { id: "other", label: "Other", qualifyingAuthority: null },
];

/**
 * The picker's options, in the order the borrower sees them. The URLA select
 * renders this rather than its own list, so the stored strings and the catalog
 * cannot drift apart — they are now the same array.
 */
export const OTHER_INCOME_LABELS: readonly string[] = OTHER_INCOME_TYPES.map((t) => t.label);

const BY_ID = new Map<OtherIncomeTypeId, OtherIncomeTypeDefinition>(
  OTHER_INCOME_TYPES.map((t) => [t.id, t]),
);

/**
 * Normalised only for whitespace and case — deliberately NOT fuzzy. A stored
 * value that does not match a known label returns `null` and is reported as
 * unclassified, because guessing which benefit a borrower meant is exactly the
 * kind of invention this repo refuses everywhere else.
 */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const BY_NORMALISED_LABEL = new Map<string, OtherIncomeTypeId>(
  OTHER_INCOME_TYPES.map((t) => [normalise(t.label), t.id]),
);

/**
 * Read the free-text `other_income_sources.income_source` column as a type.
 * Returns `null` for anything unrecognised — including rows written before this
 * catalog existed with text that no longer matches a picker option.
 */
export function classifyOtherIncomeSource(stored: string | null | undefined): OtherIncomeTypeId | null {
  if (typeof stored !== "string") return null;
  const trimmed = stored.trim();
  if (trimmed === "") return null;
  return BY_NORMALISED_LABEL.get(normalise(trimmed)) ?? null;
}

export function otherIncomeTypeDefinition(id: OtherIncomeTypeId): OtherIncomeTypeDefinition {
  const found = BY_ID.get(id);
  // Unreachable while the id is typed; a runtime guard for values crossing the wire.
  if (!found) throw new Error(`Unknown other-income type id: ${id}`);
  return found;
}

export function otherIncomeTypeLabel(id: OtherIncomeTypeId): string {
  return otherIncomeTypeDefinition(id).label;
}

/**
 * True when this type's qualifying treatment has no in-repo authority — i.e. the
 * amount is being used exactly as declared because no cited rule says otherwise.
 * Today that is every type; see the module docstring for why that is the honest
 * state and what changes it.
 */
export function hasUncitedQualifyingTreatment(id: OtherIncomeTypeId): boolean {
  return otherIncomeTypeDefinition(id).qualifyingAuthority === null;
}

/**
 * The document-requirement vocabulary (`INCOME_TYPES` in
 * `shared/schema/underwritingTasks.ts`), restated as a bare union.
 *
 * It is restated rather than imported because this module is pulled into the
 * CLIENT bundle by the URLA picker, and `@shared/schema` drags 174 pgTable
 * definitions with it — the leak `tests/clientSchemaImports.test.ts` exists to
 * prevent. `server/pipelineEngine.ts` asserts at compile time that this union
 * and `IncomeType` are the same set, so they cannot drift silently.
 */
export type DocumentIncomeType =
  | "w2" | "self_employed" | "rental" | "bonus" | "commission" | "overtime"
  | "social_security" | "pension" | "disability" | "alimony" | "child_support"
  | "investment" | "other";

/**
 * Which document rule an other-income type falls under.
 *
 * A type maps to its own rule ONLY where the Selling Guide section is
 * transcribed in `docs/fannie-mae/income-documentation-matrix.md`. Everything
 * else maps to `other` — which asks for tax returns and routes to a human —
 * because naming a specific document for an untranscribed rule would be
 * inventing one. Each such row carries the section that WOULD govern it, so
 * filling the gap later is a transcription, not a hunt.
 *
 * 🚨 `separate_maintenance` maps to `alimony` deliberately: B3-3.4-02 governs
 * "Alimony, Child Support, Equalization Payments, or Separate Maintenance" as
 * one rule, so it inherits the same Reg B opt-in gate.
 */
export const OTHER_INCOME_TO_DOCUMENT_TYPE: Record<OtherIncomeTypeId, DocumentIncomeType> = {
  alimony: "alimony",                          // B3-3.4-02 — transcribed (opt-in)
  child_support: "child_support",              // B3-3.4-02 — transcribed (opt-in)
  separate_maintenance: "alimony",             // B3-3.4-02 — same rule (opt-in)
  disability: "disability",                    // B3-3.4-09 — transcribed
  social_security: "social_security",          // B3-3.4-15 — transcribed
  retirement: "pension",                       // B3-3.4-03 — transcribed
  interest_and_dividends: "investment",        // B3-3.4-08 — transcribed
  capital_gains: "investment",                 // B3-3.4-05 — transcribed
  // Untranscribed: the section is named, the rule is not yet in-repo.
  notes_receivable: "other",                   // would be B3-3.4-11
  royalty_payments: "other",                   // would be B3-3.4-13
  unemployment_benefits: "other",              // would be B3-3.4-17
  automobile_allowance: "other",               // would be B3-3.3-04
  mortgage_credit_certificate: "other",        // would be B3-3.4-10
  public_assistance: "other",                  // would be B3-3.4-12
  boarder_income: "other",                     // would be B3-3.4-04
  foster_care: "other",                        // would be B3-3.4-07
  housing_or_parsonage: "other",               // would be B3-3.3-04
  trust: "other",                              // would be B3-3.4-16
  va_compensation: "other",                    // would be B3-3.4-18
  other: "other",
};

/**
 * Read the free-text `other_income_sources.income_source` column as a document
 * rule key. Returns `null` for anything the catalog cannot classify — never a
 * guess, and in particular never an opt-in type.
 */
export function documentIncomeTypeForStoredSource(
  stored: string | null | undefined,
): DocumentIncomeType | null {
  const id = classifyOtherIncomeSource(stored);
  return id ? OTHER_INCOME_TO_DOCUMENT_TYPE[id] : null;
}
