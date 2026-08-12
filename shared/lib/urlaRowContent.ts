/**
 * What the URLA save is allowed to drop, and what it must not claim it kept.
 *
 * Shared deliberately: the client builds the save payload and the server
 * persists it, and BOTH sides carried their own copy of these filters. They
 * disagreed with each other, and neither matched the database (#451).
 *
 * The rule is not a preference — it is the NOT NULL columns in
 * shared/schema/lendingUrla.ts. A row missing a NOT NULL value cannot be
 * inserted; a row missing anything else can.
 *
 *   employment_history     employment_type NOT NULL, but the route defaults it
 *                          to "current". employer_name and position_title are
 *                          NULLABLE — so a row carrying only dates and income
 *                          IS persistable, and dropping it was pure data loss.
 *   urla_assets            account_type NOT NULL.
 *   urla_liabilities       liability_type NOT NULL.
 *   other_income_sources   income_source AND monthly_amount both NOT NULL —
 *                          so that section's `&&` was correct all along, not
 *                          the asymmetry it looked like.
 *
 * The old predicates got this wrong in BOTH directions:
 *
 *   employment   `employerName || positionTitle` (client) dropped rows the
 *                database would have accepted — the reported loss.
 *   assets       `accountType || financialInstitution` ADMITTED a row with only
 *                an institution, which then violates account_type NOT NULL on
 *                insert. Same shape for liabilities. A filter that lets through
 *                what the schema rejects turns a silent drop into a failed save.
 */

/** Keys that identify a row rather than carry anything the borrower typed. */
const ROW_METADATA_KEYS = new Set([
  "id",
  "applicationId",
  "loanApplicationId",
  "borrowerSequenceNumber",
  "createdAt",
  "updatedAt",
]);

/**
 * Has the borrower put anything in this row at all?
 *
 * The form seeds every repeating section with a blank `{}` (see `emptySlice`),
 * so untouched rows must still be dropped — but the test is emptiness, not the
 * presence of one chosen field.
 *
 * `false` and `0` count as content: a cleared checkbox and a zero balance are
 * both answers. Only null, undefined and blank/whitespace strings are absent —
 * the same rule `hasValue` applies in server/services/mismoValidation.ts.
 */
export function hasBorrowerContent(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return Object.entries(row).some(([key, value]) => {
    if (ROW_METADATA_KEYS.has(key)) return false;
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    return true;
  });
}

export type UrlaRowSection = "employment" | "asset" | "liability" | "otherIncome";

/**
 * The fields a row must carry to be insertable, mirroring NOT NULL. Employment
 * has none: its only NOT NULL borrower column is defaulted by the route.
 */
const REQUIRED_FIELDS: Record<UrlaRowSection, { field: string; label: string }[]> = {
  employment: [],
  asset: [{ field: "accountType", label: "an account type" }],
  liability: [{ field: "liabilityType", label: "a liability type" }],
  otherIncome: [
    { field: "incomeSource", label: "an income source" },
    { field: "monthlyAmount", label: "a monthly amount" },
  ],
};

const present = (row: Record<string, unknown>, field: string): boolean => {
  const v = row[field];
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return true;
};

export type UrlaRowSaveState =
  /** Untouched — drop it, and say nothing. The borrower never filled it in. */
  | { state: "empty" }
  /** Persistable. */
  | { state: "saveable" }
  /**
   * The borrower entered something, but the row is missing a value the database
   * requires. It CANNOT be saved — and the borrower must be told, because this
   * is the case that used to vanish under a success message.
   */
  | { state: "incomplete"; missing: string[] };

export function urlaRowSaveState(
  section: UrlaRowSection,
  row: Record<string, unknown> | null | undefined,
): UrlaRowSaveState {
  if (!hasBorrowerContent(row)) return { state: "empty" };
  const missing = REQUIRED_FIELDS[section]
    .filter(r => !present(row as Record<string, unknown>, r.field))
    .map(r => r.label);
  return missing.length ? { state: "incomplete", missing } : { state: "saveable" };
}

/** Convenience for the payload builders and the persistence loops. */
export function isUrlaRowSaveable(
  section: UrlaRowSection,
  row: Record<string, unknown> | null | undefined,
): boolean {
  return urlaRowSaveState(section, row).state === "saveable";
}
