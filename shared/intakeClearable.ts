// The wire representation of "clear this field" — a catalog and a predicate,
// and nothing else.
//
// ITS OWN MODULE FOR A MEASURED REASON. This lived in shared/preApprovalForm.ts
// for one commit, which every visitor already downloads: the funnel form schema
// sits in the EAGER entry chunk, so 50 bytes of catalog rode along with it and
// `pnpm guard:bundle` said so (baseline 522,434 -> 522,484). The only client
// that needs the predicate is /profile, which is lazily routed
// (client/src/App.tsx:134), so isolating the catalog here puts the bytes in
// that page's chunk instead of in front of every first paint.
//
// Table-free on purpose, like preApprovalForm: a value import of
// @shared/schema ships all 174 Drizzle table definitions to the browser
// (#482, tests/clientSchemaImports.test.ts).

/**
 * Fields a borrower may set back to "not answered", and the wire value that
 * says so: an explicit `null`.
 *
 * THE THREE STATES MUST STAY DISTINCT, and before this existed there were only
 * two. `.partial()` makes every field optional, so **absent** means "leave this
 * alone" — which is right, and is what lets the funnel's debounced autosave
 * send partial progress without blanking earlier answers. A **present** field
 * must satisfy the base rules, all of which reject an empty string. There was
 * no third state, so "I want this blank again" had nothing to travel as.
 *
 * Every surface that hit that wall dealt with it the same way — by dropping the
 * edit before sending. `/profile` then reported "Your self-reported details were
 * saved", refetched, and put the old value back on screen: the borrower's
 * correction was gone and nothing said so (PR #547). That is a validation rule
 * enforced by discarding data instead of reporting it, and the fix is to make
 * the intent expressible rather than to keep apologising for it.
 *
 * `null` — never `""`. An empty string is what a form control produces on its
 * own, from a half-typed field, a controlled input mounting, or a JSON caller
 * being sloppy; treating it as a command to erase data would make every
 * accidental blank destructive. `null` has to be chosen.
 *
 * WHY THIS NEEDS NO MIGRATION: every column below is already nullable in
 * `loan_applications` (shared/schema/lendingCore.ts:63-81) — `null` has always
 * been a legal value there, and it is exactly the state a draft is in before
 * the borrower answers. Clearing returns the row to a shape the whole app
 * already handles; nothing new reaches the database, so there is no DDL to
 * write. (`pnpm guard:schema` asks whether a new *column* arrived without a
 * migration; the honest answer here is that none did.)
 *
 * The list is deliberately explicit rather than "everything nullable":
 *
 *   - the four money fields, `employmentYears`, `employerName` and the four
 *     property-location fields are FREE-TEXT INPUTS a borrower can empty on
 *     `/profile`, so each one needs a clear or the wall comes straight back;
 *   - `creditScore`, `loanPurpose`, `propertyType` and `employmentType` are
 *     select-only. There is no "empty" for a UI to produce, so admitting one
 *     would be untested surface area;
 *   - `isVeteran` / `isFirstTimeBuyer` / `avoidsInterestFinancing` are
 *     deliberately left alone. For the last one especially, null ("not asked")
 *     already carries meaning distinct from false, and that distinction is set
 *     at intake — a later PATCH must not be able to reach in and unset it.
 *
 * Adding a field here is a decision, not a formality: it makes erasure
 * reachable from a route. `tests/intakeClearSemantics.test.ts` pins the
 * catalog, the three states, and the fact that the AI coach can never reach
 * this path.
 */
export const CLEARABLE_INTAKE_FIELDS = [
  "annualIncome",
  "monthlyDebts",
  "employmentYears",
  "purchasePrice",
  "downPayment",
  "employerName",
  "propertyAddress",
  "propertyCity",
  "propertyState",
  "propertyZip",
] as const;

export type ClearableIntakeField = typeof CLEARABLE_INTAKE_FIELDS[number];

const CLEARABLE_FIELD_SET: ReadonlySet<string> = new Set(CLEARABLE_INTAKE_FIELDS);

/** Can this field be sent as `null` to mean "the borrower un-answered it"? */
export function isClearableIntakeField(field: string): field is ClearableIntakeField {
  return CLEARABLE_FIELD_SET.has(field);
}
