// Pre-approval funnel form schema — the Zod contract the intake form and the
// server both validate against, plus the small value vocabularies it needs.
//
// WHY THIS IS NOT IN shared/schema/lendingUrla.ts ANY MORE
//
// `preApprovalFormSchema` is a RUNTIME import in the client (PreApproval.tsx,
// preApprovalMachine.ts). While it sat in a module that also declares
// pgTable(...) and createInsertSchema(...), importing it pulled all 174 Drizzle
// table definitions into the public browser bundle — pgTable() is side-effecting,
// so tree-shaking could not drop them.
//
// Nothing here is table-derived: preApprovalFormBaseSchema is a plain z.object,
// not createInsertSchema(loanApplications). That is what makes the split safe —
// keep it true. This module must import nothing but zod.
//
// lendingUrla.ts imports what it still uses and re-exports the rest, so
// `@shared/schema` consumers and all server imports are unchanged.

import { z } from "zod";

const VALID_US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC"
] as const;

export type USStateCode = typeof VALID_US_STATES[number];
export { VALID_US_STATES };

const currencyString = (fieldLabel: string) =>
  z.string()
    .min(1, `${fieldLabel} is required`)
    .refine(
      (v) => {
        const num = parseFloat(v.replace(/[,$]/g, ""));
        return !isNaN(num) && num >= 0;
      },
      { message: `${fieldLabel} must be a valid dollar amount` }
    );

const positiveCurrencyString = (fieldLabel: string) =>
  z.string()
    .min(1, `${fieldLabel} is required`)
    .refine(
      (v) => {
        const num = parseFloat(v.replace(/[,$]/g, ""));
        return !isNaN(num) && num > 0;
      },
      { message: `${fieldLabel} must be greater than $0` }
    )
    .refine(
      (v) => {
        const num = parseFloat(v.replace(/[,$]/g, ""));
        return num <= 100_000_000;
      },
      { message: `${fieldLabel} exceeds the maximum allowed value` }
    );

export const rentalPropertyEntrySchema = z.object({
  address: z.string()
    .min(1, "Property address is required")
    .max(500, "Address is too long"),
  city: z.string().max(100, "City name is too long").optional(),
  state: z.string()
    .refine((v) => !v || VALID_US_STATES.includes(v as any), { message: "Please select a valid US state" })
    .optional(),
  monthlyRentalIncome: z.string()
    .min(1, "Monthly rental income is required")
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return !isNaN(n) && n > 0; },
      { message: "Rental income must be a valid amount greater than $0" }
    )
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return n <= 1_000_000; },
      { message: "Monthly rental income exceeds the maximum allowed value" }
    ),
  monthlyDebtPayment: z.string()
    .refine(
      (v) => { if (!v) return true; const n = parseFloat(v.replace(/[,$]/g, "")); return !isNaN(n) && n >= 0; },
      { message: "Debt payment must be a valid dollar amount" }
    )
    .optional(),
});

export type RentalPropertyEntry = z.infer<typeof rentalPropertyEntrySchema>;

export const incomeSourceEntrySchema = z.object({
  type: z.enum(
    ["w2", "self_employed", "rental", "social_security", "pension", "investment", "other"],
    { error: () => "Please select a valid income type" }
  ),
  annualAmount: z.string()
    .min(1, "Income amount is required")
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return !isNaN(n) && n > 0; },
      { message: "Income amount must be greater than $0" }
    )
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return n <= 100_000_000; },
      { message: "Income amount exceeds the maximum allowed value" }
    ),
  employerName: z.string().max(200, "Employer name is too long").optional(),
  yearsInRole: z.string()
    .refine(
      (v) => { if (!v) return true; const n = parseInt(v); return !isNaN(n) && n >= 0 && n <= 80; },
      { message: "Years in role must be between 0 and 80" }
    )
    .optional(),
  rentalProperties: z.array(rentalPropertyEntrySchema).optional(),
});

export type IncomeSourceEntry = z.infer<typeof incomeSourceEntrySchema>;

// Exported for shared/schema/lendingUrla.ts, which derives further schemas from
// it. Not part of the public form contract — prefer preApprovalFormSchema.
export const preApprovalFormBaseSchema = z.object({
  annualIncome: positiveCurrencyString("Annual income"),
  employmentType: z.enum(
    ["employed", "self_employed", "retired", "other"],
    { error: () => "Please select your employment status" }
  ),
  employmentYears: z.string()
    .min(1, "Years at current job is required")
    .refine(
      (v) => { const n = parseInt(v); return !isNaN(n) && n >= 0; },
      { message: "Please enter a valid number of years" }
    )
    .refine(
      (v) => { const n = parseInt(v); return n <= 80; },
      { message: "Years at current job cannot exceed 80" }
    ),

  hasAdditionalIncome: z.boolean().optional(),
  incomeSources: z.array(incomeSourceEntrySchema).optional(),

  monthlyDebts: currencyString("Monthly debts")
    .refine(
      (v) => { const n = parseFloat(v.replace(/[,$]/g, "")); return n <= 1_000_000; },
      { message: "Monthly debts exceeds the maximum allowed value" }
    ),
  creditScore: z.string()
    .min(1, "Credit score range is required")
    .refine(
      (v) => ["760", "720", "680", "640", "600", "not_sure"].includes(v),
      { message: "Please select a valid credit score range" }
    ),

  loanPurpose: z.enum(
    ["purchase", "refinance", "cash_out"],
    { error: () => "Please select what you're looking to do" }
  ),
  propertyType: z.enum(
    ["single_family", "condo", "townhouse", "multi_family"],
    { error: () => "Please select a property type" }
  ),
  purchasePrice: positiveCurrencyString("Purchase price"),
  downPayment: currencyString("Down payment"),

  isVeteran: z.boolean(),
  isFirstTimeBuyer: z.boolean(),
  // UAL P7 routing preference ("financing that avoids interest"). Optional in
  // the form base so non-funnel callers are unaffected; the funnel supplies it.
  avoidsInterestFinancing: z.boolean().optional(),
  propertyState: z.string()
    .min(1, "Property state is required")
    .refine(
      (v) => VALID_US_STATES.includes(v as any),
      { message: "Please select a valid US state" }
    ),

  // VA residual-income inputs — required for veterans (enforced in the
  // superRefine below); routed into the funnel only on the VA path.
  householdFamilySize: z.string()
    .refine(
      (v) => { if (!v) return true; const n = parseInt(v); return !isNaN(n) && n >= 1 && n <= 20; },
      { message: "Household size must be between 1 and 20" }
    )
    .optional(),
  homeSquareFootage: z.string()
    .refine(
      (v) => { if (!v) return true; const n = parseInt(v); return !isNaN(n) && n >= 100 && n <= 50000; },
      { message: "Home square footage must be between 100 and 50,000" }
    )
    .optional(),
});

export type PreApprovalFormData = z.infer<typeof preApprovalFormBaseSchema>;

// Exported for the derived schemas in shared/schema/lendingUrla.ts (see above).
export const downPaymentWithinPurchasePrice = (
  // `null` is admitted because the draft-update schema lets a borrower CLEAR
  // either figure (CLEARABLE_INTAKE_FIELDS, below in this file).
  // The falsy guard below already handled it; only the type was too narrow,
  // and widening it here is what keeps that check honest rather than casting
  // at the call site.
  data: { downPayment?: string | null; purchasePrice?: string | null },
  ctx: z.RefinementCtx,
) => {
  // A cleared figure has nothing to compare against — the pair is only
  // meaningful when both are present, exactly as when neither was answered yet.
  if (!data.downPayment || !data.purchasePrice) return;
  const dp = parseFloat(data.downPayment.replace(/[,$]/g, ""));
  const pp = parseFloat(data.purchasePrice.replace(/[,$]/g, ""));
  if (!isNaN(dp) && !isNaN(pp) && dp > pp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Down payment cannot be more than the purchase price",
      path: ["downPayment"],
    });
  }
};

// The VA residual-income evaluation (underwritingEngine) cannot run without
// household size and square footage — require both for veterans.
const vaResidualInputsPresent = (
  data: { isVeteran?: boolean; householdFamilySize?: unknown; homeSquareFootage?: unknown },
  ctx: z.RefinementCtx,
) => {
  if (!data.isVeteran) return;
  if (!data.householdFamilySize) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Household size is required for VA loan eligibility",
      path: ["householdFamilySize"],
    });
  }
  if (!data.homeSquareFootage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Home square footage is required for VA loan eligibility",
      path: ["homeSquareFootage"],
    });
  }
};

export const preApprovalFormSchema = preApprovalFormBaseSchema.superRefine(
  (data, ctx) => {
    downPaymentWithinPurchasePrice(data, ctx);
    vaResidualInputsPresent(data, ctx);
  },
);

// ---------------------------------------------------------------------------
// Wire-format intake schema — the SERVER-side validation for the same payload
// the funnel validates client-side. Derived from preApprovalFormBaseSchema so
// the two can never drift: the server rejects exactly what the client
// rejects. (The old server-local schema silently clamped out-of-range values
// — credit score 900 became 850, employmentYears NaN became 0 — turning
// validation errors into fabricated data.)
// ---------------------------------------------------------------------------

/** The credit bands the funnel collects; "not_sure" maps to the named default. */
export const CREDIT_SCORE_BAND_VALUES = ["760", "720", "680", "640", "600", "not_sure"] as const;
/**
 * Midpoint used when the borrower doesn't know their score. Explicit and
 * named — not a silent clamp. The figure stays `self_reported` provenance
 * until a real credit pull replaces it (see shared/dataProvenance.ts).
 */
export const CREDIT_SCORE_UNKNOWN_DEFAULT = 680;

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

// The four fields this PATCH accepts that the funnel form does not carry.
// Named so the clearable variants below can reuse the SAME validator rather
// than restate it — a second spelling is how a rule and its clear drift apart.
const employerNameField = z.string().max(200, "Employer name is too long");
const propertyAddressField = z.string().max(500, "Address is too long");
const propertyCityField = z.string().max(100, "City name is too long");
const propertyZipField = z.string().refine(
  (v) => !v || /^\d{5}(-\d{4})?$/.test(v),
  { message: "ZIP code must be 5 digits (e.g., 90210) or ZIP+4 (e.g., 90210-1234)" },
);

const partialIntakeShape = preApprovalFormBaseSchema.partial().shape;
