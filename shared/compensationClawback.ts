// ---------------------------------------------------------------------------
// Early-payoff (EPO) compensation clawback exposure.
//
// Every wholesale broker agreement contains an early-payoff clause: if the
// loan pays off within a stated window after funding, the lender reclaims the
// compensation it paid the broker — usually all of it. Early-payment-default
// (EPD) provisions sit alongside it.
//
// This was represented nowhere: a grep for "EPO", "clawback", "early payoff",
// "repurchase", "surety" and "net worth" across server/, shared/ and the
// knowledge base returned nothing. For an asset-light broker the contingent
// liabilities ARE the balance sheet, and this is the largest of them —
// 200-275 bps of every funded loan, live for months after the money arrives.
//
// Two things follow from modeling it, and the second is the one that matters:
//
//   1. The exposure becomes a number somebody can reserve against.
//   2. The platform stops attacking its own book. lifecycleEngine.ts raises a
//      refi alert whenever market rates sit 25 bps below a homeowner's rate.
//      Pointed at a loan we funded six weeks ago, that feature solicits the
//      exact early payoff that triggers our own clawback — we would pay the
//      lender back our entire commission for the privilege of originating a
//      refinance. `isWithinClawbackWindow` is the guard.
// ---------------------------------------------------------------------------

import { getWholesaleLender } from "./wholesaleLenders";

/**
 * PLATFORM ASSUMPTION — not a regulatory value and not a contracted one.
 *
 * Used only for lenders whose `epoClawbackDays` is unset, which today is all
 * of them because no broker agreement has been executed. 180 days is the
 * common wholesale EPO period; the real number comes from each signed
 * agreement and MUST replace this per lender.
 *
 * Every exposure computed from this constant is flagged `windowSource:
 * "assumed"` so a reserve figure can never silently rest on it.
 * Ledger: `platform-epo-clawback-window`.
 */
export const DEFAULT_EPO_CLAWBACK_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ClawbackWindowSource = "contracted" | "assumed";

export interface ClawbackWindow {
  days: number;
  source: ClawbackWindowSource;
}

/** The EPO window for a lender, and whether it came from an agreement. */
export function clawbackWindowFor(lenderId: string): ClawbackWindow {
  const lender = getWholesaleLender(lenderId);
  const contracted = lender?.epoClawbackDays;
  if (typeof contracted === "number" && Number.isFinite(contracted) && contracted > 0) {
    return { days: contracted, source: "contracted" };
  }
  return { days: DEFAULT_EPO_CLAWBACK_DAYS, source: "assumed" };
}

export interface ClawbackExposureInput {
  lenderId: string;
  fundedAt: Date | string | null | undefined;
  /** Compensation actually received — the amount a lender would reclaim. */
  compensationReceivedAmount: number | string | null | undefined;
}

export interface ClawbackExposure {
  /** True while an early payoff would trigger a clawback. */
  atRisk: boolean;
  /** Dollars the lender could reclaim. 0 when not at risk or unknown. */
  amountAtRisk: number;
  window: ClawbackWindow;
  expiresAt: Date | null;
  daysRemaining: number | null;
  /**
   * True when the loan is funded but we cannot tell what is at risk — no
   * remittance recorded. Distinct from "not at risk": it is an unknown, and
   * unknowns must not be summed into a reserve as zero without being counted.
   */
  indeterminate: boolean;
  message: string;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function evaluateClawbackExposure(
  input: ClawbackExposureInput,
  now: Date = new Date(),
): ClawbackExposure {
  const window = clawbackWindowFor(input.lenderId);
  const fundedAt = toDate(input.fundedAt);

  if (!fundedAt) {
    return {
      atRisk: false,
      amountAtRisk: 0,
      window,
      expiresAt: null,
      daysRemaining: null,
      indeterminate: false,
      message: "Not funded — no compensation has been paid, so nothing can be reclaimed.",
    };
  }

  const expiresAt = new Date(fundedAt.getTime() + window.days * DAY_MS);
  const msRemaining = expiresAt.getTime() - now.getTime();
  const inWindow = msRemaining > 0;
  const daysRemaining = inWindow ? Math.ceil(msRemaining / DAY_MS) : 0;

  if (!inWindow) {
    return {
      atRisk: false,
      amountAtRisk: 0,
      window,
      expiresAt,
      daysRemaining: 0,
      indeterminate: false,
      message: `Clawback window closed ${expiresAt.toISOString().split("T")[0]}; compensation is earned.`,
    };
  }

  const received = toNumber(input.compensationReceivedAmount);
  if (received === null) {
    return {
      atRisk: true,
      amountAtRisk: 0,
      window,
      expiresAt,
      daysRemaining,
      indeterminate: true,
      message:
        `Inside the ${window.days}-day clawback window (${daysRemaining} days remaining) but no ` +
        `remittance is recorded, so the amount at risk is unknown.`,
    };
  }

  return {
    atRisk: true,
    amountAtRisk: round2(received),
    window,
    expiresAt,
    daysRemaining,
    indeterminate: false,
    message:
      `$${round2(received).toFixed(2)} is reclaimable for another ${daysRemaining} days ` +
      `(${window.days}-day ${window.source} EPO window, expires ${expiresAt.toISOString().split("T")[0]}).`,
  };
}

/**
 * Is this loan still inside its clawback window? The guard the refi-alert
 * sweep consults before soliciting a payoff on our own book.
 */
export function isWithinClawbackWindow(
  input: Pick<ClawbackExposureInput, "lenderId" | "fundedAt">,
  now: Date = new Date(),
): boolean {
  return evaluateClawbackExposure({ ...input, compensationReceivedAmount: null }, now).atRisk;
}

export interface ClawbackRegisterEntry extends ClawbackExposureInput {
  submissionId?: string;
  applicationId?: string;
  status?: string;
}

export interface ClawbackRegister {
  /** Funded loans still inside their EPO window. */
  atRiskCount: number;
  /** Total reclaimable dollars — the reserve figure. */
  totalAtRisk: number;
  /** At-risk loans whose amount is unknown (no remittance recorded). */
  indeterminateCount: number;
  /** True when ANY entry rests on the platform assumption, not a contract. */
  usesAssumedWindow: boolean;
  /** Soonest window expiry among at-risk loans. */
  nextExpiry: Date | null;
  entries: (ClawbackExposure & { submissionId?: string; applicationId?: string })[];
}

/**
 * Roll funded submissions into the contingent-liability register the audit
 * found missing. Only `funded` rows can carry exposure — nothing is reclaimed
 * from a loan that never paid us.
 */
export function buildClawbackRegister(
  records: ClawbackRegisterEntry[],
  now: Date = new Date(),
): ClawbackRegister {
  const entries = records
    .filter(r => r.status === undefined || r.status === "funded")
    .map(r => ({
      ...evaluateClawbackExposure(r, now),
      submissionId: r.submissionId,
      applicationId: r.applicationId,
    }))
    .filter(e => e.atRisk);

  let totalAtRisk = 0;
  let indeterminateCount = 0;
  let usesAssumedWindow = false;
  let nextExpiry: Date | null = null;

  for (const entry of entries) {
    totalAtRisk += entry.amountAtRisk;
    if (entry.indeterminate) indeterminateCount += 1;
    if (entry.window.source === "assumed") usesAssumedWindow = true;
    if (entry.expiresAt && (nextExpiry === null || entry.expiresAt < nextExpiry)) {
      nextExpiry = entry.expiresAt;
    }
  }

  return {
    atRiskCount: entries.length,
    totalAtRisk: round2(totalAtRisk),
    indeterminateCount,
    usesAssumedWindow,
    nextExpiry,
    entries,
  };
}
