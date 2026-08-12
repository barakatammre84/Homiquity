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

/**
 * The EPO window for a lender, and whether it came from an agreement.
 *
 * Takes the contracted days directly (from `wholesale_lenders.epo_clawback_days`)
 * rather than looking the lender up: the catalog is a database table and this
 * module is shared/, which does no IO.
 *
 * NULL/undefined means NO AGREEMENT EXISTS YET, not "no clawback" — so it
 * resolves to the platform assumption and is reported as `source: "assumed"`.
 * A caller that cannot supply the value therefore degrades LOUDLY (the register
 * raises `usesAssumedWindow`), never silently to zero exposure.
 */
export function clawbackWindowFor(contractedDays?: number | null): ClawbackWindow {
  if (typeof contractedDays === "number" && Number.isFinite(contractedDays) && contractedDays > 0) {
    return { days: contractedDays, source: "contracted" };
  }
  return { days: DEFAULT_EPO_CLAWBACK_DAYS, source: "assumed" };
}

export interface ClawbackExposureInput {
  lenderId: string;
  /**
   * Contracted EPO window from this lender's executed broker agreement
   * (`wholesale_lenders.epo_clawback_days`). Omit when unknown — the exposure
   * then rests on DEFAULT_EPO_CLAWBACK_DAYS and is flagged as assumed.
   */
  epoClawbackDays?: number | null;
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
  const window = clawbackWindowFor(input.epoClawbackDays);
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
  /**
   * True while the lender leg is the deterministic simulation. No lender paid
   * us on a simulated funding, so no lender can reclaim anything — including
   * it would inflate the reserve with money that never moved (F-21).
   */
  simulated?: boolean | null;
}

export interface ClawbackRegister {
  /** Funded loans still inside their EPO window. */
  atRiskCount: number;
  /** Total reclaimable dollars — the reserve figure. Real fundings only. */
  totalAtRisk: number;
  /** At-risk loans whose amount is unknown (no remittance recorded). */
  indeterminateCount: number;
  /** True when ANY entry rests on the platform assumption, not a contract. */
  usesAssumedWindow: boolean;
  /** Soonest window expiry among at-risk loans. */
  nextExpiry: Date | null;
  /**
   * Simulated funded rows kept out of the figures above. Reported rather than
   * silently dropped: this register's discipline is that a number is never
   * allowed to look more complete than it is, in either direction.
   */
  simulatedExcludedCount: number;
  entries: (ClawbackExposure & { submissionId?: string; applicationId?: string })[];
}

/**
 * Roll funded submissions into the contingent-liability register the audit
 * found missing. Only `funded` rows can carry exposure — nothing is reclaimed
 * from a loan that never paid us, and nothing is reclaimable from a loan
 * whose funding was simulated.
 */
export function buildClawbackRegister(
  records: ClawbackRegisterEntry[],
  now: Date = new Date(),
): ClawbackRegister {
  const funded = records.filter(r => r.status === undefined || r.status === "funded");
  const simulatedExcludedCount = funded.filter(r => r.simulated).length;

  const entries = funded
    .filter(r => !r.simulated)
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
    simulatedExcludedCount,
    entries,
  };
}
