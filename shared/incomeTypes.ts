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
 * `qualifyingAuthority` is `null` for every entry today. That is still the
 * honest state — but as of 2026-08-22 the REASON changed, and the old reason is
 * no longer true.
 *
 * The old reason was "there is no Selling Guide income chapter in-repo". There
 * is now: the founder supplied the 08-05-2026 edition, and the two rules this
 * module names are both in it —
 *   * non-taxable gross-up — B3-3.1-01, Nontaxable Income: add "an amount
 *     equivalent to 25% of the nontaxable income", or the actual tax amount if
 *     a wage earner in a similar bracket would pay more than 25%;
 *   * continuance — B3-3.1-01, Continuance of Income: income with a defined
 *     expiration date, or dependent on depletion of an asset, must be
 *     documented to continue at least THREE YEARS from the note date.
 *
 * They stay uncomputed for two different reasons, and the difference matters:
 *   * GROSS-UP raises qualifying income, which LOOSENS the DTI gate. This
 *     repo's rail lets a reading tighten a gate or remove a borrower charge —
 *     never loosen one. Applying it is a founder decision, not an agent's.
 *   * CONTINUANCE removes income, which tightens — allowed — but
 *     `other_income_sources` carries only `income_source` and `monthly_amount`.
 *     There is no expiration date to test against, so the rule is
 *     unimplementable until that is captured.
 *
 * Both are recorded in knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md.
 *
 * Filling one in is still a three-part change, in this order and never fewer:
 *   1. the authority is available AND the citation points at a TRACKED file;
 *   2. a `data/regulatory/regulatory-ledger.json` entry cites it;
 *   3. `qualifyingAuthority` points at the doc and section, and the calculator
 *      that consumes it ships in the same commit.
 * `tests/incomeTypes.test.ts` enforces step 3 mechanically with `fs.existsSync`:
 * a citation naming a file that is not on disk fails the suite.
 *
 * 🚨 STEP 1 HAS A TRAP NOW. The repo went public on 2026-08-22, so the Guide PDF
 * and its full text extraction are GITIGNORED (see .gitignore and
 * scripts/extract-selling-guide.py). Citing
 * `docs/fannie-mae/selling-guide/selling-guide-text.txt` would pass on your
 * machine and FAIL in CI, where the fresh clone does not have it. Cite the
 * tracked `docs/fannie-mae/selling-guide/section-index.tsv` — or the conformance
 * ledger — and name the section in `section`.
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
