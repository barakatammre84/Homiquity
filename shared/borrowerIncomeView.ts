/**
 * Borrower-facing income summary — the masked read model behind
 * GET /api/loan-applications/:id/income-summary (Borrower Clarity PR 7,
 * kb log 2026-08-04 §4; user decision: C1 + educational pre-decision state).
 *
 * Two states, one contract:
 *  - AVAILABLE (post-decision only): the file is approved-grade AND its
 *    financial data is decision-grade verified — the same gate class as the
 *    pre-approval letter. The borrower sees how their verified income was
 *    calculated: per-path monthly figures with Selling Guide citations and
 *    the qualifying total. Transparency into a decision already made — never
 *    live math over unverified data (MR-2; Reg N §1014.3(q) — the C2
 *    variant is a recorded binding rejection).
 *  - ANALYZING (any earlier state): an educational payload — which income
 *    sources are under analysis, framed as finding the borrower's full
 *    purchasing power. No figures, no candidacy signals, no recommendations.
 *
 * Strict whitelist in the borrowerOfferView pattern. The raw evaluation row
 * and path payloads carry calculator prose (notes[]), internal gate codes
 * (unavailableReason), triage state (requiresManualReview), and method
 * recommendations (recommendedPathId/-Reason — steering) that never reach a
 * borrower payload.
 */
import {
  incomePathsSchema,
  type IncomePathId,
  type IncomePathResult,
  roundCents,
} from "./incomePaths";

/** Counsel-review item (memo §5): shown under the available breakdown. */
export const BORROWER_INCOME_DISCLAIMER =
  "This summary shows how your verified income was calculated for qualification purposes. " +
  "It is not a commitment to lend and not a Loan Estimate; final loan terms are " +
  "determined at underwriting and closing.";

/** Counsel-review item (memo §5): the educational pre-decision framing. */
export const INCOME_ANALYSIS_EDUCATION =
  "We're analyzing your full income picture to find your full purchasing power. " +
  "Complex income — business returns, rental properties, multiple entities — is our " +
  "specialty, and a careful analysis often supports more than a quick look suggests.";

/** Borrower-friendly source labels — path ids are internal vocabulary. */
export const INCOME_SOURCE_LABELS: Record<IncomePathId, string> = {
  agency_wage: "Employment income",
  self_employment: "Business & self-employment income",
  rental: "Rental income",
  dscr: "Investment-property cash flow",
  bank_statement: "Bank-statement income",
};

export interface BorrowerIncomePathView {
  pathId: IncomePathId;
  label: string;
  /** Monthly qualifying figure (may be negative for a net rental drag). */
  monthlyQualifyingIncome: number;
  /** True when this figure is summed into the qualifying total. */
  appliedToDti: boolean;
  /** Selling Guide citations — {doc, section} pairs, safe by construction. */
  citations: Array<{ doc: string; section: string }>;
}

export interface BorrowerIncomeSummaryAvailable {
  available: true;
  evaluatedAt: Date | string;
  incomeBasis: string;
  totalMonthlyQualifyingIncome: number;
  paths: BorrowerIncomePathView[];
  disclaimer: string;
}

export interface BorrowerIncomeSummaryAnalyzing {
  available: false;
  state: "analyzing";
  /** Friendly labels only — derived from evidence-bearing paths. */
  sourcesUnderReview: string[];
  education: string;
}

export type BorrowerIncomeSummary =
  | BorrowerIncomeSummaryAvailable
  | BorrowerIncomeSummaryAnalyzing;

/** Parse a persisted paths jsonb; null when absent or off-contract. */
export function parsePersistedPaths(paths: unknown): IncomePathResult[] | null {
  if (!paths) return null;
  const parsed = incomePathsSchema.safeParse(paths);
  return parsed.success ? parsed.data : null;
}

export function toBorrowerIncomeAvailableView(evaluation: {
  createdAt: Date | string;
  incomeBasis: string;
  primaryMonthlyQualifyingIncome: string | number;
  paths: IncomePathResult[];
}): BorrowerIncomeSummaryAvailable {
  const paths: BorrowerIncomePathView[] = evaluation.paths
    .filter(
      (p): p is Extract<IncomePathResult, { kind: "dti_income" }> =>
        p.kind === "dti_income" && p.status === "applicable",
    )
    .map((p) => ({
      pathId: p.pathId,
      label: INCOME_SOURCE_LABELS[p.pathId],
      monthlyQualifyingIncome: roundCents(p.monthlyQualifyingIncome),
      appliedToDti: p.appliedToDti,
      citations: p.citations.map((c) => ({ doc: c.doc, section: c.section })),
    }));

  return {
    available: true,
    evaluatedAt: evaluation.createdAt,
    incomeBasis: evaluation.incomeBasis,
    totalMonthlyQualifyingIncome: roundCents(Number(evaluation.primaryMonthlyQualifyingIncome)),
    paths,
    disclaimer: BORROWER_INCOME_DISCLAIMER,
  };
}

export function toBorrowerIncomeAnalyzingView(
  paths: IncomePathResult[] | null,
): BorrowerIncomeSummaryAnalyzing {
  // Evidence-bearing paths only ("applicable" computed, "unavailable" gated);
  // "not_indicated" means no evidence in the file. Labels, never figures.
  const sourcesUnderReview = (paths ?? [])
    .filter((p) => p.status !== "not_indicated")
    .map((p) => INCOME_SOURCE_LABELS[p.pathId]);
  return {
    available: false,
    state: "analyzing",
    sourcesUnderReview,
    education: INCOME_ANALYSIS_EDUCATION,
  };
}
