// ---------------------------------------------------------------------------
// Where every disclosed fee came from.
//
// The closing-cost model hardcodes fifteen constants with no citation, no
// state awareness and no provenance — in a repository that otherwise enforces
// "no citation, no implementation" for policy scalars. Four of them land in
// the TRID ZERO-tolerance bucket, so every dollar of error is a cure the
// originator pays out of its own compensation.
//
// The defect is not that the numbers are wrong (some are fine). It is that
// nothing distinguishes a number somebody verified from a number somebody
// guessed, so nobody can tell which disclosed figures are safe. This module
// makes that answerable, and gives a file a way to disclose the ACTUAL quote
// once it is known.
//
// Three provenance tiers, most reliable first:
//
//   actual            a real quote or invoice for THIS file. Disclose this.
//   cited             a published schedule (statute, fee table) with a source.
//   platform_estimate a national working figure. Honest, and a cure risk.
//
// ---------------------------------------------------------------------------
// STATE OF THE DATA (2026-08-04) — READ BEFORE TRUSTING ANY VALUE HERE
// ---------------------------------------------------------------------------
// Every entry below is `platform_estimate`. NONE has been upgraded to `cited`,
// because the sources needed to do it could not be reached: this environment's
// network policy blocked ilga.gov, tax.illinois.gov and chicago.gov (as it
// blocked every federal regulatory host), and no Illinois fee schedule exists
// under docs/.
//
// So this module deliberately does NOT introduce new statutory numbers. It
// carries the EXISTING constants forward unchanged, labels them as the
// estimates they always were, and creates the slot a cited value drops into.
// Populating that slot is a human task — see ledger entry
// `platform-closing-cost-fee-schedule`.
//
// The transfer-tax entry is called out specifically: 0.1% of the purchase
// price is a single national constant applied to an Illinois-only footprint,
// and Illinois levies transfer tax at state, county AND municipal level (the
// Chicago municipal rate in particular is not small). It is flagged
// `suspectedInaccurate` so it cannot be mistaken for a checked figure.
// ---------------------------------------------------------------------------

import type { ToleranceBucket } from "./feeTolerance";

export const FEE_PROVENANCE_TIERS = ["actual", "cited", "platform_estimate"] as const;
export type FeeProvenanceTier = (typeof FEE_PROVENANCE_TIERS)[number];

export interface FeeProvenance {
  tier: FeeProvenanceTier;
  /** Where a `cited` value came from. Required for that tier, else null. */
  citation?: string | null;
  sourceUrl?: string | null;
  /**
   * True when there is positive reason to think the value is wrong for the
   * licensed footprint. Distinct from "unverified" — this is a known smell.
   */
  suspectedInaccurate?: boolean;
  note?: string;
}

export interface FeeDefinition {
  /** Matches the fee ids in feeTolerance.ts so the two line up. */
  id: string;
  label: string;
  bucket: ToleranceBucket;
  provenance: FeeProvenance;
}

const ESTIMATE = (note: string): FeeProvenance => ({
  tier: "platform_estimate",
  citation: null,
  sourceUrl: null,
  note,
});

/**
 * Provenance for every third-party charge the platform discloses. Platform
 * charges (origination, application, underwriting) are excluded — those are
 * our own prices, not estimates of somebody else's.
 */
export const THIRD_PARTY_FEE_DEFINITIONS: readonly FeeDefinition[] = [
  {
    id: "appraisal",
    label: "Appraisal fee",
    bucket: "zero",
    provenance: ESTIMATE(
      "Flat national working figure. Plausible for a conforming SFR; complex, rural and 2-4 unit " +
        "assignments run materially higher, and the difference is a zero-tolerance cure. Replace " +
        "with the AMC's actual quote via a per-file actual before the Loan Estimate issues.",
    ),
  },
  { id: "credit_report", label: "Credit report fee", bucket: "zero", provenance: ESTIMATE("Flat national working figure; the real cost is the bureau invoice.") },
  { id: "flood_determination", label: "Flood determination fee", bucket: "zero", provenance: ESTIMATE("Flat national working figure.") },
  { id: "tax_service", label: "Tax service fee", bucket: "zero", provenance: ESTIMATE("Flat national working figure.") },
  { id: "title_insurance", label: "Lender's title insurance", bucket: "zero", provenance: ESTIMATE("Percentage of loan amount; real premiums come from the title underwriter's filed rate schedule, which varies by state.") },
  { id: "title_search", label: "Title search", bucket: "zero", provenance: ESTIMATE("Flat national working figure.") },
  { id: "survey_fee", label: "Survey fee", bucket: "zero", provenance: ESTIMATE("Flat national working figure.") },
  { id: "pest_inspection", label: "Pest inspection", bucket: "zero", provenance: ESTIMATE("Flat national working figure.") },
  { id: "recording_fees", label: "Recording fees", bucket: "ten_percent", provenance: ESTIMATE("Flat national working figure; recording fees are set by the county recorder.") },
  {
    id: "transfer_taxes",
    label: "Transfer taxes",
    bucket: "zero",
    provenance: {
      tier: "platform_estimate",
      citation: null,
      sourceUrl: null,
      suspectedInaccurate: true,
      note:
        "A single national percentage of the purchase price, applied to an Illinois-only footprint. " +
        "Illinois levies real-estate transfer tax at state, county AND municipal level, and the " +
        "municipal component (Chicago in particular) is not small. This needs a cited " +
        "state/county/municipal table verified against current statute — it is a zero-tolerance " +
        "charge, so an understatement is a dollar-for-dollar cure. Do not treat the current value " +
        "as checked.",
    },
  },
];

const BY_ID = new Map(THIRD_PARTY_FEE_DEFINITIONS.map(f => [f.id, f]));

export function feeProvenance(feeId: string): FeeProvenance | null {
  return BY_ID.get(feeId)?.provenance ?? null;
}

/** Fees carrying a known accuracy smell — the ones to fix first. */
export function suspectFees(): FeeDefinition[] {
  return THIRD_PARTY_FEE_DEFINITIONS.filter(f => f.provenance.suspectedInaccurate === true);
}

/** Third-party fees still resting on an unverified estimate. */
export function unverifiedFees(): FeeDefinition[] {
  return THIRD_PARTY_FEE_DEFINITIONS.filter(f => f.provenance.tier === "platform_estimate");
}

// ---------------------------------------------------------------------------
// Per-file actuals
// ---------------------------------------------------------------------------

/**
 * A real, known charge for one file — the AMC's appraisal quote, the title
 * company's figure. Overrides the estimate at disclosure time.
 *
 * This is the highest-value half of the fix: the appraisal alone is the
 * largest single zero-tolerance variance on a file, and it is usually KNOWN
 * before the Loan Estimate has to go out. Disclosing the real number instead
 * of a national average removes the cure rather than measuring it.
 */
export interface ActualFee {
  feeId: string;
  amount: number;
  /** Who quoted it — the AMC, title company, or county. */
  source: string;
  recordedAt: string;
}

export type ActualFeeMap = Record<string, number>;

/** Index a file's recorded actuals for lookup during fee computation. */
export function toActualFeeMap(actuals: readonly ActualFee[] | null | undefined): ActualFeeMap {
  const map: ActualFeeMap = {};
  for (const actual of actuals ?? []) {
    if (!BY_ID.has(actual.feeId)) continue; // ignore unknown ids rather than disclosing them
    if (!Number.isFinite(actual.amount) || actual.amount < 0) continue;
    map[actual.feeId] = actual.amount;
  }
  return map;
}

/**
 * The amount to disclose for a fee: the file's actual when one is recorded,
 * otherwise the platform estimate. Pure.
 */
export function resolveFeeAmount(feeId: string, estimate: number, actuals: ActualFeeMap): number {
  const actual = actuals[feeId];
  return actual === undefined ? estimate : actual;
}

/** Provenance tier actually used for a fee on a given file. */
export function resolvedProvenanceTier(feeId: string, actuals: ActualFeeMap): FeeProvenanceTier {
  if (actuals[feeId] !== undefined) return "actual";
  return feeProvenance(feeId)?.tier ?? "platform_estimate";
}

export interface FeeProvenanceReport {
  /** Fees disclosed from a real quote for this file. */
  actualCount: number;
  /** Fees still disclosed from an unverified national estimate. */
  estimateCount: number;
  /** Estimated fees in the zero-tolerance bucket — the cure-risk surface. */
  zeroToleranceEstimateCount: number;
  /** Fees with a known accuracy problem still unresolved on this file. */
  suspectFeeIds: string[];
  message: string;
}

/**
 * How much of a file's third-party disclosure rests on guesses? Answers the
 * question the audit actually asked: which of these numbers is safe?
 */
export function reportFeeProvenance(actuals: ActualFeeMap): FeeProvenanceReport {
  let actualCount = 0;
  let estimateCount = 0;
  let zeroToleranceEstimateCount = 0;
  const suspectFeeIds: string[] = [];

  for (const fee of THIRD_PARTY_FEE_DEFINITIONS) {
    if (actuals[fee.id] !== undefined) {
      actualCount += 1;
      continue;
    }
    estimateCount += 1;
    if (fee.bucket === "zero") zeroToleranceEstimateCount += 1;
    if (fee.provenance.suspectedInaccurate) suspectFeeIds.push(fee.id);
  }

  return {
    actualCount,
    estimateCount,
    zeroToleranceEstimateCount,
    suspectFeeIds,
    message:
      `${actualCount} of ${THIRD_PARTY_FEE_DEFINITIONS.length} third-party charges are disclosed from a ` +
      `real quote; ${estimateCount} rest on unverified estimates, ${zeroToleranceEstimateCount} of them ` +
      `in the zero-tolerance bucket where any increase is a cure` +
      (suspectFeeIds.length > 0 ? ` (known-suspect: ${suspectFeeIds.join(", ")})` : "") + ".",
  };
}
