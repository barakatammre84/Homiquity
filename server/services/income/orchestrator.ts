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
import { isDecisionGrade, type DataProvenance } from "@shared/dataProvenance";
import { storage } from "../../storage";
import { calculateSubjectPropertyQualifyingRent } from "../underwritingNuance";
import { computeAgencyWageIncome } from "./paths/agencyWage";
import { computeSelfEmploymentPath } from "./paths/selfEmployment";
import { computeRentalPath } from "./paths/rental";
import { computeDscrPath } from "./paths/dscr";
import {
  computeBankStatementPath,
  BANK_STATEMENT_PERIODS,
  type BankStatementAnalysisInput,
} from "./paths/bankStatement";

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
 * but not auto-applied — see rental.ts). Alternative methods carry their own
 * program authority (P4): DSCR computes the cited Rent-Divided-PITIA ratio
 * over declared rentals (no in-repo qualifying threshold — always review);
 * bank-statement math is cited and available but has no capture surface until
 * P5. Same inputs → same result → same evaluation fingerprint.
 */

export interface IncomePathsCoreInput {
  employment: EmploymentHistory[];
  otherIncome: OtherIncomeSource[];
  rentalProperties: RentalPropertyEntry[];
  fallbackAnnualIncome?: number | string | null;
  /** Latest captured bank-statement deposit analysis (P5 capture surface). */
  bankStatementAnalysis?: BankStatementAnalysisInput;
  /**
   * Decision-grade provenance gate (shared/dataProvenance isDecisionGrade):
   * POSITIVE rental offsets and subject-property rent apply to qualifying
   * income only when true. Losses apply regardless (ledger
   * platform-rental-preliminary-asymmetry). Defaults false — conservative.
   */
  applyRentalToDti?: boolean;
  /** URLA liabilities contain mortgage-type rows (B3-3.8-01 double-count guard). */
  hasMortgageLiabilityRows?: boolean;
  /** Subject-property facts for the B3-3.8-01 2–4-unit owner-occupied rent rule. */
  subjectProperty?: {
    numberOfUnits: number | null;
    occupancyType: string | null;
    estimatedMarketRent: number | string | null;
  } | null;
}

export function computeIncomePaths(input: IncomePathsCoreInput): IncomeOrchestrationResult {
  const agency = computeAgencyWageIncome({
    employment: input.employment,
    otherIncome: input.otherIncome,
    fallbackAnnualIncome: input.fallbackAnnualIncome,
  });
  const selfEmployment = computeSelfEmploymentPath(input.employment);
  const rentalPath = computeRentalPath(input.rentalProperties, {
    applyPositiveToDti: input.applyRentalToDti === true,
    hasMortgageLiabilityRows: input.hasMortgageLiabilityRows === true,
  });

  const hasSelfEmployment = selfEmployment.path.status === "applicable";
  const dscr = computeDscrPath(input.rentalProperties);
  const bankStatement = computeBankStatementPath(hasSelfEmployment, input.bankStatementAnalysis);

  const paths: IncomePathResult[] = [
    agency.path,
    selfEmployment.path,
    rentalPath,
    bankStatement,
    dscr,
  ];

  // Primary DTI income = applied component dti_income paths. Rental applies
  // per B3-3.8-01 (ledger fnma-b3-3-8-01-rental-offset-dti): a positive net
  // offset joins the income side here; a LOSS is surfaced as a liability for
  // the decision engine to add to monthly obligations — never negative income
  // (the two land in different halves of the DTI ratio).
  const agencyApplied = agency.path.monthlyQualifyingIncome;
  const seApplied = selfEmployment.path.monthlyQualifyingIncome;
  const rentalNet = rentalPath.status === "applicable" ? rentalPath.monthlyQualifyingIncome : 0;
  const rentalIncomeApplied =
    rentalPath.appliedToDti && rentalNet > 0 ? roundCents(rentalNet) : 0;
  const rentalLiabilityApplied =
    rentalPath.appliedToDti && rentalNet < 0 ? roundCents(-rentalNet) : 0;

  // Subject-property 2–4-unit owner-occupied rent (B3-3.8-01, ledger
  // fnma-b3-3-8-01-subject-rental-income): qualifying rent is ADDED to income;
  // the full subject PITIA stays in the housing expense — never netted here.
  // Same provenance gate as positive rental (platform asymmetry policy).
  const subjectQualifyingRent = calculateSubjectPropertyQualifyingRent(
    input.subjectProperty?.estimatedMarketRent,
    input.subjectProperty?.numberOfUnits,
    input.subjectProperty?.occupancyType,
  );
  const subjectRentalIncomeApplied =
    input.applyRentalToDti === true && subjectQualifyingRent !== null
      ? roundCents(subjectQualifyingRent)
      : 0;

  const primary = roundCents(
    agencyApplied + seApplied + rentalIncomeApplied + subjectRentalIncomeApplied,
  );

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
      rental: roundCents(rentalNet),
      rentalIncomeApplied,
      rentalLiabilityApplied,
      subjectRentalIncomeApplied,
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
    bankStatement: input.bankStatementAnalysis
      ? {
          m: input.bankStatementAnalysis.months,
          d: numOrNull(input.bankStatementAnalysis.totalEligibleDeposits),
          f: numOrNull(input.bankStatementAnalysis.expenseFactor ?? null),
          c: !!input.bankStatementAnalysis.hasThirdPartyExpenseStatement,
        }
      : null,
    // Rental DTI application context (B3-3.8-01 wiring): the provenance gate,
    // the mortgage-liability coexistence guard, and the subject-property facts
    // all change the applied result, so they are part of the inputs identity.
    rentalApply: input.applyRentalToDti === true,
    mortgageLiabRows: input.hasMortgageLiabilityRows === true,
    subject: input.subjectProperty
      ? {
          u: input.subjectProperty.numberOfUnits ?? null,
          o: input.subjectProperty.occupancyType ?? null,
          r: numOrNull(input.subjectProperty.estimatedMarketRent),
        }
      : null,
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
 * Latest captured bank-statement deposit analysis for an application (P5
 * capture surface), adapted to the calculator's input shape. Null when none
 * captured or the row fails the program's period constraint.
 */
export async function loadLatestBankStatementAnalysis(
  applicationId: string,
): Promise<BankStatementAnalysisInput | undefined> {
  const row = await storage.getLatestBankStatementAnalysis(applicationId);
  if (!row) return undefined;
  const months = row.months as (typeof BANK_STATEMENT_PERIODS)[number];
  if (!BANK_STATEMENT_PERIODS.includes(months)) return undefined;
  return {
    months,
    totalEligibleDeposits: Number(row.totalEligibleDeposits),
    expenseFactor: row.expenseFactor !== null ? Number(row.expenseFactor) : undefined,
    hasThirdPartyExpenseStatement: row.hasThirdPartyExpenseStatement,
  };
}

/**
 * True when any URLA liability row is mortgage-shaped (mortgage/HELOC/home
 * equity). Used by the B3-3.8-01 double-count guard: an applied rental offset
 * already carries the property's PITIA inside the net, so a coexisting
 * mortgage-type liability row may count the same payment twice.
 */
export function hasMortgageTypeLiability(
  liabilities: Array<{ liabilityType: string | null }>,
): boolean {
  return liabilities.some((l) => /mortgage|heloc|home[\s_-]?equity/i.test(l.liabilityType ?? ""));
}

/**
 * IO layer: load an application's income facts and evaluate every path. Reads
 * exactly what the instant-decision path reads, plus rental properties from
 * the application's incomeSources jsonb, the latest captured bank-statement
 * analysis, URLA liabilities (double-count guard), and the subject-property
 * facts (B3-3.8-01 2–4-unit owner-occupied rent).
 */
export async function evaluateIncomePaths(app: LoanApplication): Promise<EvaluatedIncomePaths> {
  const [employment, otherIncome, bankStatementAnalysis, liabilities, propertyInfo] =
    await Promise.all([
      storage.getEmploymentHistory(app.id),
      storage.getOtherIncomeSources(app.id),
      loadLatestBankStatementAnalysis(app.id),
      storage.getUrlaLiabilities(app.id),
      storage.getUrlaPropertyInfo(app.id),
    ]);
  const rentalProperties = ((app.incomeSources as IncomeSourceEntry[] | null) ?? [])
    .filter((s) => s.type === "rental")
    .flatMap((s) => s.rentalProperties ?? []);

  const input: IncomePathsCoreInput = {
    employment,
    otherIncome,
    rentalProperties,
    fallbackAnnualIncome: app.annualIncome,
    bankStatementAnalysis,
    applyRentalToDti: isDecisionGrade(app.financialDataProvenance as DataProvenance),
    hasMortgageLiabilityRows: hasMortgageTypeLiability(liabilities),
    subjectProperty: propertyInfo
      ? {
          numberOfUnits: propertyInfo.numberOfUnits,
          occupancyType: propertyInfo.occupancyType,
          estimatedMarketRent: propertyInfo.estimatedMarketRent,
        }
      : null,
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
