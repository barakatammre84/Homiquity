/**
 * Roadmap G-C: pull-through % and cycle-time days, derived from status
 * transitions — so the acquisition playbook's gates (>70% pull-through,
 * <12-day time-to-clear) are reportable from day one of real traffic
 * instead of raw unassembled audit rows.
 *
 * Honesty rules (the FinancialReports page renders these properties as-is):
 *  - TWO pull-through denominators, both named. "Resolved" divides funded by
 *    files that reached ANY terminal state — the number the >70% gate means.
 *    "Overall" divides by everything created in the window; in-flight files
 *    drag it down, so it is not a conversion rate until the window resolves.
 *  - null means "cannot be computed", never zero. No files resolved → null
 *    pull-through, not 0%.
 *  - A funded file with no recorded funding transition (rows predating the
 *    audit trail) counts in pull-through — its status is a fact — but is
 *    EXCLUDED from cycle time and counted, so the median never silently
 *    rests on a partial cohort.
 *
 * Pure and deterministic: no I/O, no clock — callers pass the rows.
 */
import { LOAN_APP_TERMINAL_STATUSES } from "./schema";

export interface CycleTimeAppRow {
  id: string;
  createdAt: Date | string;
  status: string;
}

export interface FundedEventRow {
  applicationId: string;
  /** Timestamp of the FIRST status transition into "funded". */
  fundedAt: Date | string;
}

/**
 * The second half of the cash cycle, from `lender_submissions` (audit F-23).
 *
 * A broker's only liquidity risk is working capital: costs are incurred at
 * application and revenue arrives after funding. Funding is not the moment cash
 * arrives — the lender wires compensation some days later, and THAT lag is the
 * pure cash-drag window. `compensation_received_at` has always recorded it and
 * was read by nothing; `summarizeCompensation` reads the amount beside it and
 * ignores the timestamp.
 */
export interface RemittanceEventRow {
  applicationId: string;
  fundedAt: Date | string | null | undefined;
  compensationReceivedAt: Date | string | null | undefined;
}

export interface IntervalStats {
  measuredCount: number;
  medianDays: number | null;
  p90Days: number | null;
}

export interface CycleTimeReport {
  windowDays: number;
  totalCreated: number;
  outcomes: {
    funded: number;
    denied: number;
    withdrawn: number;
    expired: number;
    inFlight: number;
  };
  /** funded / (all terminal outcomes); null when nothing has resolved. */
  pullThroughResolvedPct: number | null;
  /** funded / totalCreated; null when nothing was created in the window. */
  pullThroughOverallPct: number | null;
  cycleTime: {
    /** Funded files with a measurable created→funded interval. */
    measuredCount: number;
    /** Funded files with no usable funding transition — excluded from the stats. */
    unmeasuredFundedCount: number;
    medianDays: number | null;
    p90Days: number | null;
  };
  /**
   * funded → compensation received. The days the company carries the file
   * after closing, before the money it earned arrives.
   */
  remittanceLag: IntervalStats & {
    /** Funded files with no remittance timestamp — excluded from the stats. */
    unmeasuredFundedCount: number;
  };
  /**
   * application → cash: the full outflow-to-inflow window. Summed from the two
   * medians and the two p90s rather than measured per file, because a file that
   * has a funding transition may not yet have a remittance and vice versa —
   * intersecting them would shrink the cohort to whichever is scarcer. Stated
   * as a sum of statistics so nobody reads it as a measured distribution.
   */
  daysToCash: {
    medianDays: number | null;
    p90Days: number | null;
  };
  notes: string[];
}

const MS_PER_DAY = 86_400_000;

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile90(sorted: number[]): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)];
}

export function computeCycleTimeReport(
  windowDays: number,
  applications: CycleTimeAppRow[],
  fundedEvents: FundedEventRow[],
  remittanceEvents: RemittanceEventRow[] = [],
): CycleTimeReport {
  const fundedAtById = new Map<string, number>();
  for (const e of fundedEvents) {
    const t = toTime(e.fundedAt);
    if (!Number.isNaN(t)) fundedAtById.set(e.applicationId, t);
  }

  const outcomes = { funded: 0, denied: 0, withdrawn: 0, expired: 0, inFlight: 0 };
  const cycleDays: number[] = [];
  let unmeasuredFunded = 0;

  for (const app of applications) {
    switch (app.status) {
      case "funded": {
        outcomes.funded += 1;
        const fundedAt = fundedAtById.get(app.id);
        const createdAt = toTime(app.createdAt);
        // A funding transition earlier than creation is corrupt data, not a
        // zero-day close — treat it as unmeasured rather than skew the median.
        if (fundedAt !== undefined && !Number.isNaN(createdAt) && fundedAt >= createdAt) {
          cycleDays.push((fundedAt - createdAt) / MS_PER_DAY);
        } else {
          unmeasuredFunded += 1;
        }
        break;
      }
      case "denied":
        outcomes.denied += 1;
        break;
      case "withdrawn":
        outcomes.withdrawn += 1;
        break;
      case "expired":
        outcomes.expired += 1;
        break;
      default:
        outcomes.inFlight += 1;
    }
  }

  // --- funded → remittance (F-23) -----------------------------------------
  // Scoped to the window's applications so both intervals describe the same
  // cohort; a remittance on a file created before the window would otherwise
  // pull the lag toward a population the rest of the report excludes.
  const inWindow = new Set(applications.map(a => a.id));
  const lagDays: number[] = [];
  let unmeasuredRemittance = 0;
  for (const e of remittanceEvents) {
    if (!inWindow.has(e.applicationId)) continue;
    const fundedAt = e.fundedAt == null ? NaN : toTime(e.fundedAt);
    const receivedAt =
      e.compensationReceivedAt == null ? NaN : toTime(e.compensationReceivedAt);
    // Same rule as cycle time: a remittance dated before funding is corrupt
    // data, not a same-day wire, and must not shorten the median.
    if (!Number.isNaN(fundedAt) && !Number.isNaN(receivedAt) && receivedAt >= fundedAt) {
      lagDays.push((receivedAt - fundedAt) / MS_PER_DAY);
    } else {
      unmeasuredRemittance += 1;
    }
  }

  const resolved = outcomes.funded + outcomes.denied + outcomes.withdrawn + outcomes.expired;
  const totalCreated = applications.length;
  cycleDays.sort((a, b) => a - b);
  lagDays.sort((a, b) => a - b);

  const cycleMedian = cycleDays.length > 0 ? median(cycleDays) : null;
  const cycleP90 = cycleDays.length > 0 ? percentile90(cycleDays) : null;
  const lagMedian = lagDays.length > 0 ? median(lagDays) : null;
  const lagP90 = lagDays.length > 0 ? percentile90(lagDays) : null;

  // Null propagates: with either half unmeasured the full window is unknown,
  // and reporting the half we have as though it were the whole would understate
  // exactly the number this exists to surface.
  const sumOrNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

  const notes: string[] = [
    'Resolved pull-through divides funded by files that reached any terminal state — the number the >70% gate means. Overall divides by everything created in the window; in-flight files drag it down.',
  ];
  if (unmeasuredFunded > 0) {
    notes.push(
      `${unmeasuredFunded} funded file(s) have no usable funding transition in the audit trail — counted in pull-through, excluded from cycle time.`,
    );
  }
  if (unmeasuredRemittance > 0) {
    notes.push(
      `${unmeasuredRemittance} funded file(s) have no usable remittance timestamp — excluded from the remittance lag, so days-to-cash rests on the files that do.`,
    );
  }
  if (lagMedian === null) {
    notes.push(
      "No remittance has been timed yet, so days-to-cash is unknown rather than equal to the funding cycle — the lender's wire lag is not zero, it is unmeasured.",
    );
  }

  return {
    windowDays,
    totalCreated,
    outcomes,
    pullThroughResolvedPct: resolved > 0 ? (outcomes.funded / resolved) * 100 : null,
    pullThroughOverallPct: totalCreated > 0 ? (outcomes.funded / totalCreated) * 100 : null,
    cycleTime: {
      measuredCount: cycleDays.length,
      unmeasuredFundedCount: unmeasuredFunded,
      medianDays: cycleMedian,
      p90Days: cycleP90,
    },
    remittanceLag: {
      measuredCount: lagDays.length,
      unmeasuredFundedCount: unmeasuredRemittance,
      medianDays: lagMedian,
      p90Days: lagP90,
    },
    daysToCash: {
      medianDays: sumOrNull(cycleMedian, lagMedian),
      p90Days: sumOrNull(cycleP90, lagP90),
    },
    notes,
  };
}

/**
 * The terminal statuses this module's switch enumerates. Pinned against the
 * schema's LOAN_APP_TERMINAL_STATUSES in tests/cycleTimeReport.test.ts — if
 * the vocabulary ever grows, the switch must learn the new status or funded
 * math silently miscounts.
 */
export const CYCLE_TIME_TERMINAL_STATUSES = ["funded", "denied", "withdrawn", "expired"] as const;
void LOAN_APP_TERMINAL_STATUSES;
