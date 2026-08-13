import type { ComputedOffer } from "./pricingAdapter";

// ---------------------------------------------------------------------------
// Anti-steering safe-harbor option set — Reg Z, 12 CFR §1026.36(e)(2)-(3).
// Verified verbatim against eCFR (API) 2026-07-11; ledger entry
// `regz-1026-36e3-option-set` in data/regulatory/regulatory-ledger.json.
//
// (e)(3)(i): for each type of transaction the consumer expressed interest in,
// the presented options must include:
//   (A) the loan with the lowest interest rate;
//   (B) the loan with the lowest interest rate WITHOUT negative amortization,
//       a prepayment penalty, interest-only payments, a balloon payment in
//       the first 7 years of the life of the loan, a demand feature, shared
//       equity, or shared appreciation;
//   (C) the loan with the lowest total dollar amount of discount points,
//       origination points or origination fees — ties broken by the lowest
//       interest rate among the tied loans.
// (e)(3)(ii): the originator must have a good-faith belief the options are
// loans the consumer likely qualifies for — satisfied structurally by the
// scenario simulator, which runs deterministic qualification on every offer
// it returns.
//
// Feature detection honesty: the rate-sheet catalog carries no prepayment-
// penalty / demand / shared-equity flags today, so the (B) leg derives risky
// features from amortizationType markers (IO / balloon / neg-am patterns).
// The simulated Target-5 catalog contains no such products; when the PPE
// contract lands, its adapter must map the real feature flags (ledger note).
//
// Deterministic: stable sort keys everywhere; ties beyond the regulation's
// own tie-break resolve by lender code + product code so the same offer set
// always yields the same option ids.
// ---------------------------------------------------------------------------

export type AntiSteeringOptionKey =
  | "lowest_rate"
  | "lowest_rate_no_risky_features"
  | "lowest_points_and_fees";

export interface AntiSteeringOption {
  key: AntiSteeringOptionKey;
  /** Stable offer identity within the evaluated set. */
  lenderId: string;
  productId: string;
  adjustedRate: number;
  /** Dollar total of discount points + origination-type lender fees. */
  pointsAndFeesDollars: number;
  /**
   * True only when this option came from an approved, non-demo counterparty.
   * An option the platform could not actually deliver is still shown — it is a
   * real quote off a real rate sheet — but a consumer must be able to tell.
   */
  lenderApproved: boolean;
}

export interface AntiSteeringOptionSet {
  citation: "12 CFR §1026.36(e)(2)-(3)";
  /**
   * Distinct **approved** creditors quoted — the (e)(3)(i) "significant
   * number" surface.
   *
   * (e)(3)(i) measures creditors "with which the originator regularly does
   * business". A lender at `target` has no broker agreement, and a seeded demo
   * row is not a company at all, so neither is a creditor we do business with
   * — regularly or otherwise. This counted every lender that produced an offer
   * until the 2026-08-07 audit (F-0807-01): with the three seeded demo lenders
   * it reported `creditorsQuoted: 3, singleCreditor: false`, which reads as a
   * shopped, plausibly-compliant option set when the true count is ZERO.
   */
  creditorsQuoted: number;
  /** Every distinct lender quoted, approved or not. Never the (e)(3)(i) number. */
  creditorsQuotedTotal: number;
  /**
   * True when NO approved creditor quoted — today's actual state, and strictly
   * worse than `singleCreditor`. The safe harbor cannot be available on an
   * option set containing no creditor the originator does business with.
   */
  noApprovedCreditors: boolean;
  options: AntiSteeringOption[];
  /**
   * True when a (B) candidate exists; false only if every offer carries a
   * risky feature (impossible in today's catalog, kept honest anyway).
   */
  hasNoRiskyFeatureOption: boolean;
  /**
   * True when every option came from ONE creditor.
   *
   * (e)(3)(i) requires options obtained from "a significant number of the
   * creditors with which the originator regularly does business", and the
   * safe harbor is not available without them. What counts as significant is
   * a counsel determination, so this flag deliberately asserts only the case
   * that needs no interpretation: a single creditor is not several, so an
   * option set built from one cannot satisfy the requirement however the
   * threshold is later drawn.
   *
   * Directly downstream of counterparty concentration (audit F-5): with one
   * approved wholesale lender, every option set the platform can produce is
   * single-creditor. Counted over APPROVED creditors only — see
   * `creditorsQuoted`.
   */
  singleCreditor: boolean;
}

/** Risky-feature markers per (e)(3)(i)(B), derivable from today's catalog. */
export function hasRiskyFeatures(offer: ComputedOffer): boolean {
  const amortization = (offer.amortizationType ?? "").toUpperCase();
  return (
    /\bIO\b|INTEREST[-_ ]?ONLY/.test(amortization) ||
    /BALLOON/.test(amortization) ||
    /NEG/.test(amortization)
  );
}

/**
 * Discount points + origination points/fees for one offer, in dollars.
 * Offers are currently priced at par (no discount points applied by
 * computeOffers), so the differentiator is the lender's origination-type
 * fees: `originationFee` plus any `other` fee whose name marks it as an
 * origination/discount/points charge. Platform-side fees are identical
 * across offers and cannot change the (C) argmin, so they are excluded.
 */
export function pointsAndFeesDollars(offer: ComputedOffer): number {
  const fees = offer.lenderFees as
    | { originationFee?: number; other?: { name: string; amount: number }[] }
    | null
    | undefined;
  let total = fees?.originationFee ?? 0;
  for (const fee of fees?.other ?? []) {
    if (/origination|discount|point/i.test(fee.name ?? "")) total += fee.amount ?? 0;
  }
  return total;
}

/** Stable lexicographic key for deterministic tie-breaks beyond the reg's own. */
function stableKey(offer: ComputedOffer): string {
  return `${offer.lenderCode}::${offer.productCode}::${offer.lockTerm}`;
}

function byRateThenFees(a: ComputedOffer, b: ComputedOffer): number {
  if (a.adjustedRate !== b.adjustedRate) return a.adjustedRate - b.adjustedRate;
  const feeDelta = pointsAndFeesDollars(a) - pointsAndFeesDollars(b);
  if (feeDelta !== 0) return feeDelta;
  return stableKey(a).localeCompare(stableKey(b));
}

/** (C) ordering: lowest fees; ties by lowest rate (the reg's tie-break); then stable. */
function byFeesThenRate(a: ComputedOffer, b: ComputedOffer): number {
  const feeDelta = pointsAndFeesDollars(a) - pointsAndFeesDollars(b);
  if (feeDelta !== 0) return feeDelta;
  if (a.adjustedRate !== b.adjustedRate) return a.adjustedRate - b.adjustedRate;
  return stableKey(a).localeCompare(stableKey(b));
}

function toOption(key: AntiSteeringOptionKey, offer: ComputedOffer): AntiSteeringOption {
  return {
    key,
    lenderId: offer.lenderId,
    productId: offer.productId,
    adjustedRate: offer.adjustedRate,
    pointsAndFeesDollars: pointsAndFeesDollars(offer),
    lenderApproved: offer.lenderApproved === true,
  };
}

/**
 * Derive the §1026.36(e)(3)(i) option set from an evaluated offer set.
 * Returns an empty option list for an empty offer set (the simulator reports
 * that state separately).
 */
export function deriveAntiSteeringOptions(offers: ComputedOffer[]): AntiSteeringOptionSet {
  // The sufficiency count is over APPROVED creditors; the total is reported
  // beside it so nothing is hidden, never in its place.
  const creditorsQuoted = new Set(
    offers.filter((o) => o.lenderApproved === true).map((o) => o.lenderId),
  ).size;
  const creditorsQuotedTotal = new Set(offers.map((o) => o.lenderId)).size;

  if (offers.length === 0) {
    return {
      citation: "12 CFR §1026.36(e)(2)-(3)",
      creditorsQuoted,
      creditorsQuotedTotal,
      noApprovedCreditors: true,
      options: [],
      hasNoRiskyFeatureOption: false,
      singleCreditor: false,
    };
  }

  const byRate = [...offers].sort(byRateThenFees);
  const lowestRate = byRate[0];

  const noRisky = byRate.filter((o) => !hasRiskyFeatures(o));
  const lowestRateNoRisky = noRisky[0] ?? null;

  const lowestFees = [...offers].sort(byFeesThenRate)[0];

  const options: AntiSteeringOption[] = [toOption("lowest_rate", lowestRate)];
  if (lowestRateNoRisky) {
    options.push(toOption("lowest_rate_no_risky_features", lowestRateNoRisky));
  }
  options.push(toOption("lowest_points_and_fees", lowestFees));

  return {
    citation: "12 CFR §1026.36(e)(2)-(3)",
    creditorsQuoted,
    creditorsQuotedTotal,
    noApprovedCreditors: creditorsQuoted === 0,
    options,
    hasNoRiskyFeatureOption: lowestRateNoRisky !== null,
    singleCreditor: creditorsQuoted <= 1,
  };
}
