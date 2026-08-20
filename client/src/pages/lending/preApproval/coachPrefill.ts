// Coach-intake gap-fill for the pre-approval funnel.
//
// Homi collects the same figures the funnel asks for, so a borrower who
// talked to the coach shouldn't have to retype them. GAP-FILL is the whole
// contract: intake may fill a field the borrower has left BLANK, and may never
// replace an answer that already exists.
//
// This used to live inline in PreApproval.tsx, where the guards read a
// freshly-created empty object instead of the form (`!formData.annualIncome`
// is always true), and the merge put intake AFTER the current values — so a
// late-arriving intake overwrote live input. `refetchOnWindowFocus` is on
// globally (lib/queryClient.ts), so the funnel refetched intake every time the
// tab regained focus: start /apply → open the coach in another tab → come back
// → income, debts, credit band, price and down payment silently replaced,
// mid-funnel, with no notice. Those figures are what get POSTed to
// /api/loan-applications with the FCRA soft-pull acknowledgement attached, so a
// silent overwrite is a compliance problem, not just a UX one.
//
// The rule below is deliberately narrow, and blankness is the ONLY test:
//
//   * A non-empty value is never touched. That protects typed input, URL-param
//     deep links (/apply?price=…&state=…), and consented draft restores alike,
//     without the hook having to tell those three apart.
//   * The enum fields (employmentType, propertyType, loanPurpose) are never
//     filled. The form always constructs them with a concrete default, so
//     "blank" is unobservable — and that default may itself carry intent from
//     the URL (/self-employed → self_employed, ?type=refinance → refinance),
//     which intake must not override. The funnel asks these as questions
//     anyway; employmentType in particular drives which income documentation
//     the file needs, so a silent auto-answer is the wrong trade.
//   * Booleans are monotone: intake may flip false → true, never true → false.
//     /va-loans and /first-time-buyer pre-set these, and un-setting them would
//     drop the borrower off the VA path.
//
// Adopting a saved DRAFT is a different question with a different answer — one
// explicit consent-gated decision point (#249, see useDraftRestore.ts). Gap-
// filling blanks needs no banner precisely because it cannot destroy anything.
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CREDIT_SCORE_BAND_VALUES } from "@shared/preApprovalForm";
import type { PreApprovalFormData } from "@shared/schema";
/** The subset of `GET /api/coach/intake/latest` the funnel can consume. */
export interface CoachIntake {
  annualIncome?: string;
  monthlyDebts?: string;
  creditScore?: string;
  employmentType?: string;
  employmentYears?: string;
  downPayment?: string;
  purchasePrice?: string;
  propertyType?: string;
  loanPurpose?: string;
  isVeteran?: boolean;
  isFirstTimeBuyer?: boolean;
}

/** Currency/number-ish fields arrive as free text from the coach transcript. */
const CURRENCY_FIELDS = [
  "annualIncome",
  "monthlyDebts",
  "downPayment",
  "purchasePrice",
] as const satisfies readonly (keyof PreApprovalFormData)[];

/** Numeric bands the borrower can be placed into; "not_sure" is never derived. */
const NUMERIC_CREDIT_BANDS = CREDIT_SCORE_BAND_VALUES.filter((v) => v !== "not_sure");

/** How far a coach-reported score may sit from a band before we decline to guess. */
const CREDIT_BAND_TOLERANCE = 30;

/** Blank means "the borrower has not answered this yet" — nothing else. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** Map a free-text score ("about 715", "715") onto the funnel's bands. */
export function toCreditBand(raw: string): string | undefined {
  const score = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(score)) return undefined;
  return NUMERIC_CREDIT_BANDS.find(
    (band) => Math.abs(parseInt(band, 10) - score) <= CREDIT_BAND_TOLERANCE,
  );
}

/**
 * The patch intake is allowed to apply to `current`.
 *
 * Pure and form-free so the rule is testable on its own. Returns ONLY keys
 * whose current value is blank — an empty object means "intake has nothing to
 * add", which is the common case and the one that must stay a no-op.
 */
export function gapFillFromCoachIntake(
  current: PreApprovalFormData,
  intake: CoachIntake | null | undefined,
): Partial<PreApprovalFormData> {
  if (!intake) return {};
  const patch: Partial<PreApprovalFormData> = {};

  for (const field of CURRENCY_FIELDS) {
    const incoming = intake[field];
    if (!incoming || !isBlank(current[field])) continue;
    const cleaned = incoming.replace(/[^0-9.]/g, "");
    if (cleaned) patch[field] = cleaned;
  }

  if (intake.employmentYears && isBlank(current.employmentYears)) {
    const years = intake.employmentYears.replace(/[^0-9]/g, "");
    if (years) patch.employmentYears = years;
  }

  if (intake.creditScore && isBlank(current.creditScore)) {
    const band = toCreditBand(intake.creditScore);
    if (band) patch.creditScore = band;
  }

  // Monotone: only ever raises a flag the borrower has not already raised.
  if (intake.isVeteran === true && current.isVeteran !== true) {
    patch.isVeteran = true;
  }
  if (intake.isFirstTimeBuyer === true && current.isFirstTimeBuyer !== true) {
    patch.isFirstTimeBuyer = true;
  }

  return patch;
}

/**
 * Apply the coach gap-fill to a live funnel form, at most once per mount.
 *
 * Takes the intake instead of fetching it — the page already owns that query,
 * and passing the data in keeps the rule testable without a QueryClient (same
 * shape as useActiveApplication).
 *
 * Stays armed until it actually writes something, so intake that resolves late
 * (or only after the borrower talks to the coach in another tab) still lands.
 * That is safe now only because the patch is computed against the form's
 * CURRENT values at apply time: whatever the borrower has answered by then is
 * no longer blank, so it cannot be part of the patch.
 *
 * Writes field-by-field with `setValue` rather than `form.reset`, so the fill
 * neither clears the borrower's dirty state nor disturbs untouched fields.
 */
export function useCoachPrefill(
  form: UseFormReturn<PreApprovalFormData>,
  intake: CoachIntake | null | undefined,
): void {
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current || !intake) return;
    const patch = gapFillFromCoachIntake(form.getValues(), intake);
    const fields = Object.keys(patch) as (keyof PreApprovalFormData)[];
    if (fields.length === 0) return;
    for (const field of fields) {
      form.setValue(field, patch[field] as never);
    }
    appliedRef.current = true;
  }, [intake, form]);
}
