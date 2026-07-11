import type { EmploymentHistory, OtherIncomeSource } from "@shared/schema";
import type { DtiIncomePathResult } from "@shared/incomePaths";
import { roundCents, parseFinancialNumber, isPresentFinancialNumber } from "@shared/incomePaths";

/**
 * Agency wage path (UAL P3) — the reconciled W-2 / wage income math, the ONE
 * implementation replacing the two that existed (server/underwriting.ts
 * qualifyIncome and decisionEngine aggregateBorrowerFinancials).
 *
 * Semantics preserved from decisionEngine (the richer, live instant-decision
 * producer), Fannie Selling Guide B3-3.1 (stable monthly income):
 *  - itemized fields (base/overtime/bonus/commission/other) win whenever ANY
 *    is present — including when they net to a loss (a net-negative K-1 total
 *    must not be silently deleted by a `> 0` guard);
 *  - otherwise the rolled-up totalMonthlyIncome for the job (which may be a
 *    loss) is used as base;
 *  - self-employed records are SKIPPED here and handled by the self-employment
 *    path (Form 1084) — this is the unification: the instant-decision path now
 *    routes self-employment through the cited calculator instead of counting a
 *    raw captured figure;
 *  - other-income sources add to variable income;
 *  - when NO usable wage line item exists at all, fall back to the
 *    application-summary annual income (base only). A net loss IS usable data,
 *    so the fallback fires only on the true absence of any line item.
 */

const AGENCY_WAGE_CITATIONS = [
  { doc: "docs/fannie-mae (Selling Guide)", section: "B3-3.1 Employment and Other Sources of Income" },
];

function toNum(v: unknown): number {
  const n = parseFinancialNumber(v);
  return isNaN(n) ? 0 : n;
}

const isPresentNumber = isPresentFinancialNumber;

export interface AgencyWageInput {
  employment: EmploymentHistory[];
  otherIncome: OtherIncomeSource[];
  /** Application-summary fallback used only when no wage line item exists. */
  fallbackAnnualIncome?: number | string | null;
}

export interface AgencyWageComputation {
  path: DtiIncomePathResult;
  /** Split retained so the underwriting engine's base/bonus inputs stay exact. */
  baseMonthlyIncome: number;
  variableMonthlyIncome: number;
  /** Whether any wage/other line item was found (vs falling back to app summary). */
  usedLineItems: boolean;
}

export function computeAgencyWageIncome(input: AgencyWageInput): AgencyWageComputation {
  const notes: string[] = [];
  let base = 0;
  let variable = 0;
  let sawLineItem = false;

  for (const e of input.employment) {
    if (e.isSelfEmployed) continue; // handled by the self-employment (1084) path
    const itemized = [e.baseIncome, e.overtimeIncome, e.bonusIncome, e.commissionIncome, e.otherIncome];
    if (itemized.some(isPresentNumber)) {
      base += toNum(e.baseIncome);
      variable +=
        toNum(e.overtimeIncome) + toNum(e.bonusIncome) + toNum(e.commissionIncome) + toNum(e.otherIncome);
      sawLineItem = true;
    } else if (isPresentNumber(e.totalMonthlyIncome)) {
      base += toNum(e.totalMonthlyIncome);
      sawLineItem = true;
    }
  }

  for (const o of input.otherIncome) {
    if (isPresentNumber(o.monthlyAmount)) {
      variable += toNum(o.monthlyAmount);
      sawLineItem = true;
    }
  }

  let usedLineItems = sawLineItem;
  if (!sawLineItem) {
    const annual = toNum(input.fallbackAnnualIncome);
    base = annual / 12;
    variable = 0;
    usedLineItems = false;
    if (annual > 0) {
      notes.push("No wage line items captured — using the application-summary annual income.");
    }
  }

  base = roundCents(base);
  variable = roundCents(variable);
  const monthly = roundCents(base + variable);
  const applicable = monthly !== 0 || usedLineItems;

  return {
    baseMonthlyIncome: base,
    variableMonthlyIncome: variable,
    usedLineItems,
    path: {
      pathId: "agency_wage",
      kind: "dti_income",
      role: "component",
      status: applicable ? "applicable" : "not_indicated",
      monthlyQualifyingIncome: monthly,
      appliedToDti: true,
      citations: AGENCY_WAGE_CITATIONS,
      requiresManualReview: false,
      notes,
    },
  };
}
