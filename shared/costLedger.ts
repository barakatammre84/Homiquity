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
// Commission payouts — the other cost side
//
// `loan_cost_entries` books vendor spend. It is not the only money that leaves
// the company per loan: `broker_commissions` records a payout to a referring
// broker on a funded file, created at funding and disbursed by an admin.
//
// Those rows lived in a table nothing financial read, so the margin figure
// below excluded the single largest variable cost a brokerage carries while
// its own comment asserted commissions were "not captured anywhere". They are
// captured — just not joined. This is the join.
//
// The status lifecycle is what makes the arithmetic honest, so it is modeled
// rather than summed flat:
//
//   pending    created on funding, awaiting admin sign-off. NOT yet committed
//              — it can still be rejected, so counting it as cost would
//              overstate spend.
//   approved   signed off, not yet disbursed. Committed: a real payable.
//   paid       cash out the door.
//   rejected   never owed; contributes nothing.
//
// `committedAmount` (approved + paid) is what the book actually owes or has
// spent, and is the figure the margin uses.
// ---------------------------------------------------------------------------

export interface CommissionRowLike {
  status: string;
  commissionAmount: string | number | null;
}

export interface CommissionCostSummary {
  /** Disbursed — cash already gone. */
  paidAmount: number;
  paidCount: number;
  /** Signed off but not yet disbursed — an accrued payable. */
  approvedAmount: number;
  approvedCount: number;
  /** Created on funding, not yet signed off. Not counted as cost. */
  pendingAmount: number;
  pendingCount: number;
  /** approved + paid — what the book owes or has spent. */
  committedAmount: number;
}

export const EMPTY_COMMISSION_COSTS: CommissionCostSummary = {
  paidAmount: 0,
  paidCount: 0,
  approvedAmount: 0,
  approvedCount: 0,
  pendingAmount: 0,
  pendingCount: 0,
  committedAmount: 0,
};

export function summarizeCommissionCosts(rows: CommissionRowLike[]): CommissionCostSummary {
  let paidAmount = 0;
  let paidCount = 0;
  let approvedAmount = 0;
  let approvedCount = 0;
  let pendingAmount = 0;
  let pendingCount = 0;

  for (const row of rows) {
    const amount = toNumber(row.commissionAmount);
    if (row.status === "paid") {
      paidAmount += amount;
      paidCount += 1;
    } else if (row.status === "approved") {
      approvedAmount += amount;
      approvedCount += 1;
    } else if (row.status === "pending") {
      pendingAmount += amount;
      pendingCount += 1;
    }
    // "rejected" is never owed and is deliberately not accumulated anywhere.
  }

  return {
    paidAmount: round2(paidAmount),
    paidCount,
    approvedAmount: round2(approvedAmount),
    approvedCount,
    pendingAmount: round2(pendingAmount),
    pendingCount,
    committedAmount: round2(paidAmount + approvedAmount),
  };
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
   * Commission payouts on funded files. Optional so existing callers keep
   * compiling, but omitting it understates cost — pass it wherever the rows
   * are reachable.
   */
  commissions?: CommissionCostSummary;
}

export interface UnitEconomics {
  revenue: number;
  /** Vendor spend + committed commission payouts. */
  directCost: number;
  /** Vendor spend alone — the `loan_cost_entries` side. */
  vendorCost: number;
  /** Committed commission payouts — approved + paid. */
  commissionCost: number;
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
   * True when the figures rest on an incomplete cost side. Still unconditional:
   * commission payouts are now counted, but processing labour, loan-officer
   * salary and overhead are modeled nowhere, so gross margin remains an UPPER
   * bound.
   */
  costSideIncomplete: true;
  notes: string[];
}

/**
 * Roll revenue and cost into the margin figures.
 *
 * `grossMargin` is deliberately an upper bound and says so. Two cost lines are
 * counted — direct vendor spend (`loan_cost_entries`) and committed commission
 * payouts (`broker_commissions`) — and the rest is not modeled anywhere:
 * processing labour, loan-officer salary, and overhead allocation. The real
 * margin is lower by whatever those cost. Reporting it as though it were
 * complete would be the same class of error as reporting pipeline volume as
 * revenue.
 */
export function computeUnitEconomics(input: UnitEconomicsInput): UnitEconomics {
  const revenue = round2(input.receivedCompensation);
  const commissions = input.commissions ?? EMPTY_COMMISSION_COSTS;
  const vendorCost = input.costs.totalCost;
  const commissionCost = commissions.committedAmount;
  const directCost = round2(vendorCost + commissionCost);
  const grossMargin = round2(revenue - directCost);

  const notes: string[] = [
    "Vendor spend and committed commission payouts only — processing labour, loan-officer salary and overhead are not captured, so gross margin is an upper bound.",
  ];
  if (input.costs.simulatedCost > 0) {
    notes.push(
      `$${input.costs.simulatedCost.toFixed(2)} of cost sits behind still-simulated vendor adapters and is excluded from these figures.`,
    );
  }
  if (commissions.pendingAmount > 0) {
    notes.push(
      `$${commissions.pendingAmount.toFixed(2)} of commission across ${commissions.pendingCount} file(s) is pending admin sign-off and is excluded until approved — cost will rise by that much if it is.`,
    );
  }
  if (input.fundedCount === 0) {
    notes.push("Nothing has funded, so per-funded-loan figures are undefined rather than zero.");
  }

  return {
    revenue,
    directCost,
    vendorCost,
    commissionCost,
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
