// ---------------------------------------------------------------------------
// Unit economics — the cost side, and the margin it makes computable.
//
// The platform could state (after F-6) what a funded loan earned, but nothing
// about what it cost to produce: no cost-per-file, no vendor invoice tracking,
// no commission. So "what is the gross margin on a loan?" had no answer, and
// neither did the question underneath it — how much do we spend on files that
// never fund?
//
// The arithmetic here turns on one distinction that is easy to get wrong:
//
//   COST PER FILE          total cost / all files touched.  Interesting.
//   COST PER FUNDED LOAN   total cost / funded count.       The real number.
//
// Costs are incurred on every file; revenue arrives only on the ones that
// close. At 60% pull-through, every funded loan carries the cost of two-thirds
// of a dead file on top of its own. Dividing by application count flatters the
// business by exactly the pull-through gap, which is why the roll-up below
// reports both and names which is which.
//
// Pure and deterministic. Persistence is `loan_cost_entries`.
// ---------------------------------------------------------------------------

import { LOAN_COST_CATEGORIES, type LoanCostCategory } from "./schema/compliance";

export { LOAN_COST_CATEGORIES, type LoanCostCategory };

export interface CostEntryLike {
  applicationId: string;
  category: string;
  amount: string | number;
  simulated?: boolean | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface CostSummary {
  /** Real spend — simulated vendor legs excluded. */
  totalCost: number;
  /**
   * Spend booked against a still-simulated vendor adapter. Reported
   * separately so a margin figure never quietly includes money nobody paid.
   */
  simulatedCost: number;
  byCategory: { category: string; amount: number; count: number }[];
  entryCount: number;
  /** Distinct applications carrying at least one cost entry. */
  filesWithCost: number;
}

export function summarizeCosts(entries: CostEntryLike[]): CostSummary {
  const byCategory = new Map<string, { amount: number; count: number }>();
  const files = new Set<string>();
  let totalCost = 0;
  let simulatedCost = 0;

  for (const entry of entries) {
    const amount = toNumber(entry.amount);
    files.add(entry.applicationId);
    if (entry.simulated) {
      simulatedCost += amount;
      continue;
    }
    totalCost += amount;
    const bucket = byCategory.get(entry.category) ?? { amount: 0, count: 0 };
    bucket.amount += amount;
    bucket.count += 1;
    byCategory.set(entry.category, bucket);
  }

  return {
    totalCost: round2(totalCost),
    simulatedCost: round2(simulatedCost),
    byCategory: [...byCategory.entries()]
      .map(([category, v]) => ({ category, amount: round2(v.amount), count: v.count }))
      // Largest first: the point of the breakdown is to find the leak.
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category)),
    entryCount: entries.length,
    filesWithCost: files.size,
  };
}

/** Direct cost booked against one file. */
export function costForApplication(entries: CostEntryLike[], applicationId: string): number {
  return round2(
    entries
      .filter(e => e.applicationId === applicationId && !e.simulated)
      .reduce((sum, e) => sum + toNumber(e.amount), 0),
  );
}

// ---------------------------------------------------------------------------
// Unit economics
// ---------------------------------------------------------------------------

export interface UnitEconomicsInput {
  /** Real compensation collected on funded loans (shared/compensationLedger). */
  receivedCompensation: number;
  fundedCount: number;
  costs: CostSummary;
  /**
   * Compensation booked against SIMULATED fundings, already excluded from
   * `receivedCompensation`. Passed in only so the exclusion can be stated in
   * `notes` — the cost side has always disclosed its simulated total, and a
   * revenue figure that quietly drops rows is the same defect mirrored.
   */
  simulatedRevenue?: number;
}

export interface UnitEconomics {
  revenue: number;
  directCost: number;
  /** revenue − directCost across the whole book. */
  grossMargin: number;
  /** grossMargin / revenue, as a percentage. Null when revenue is 0. */
  grossMarginPct: number | null;
  /** Total cost divided by FUNDED loans — what a closing actually costs. */
  costPerFundedLoan: number | null;
  /** Revenue − cost, per funded loan. Null with nothing funded. */
  marginPerFundedLoan: number | null;
  /** Total cost divided by files touched. Flatters the business; labeled. */
  costPerFileTouched: number | null;
  /**
   * True when the figures rest on an incomplete cost side — labor and
   * commissions are not captured anywhere, so gross margin is an UPPER bound.
   */
  costSideIncomplete: true;
  notes: string[];
}

/**
 * Roll revenue and cost into the margin figures.
 *
 * `grossMargin` is deliberately an upper bound and says so: this ledger
 * captures direct vendor spend only. Loan-officer compensation, processing
 * labour, and overhead allocation are not modeled anywhere in the platform, so
 * the real margin is lower by whatever those cost. Reporting it as though it
 * were complete would be the same class of error as reporting pipeline volume
 * as revenue.
 */
export function computeUnitEconomics(input: UnitEconomicsInput): UnitEconomics {
  const revenue = round2(input.receivedCompensation);
  const directCost = input.costs.totalCost;
  const grossMargin = round2(revenue - directCost);

  const notes: string[] = [
    "Direct vendor spend only — loan-officer compensation, processing labour and overhead are not captured, so gross margin is an upper bound.",
  ];
  if (input.costs.simulatedCost > 0) {
    notes.push(
      `$${input.costs.simulatedCost.toFixed(2)} of cost sits behind still-simulated vendor adapters and is excluded from these figures.`,
    );
  }
  if (input.simulatedRevenue && input.simulatedRevenue > 0) {
    notes.push(
      `$${input.simulatedRevenue.toFixed(2)} of compensation was booked against SIMULATED lender ` +
        `fundings and is excluded from revenue — no lender wired it.`,
    );
  }
  if (input.fundedCount === 0) {
    notes.push("Nothing has funded, so per-funded-loan figures are undefined rather than zero.");
  }

  return {
    revenue,
    directCost,
    grossMargin,
    grossMarginPct: revenue === 0 ? null : round2((grossMargin / revenue) * 100),
    costPerFundedLoan: input.fundedCount === 0 ? null : round2(directCost / input.fundedCount),
    marginPerFundedLoan: input.fundedCount === 0 ? null : round2(grossMargin / input.fundedCount),
    costPerFileTouched:
      input.costs.filesWithCost === 0 ? null : round2(directCost / input.costs.filesWithCost),
    costSideIncomplete: true,
    notes,
  };
}
