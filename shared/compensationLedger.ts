// ---------------------------------------------------------------------------
// Broker compensation ledger — the revenue side of a funded loan.
//
// The platform had no representation of revenue at all: the comp fields on
// `lender_offers` were never written, the seeded per-lender comp plans were
// read only by dead code, and the single financial metric on the admin
// dashboard summed the purchase price of PENDING applications — pipeline
// volume, not funded volume and not revenue.
//
// The consequence was not a missing chart. It was that nobody could answer:
//   * what does a funded loan actually earn?
//   * did the lender pay us what the comp plan says?
//   * how many files did we work that never funded?
//
// This module is the arithmetic for those three questions. The lifecycle is
// deliberately two-sided, because a single "revenue" number cannot be checked
// against anything:
//
//   EXPECTED  snapshotted at submission from the elected comp plan
//             (shared/compliance/loCompensation.ts) × the loan amount.
//   RECEIVED  recorded at funding, from the lender's actual remittance.
//   VARIANCE  the difference — the only thing that can surface a short-pay.
//
// Pure and deterministic. Persistence lives on `lender_submissions`.
// ---------------------------------------------------------------------------

export type CompensationVarianceStatus =
  /** Funded, and the remittance matches what the plan predicted. */
  | "as_expected"
  /** Funded and the lender paid LESS than the plan — money we are owed. */
  | "short_paid"
  /** Funded and the lender paid MORE than the plan — also a discrepancy. */
  | "over_paid"
  /** Not funded yet, or funded with no remittance recorded. */
  | "pending";

export interface CompensationVariance {
  status: CompensationVarianceStatus;
  expectedAmount: number | null;
  receivedAmount: number | null;
  /** received − expected. Negative means we were short-paid. */
  variance: number | null;
  /** Variance as a percentage of expected; null when expected is 0/unknown. */
  variancePct: number | null;
  message: string;
}

/**
 * Rounding tolerance, in dollars. Lender remittances routinely differ from a
 * bps calculation by cents (their rounding vs. ours); treating that as a
 * short-pay would bury real discrepancies in noise. This is an operational
 * threshold, not a regulatory one.
 */
export const COMPENSATION_MATCH_TOLERANCE = 1;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function evaluateCompensationVariance(input: {
  // Drizzle returns `decimal` columns as strings, so both forms are accepted
  // and normalized here rather than at every call site.
  expectedAmount: number | string | null | undefined;
  receivedAmount: number | string | null | undefined;
}): CompensationVariance {
  const expected = numberOrNull(input.expectedAmount);
  const received = numberOrNull(input.receivedAmount);

  if (received === null) {
    return {
      status: "pending",
      expectedAmount: expected,
      receivedAmount: null,
      variance: null,
      variancePct: null,
      message:
        expected === null
          ? "No compensation expectation recorded for this submission."
          : `Expecting $${expected.toFixed(2)}; no remittance recorded yet.`,
    };
  }

  if (expected === null) {
    return {
      status: "pending",
      expectedAmount: null,
      receivedAmount: received,
      variance: null,
      variancePct: null,
      message:
        `Received $${received.toFixed(2)} with no recorded expectation to check it against — ` +
        `the comp plan was not captured at submission.`,
    };
  }

  const variance = round2(received - expected);
  const variancePct = expected === 0 ? null : round2((variance / expected) * 100);

  if (Math.abs(variance) <= COMPENSATION_MATCH_TOLERANCE) {
    return {
      status: "as_expected",
      expectedAmount: expected,
      receivedAmount: received,
      variance,
      variancePct,
      message: `Remittance matches the comp plan ($${received.toFixed(2)}).`,
    };
  }

  if (variance < 0) {
    return {
      status: "short_paid",
      expectedAmount: expected,
      receivedAmount: received,
      variance,
      variancePct,
      message:
        `Short-paid by $${Math.abs(variance).toFixed(2)} — expected $${expected.toFixed(2)}, ` +
        `received $${received.toFixed(2)}. Reconcile against the lender's remittance advice.`,
    };
  }

  return {
    status: "over_paid",
    expectedAmount: expected,
    receivedAmount: received,
    variance,
    variancePct,
    message:
      `Over-paid by $${variance.toFixed(2)} — expected $${expected.toFixed(2)}, ` +
      `received $${received.toFixed(2)}. Confirm before recognizing it; lenders claw back overpayments.`,
  };
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Portfolio roll-up
// ---------------------------------------------------------------------------

export interface CompensationRecord {
  status: string;
  fundedLoanAmount?: string | number | null;
  compensationExpectedAmount?: string | number | null;
  compensationReceivedAmount?: string | number | null;
  /**
   * True while the lender leg is the deterministic simulation
   * (`lender_submissions.simulated`, which DEFAULTS TO TRUE).
   *
   * Nothing here read this column until F-21, so simulated funding was summed
   * into revenue, pull-through and the clawback reserve exactly as though a
   * lender had wired the money — while `costLedger.ts` next door was carefully
   * segregating simulated spend. Gross margin was therefore real cost
   * subtracted from imaginary revenue.
   */
  simulated?: boolean | null;
}

/**
 * Simulated activity, kept apart from every real figure.
 *
 * Reported rather than dropped, for the same reason `CostSummary` reports
 * `simulatedCost`: a walkthrough that produces a funded submission should be
 * visible as what it is, not vanish. What it must never do is move a number
 * anyone would read as revenue.
 */
export interface SimulatedCompensationSummary {
  fundedCount: number;
  fundedVolume: number;
  /** Compensation "received" on simulated funding — money nobody wired. */
  receivedCompensation: number;
  inFlightCount: number;
  deadCount: number;
}

export interface CompensationSummary {
  /**
   * Every field on this object counts REAL submissions only. Simulated rows
   * are excluded throughout and totalled in `simulated` below.
   */
  /** Submissions in a live, non-terminal state. */
  inFlightCount: number;
  fundedCount: number;
  /** Submissions that reached a terminal non-funded state. */
  deadCount: number;
  /** fundedCount / (fundedCount + deadCount) — the broker's defining metric. */
  pullThroughPct: number | null;
  fundedVolume: number;
  expectedCompensation: number;
  receivedCompensation: number;
  /** received − expected across funded loans; negative means owed to us. */
  compensationVariance: number;
  shortPaidCount: number;
  /** Funded loans with no remittance recorded — revenue we cannot confirm. */
  awaitingRemittanceCount: number;
  /** Simulated activity, excluded from every figure above. */
  simulated: SimulatedCompensationSummary;
}

const DEAD_STATUSES = new Set(["denied", "withdrawn"]);

/**
 * Roll a set of submissions into the numbers a broker actually runs on.
 *
 * Pull-through is computed over RESOLVED submissions only (funded vs.
 * denied/withdrawn) — counting in-flight files as failures would make the
 * metric drift with pipeline size rather than with performance.
 *
 * SIMULATED ROWS ARE EXCLUDED from every figure and totalled separately.
 * Pull-through in particular must not mix them: a walkthrough drives files to
 * `funded` on demand, so including simulated rows would report a pull-through
 * approaching 100% that describes the demo script rather than the business.
 */
export function summarizeCompensation(records: CompensationRecord[]): CompensationSummary {
  let fundedCount = 0;
  let deadCount = 0;
  let inFlightCount = 0;
  let fundedVolume = 0;
  let expectedCompensation = 0;
  let receivedCompensation = 0;
  let shortPaidCount = 0;
  let awaitingRemittanceCount = 0;

  const simulated: SimulatedCompensationSummary = {
    fundedCount: 0,
    fundedVolume: 0,
    receivedCompensation: 0,
    inFlightCount: 0,
    deadCount: 0,
  };

  for (const record of records) {
    // Branch on provenance BEFORE anything else, so no simulated amount can
    // reach a real accumulator by any path through the block below.
    if (record.simulated) {
      if (record.status === "funded") {
        simulated.fundedCount += 1;
        simulated.fundedVolume += numberOrNull(record.fundedLoanAmount) ?? 0;
        simulated.receivedCompensation += numberOrNull(record.compensationReceivedAmount) ?? 0;
      } else if (DEAD_STATUSES.has(record.status)) {
        simulated.deadCount += 1;
      } else {
        simulated.inFlightCount += 1;
      }
      continue;
    }

    if (record.status === "funded") {
      fundedCount += 1;
      fundedVolume += numberOrNull(record.fundedLoanAmount) ?? 0;

      const expected = numberOrNull(record.compensationExpectedAmount);
      const received = numberOrNull(record.compensationReceivedAmount);
      expectedCompensation += expected ?? 0;
      receivedCompensation += received ?? 0;

      if (received === null) {
        awaitingRemittanceCount += 1;
      } else {
        const variance = evaluateCompensationVariance({ expectedAmount: expected, receivedAmount: received });
        if (variance.status === "short_paid") shortPaidCount += 1;
      }
    } else if (DEAD_STATUSES.has(record.status)) {
      deadCount += 1;
    } else {
      inFlightCount += 1;
    }
  }

  const resolved = fundedCount + deadCount;

  return {
    inFlightCount,
    fundedCount,
    deadCount,
    pullThroughPct: resolved === 0 ? null : round2((fundedCount / resolved) * 100),
    fundedVolume: round2(fundedVolume),
    expectedCompensation: round2(expectedCompensation),
    receivedCompensation: round2(receivedCompensation),
    compensationVariance: round2(receivedCompensation - expectedCompensation),
    shortPaidCount,
    awaitingRemittanceCount,
    simulated: {
      ...simulated,
      fundedVolume: round2(simulated.fundedVolume),
      receivedCompensation: round2(simulated.receivedCompensation),
    },
  };
}
