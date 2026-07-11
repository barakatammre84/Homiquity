import crypto from "crypto";
import type {
  EmploymentHistory,
  OtherIncomeSource,
  RentalPropertyEntry,
  LoanApplication,
  IncomeSourceEntry,
} from "@shared/schema";
import {
  canonicalizePaths,
  roundCents,
  type IncomeOrchestrationResult,
  type IncomePathResult,
  type IncomePathId,
} from "@shared/incomePaths";
import { storage } from "../../storage";
import { computeAgencyWageIncome } from "./paths/agencyWage";
import { computeSelfEmploymentPath } from "./paths/selfEmployment";
import { computeRentalPath } from "./paths/rental";
import { computeDscrPath, computeBankStatementPath } from "./paths/nonQmGated";

/**
 * Multi-path income orchestrator (UAL P3) — the SINGLE income producer.
 *
 * Two layers, mirroring the underwriting engine:
 *  - a pure core `computeIncomePaths(input)` — deterministic, no IO, unit-
 *    tested directly; runs every applicable path in one pass and ranks them;
 *  - an IO loader `evaluateIncomePaths(applicationId)` that performs the reads
 *    (the same reads decisionEngine.aggregateBorrowerFinancials does).
 *
 * The "primary" DTI income fed to the deterministic engine is the sum of the
 * APPLIED component paths (agency wage + self-employment; rental is surfaced
 * but not auto-applied — see rental.ts). Alternative methods (bank-statement,
 * DSCR) are gated (P4) and surfaced without a figure. Same inputs → same
 * result → same evaluation fingerprint.
 */

export interface IncomePathsCoreInput {
  employment: EmploymentHistory[];
  otherIncome: OtherIncomeSource[];
  rentalProperties: RentalPropertyEntry[];
  fallbackAnnualIncome?: number | string | null;
}

export function computeIncomePaths(input: IncomePathsCoreInput): IncomeOrchestrationResult {
  const agency = computeAgencyWageIncome({
    employment: input.employment,
    otherIncome: input.otherIncome,
    fallbackAnnualIncome: input.fallbackAnnualIncome,
  });
  const selfEmployment = computeSelfEmploymentPath(input.employment);
  const rentalPath = computeRentalPath(input.rentalProperties);

  const hasSelfEmployment = selfEmployment.path.status === "applicable";
  const hasRental = rentalPath.status === "applicable";
  const dscr = computeDscrPath(hasRental);
  const bankStatement = computeBankStatementPath(hasSelfEmployment);

  const paths: IncomePathResult[] = [
    agency.path,
    selfEmployment.path,
    rentalPath,
    bankStatement,
    dscr,
  ];

  // Primary DTI income = applied component dti_income paths.
  const agencyApplied = agency.path.monthlyQualifyingIncome;
  const seApplied = selfEmployment.path.monthlyQualifyingIncome;
  const rentalNet = rentalPath.appliedToDti ? rentalPath.monthlyQualifyingIncome : 0;
  const primary = roundCents(agencyApplied + seApplied + rentalNet);

  // Recommendation: max qualifying income among the full-doc total and any
  // ENABLED alternative method. All alternatives are gated today, so this is
  // the full-doc total; recommendedPathId stays null until an alternative is
  // both enabled and higher (honest about the current state).
  const enabledAlternatives = paths.filter(
    (p): p is Extract<IncomePathResult, { kind: "dti_income" }> =>
      p.role === "alternative" && p.kind === "dti_income" && p.status === "applicable",
  );
  let recommendedPathId: IncomePathId | null = null;
  let recommendationReason =
    "Standard full-documentation income (wage + self-employment). No alternative program is enabled yet.";
  for (const alt of enabledAlternatives) {
    if (alt.monthlyQualifyingIncome > primary) {
      recommendedPathId = alt.pathId;
      recommendationReason = `Alternative program (${alt.pathId}) yields higher qualifying income than full-doc.`;
    }
  }

  const requiresManualReview =
    selfEmployment.path.requiresManualReview || rentalPath.requiresManualReview;

  return {
    paths,
    primaryMonthlyQualifyingIncome: primary,
    primaryBreakdown: {
      agencyBase: agency.baseMonthlyIncome,
      agencyVariable: agency.variableMonthlyIncome,
      selfEmployment: seApplied,
      rental: rentalNet,
    },
    recommendedPathId,
    recommendationReason,
    requiresManualReview,
    incomeBasis: agency.usedLineItems ? "urla_line_items" : "application_summary",
  };
}

/** SHA-256 over the canonical inputs — same inputs, same evaluation. */
export function incomeInputsFingerprint(input: IncomePathsCoreInput): string {
  const canonical = {
    employment: input.employment
      .map((e) => ({
        se: !!e.isSelfEmployed,
        b: numOrNull(e.baseIncome),
        ot: numOrNull(e.overtimeIncome),
        bo: numOrNull(e.bonusIncome),
        c: numOrNull(e.commissionIncome),
        o: numOrNull(e.otherIncome),
        t: numOrNull(e.totalMonthlyIncome),
        // Self-employment worksheet drives the 1084 figure — hash its content.
        w: e.selfEmploymentIncome ?? null,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    otherIncome: input.otherIncome
      .map((o) => numOrNull(o.monthlyAmount))
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b),
    rental: input.rentalProperties
      .map((p) => ({ r: numOrNull(p.monthlyRentalIncome), d: numOrNull(p.monthlyDebtPayment) }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    fallback: numOrNull(input.fallbackAnnualIncome ?? null),
  };
  return sha256(JSON.stringify(canonical));
}

/** SHA-256 over the canonical path RESULTS — reproducibility of the evaluation. */
export function incomeEvaluationFingerprint(result: IncomeOrchestrationResult): string {
  return sha256(
    JSON.stringify({
      paths: canonicalizePaths(result.paths),
      primary: roundCents(result.primaryMonthlyQualifyingIncome),
      recommended: result.recommendedPathId,
      basis: result.incomeBasis,
    }),
  );
}

export interface EvaluatedIncomePaths {
  result: IncomeOrchestrationResult;
  inputsFingerprint: string;
  evaluationFingerprint: string;
}

/**
 * IO layer: load an application's income facts and evaluate every path. Reads
 * exactly what the instant-decision path reads, plus rental properties from
 * the application's incomeSources jsonb.
 */
export async function evaluateIncomePaths(app: LoanApplication): Promise<EvaluatedIncomePaths> {
  const [employment, otherIncome] = await Promise.all([
    storage.getEmploymentHistory(app.id),
    storage.getOtherIncomeSources(app.id),
  ]);
  const rentalProperties = ((app.incomeSources as IncomeSourceEntry[] | null) ?? [])
    .filter((s) => s.type === "rental")
    .flatMap((s) => s.rentalProperties ?? []);

  const input: IncomePathsCoreInput = {
    employment,
    otherIncome,
    rentalProperties,
    fallbackAnnualIncome: app.annualIncome,
  };
  const result = computeIncomePaths(input);
  return {
    result,
    inputsFingerprint: incomeInputsFingerprint(input),
    evaluationFingerprint: incomeEvaluationFingerprint(result),
  };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
