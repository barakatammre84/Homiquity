// ---------------------------------------------------------------------------
// Platform closing-cost model — the ONE fee schedule behind the TRID Loan
// Estimate (services/loanEstimate.ts) and the LO-2 what-if scenario simulator
// (services/scenarioSimulator.ts). Extracted from generateLoanEstimate so a
// scenario's cash-to-close is the same number the Loan Estimate would show for
// the same inputs — two surfaces, one schedule.
//
// services/apr.ts's advertised-rate model mirrors the origination /
// application / underwriting / tax-service constants for marketing surfaces;
// change them together.
//
// Pure and side-effect free: prepaid interest takes a day count (the LE
// derives it from its estimated closing date; the simulator uses the same
// 15-day assumption as the advertised-fee model) so callers stay
// deterministic.
//
// COMPENSATION IS A REQUIRED INPUT (12 CFR §1026.36(d)(2)). A loan originator
// may not be paid by the consumer and by another person on the same
// transaction, so the borrower-paid origination fee is not a constant — it is
// a function of how the originator is paid. Under a lender-paid plan it is
// ZERO, and the compensation the lender pays is reported separately (it is not
// a charge to the borrower and does not appear in the borrower's cost totals,
// but it does count toward the QM points-and-fees cap — see
// shared/compliance/loCompensation.ts).
//
// There is deliberately no default: a missing compensation model must stop the
// Loan Estimate, because assuming one is exactly the §1026.36(d)(2) mistake.
// ---------------------------------------------------------------------------

import {
  borrowerPaidOriginationAllowed,
  compensationAmount,
  evaluatePointsAndFeesFloor,
  type CompensationModel,
  type OriginatorCompensation,
  type QmFloorEvaluation,
} from "@shared/compliance/loCompensation";
import { resolveFeeAmount, type ActualFeeMap } from "@shared/compliance/feeProvenance";

/** Borrower-paid origination fee as a fraction of the loan amount. */
export const ORIGINATION_FEE_RATE = 0.01;
/**
 * Flat platform fees. Exported because the QM points-and-fees floor
 * (services/mismoValidation.ts) must score the same numbers the Loan Estimate
 * discloses — two surfaces, one schedule.
 */
export const PLATFORM_APPLICATION_FEE = 500;
export const PLATFORM_UNDERWRITING_FEE = 1500;
export const PLATFORM_TAX_SERVICE_FEE = 100;

/**
 * The platform's own pricing policy for one file.
 *
 * Every function below takes this as a PARAMETER rather than reading a global,
 * which is what lets the schedule become admin-editable without any of this
 * module losing its purity: the caller resolves the active schedule (see
 * services/platformFeeSchedule.ts) and passes it in, and the same inputs still
 * produce the same outputs forever. That matters because a Loan Estimate must
 * stay reproducible from the schedule it was priced under.
 */
export interface PlatformFeeSchedule {
  applicationFee: number;
  underwritingFee: number;
  taxServiceFee: number;
  /** Borrower-paid origination as a FRACTION of the loan amount (0.01 = 1%). */
  originationFeeRate: number;
}

/**
 * The compiled-in baseline, used whenever no schedule has been published.
 *
 * This is deliberately the single source of the default: migration 0047 seeds
 * NO row, so an empty `platform_fee_schedules` table means "use this". Seeding
 * the constants into the table as well would fork the baseline in two places
 * and let them drift.
 */
export const DEFAULT_PLATFORM_FEE_SCHEDULE: PlatformFeeSchedule = {
  applicationFee: PLATFORM_APPLICATION_FEE,
  underwritingFee: PLATFORM_UNDERWRITING_FEE,
  taxServiceFee: PLATFORM_TAX_SERVICE_FEE,
  originationFeeRate: ORIGINATION_FEE_RATE,
};

/**
 * Prepaid finance charges the platform can determine WITHOUT a closing date —
 * its own origination-side charges (§1026.4). Deliberately excludes prepaid
 * interest and prepaid MI, which need a closing date and a rate.
 *
 * Used to derive a Regulation Z Total Loan Amount before closing
 * (services/mismoValidation.ts). Because it UNDER-counts the true prepaid
 * finance charges, the total loan amount it yields is an upper bound on the
 * true one — so the QM percentage cap computed from it stays slightly
 * permissive, but is strictly tighter than standing in the note amount.
 * Never the reverse.
 */
/**
 * The platform's OWN charges that are finance charges under §1026.4 — the one
 * list, so the same charge cannot be counted in one Reg Z computation and
 * forgotten in another (audit F-19).
 *
 * Two computations read this and must never diverge:
 *   - `knownPrepaidFinanceCharges()` subtracts them to derive the Regulation Z
 *     Total Loan Amount, which SHRINKS the QM cap (the denominator);
 *   - `pointsAndFeesFloor()` counts them against that cap (the numerator).
 *
 * §1026.32(b)(1)(i) draws points and fees from the finance charge, so
 * membership in this list is a single classification decision that lands in
 * both places at once. Before F-19 the tax service fee was in the first and
 * not the second: the same $100 tightened the cap without being charged
 * against it.
 *
 * ⚠️ WHICH charges belong here is NOT verified against §1026.4 — the ledger
 * entry `regz-1026-4-platform-finance-charge-classification` records exactly
 * that, on a short review interval. What IS now guaranteed is that the answer
 * is applied consistently: change a charge's membership here and both
 * computations move together.
 */
export interface PlatformFinanceCharge {
  id: "application" | "underwriting" | "tax_service";
  name: string;
  amount: number;
  /**
   * True when this is OUR revenue and we can therefore charge less of it.
   *
   * The tax service fee is a vendor's charge passed through — we cannot
   * discount somebody else's fee, so it is not reducible. That asymmetry is
   * what makes the F-17 fit honest rather than a fiction.
   */
  reducible: boolean;
}

export function platformFinanceCharges(
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): PlatformFinanceCharge[] {
  return [
    { id: "application", name: "Application fee", amount: schedule.applicationFee, reducible: true },
    { id: "underwriting", name: "Underwriting fee", amount: schedule.underwritingFee, reducible: true },
    { id: "tax_service", name: "Tax service fee", amount: schedule.taxServiceFee, reducible: false },
  ];
}

/** Sum of the platform's own prepaid finance charges under a schedule. */
export function platformFinanceChargeTotal(
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): number {
  return platformFinanceCharges(schedule).reduce((sum, charge) => sum + charge.amount, 0);
}

/** The baseline schedule's charges/total — the compiled-in default. */
export const PLATFORM_FINANCE_CHARGES: readonly PlatformFinanceCharge[] = platformFinanceCharges();
export const PLATFORM_FINANCE_CHARGE_TOTAL = platformFinanceChargeTotal();

export function knownPrepaidFinanceCharges(
  originationFee: number,
  points = 0,
  platformTotal: number = PLATFORM_FINANCE_CHARGE_TOTAL,
): number {
  return originationFee + points + platformTotal;
}

// ---------------------------------------------------------------------------
// QM points-and-fees floor, scored off THIS fee schedule
// ---------------------------------------------------------------------------
// Two surfaces ask "does this structure blow the QM cap?": the
// submission-readiness check (services/mismoValidation.ts) and the
// compensation election (routes/lending/pricing.ts). They must score the same
// numbers, for the same reason the fee constants above are exported — two
// surfaces, one schedule. So the basis lives here, once, next to the schedule
// it is derived from.
//
// Note the ordering this enables, which is the whole point (audit F-18): the
// election is the moment the QM outcome is DECIDED and the only moment it is
// still free to change — it freezes at Loan Estimate issuance. Evaluating the
// floor only at submission ran the check after its own remedy had expired.
// ---------------------------------------------------------------------------

/**
 * Regulation Z Total Loan Amount (§1026.32(b)(4)) stand-in — the note amount
 * less the prepaid finance charges the platform can determine before closing.
 *
 * Under-counts the true prepaid finance charges (prepaid interest and prepaid
 * MI need a closing date and a rate), so the figure is an UPPER bound on the
 * true Total Loan Amount and the cap derived from it stays slightly permissive
 * — but strictly tighter than standing in the note amount, never looser.
 *
 * `compensation` may be null: the borrower-paid origination fee is a function
 * of the compensation model, and with no election there is no origination fee
 * to subtract.
 */
export function regulationZTotalLoanAmountStandIn(
  loanAmount: number,
  compensation: OriginatorCompensation | null,
  platformTotal: number = PLATFORM_FINANCE_CHARGE_TOTAL,
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): number {
  const originationFee =
    compensation && borrowerPaidOriginationAllowed(compensation.model)
      ? loanAmount * schedule.originationFeeRate
      : 0;
  return Math.max(0, loanAmount - knownPrepaidFinanceCharges(originationFee, 0, platformTotal));
}

/**
 * Evaluate the QM points-and-fees floor for one file against the platform's
 * own fee schedule.
 *
 * Returns the three-valued verdict from shared/compliance/loCompensation.ts —
 * `over_cap` is definitive (the true figure exceeds the cap too), while
 * `not_cleared` is NOT a pass, only "the floor fits and the complete figure is
 * still unknown".
 */
export function evaluatePlatformQmFloor(
  noteDate: Date | string,
  loanAmount: number,
  compensation: OriginatorCompensation,
  charges: readonly { name: string; amount: number }[] = PLATFORM_FINANCE_CHARGES,
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): QmFloorEvaluation {
  const originationFee = borrowerPaidOriginationAllowed(compensation.model)
    ? loanAmount * schedule.originationFeeRate
    : 0;
  const platformTotal = charges.reduce((sum, c) => sum + c.amount, 0);
  return evaluatePointsAndFeesFloor(
    noteDate,
    loanAmount,
    // Same total on both sides — a reduced fee schedule shrinks the numerator
    // AND raises the cap, and F-19's invariant has to survive the reduction.
    regulationZTotalLoanAmountStandIn(loanAmount, compensation, platformTotal, schedule),
    {
      loanAmount,
      originationFee,
      points: 0,
      platformFinanceCharges: charges,
      compensation,
    },
  );
}

// ---------------------------------------------------------------------------
// F-17 resolution: the platform's own fees fit the QM cap, by construction
// ---------------------------------------------------------------------------
// The dead band existed because a FIXED fee met a cap that is proportional in
// the tiers that matter. Any fixed number is wrong at some loan size, so no
// choice of number resolves this — only removing the fixedness does.
//
// So the schedule below is a CEILING, not a price: a file is charged the
// standard schedule whenever it fits, and the reducible part is trimmed to fit
// when it does not. Charging less is always permitted, needs no changed
// circumstance, and is the borrower-favourable direction — so this is safe in
// exactly the direction that matters.
//
// What it does NOT do is manufacture room that isn't there. The tax service
// fee is a vendor's charge we cannot discount, and originator compensation is
// set by the comp plan, not per file. When those two alone exceed the cap the
// file is still not originable, and the gate still refuses it (see F-17's
// residual note in the audit log).
// ---------------------------------------------------------------------------

/** The part of the platform schedule that cannot be reduced (vendor charges). */
export function platformNonReducibleTotal(
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): number {
  return platformFinanceCharges(schedule)
    .filter(c => !c.reducible)
    .reduce((sum, c) => sum + c.amount, 0);
}

export const PLATFORM_NON_REDUCIBLE_TOTAL = platformNonReducibleTotal();

/**
 * The largest platform finance-charge total that does not put this file over
 * the QM cap — never more than the standard schedule.
 *
 * Null when even charging nothing fails: compensation alone has exhausted the
 * cap, and no fee decision rescues the file.
 *
 * Monotone in the total (a bigger fee raises the floor AND lowers the cap), so
 * a binary search finds the exact edge without duplicating the tier tables.
 */
export function maxPlatformFinanceChargeTotal(
  noteDate: Date | string,
  loanAmount: number,
  compensation: OriginatorCompensation,
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): number | null {
  const fits = (total: number) =>
    evaluatePlatformQmFloor(
      noteDate,
      loanAmount,
      compensation,
      [{ name: "Platform charges", amount: total }],
      schedule,
    ).verdict !== "over_cap";

  if (!fits(0)) return null;
  const scheduleTotal = platformFinanceChargeTotal(schedule);
  const standard = Math.floor(scheduleTotal);
  if (fits(standard)) return scheduleTotal;

  let low = 0;
  let high = standard;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  return low;
}

export interface ResolvedPlatformCharges {
  /** What to actually charge, id-for-id with PLATFORM_FINANCE_CHARGES. */
  charges: PlatformFinanceCharge[];
  total: number;
  standardTotal: number;
  /** True when the standard schedule was trimmed to fit the cap. */
  reduced: boolean;
  /**
   * False when no fee decision makes this file QM-eligible — compensation, or
   * compensation plus the non-reducible vendor charges, already exceeds the
   * cap. The submission gates still refuse these.
   */
  originable: boolean;
}

/**
 * The platform's own charges for one file, trimmed to fit the QM cap.
 *
 * Reduces only what is ours to reduce, proportionally across the reducible
 * charges so each still appears on the Loan Estimate under its own name, and
 * rounds DOWN to whole dollars so rounding can never push a file back over.
 */
export function resolvePlatformFinanceCharges(
  noteDate: Date | string,
  loanAmount: number,
  compensation: OriginatorCompensation,
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): ResolvedPlatformCharges {
  const standardTotal = platformFinanceChargeTotal(schedule);
  const standard = () => platformFinanceCharges(schedule);
  const budget = maxPlatformFinanceChargeTotal(noteDate, loanAmount, compensation, schedule);

  // No table for the note year, or compensation alone is over the cap: charge
  // the standard schedule and let the gate speak. Trimming a fee cannot fix a
  // compensation problem, and pretending otherwise would hide it.
  if (budget === null) {
    return { charges: standard(), total: standardTotal, standardTotal, reduced: false, originable: false };
  }
  if (budget >= standardTotal) {
    return { charges: standard(), total: standardTotal, standardTotal, reduced: false, originable: true };
  }

  const reducibleBudget = budget - platformNonReducibleTotal(schedule);
  if (reducibleBudget < 0) {
    // The vendor pass-throughs alone break the cap. Nothing of ours is left to
    // give, so this is not a fee problem either.
    return { charges: standard(), total: standardTotal, standardTotal, reduced: false, originable: false };
  }

  const reducibleStandard = standardTotal - platformNonReducibleTotal(schedule);
  const scale = reducibleStandard > 0 ? reducibleBudget / reducibleStandard : 0;
  const charges = platformFinanceCharges(schedule).map(charge =>
    charge.reducible
      ? { ...charge, amount: Math.floor(charge.amount * scale) }
      : { ...charge },
  );

  return {
    charges,
    total: charges.reduce((sum, c) => sum + c.amount, 0),
    standardTotal,
    reduced: true,
    originable: true,
  };
}

/**
 * Note date to score the QM thresholds against, before a note exists.
 *
 * The §1026.43(e) dollar amounts are adjusted annually and the tables are
 * selected by NOTE DATE, so pre-closing the scheduled closing date stands in,
 * and today's date stands in for that. Delivery re-checks against the real
 * note date. Shared so every surface picks the same table.
 */
export function estimatedNoteDate(closingDate: string | Date | null | undefined): Date {
  if (!closingDate) return new Date();
  const parsed = typeof closingDate === "string" ? new Date(closingDate) : closingDate;
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Score a file's QM points-and-fees floor **as it would actually be charged** —
 * i.e. after the schedule trims to fit (F-17).
 *
 * This is what the gates must use. `evaluatePlatformQmFloor` above is the
 * primitive that scores a GIVEN set of charges; this one applies the fee policy
 * first, so a file that is originable at a trimmed fee is no longer refused for
 * a fee we were never going to charge it.
 */
export function evaluateFileQmFloor(
  noteDate: Date | string,
  loanAmount: number,
  compensation: OriginatorCompensation,
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): QmFloorEvaluation {
  const resolved = resolvePlatformFinanceCharges(noteDate, loanAmount, compensation, schedule);
  return evaluatePlatformQmFloor(noteDate, loanAmount, compensation, resolved.charges, schedule);
}

/** Upper bound on an electable compensation rate; mirrors the election schema. */
export const MAX_ELECTABLE_COMPENSATION_BPS = 1000;

/**
 * The highest whole-basis-point compensation rate that does NOT put this file
 * definitively over the QM cap on the platform's own charges alone.
 *
 * Returns null when even 0 bps is over the cap — i.e. the fixed platform fees
 * exhaust the entire cap at this loan amount, so no compensation rate rescues
 * the file and the fee schedule (or the loan amount) is the thing that has to
 * move. That is audit F-17, surfaced per-file.
 *
 * Deliberately named "electable" and not "safe": clearing the floor is
 * `not_cleared`, never a pass, so this is the ceiling on what may be elected,
 * not a guarantee the delivered figure will fit.
 *
 * The floor is non-decreasing in bps (the cap does not move with it — the Reg Z
 * stand-in depends on the model, not the rate), so the first rate that is not
 * over cap, scanning down, is the highest such rate.
 */
export function maxElectableCompensationBps(
  noteDate: Date | string,
  loanAmount: number,
  model: CompensationModel,
  schedule: PlatformFeeSchedule = DEFAULT_PLATFORM_FEE_SCHEDULE,
): number | null {
  for (let bps = MAX_ELECTABLE_COMPENSATION_BPS; bps >= 0; bps--) {
    // Scored against what this file would ACTUALLY be charged — the schedule
    // trims to fit (F-17), so the ceiling must reflect that rather than
    // pretending the full standard fee always applies.
    if (resolvePlatformFinanceCharges(noteDate, loanAmount, { model, bps }, schedule).originable) {
      return bps;
    }
  }
  return null;
}

export interface ClosingCostInputs {
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  /** Note rate, %. */
  interestRate: number;
  /** Monthly MI premium ($/month; 0 when none applies) — private PMI or FHA MIP. */
  monthlyPMI: number;
  /**
   * Up-front (single-premium) mortgage insurance collected in cash at closing
   * — FHA UFMIP today (services/mortgageInsurance.ts offerUpfrontMI). Defaults
   * to 0. Rides the prepaids "Mortgage Insurance Premium" line alongside the
   * periodic months, counts as a §1026.4 prepaid finance charge (the posture
   * services/apr.ts has always taken for it), and is NOT escrowed — the escrow
   * cushion is periodic-only.
   */
  upfrontMortgageInsurance?: number;
  /** Days of prepaid interest collected at closing. */
  prepaidInterestDays: number;
  /**
   * How the loan originator is paid on this transaction. Required — see the
   * header. Determines whether the borrower is charged an origination fee.
   */
  compensation: OriginatorCompensation;
  /**
   * Real, known third-party charges for THIS file (the AMC's appraisal quote,
   * the title company's figure) keyed by the fee ids in
   * shared/compliance/feeProvenance.ts. Any fee present here is disclosed at
   * its actual amount instead of the platform estimate.
   *
   * This is the practical half of the F-9 fix: the fee constants below are
   * unverified national figures sitting in a zero-tolerance bucket, and the
   * appraisal is the largest single variance on a file. Disclosing the real
   * number when it is known removes the cure rather than measuring it.
   */
  actualFees?: ActualFeeMap;
  /** Annual property taxes; defaults to the platform 1.2%-of-price model. */
  annualPropertyTaxes?: number;
  /** Annual homeowner's insurance; defaults to max($1,200, 0.3% of price). */
  annualHomeownersInsurance?: number;
  /** Lender credits (e.g. the FTHB LLPA waiver), subtracted from cash to close. */
  lenderCredits?: number;
  /**
   * Expected note date, which selects the QM threshold table the platform's
   * own fees are fitted against (F-17). Defaults to today; the Loan Estimate
   * passes its estimated closing date.
   */
  noteDate?: string | Date | null;
  /**
   * The platform's own pricing policy for this file. Defaults to the compiled
   * baseline; callers that price a real file resolve the ACTIVE published
   * schedule (services/platformFeeSchedule.ts) and pass it, so re-pricing
   * never needs a deploy.
   */
  feeSchedule?: PlatformFeeSchedule;
}

export interface ClosingCostStructure {
  /** Borrower-paid origination fee. Always 0 under a lender-paid plan. */
  originationFee: number;
  /**
   * Compensation the wholesale lender pays the originator. NOT a borrower
   * charge — excluded from every borrower-facing total below, and excluded
   * from the Loan Estimate (which has no "paid by others" column; that column
   * exists only on the Closing Disclosure). Carried here because the QM
   * points-and-fees cap counts it.
   */
  lenderPaidCompensation: number;
  points: number;
  applicationFee: number;
  underwritingFee: number;
  appraisalFee: number;
  creditReportFee: number;
  floodDeterminationFee: number;
  taxServiceFee: number;
  titleInsurance: number;
  titleSearch: number;
  surveyFee: number;
  pestInspectionFee: number;
  recordingFees: number;
  transferTaxes: number;
  ownersTitleInsurance: number;

  annualPropertyTax: number;
  annualHomeownersInsurance: number;
  monthlyPropertyTax: number;
  monthlyHomeownersInsurance: number;
  monthlyEscrow: number;

  prepaidInterest: number;
  prepaidHomeownersInsurance: number;
  prepaidMortgageInsurance: number;
  prepaidPropertyTaxes: number;
  escrowHomeownersInsurance: number;
  escrowMortgageInsurance: number;
  escrowPropertyTaxes: number;

  loanCostsTotal: number;
  otherCostsTotal: number;
  totalClosingCosts: number;
  /** Prepaid finance charges per §1026.4 — the APR solver's fee input. */
  prepaidFinanceCharges: number;
  /**
   * How the platform's own fees were resolved against the QM cap (F-17).
   * `reduced` means this file was charged less than the standard schedule so
   * that it could be originated at all; `originable: false` means no fee
   * decision saves it and the submission gates will still refuse.
   */
  platformFees: {
    total: number;
    standardTotal: number;
    reduced: boolean;
    originable: boolean;
  };
  lenderCredits: number;
  cashToClose: number;
}

export interface EscrowEstimateInputs {
  purchasePrice: number;
  /** Annual property taxes; defaults to the platform 1.2%-of-price model. */
  annualPropertyTaxes?: number;
  /** Annual homeowner's insurance; defaults to max($1,200, 0.3% of price). */
  annualHomeownersInsurance?: number;
}

export interface MonthlyEscrowEstimate {
  annualPropertyTax: number;
  monthlyPropertyTax: number;
  annualHomeownersInsurance: number;
  monthlyHomeownersInsurance: number;
  monthlyEscrow: number;
}

/**
 * Platform escrow model — property tax at 1.2%/yr of price, homeowner's
 * insurance at max($1,200, 0.3%/yr of price). Extracted VERBATIM from
 * computeClosingCosts (no formula change) so the decision engine's internal
 * payment projection (services/loanEstimate.ts computePaymentProjection) and
 * the Loan Estimate price the SAME escrow from one source. Pure, and reads no
 * fee or compensation input — a monthly escrow is independent of how the
 * originator is paid.
 */
export function estimateMonthlyEscrow(input: EscrowEstimateInputs): MonthlyEscrowEstimate {
  const annualPropertyTax = input.annualPropertyTaxes ?? input.purchasePrice * 0.012;
  const monthlyPropertyTax = annualPropertyTax / 12;
  const annualHomeownersInsurance =
    input.annualHomeownersInsurance ?? Math.max(1200, input.purchasePrice * 0.003);
  const monthlyHomeownersInsurance = annualHomeownersInsurance / 12;
  return {
    annualPropertyTax,
    monthlyPropertyTax,
    annualHomeownersInsurance,
    monthlyHomeownersInsurance,
    monthlyEscrow: monthlyPropertyTax + monthlyHomeownersInsurance,
  };
}

// calculatePMI — the compile-time FICO×LTV BPMI card — lived here until the
// F-077 migration completed. It exceeded the versioned CONVENTIONAL_PMI matrix
// in every live cell (1.42×–2.17×); the LE/decision path (services/
// loanEstimate.ts) and the what-if simulator (services/scenarioSimulator.ts)
// both price the matrix via calculateLLPA now, so the card is deleted per its
// own docstring. Never reintroduce a compile-time MI rate table — MI resolves
// from the CONVENTIONAL_PMI matrix (loud failure on a missing band) or the
// product-aware helper (services/mortgageInsurance.ts).

export function computeClosingCosts(input: ClosingCostInputs): ClosingCostStructure {
  const { purchasePrice, downPayment, loanAmount, interestRate, monthlyPMI, compensation } = input;

  if (!compensation) {
    throw new Error(
      "Originator compensation model is required to compute closing costs (12 CFR 1026.36(d)(2))",
    );
  }

  const {
    annualPropertyTax,
    monthlyPropertyTax,
    annualHomeownersInsurance,
    monthlyHomeownersInsurance,
    monthlyEscrow,
  } = estimateMonthlyEscrow(input);

  // §1026.36(d)(2): charge the borrower an origination fee ONLY when the
  // originator takes compensation from nobody else on this transaction.
  const schedule = input.feeSchedule ?? DEFAULT_PLATFORM_FEE_SCHEDULE;
  const originationFee = borrowerPaidOriginationAllowed(compensation.model)
    ? loanAmount * schedule.originationFeeRate
    : 0;
  const lenderPaidCompensation =
    compensation.model === "lender_paid" ? compensationAmount(loanAmount, compensation) : 0;
  const points = 0;
  // F-17: the platform's own fees are a ceiling, not a fixed price — they trim
  // to fit the QM points-and-fees cap when a loan size would otherwise put our
  // own charges over it. Charging less needs no changed circumstance and is
  // the borrower-favourable direction.
  const resolvedPlatform = resolvePlatformFinanceCharges(
    estimatedNoteDate(input.noteDate),
    loanAmount,
    compensation,
    schedule,
  );
  const platformCharge = (id: PlatformFinanceCharge["id"]) =>
    resolvedPlatform.charges.find(c => c.id === id)?.amount ?? 0;
  const applicationFee = platformCharge("application");
  const underwritingFee = platformCharge("underwriting");
  // Third-party charges. Every constant below is an UNVERIFIED national
  // working figure with no citation — provenance and the known-suspect entries
  // are catalogued in shared/compliance/feeProvenance.ts (audit F-9). A file
  // with a real quote recorded discloses that instead.
  const actuals = input.actualFees ?? {};
  const fee = (id: string, estimate: number) => resolveFeeAmount(id, estimate, actuals);

  const appraisalFee = fee("appraisal", 650);
  const creditReportFee = fee("credit_report", 75);
  const floodDeterminationFee = fee("flood_determination", 25);
  const taxServiceFee = fee("tax_service", platformCharge("tax_service"));
  const titleInsurance = fee("title_insurance", loanAmount * 0.005);
  const titleSearch = fee("title_search", 350);
  const surveyFee = fee("survey_fee", 450);
  const pestInspectionFee = fee("pest_inspection", 150);
  const recordingFees = fee("recording_fees", 150);
  // SUSPECT (F-9): a single national percentage applied to an Illinois-only
  // footprint, where transfer tax is levied at state, county AND municipal
  // level. Zero-tolerance, so an understatement is a dollar-for-dollar cure.
  const transferTaxes = fee("transfer_taxes", purchasePrice * 0.001);

  const dailyInterest = (loanAmount * (interestRate / 100)) / 365;
  const prepaidInterest = dailyInterest * input.prepaidInterestDays;
  const prepaidHomeownersInsurance = annualHomeownersInsurance;
  // Two months of the periodic premium, plus any up-front single premium
  // (FHA UFMIP) — one prepaids line, per the input's doc comment.
  const upfrontMortgageInsurance = input.upfrontMortgageInsurance ?? 0;
  const prepaidMortgageInsurance = monthlyPMI * 2 + upfrontMortgageInsurance;
  const prepaidPropertyTaxes = monthlyPropertyTax * 2;

  const escrowHomeownersInsurance = monthlyHomeownersInsurance * 3;
  const escrowMortgageInsurance = monthlyPMI * 2;
  const escrowPropertyTaxes = monthlyPropertyTax * 3;

  const ownersTitleInsurance = purchasePrice * 0.003;

  const loanCostsTotal = originationFee + points + applicationFee + underwritingFee +
    appraisalFee + creditReportFee + floodDeterminationFee + taxServiceFee +
    titleInsurance + titleSearch + surveyFee + pestInspectionFee;

  const otherCostsTotal = recordingFees + transferTaxes +
    prepaidHomeownersInsurance + prepaidMortgageInsurance + prepaidInterest + prepaidPropertyTaxes +
    escrowHomeownersInsurance + escrowMortgageInsurance + escrowPropertyTaxes +
    ownersTitleInsurance;

  const totalClosingCosts = loanCostsTotal + otherCostsTotal;

  // Prepaid finance charges per §1026.4: origination, points, application/
  // underwriting fees, tax service, prepaid interest, and prepaid MI (which
  // includes any up-front FHA MIP — services/apr.ts has always classified
  // UFMIP as a prepaid finance charge on the advertised surface).
  // Appraisal, credit report, title, survey, pest, and recording/transfer
  // charges are excluded (§1026.4(c)(7), (e)).
  //
  // OPEN ITEM — lender-paid compensation and the APR. §1026.4(a)(3) governs
  // whether a fee payable to a mortgage broker is a finance charge when the
  // creditor rather than the consumer pays it. That text could not be
  // verified when this was written (ledger: regz-1026-36d2-dual-compensation),
  // so `lenderPaidCompensation` is deliberately NOT added here — the APR math
  // is unchanged from its previously-verified state rather than altered on an
  // unverified reading. Resolve before the first real lender-paid file.
  const prepaidFinanceCharges =
    originationFee + points + applicationFee + underwritingFee + taxServiceFee +
    prepaidInterest + prepaidMortgageInsurance;

  const lenderCredits = input.lenderCredits ?? 0;
  const cashToClose = totalClosingCosts + downPayment - lenderCredits;

  return {
    originationFee,
    lenderPaidCompensation,
    points,
    applicationFee,
    underwritingFee,
    appraisalFee,
    creditReportFee,
    floodDeterminationFee,
    taxServiceFee,
    titleInsurance,
    titleSearch,
    surveyFee,
    pestInspectionFee,
    recordingFees,
    transferTaxes,
    ownersTitleInsurance,

    annualPropertyTax,
    annualHomeownersInsurance,
    monthlyPropertyTax,
    monthlyHomeownersInsurance,
    monthlyEscrow,

    prepaidInterest,
    prepaidHomeownersInsurance,
    prepaidMortgageInsurance,
    prepaidPropertyTaxes,
    escrowHomeownersInsurance,
    escrowMortgageInsurance,
    escrowPropertyTaxes,

    loanCostsTotal,
    otherCostsTotal,
    totalClosingCosts,
    prepaidFinanceCharges,
    platformFees: {
      total: resolvedPlatform.total,
      standardTotal: resolvedPlatform.standardTotal,
      reduced: resolvedPlatform.reduced,
      originable: resolvedPlatform.originable,
    },
    lenderCredits,
    cashToClose,
  };
}
