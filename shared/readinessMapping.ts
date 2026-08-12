// ---------------------------------------------------------------------------
// Application → readiness checklist mapping.
//
// WHY THIS EXISTS. Two "how ready are you" models had grown side by side:
//
//   readiness_checklist  25 weighted fields across 9 categories, each carrying a
//                        trust tier (self_reported → application_stated →
//                        document_extracted/verified). The real engine.
//   the coach percentage a conversational assessment on borrower_profiles, and
//                        the ONLY one a borrower ever sees.
//
// They disagreed because the checklist was only ever written by the document
// paths — extraction and presence credit. Nothing seeded it from the
// APPLICATION, so a borrower who had stated their income, employer, credit
// score and property still scored near zero on the model that knew the most.
// That is why the checklist could not be made the single number: it was not
// wrong, it was starved.
//
// This module is the missing feed. It maps a loan application onto the
// checklist's own vocabulary at `application_stated` (tier 2) — the borrower
// said it on their application, which outranks a chat aside and is outranked by
// a document. Documents then upgrade the same rows to tier 1, and because
// updateReadinessField only ever climbs, stating income and later proving it
// strengthens one row rather than creating two truths.
//
// Pure and deterministic: no IO, no clock. The writer lives in
// server/services/readinessSync.ts so these rules stay testable without a
// database.
// ---------------------------------------------------------------------------

/** The subset of a loan application this mapping reads. */
export interface ReadinessApplicationInput {
  annualIncome?: string | number | null;
  monthlyDebts?: string | number | null;
  creditScore?: number | null;
  employmentType?: string | null;
  employmentYears?: number | null;
  employerName?: string | null;
  propertyAddress?: string | null;
  propertyType?: string | null;
  propertyState?: string | null;
  purchasePrice?: string | number | null;
  downPayment?: string | number | null;
  occupancyType?: string | null;
}

export interface ReadinessAssertion {
  /** A fieldName from READINESS_FIELDS. */
  fieldName: string;
  /** Always application_stated — this module speaks only for the application. */
  status: "application_stated";
}

/** Present = a non-empty, non-zero answer. A 0 income is not an answer. */
function stated(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n > 0 : true;
}

/** A text answer counts when it is a non-blank string. */
function answered(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Which readiness fields this application has answers for.
 *
 * Deliberately narrow: only fields the loan application genuinely carries. The
 * identity, declarations and consent categories are NOT asserted here — they
 * live on other records (URLA declarations, consent rows), and claiming them
 * from an application that does not hold them would inflate the score, which is
 * the exact failure the single-number change is meant to end.
 */
export function readinessAssertionsFromApplication(
  app: ReadinessApplicationInput,
): ReadinessAssertion[] {
  const assert = (fieldName: string): ReadinessAssertion => ({
    fieldName,
    status: "application_stated",
  });
  const out: ReadinessAssertion[] = [];

  // Income
  if (stated(app.annualIncome)) out.push(assert("annual_income"));
  if (answered(app.employmentType)) out.push(assert("employment_type"));

  // Employment
  if (answered(app.employerName)) out.push(assert("employer_name"));
  // 0 years is a real answer here (a new job), unlike a 0 income.
  if (app.employmentYears !== null && app.employmentYears !== undefined) {
    out.push(assert("employment_duration"));
  }

  // Liabilities. A declared 0 monthly debt IS an answer — "I have none" is
  // information — so this checks for presence rather than a positive number.
  if (app.monthlyDebts !== null && app.monthlyDebts !== undefined && app.monthlyDebts !== "") {
    out.push(assert("monthly_debts"));
  }

  // Credit
  if (app.creditScore !== null && app.creditScore !== undefined && app.creditScore > 0) {
    out.push(assert("credit_score"));
  }

  // Assets — the application carries a down payment figure, not a balance, so
  // it speaks to the SOURCE question and not to total_assets, which stays a
  // document/Plaid fact.
  if (stated(app.downPayment)) out.push(assert("down_payment_source"));

  // Property
  if (answered(app.propertyType)) out.push(assert("property_type"));
  if (answered(app.propertyAddress)) out.push(assert("property_address"));
  if (stated(app.purchasePrice)) out.push(assert("purchase_price"));
  if (answered(app.occupancyType)) out.push(assert("occupancy_type"));

  return out;
}
