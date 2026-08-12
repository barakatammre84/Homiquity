// ---------------------------------------------------------------------------
// TRID good-faith fee tolerance — 12 CFR §1026.19(e)(3).
//
// An estimate disclosed on a Loan Estimate is made "in good faith" only if the
// charge actually paid does not exceed it, subject to three tiers:
//
//   (e)(3)(i)   ZERO tolerance — no increase permitted. Charges paid to the
//               creditor / loan originator / an affiliate, charges for
//               services the consumer cannot shop for, and transfer taxes.
//   (e)(3)(ii)  TEN PERCENT cumulative — recording fees, and services the
//               consumer CAN shop for where the consumer picks a provider on
//               the creditor's written list. Measured on the SUM, not per line.
//   (e)(3)(iii) NO tolerance (good faith only) — prepaid interest, property
//               insurance premiums, escrow deposits, and services the consumer
//               shopped for off-list.
//
// An increase beyond a tier's limit is a cure the originator pays, plus the
// §1026.19(f)(2)(v) 60-day post-consummation refund obligation. Baselines
// reset ONLY on a valid changed circumstance (§1026.19(e)(3)(iv)) — which is
// why this module's verdict is expressed in terms of "is a change of
// circumstance on file", not "is the number bigger".
//
// ---------------------------------------------------------------------------
// WHAT IS AND IS NOT VERIFIED
// ---------------------------------------------------------------------------
// The tier STRUCTURE above is standard TRID and is mirrored by the Loan
// Estimate section layout this codebase already builds (services/loanEstimate.ts
// Sections A/B/C and Other Costs). The verbatim §1026.19(e)(3) text could not
// be fetched when this module was written — network policy blocked every
// regulatory host — so two classification choices are called out explicitly:
//
//   1. Services the consumer can shop for (LE Section C) are classified ZERO
//      tolerance here, not ten-percent. The ten-percent tier applies only when
//      the consumer picks a provider from the creditor's written list of
//      providers (§1026.19(e)(1)(vi)). This platform has no written-list
//      feature at all, so no consumer can satisfy that condition, and the
//      stricter tier is the correct AND conservative reading.
//   2. Transfer taxes are ZERO tolerance; recording fees are TEN PERCENT.
//      They are separate lines in the LE's "Taxes and Other Government Fees"
//      section for exactly this reason.
//
// Both choices err toward flagging more, never less. This module raises a
// redisclosure gate; it does not compute a legal cure amount. Confirm the tier
// composition (ledger: trid-1026-19e3-fee-tolerance) before any figure here is
// used to pay or decline a cure.
// ---------------------------------------------------------------------------

export const TOLERANCE_BUCKETS = ["zero", "ten_percent", "none"] as const;
export type ToleranceBucket = (typeof TOLERANCE_BUCKETS)[number];

export const TOLERANCE_BUCKET_LABELS: Record<ToleranceBucket, string> = {
  zero: "Zero tolerance (§1026.19(e)(3)(i))",
  ten_percent: "10% cumulative (§1026.19(e)(3)(ii))",
  none: "Good faith, no numeric tolerance (§1026.19(e)(3)(iii))",
};

/** One disclosed charge, with the tier it is measured under. */
export interface DisclosedFee {
  /** Stable key — the diff pairs baseline and revised lines by this. */
  id: string;
  label: string;
  amount: number;
  bucket: ToleranceBucket;
}

/**
 * The subset of a Loan Estimate that tolerance is measured against. Deliberately
 * not the whole LE: only the charges, plus the loan terms that determine
 * whether two disclosures are even comparable.
 */
export interface DisclosureSnapshot {
  loanAmount: number;
  interestRate: number;
  fees: DisclosedFee[];
}

/** LE fee lines → tolerance-bucketed snapshot. The single classification point. */
export function buildDisclosureSnapshot(input: {
  loanAmount: number;
  interestRate: number;
  originationCharges: { points: number; applicationFee: number; underwritingFee: number; originationFee: number };
  servicesYouCannotShopFor: { appraisal: number; creditReport: number; floodDetermination: number; taxService: number };
  servicesYouCanShopFor: { titleInsurance: number; titleSearch: number; surveyFee: number; pestInspection: number };
  taxesAndGovernmentFees: { recordingFees: number; transferTaxes: number };
  prepaids: { homeownersInsurance: number; mortgageInsurance: number; prepaidInterest: number; propertyTaxes: number };
  initialEscrow: { homeownersInsurance: number; mortgageInsurance: number; propertyTaxes: number };
  otherItems: { ownersTitleInsurance: number };
}): DisclosureSnapshot {
  const fees: DisclosedFee[] = [
    // Section A — paid to the creditor / loan originator. Zero tolerance.
    { id: "origination_fee", label: "Origination fee", amount: input.originationCharges.originationFee, bucket: "zero" },
    { id: "points", label: "Discount points", amount: input.originationCharges.points, bucket: "zero" },
    { id: "application_fee", label: "Application fee", amount: input.originationCharges.applicationFee, bucket: "zero" },
    { id: "underwriting_fee", label: "Underwriting fee", amount: input.originationCharges.underwritingFee, bucket: "zero" },

    // Section B — services the consumer cannot shop for. Zero tolerance.
    { id: "appraisal", label: "Appraisal fee", amount: input.servicesYouCannotShopFor.appraisal, bucket: "zero" },
    { id: "credit_report", label: "Credit report fee", amount: input.servicesYouCannotShopFor.creditReport, bucket: "zero" },
    { id: "flood_determination", label: "Flood determination fee", amount: input.servicesYouCannotShopFor.floodDetermination, bucket: "zero" },
    { id: "tax_service", label: "Tax service fee", amount: input.servicesYouCannotShopFor.taxService, bucket: "zero" },

    // Section C — see the header: zero tolerance because no written provider
    // list exists, so the ten-percent condition can never be satisfied.
    { id: "title_insurance", label: "Lender's title insurance", amount: input.servicesYouCanShopFor.titleInsurance, bucket: "zero" },
    { id: "title_search", label: "Title search", amount: input.servicesYouCanShopFor.titleSearch, bucket: "zero" },
    { id: "survey_fee", label: "Survey fee", amount: input.servicesYouCanShopFor.surveyFee, bucket: "zero" },
    { id: "pest_inspection", label: "Pest inspection", amount: input.servicesYouCanShopFor.pestInspection, bucket: "zero" },

    // Taxes and government fees — transfer taxes zero, recording ten percent.
    { id: "transfer_taxes", label: "Transfer taxes", amount: input.taxesAndGovernmentFees.transferTaxes, bucket: "zero" },
    { id: "recording_fees", label: "Recording fees", amount: input.taxesAndGovernmentFees.recordingFees, bucket: "ten_percent" },

    // Prepaids and escrows — good faith only.
    { id: "prepaid_interest", label: "Prepaid interest", amount: input.prepaids.prepaidInterest, bucket: "none" },
    { id: "prepaid_hoi", label: "Prepaid homeowner's insurance", amount: input.prepaids.homeownersInsurance, bucket: "none" },
    { id: "prepaid_mi", label: "Prepaid mortgage insurance", amount: input.prepaids.mortgageInsurance, bucket: "none" },
    { id: "prepaid_taxes", label: "Prepaid property taxes", amount: input.prepaids.propertyTaxes, bucket: "none" },
    { id: "escrow_hoi", label: "Escrow — homeowner's insurance", amount: input.initialEscrow.homeownersInsurance, bucket: "none" },
    { id: "escrow_mi", label: "Escrow — mortgage insurance", amount: input.initialEscrow.mortgageInsurance, bucket: "none" },
    { id: "escrow_taxes", label: "Escrow — property taxes", amount: input.initialEscrow.propertyTaxes, bucket: "none" },
    { id: "owners_title", label: "Owner's title insurance", amount: input.otherItems.ownersTitleInsurance, bucket: "none" },
  ];

  return {
    loanAmount: round2(input.loanAmount),
    interestRate: input.interestRate,
    fees: fees.map(f => ({ ...f, amount: round2(f.amount) })),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function bucketTotal(snapshot: DisclosureSnapshot, bucket: ToleranceBucket): number {
  return round2(
    snapshot.fees.filter(f => f.bucket === bucket).reduce((sum, f) => sum + f.amount, 0),
  );
}

export interface FeeIncrease {
  id: string;
  label: string;
  bucket: ToleranceBucket;
  baselineAmount: number;
  revisedAmount: number;
  increase: number;
  /** Does a changed circumstance on file actually authorize THIS line? */
  authorized: boolean;
}

/**
 * The platform's own fixed fee lines — the ones set by the admin fee schedule
 * (routes/admin/pricingPolicy.ts) and charged as flat dollars.
 *
 * These can only move when the platform re-prices itself, and a creditor
 * re-pricing itself is not one of the six §1026.19(e)(3)(iv) reasons. So NO
 * changed circumstance may ever authorize an increase in them, however the
 * circumstance is scoped (audit FA-21).
 *
 * `origination_fee` is deliberately NOT in this set: it is a rate applied to
 * the loan amount, so a borrower-requested increase in loan size raises it
 * legitimately. Whether any given reason reaches it is the counsel question.
 */
export const PLATFORM_SCHEDULE_FEE_IDS: readonly string[] = [
  "application_fee",
  "underwriting_fee",
  "tax_service",
];

/**
 * What a change-of-circumstance record on the file actually authorizes.
 *
 * Replaces the bare boolean this module used to take. §1026.19(e)(3)(iv)
 * resets good faith only for the charges the circumstance AFFECTED, so a
 * yes/no answer let an unrelated record (a rate lock, say) justify every
 * increase on the file — including the platform's own fee hike — and reset the
 * baseline, erasing a cure that was genuinely owed (audit FA-21).
 */
export interface ToleranceAuthorization {
  /** Is there a valid §1026.19(e)(3)(iv) record open on this file at all? */
  hasChangeOfCircumstance: boolean;
  /**
   * The charge ids that record affects. `null`/omitted = UNSCOPED, which keeps
   * the historical behaviour (authorizes everything except
   * PLATFORM_SCHEDULE_FEE_IDS). Populating it per reason type is a regulatory
   * reading and a standing counsel item — see shared/compliance/changeOfCircumstance.ts.
   */
  affectedChargeIds?: readonly string[] | null;
}

/** Build an authorization from the open CoC record on a file, if any. */
export function authorizationFrom(
  coc: { affectedChargeIds?: string[] | null } | null | undefined,
): ToleranceAuthorization {
  if (!coc) return { hasChangeOfCircumstance: false, affectedChargeIds: null };
  return { hasChangeOfCircumstance: true, affectedChargeIds: coc.affectedChargeIds ?? null };
}

/** Does the authorization reach this specific charge? */
function authorizes(auth: ToleranceAuthorization, feeId: string): boolean {
  if (!auth.hasChangeOfCircumstance) return false;
  if (PLATFORM_SCHEDULE_FEE_IDS.includes(feeId)) return false;
  if (auth.affectedChargeIds === null || auth.affectedChargeIds === undefined) return true;
  return auth.affectedChargeIds.includes(feeId);
}

export type ToleranceVerdict =
  /** Nothing increased beyond its tier. No redisclosure needed. */
  | "within_tolerance"
  /** Increases exist and a change of circumstance is on file to justify them. */
  | "increase_justified"
  /** Increases exist with NO change of circumstance — this is a cure. */
  | "cure_required";

export interface ToleranceEvaluation {
  verdict: ToleranceVerdict;
  /** Every line that went up, regardless of tier. */
  increases: FeeIncrease[];
  /** Sum of ALL increases in the zero-tolerance tier, authorized or not. */
  zeroToleranceIncrease: number;
  /**
   * The zero-tolerance subset NOT authorized by a changed circumstance. This
   * is the part that is actually cured; `zeroToleranceIncrease` is the gross
   * figure kept for transparency.
   */
  unauthorizedZeroToleranceIncrease: number;
  /** Ten-percent tier: baseline sum, revised sum, and the allowance. */
  tenPercent: { baselineTotal: number; revisedTotal: number; allowed: number; excess: number };
  /** Total dollars that would have to be cured at closing. */
  cureAmount: number;
  message: string;
}

/**
 * Compare a revised disclosure against the baseline that was actually issued.
 *
 * `authorization` is the caller's answer to "is there a valid
 * §1026.19(e)(3)(iv) record on this file, and WHICH charges does it justify?".
 * This module does not decide that — the reason catalog and the 3-business-day
 * clock live in shared/compliance/changeOfCircumstance.ts. It does enforce the
 * one part that needs no interpretation: the platform's own fixed fees
 * (PLATFORM_SCHEDULE_FEE_IDS) are never authorized by any circumstance.
 */
export function evaluateTolerance(
  baseline: DisclosureSnapshot,
  revised: DisclosureSnapshot,
  authorization: ToleranceAuthorization,
): ToleranceEvaluation {
  const baselineById = new Map(baseline.fees.map(f => [f.id, f]));

  const increases: FeeIncrease[] = [];
  for (const fee of revised.fees) {
    const before = baselineById.get(fee.id);
    // A line absent from the baseline is treated as having been disclosed at
    // zero — a newly-appearing charge is an increase, not an exemption.
    const baselineAmount = before?.amount ?? 0;
    const increase = round2(fee.amount - baselineAmount);
    if (increase > 0) {
      increases.push({
        id: fee.id,
        label: fee.label,
        bucket: fee.bucket,
        baselineAmount,
        revisedAmount: fee.amount,
        increase,
        authorized: authorizes(authorization, fee.id),
      });
    }
  }

  const zeroIncreases = increases.filter(i => i.bucket === "zero");
  const zeroToleranceIncrease = round2(
    zeroIncreases.reduce((sum, i) => sum + i.increase, 0),
  );
  // Only the UNauthorized part is actually cured. An authorized line rides on
  // the changed circumstance and resets with the new baseline.
  const unauthorizedZeroToleranceIncrease = round2(
    zeroIncreases.filter(i => !i.authorized).reduce((sum, i) => sum + i.increase, 0),
  );

  // The ten-percent tier is cumulative: individual lines may rise freely as
  // long as the SUM stays within 110% of the baseline sum.
  const tenBaseline = bucketTotal(baseline, "ten_percent");
  const tenRevised = bucketTotal(revised, "ten_percent");
  const tenAllowed = round2(tenBaseline * 1.1);
  const tenExcess = round2(Math.max(0, tenRevised - tenAllowed));

  // The cumulative tier can only be justified as a whole — there is no
  // per-line excess to attribute — so it rides on the circumstance reaching at
  // least one ten-percent line that actually moved.
  const tenExcessAuthorized =
    tenExcess > 0 && increases.some(i => i.bucket === "ten_percent" && i.authorized);
  const unauthorizedTenExcess = tenExcessAuthorized ? 0 : tenExcess;

  const grossExposure = round2(zeroToleranceIncrease + tenExcess);
  const cureAmount = round2(unauthorizedZeroToleranceIncrease + unauthorizedTenExcess);

  const tenPercent = {
    baselineTotal: tenBaseline,
    revisedTotal: tenRevised,
    allowed: tenAllowed,
    excess: tenExcess,
  };

  if (grossExposure === 0) {
    return {
      verdict: "within_tolerance",
      increases,
      zeroToleranceIncrease,
      unauthorizedZeroToleranceIncrease,
      tenPercent,
      cureAmount: 0,
      message:
        increases.length === 0
          ? "No disclosed charge increased against the issued Loan Estimate."
          : "Charges changed, but nothing exceeded its tolerance tier.",
    };
  }

  // Every dollar of exposure is covered by the circumstance on file.
  if (cureAmount === 0) {
    return {
      verdict: "increase_justified",
      increases,
      zeroToleranceIncrease,
      unauthorizedZeroToleranceIncrease,
      tenPercent,
      cureAmount,
      message:
        `$${grossExposure.toFixed(2)} of increases are covered by a change of circumstance on file. ` +
        `Issue the revised Loan Estimate within 3 business days (§1026.19(e)(4)(i)) to reset the baseline.`,
    };
  }

  // Some or all of the exposure is unauthorized. Partial coverage still means
  // a cure: the uncovered lines never had a circumstance behind them.
  const unauthorizedLines = increases.filter(i => !i.authorized).map(i => i.label);
  return {
    verdict: "cure_required",
    increases,
    zeroToleranceIncrease,
    unauthorizedZeroToleranceIncrease,
    tenPercent,
    cureAmount,
    message:
      `$${cureAmount.toFixed(2)} of charges exceed what was disclosed with no change of circumstance ` +
      `authorizing them ($${unauthorizedZeroToleranceIncrease.toFixed(2)} zero-tolerance` +
      (unauthorizedTenExcess > 0
        ? `, $${unauthorizedTenExcess.toFixed(2)} over the 10% cumulative allowance`
        : "") +
      (authorization.hasChangeOfCircumstance
        ? `; a change of circumstance is on file but does not reach ${unauthorizedLines.join(", ")}`
        : "") +
      `). Absent a valid changed circumstance this is a good-faith cure owed at closing ` +
      `(§1026.19(f)(2)(v) requires refund within 60 days of consummation).`,
  };
}
