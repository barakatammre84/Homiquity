import type { EmploymentHistory } from "@shared/schema";
import type { DtiIncomePathResult } from "@shared/incomePaths";
import { roundCents } from "@shared/incomePaths";
import {
  computeSelfEmploymentQualifyingIncome,
  type SelfEmploymentIncomeResult,
} from "../../selfEmploymentIncome";

/**
 * Self-employment path (UAL P3) — a thin wrapper over the cited Fannie Form
 * 1084 calculator (server/services/selfEmploymentIncome.ts, B3-3.5/B3-3.6).
 * The math is NOT forked here; this only aggregates across a borrower's
 * self-employed jobs and adapts the result to the path envelope.
 *
 * A self-employed job with no worksheet contributes 0 and flags manual review
 * — self-employment income only counts through the worksheet (the doctrine the
 * whole beachhead rests on).
 */

const SELF_EMPLOYMENT_CITATIONS = [
  { doc: "docs/fannie-mae/self-employment-income-reference.md", section: "B3-3.5 / B3-3.6 (Form 1084)" },
];

export interface SelfEmploymentComputation {
  path: DtiIncomePathResult;
  perJob: SelfEmploymentIncomeResult[];
}

export function computeSelfEmploymentPath(employment: EmploymentHistory[]): SelfEmploymentComputation {
  const seJobs = employment.filter((e) => e.isSelfEmployed);
  const perJob: SelfEmploymentIncomeResult[] = [];
  const notes: string[] = [];
  let monthly = 0;
  let requiresManualReview = false;
  let jobsWithoutWorksheet = 0;

  for (const e of seJobs) {
    if (!e.selfEmploymentIncome) {
      jobsWithoutWorksheet += 1;
      requiresManualReview = true;
      continue;
    }
    const se = computeSelfEmploymentQualifyingIncome(e.selfEmploymentIncome);
    perJob.push(se);
    monthly += se.monthlyQualifyingIncome;
    requiresManualReview = requiresManualReview || se.requiresManualReview;
    notes.push(...se.notes);
  }

  if (jobsWithoutWorksheet > 0) {
    notes.push(
      `${jobsWithoutWorksheet} self-employed position(s) have no completed income worksheet — self-employment income is $0 until the Form 1084 worksheet is provided.`,
    );
  }

  monthly = roundCents(monthly);
  const status = seJobs.length === 0 ? "not_indicated" : "applicable";

  return {
    perJob,
    path: {
      pathId: "self_employment",
      kind: "dti_income",
      role: "component",
      status,
      monthlyQualifyingIncome: monthly,
      appliedToDti: true,
      citations: SELF_EMPLOYMENT_CITATIONS,
      requiresManualReview,
      notes,
    },
  };
}
