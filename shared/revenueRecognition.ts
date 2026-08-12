// ---------------------------------------------------------------------------
// Revenue recognition — the second channel, and when either is earned.
//
// Revenue was modeled as lender compensation ONLY. The platform's own charges —
// application, underwriting, origination, points — were disclosed to the
// borrower, collected at closing, and represented as revenue nowhere. Three
// independent audits found it (F-0808-03, F-0809-02, F-0811-03), and the
// consequence is not a missing chart:
//
//   * 20–31.5% of a funded loan's revenue was invisible, and
//   * a BORROWER-PAID file reported a NEGATIVE margin — because under that
//     election the lender pays nothing, so the only channel the platform
//     counted was zero while its costs were real.
//
// RECOGNITION TRIGGER: the lender's remittance advice (owner decision,
// 2026-08-08 "recognize on receipt"; the receipt event named 2026-08-12).
// `lender_submissions.compensationReceivedAt` is that event — it is stamped
// when staff record what the lender actually paid. Nothing is recognized
// before it, on either channel.
//
// WHY ONE TRIGGER COVERS BOTH CHANNELS, AND WHERE THAT IS A SIMPLIFICATION:
// the platform's fees are collected through closing rather than wired by the
// lender, so in principle they are earned at closing and the remittance can
// lag. Recognizing both at the remittance advice is therefore CONSERVATIVE in
// timing — it never recognizes revenue earlier than it was received, only
// later. That is the safe direction, and it is stated here rather than hidden
// because a future receivable model (F-0809-03) will want to split them.
//
// THE TWO MODELS, AND WHY THERE IS NO DOUBLE COUNT:
//
//   lender_paid    Section A carries NO origination fee (F-1 zeroes it), and
//                  the compensation arrives as the lender's remittance.
//                  revenue = platform fees (application + underwriting + points)
//                          + lender remittance
//
//   borrower_paid  The compensation IS the origination fee on the Loan
//                  Estimate, so Section A already contains it, and the lender
//                  remits nothing.
//                  revenue = platform fees (including that origination fee)
//                          + 0
//
// Counting Section A therefore captures borrower-paid compensation exactly
// once, and the expected LENDER remittance under that election is zero — which
// is the other half of this file's job (F-0811-05: every borrower-paid file
// read as a lender short-pay).
//
// Pure and deterministic. Sources are the issued `loan_estimate_disclosures`
// snapshot (immutable, versioned) and the `lender_submissions` comp columns —
// never a recompute of today's fee schedule, which would re-price history.
// ---------------------------------------------------------------------------

import type { DisclosedFee } from "./compliance/feeTolerance";

/**
 * The disclosed Section A lines that are the PLATFORM's revenue.
 *
 * Section B/C charges (appraisal, credit report, flood, tax service, title) are
 * third-party pass-throughs — the borrower's money moving to a vendor, never
 * ours — so they are deliberately absent. Including them would restate vendor
 * spend as income.
 */
export const PLATFORM_REVENUE_FEE_IDS = [
  "origination_fee",
  "points",
  "application_fee",
  "underwriting_fee",
] as const;

const PLATFORM_FEE_ID_SET: ReadonlySet<string> = new Set(PLATFORM_REVENUE_FEE_IDS);

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Platform-fee revenue disclosed on an issued Loan Estimate. */
export function platformFeeRevenue(fees: DisclosedFee[] | null | undefined): number {
  if (!fees) return 0;
  return round2(
    fees
      .filter(f => PLATFORM_FEE_ID_SET.has(f.id))
      .reduce((sum, f) => sum + (Number.isFinite(f.amount) ? f.amount : 0), 0),
  );
}

/**
 * What the LENDER is expected to remit on this file.
 *
 * Under a borrower-paid election the answer is **zero** — the originator is
 * compensated by the consumer, so there is no lender remittance to expect and
 * a zero receipt is `as_expected`, not a short-pay. The snapshotted
 * `compensationExpectedAmount` is the amount of compensation on the file
 * whichever way it is paid; this function is the lender-side half of it.
 */
export function expectedLenderRemittance(input: {
  compensationModel?: string | null;
  compensationExpectedAmount?: number | string | null;
}): number | null {
  if (input.compensationModel === "borrower_paid") return 0;
  return numberOrNull(input.compensationExpectedAmount);
}

export interface RecognizedRevenue {
  /** True once the lender's remittance advice has been recorded. */
  recognized: boolean;
  /** Platform fees earned on this file — 0 until recognized. */
  platformFees: number;
  /** Lender compensation actually remitted — 0 until recognized. */
  lenderCompensation: number;
  /** Both channels. The number that belongs in a margin figure. */
  total: number;
  /**
   * Disclosed platform fees on a file whose remittance has NOT arrived. Real
   * revenue, not yet recognized — reported so the pipeline is visible without
   * being counted as earned.
   */
  unrecognizedPlatformFees: number;
  /**
   * True when the file funded but no issued Loan Estimate was found, so the
   * platform-fee channel could not be sourced. Distinct from "zero fees": an
   * unknown must never be summed as nothing without being counted.
   */
  platformFeesUnknown: boolean;
}

export interface RevenueRecognitionInput {
  status: string;
  compensationModel?: string | null;
  compensationReceivedAmount?: number | string | null;
  /** The remittance advice — the recognition trigger. */
  compensationReceivedAt?: Date | string | null;
  /** Fee lines from the file's issued LE disclosure, or null if none exists. */
  disclosedFees?: DisclosedFee[] | null;
  /** True while the lender leg is the deterministic simulation (F-0812-02). */
  simulated?: boolean | null;
}

/**
 * Recognize one funded file's revenue across both channels.
 *
 * Simulated submissions recognize NOTHING: no lender wired the remittance, so
 * the trigger did not really occur, and the platform fees were never collected
 * either. This mirrors `costLedger`'s treatment of simulated spend.
 */
export function recognizeRevenue(input: RevenueRecognitionInput): RecognizedRevenue {
  const disclosed = platformFeeRevenue(input.disclosedFees);
  const platformFeesUnknown = input.status === "funded" && !input.disclosedFees;

  const remittanceArrived =
    !input.simulated &&
    input.status === "funded" &&
    (input.compensationReceivedAt !== null && input.compensationReceivedAt !== undefined);

  if (!remittanceArrived) {
    return {
      recognized: false,
      platformFees: 0,
      lenderCompensation: 0,
      total: 0,
      unrecognizedPlatformFees: input.simulated ? 0 : disclosed,
      platformFeesUnknown,
    };
  }

  const lenderCompensation = round2(numberOrNull(input.compensationReceivedAmount) ?? 0);
  return {
    recognized: true,
    platformFees: disclosed,
    lenderCompensation,
    total: round2(disclosed + lenderCompensation),
    unrecognizedPlatformFees: 0,
    platformFeesUnknown,
  };
}
