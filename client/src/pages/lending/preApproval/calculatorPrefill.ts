// Calculator gap-fill for the pre-approval funnel.
//
// The affordability and rent-to-own calculators collect the same figures the
// funnel asks for, so a borrower who tuned them shouldn't have to retype them.
// GAP-FILL is the whole contract, identical to coachPrefill.ts: the handoff may
// fill a field the borrower has left BLANK, and may never replace an answer
// that already exists. That is what makes it safe to run with no banner — it
// cannot destroy anything.
//
// WHY THIS IS A MODULE AND NOT SIX LINES IN THE PAGE
//
// This used to be an inline effect in PreApproval.tsx reading `JSON.parse(raw)`
// as `any`, and it hand-rolled its own credit-score mapping:
//
//     const bucket = score >= 740 ? "excellent" : score >= 700 ? "good"
//                  : score >= 660 ? "fair" : "poor";
//     form.setValue("creditScore", bucket);
//
// Those four words are the LEADS vocabulary (`leads.selfReportedCreditRange`,
// server/routes/leads.ts) and the calculator tier ids — not the funnel's. The
// funnel's `creditScore` accepts exactly CREDIT_SCORE_BAND_VALUES:
// "760" | "720" | "680" | "640" | "600" | "not_sure" (shared/schema/lendingUrla.ts).
// So every borrower arriving from a calculator got a value matching no option:
//
//   1. the credit step rendered with NOTHING selected — the prefill bought them
//      nothing, which is the failure everyone assumed was the whole story;
//   2. no per-step gate covers that step (preApprovalMachine.ts `stepGate` has
//      cases for downPayment, incomeSources and final only), so they walked
//      past it and hit `preApprovalFormSchema.safeParse` at the FINAL step —
//      bounced with "Please select a valid credit score range" *after*
//      authorizing the FCRA soft pull, at the most expensive moment in the
//      funnel;
//   3. worst of the three: `"fair"` is non-empty, so it counted as answered.
//      coachPrefill's gap-fill tests blankness and nothing else, so the one
//      channel that DOES know the band vocabulary was locked out of repairing
//      the field. A wrong value did not just fail to help — it displaced a
//      correct one.
//
// WHY NOT coachPrefill's `toCreditBand`
//
// It was the obvious reuse and it is the wrong tool, because the two channels
// carry different qualities of input. `toCreditBand` matches a free-text score
// from a chat transcript ("about 715") against each band's LABEL VALUE within
// ±30, and declines when nothing is close — correct there: you should not place
// someone from a fuzzy transcript reading.
//
// A calculator slider is not fuzzy. It is an exact figure the borrower set on
// purpose, on a 580–850 track, and the funnel's bands are RANGES with open ends
// ("760+" at the top, "Under 640" at the bottom) rather than points. Running
// exact values through a tolerance matcher gets both ends wrong:
//
//   * 791–850 matches no band at all — the top 22% of the slider, and the
//     strongest applicants, silently get no credit prefill;
//   * 631–639 lands on "640" because it is within 30 of it, placing a borrower
//     who is under 640 into the 640–679 band. Overstating a self-reported band
//     is worse than dropping it: it feeds the affordability teaser and the
//     pricing the borrower is shown.
//
// So this channel maps by range, and derives the thresholds from
// CREDIT_SCORE_BAND_VALUES rather than restating them — adding a band to the
// funnel updates this automatically. The two channels share the VOCABULARY,
// which is what actually has to agree; the matcher is rightly per-channel.
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CREDIT_SCORE_BAND_VALUES, type PreApprovalFormData } from "@shared/schema";
import { readCalculatorPrefill, type CalculatorPrefill } from "@/lib/calculatorPrefill";

/** Figures that map straight onto a funnel currency field. */
const CURRENCY_FIELDS = [
  "annualIncome",
  "monthlyDebts",
  "downPayment",
  "purchasePrice",
] as const satisfies readonly (keyof PreApprovalFormData)[];

/** Blank means "the borrower has not answered this yet" — nothing else. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * The funnel's numeric bands as LOWER BOUNDS, highest first. Each band value is
 * the floor of its range ("720" is 720–759); the lowest is an open-ended floor
 * ("600" is labelled "Under 640"). "not_sure" is a borrower's own answer and is
 * never derived from a figure.
 */
const BAND_FLOORS = CREDIT_SCORE_BAND_VALUES.filter((v) => v !== "not_sure")
  .map((v) => ({ value: v, floor: parseInt(v, 10) }))
  .sort((a, b) => b.floor - a.floor);

/**
 * Place an exact score into a funnel band. TOTAL over every finite score — the
 * top band is open above and the bottom band is open below, so there is no
 * "declined to guess" case and no borrower falls through.
 */
export function bandForExactScore(score: number): string | undefined {
  if (!Number.isFinite(score)) return undefined;
  const matched = BAND_FLOORS.find((band) => score >= band.floor);
  return (matched ?? BAND_FLOORS[BAND_FLOORS.length - 1])?.value;
}

/**
 * The patch a calculator handoff is allowed to apply to `current`.
 *
 * Pure and form-free so the rule is testable on its own. Returns ONLY keys
 * whose current value is blank — an empty object means "the handoff has nothing
 * to add", which must stay a no-op.
 *
 * `creditScore` goes through `bandForExactScore`, which is total — every finite
 * score lands in a band the funnel offers. The only value this can ever write
 * is a member of CREDIT_SCORE_BAND_VALUES; writing anything else is the defect
 * this module was extracted to fix.
 *
 * Note the calculators' credit slider carries a real default (680) that the
 * borrower may never have moved. Carrying it over is still honest: it is the
 * figure displayed on screen as the basis of the results they just chose to act
 * on, it stays `self_reported` provenance either way, and the funnel presents
 * it as an editable estimate ("An estimate is fine"). What must not happen is
 * the field arriving *unanswerable*, which is what it did before.
 */
export function gapFillFromCalculatorPrefill(
  current: PreApprovalFormData,
  prefill: CalculatorPrefill | null | undefined,
): Partial<PreApprovalFormData> {
  if (!prefill) return {};
  const patch: Partial<PreApprovalFormData> = {};

  for (const field of CURRENCY_FIELDS) {
    const incoming = prefill[field];
    if (incoming === undefined || !isBlank(current[field])) continue;
    patch[field] = String(incoming);
  }

  if (prefill.creditScore !== undefined && isBlank(current.creditScore)) {
    const band = bandForExactScore(prefill.creditScore);
    if (band) patch.creditScore = band;
  }

  return patch;
}

/**
 * Apply the calculator handoff to a live funnel form, once per mount.
 *
 * Consumes the stash on the first pass whether or not it yields a patch, so a
 * payload can never be applied twice or leak into a later visit — that is
 * `readCalculatorPrefill`'s read-and-clear contract, and the reason this hook
 * does not stay armed the way `useCoachPrefill` does (coach intake arrives over
 * the network and may resolve late; this is already in the tab at mount).
 *
 * Writes field-by-field with `setValue` rather than `form.reset`, so the fill
 * neither clears the borrower's dirty state nor disturbs untouched fields.
 *
 * MUST run before `useCoachPrefill`. Both fill only blanks, so whichever lands
 * first wins the field; the calculator figures are the ones the borrower was
 * just looking at, so they are the better answer when both channels have one.
 */
export function useCalculatorPrefill(form: UseFormReturn<PreApprovalFormData>): void {
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;

    const patch = gapFillFromCalculatorPrefill(form.getValues(), readCalculatorPrefill());
    for (const field of Object.keys(patch) as (keyof PreApprovalFormData)[]) {
      form.setValue(field, patch[field] as never);
    }
  }, [form]);
}
