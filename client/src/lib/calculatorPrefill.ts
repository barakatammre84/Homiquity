// The calculator → pre-approval funnel handoff.
//
// Both public affordability tools end in a "Start Pre-Approval" button, and the
// figures the borrower already tuned there are exactly the figures the funnel
// asks for. Carrying them across is the difference between a borrower answering
// five questions and answering none — so this channel is load-bearing for
// intake quality, not a nicety.
//
// It rides in sessionStorage rather than the URL because most of these values
// are financial (income, debts, savings) and a URL is logged, shared and
// referred. Only the derived home price travels as `?price=`, which the funnel
// already reads at defaultValues time.
//
// THE CONTRACT LIVES HERE, not at either end. This used to be a bare
// `sessionStorage.setItem("calculatorPrefill", JSON.stringify({...}))` in two
// calculators and a `JSON.parse(raw)` typed `any` in the funnel — three
// independent spellings of one payload, with nothing holding them together.
// That is how the credit-score field came to be handed over in a vocabulary the
// funnel does not accept; see preApproval/calculatorPrefill.ts for the rule
// that consumes this, and for what that cost the borrower.

/** sessionStorage, not localStorage: a handoff is for this visit, not forever. */
const STORAGE_KEY = "calculatorPrefill";

/**
 * What a calculator may hand the funnel. Every field is OPTIONAL and NUMERIC —
 * calculators hold their inputs as numbers, and each tool contributes only what
 * it actually collects (rent-to-own has no income or debt inputs at all).
 *
 * `creditScore` is a RAW SCORE — the calculator's slider position — never a
 * funnel band. Mapping it is deliberately the reader's job, because the reader
 * is what owns the band vocabulary; a writer that mapped it would be a second
 * place that has to be kept in step with `CREDIT_SCORE_BAND_VALUES`.
 */
export interface CalculatorPrefill {
  annualIncome?: number;
  monthlyDebts?: number;
  downPayment?: number;
  creditScore?: number;
  purchasePrice?: number;
}

const NUMERIC_FIELDS = [
  "annualIncome",
  "monthlyDebts",
  "downPayment",
  "creditScore",
  "purchasePrice",
] as const satisfies readonly (keyof CalculatorPrefill)[];

/**
 * Stash figures for the funnel.
 *
 * Call this ONLY on a path that actually navigates to /apply. A payload written
 * on a path that goes somewhere else is not a harmless no-op: it sits in the
 * tab until something consumes it, so it gets applied to an unrelated later
 * visit to the funnel. (The affordability calculator did exactly that while
 * PRELAUNCH_GATED sent the borrower to "/" instead.)
 */
export function writeCalculatorPrefill(prefill: CalculatorPrefill): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    // Private mode / quota. The handoff is an optimisation — the funnel still
    // asks every question, so failing to stash costs friction, never data.
  }
}

/**
 * Read and CONSUME the handoff. Reading clears it, so a payload is applied at
 * most once and cannot resurface on a later visit to /apply in the same tab.
 *
 * Unknown keys and non-numeric values are dropped rather than trusted. This
 * crosses a JSON boundary that a previously deployed client may have written
 * (and that devtools can hand-edit), so nothing reaches `form.setValue` without
 * being the shape this module promises.
 */
export function readCalculatorPrefill(): CalculatorPrefill | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return null; // private mode / storage disabled
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt payload — the funnel just asks the questions
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const source = parsed as Record<string, unknown>;
  const out: CalculatorPrefill = {};
  for (const field of NUMERIC_FIELDS) {
    const value = source[field];
    if (typeof value === "number" && Number.isFinite(value)) out[field] = value;
  }
  return out;
}
