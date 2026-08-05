import { eq, desc } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { consolidatedUnderwritingEngine, UnderwritingError, type UnderwritingInput, type AssetProfile, type ResolvedPolicy } from "../underwritingEngine";
import { generateLoanEstimate } from "./loanEstimate";
import { isDecisionGrade, type DataProvenance } from "@shared/dataProvenance";
import { decisionSnapshots, incomePathEvaluations, type LoanApplication, type IncomeSourceEntry } from "@shared/schema";
import {
  computeIncomePaths,
  incomeInputsFingerprint,
  incomeEvaluationFingerprint,
  loadLatestBankStatementAnalysis,
  hasMortgageTypeLiability,
  departingResidenceInput,
  estimateSubjectPitia,
  type IncomePathsCoreInput,
} from "./income/orchestrator";
import type { IncomeOrchestrationResult } from "@shared/incomePaths";

// =============================================================================
// INSTANT DECISION ORCHESTRATOR (Tinman-style)
//
// Composes existing deterministic pieces into a single "instant decision":
//   1. Fact-based, multi-borrower financial aggregation from URLA line items.
//   2. Completeness check  -> NEEDS_MORE_INFO with the exact missing items.
//   3. Loan pricing (reuses generateLoanEstimate) -> proposed PITI.
//   4. Deterministic underwriting (ConsolidatedUnderwritingEngine, matrix-driven,
//      AI-free for Fair Lending) -> APPROVED / REJECTED / MANUAL_REVIEW + reasons.
//   5. Provenance tag: self-reported data yields a PRELIMINARY decision; only
//      verified data yields a VERIFIED (binding-grade) decision.
//
// Read-only: computes and returns a decision. Changes nothing, issues no
// commitment. Binding outcomes still go through the verified-data gate
// (shared/dataProvenance.ts) and human review per the underwriting policy.
// =============================================================================

export type DecisionStatus = "DECISION_READY" | "NEEDS_MORE_INFO";
export type Decision = "APPROVED" | "REJECTED" | "MANUAL_REVIEW";

export interface InstantDecision {
  status: DecisionStatus;
  decision: Decision | null;
  /** PRELIMINARY (self-reported data) vs VERIFIED (document/credit-backed). */
  qualifier: "PRELIMINARY" | "VERIFIED";
  isVerified: boolean;
  reasons: string[];
  missingItems: string[];
  /** Resolved thresholds/matrix cells + fingerprint for reproducibility (null pre-decision). */
  resolvedPolicy: ResolvedPolicy | null;
  /** The multi-path income evaluation behind this decision (UAL P3). Present once financials are aggregated. */
  income?: {
    result: IncomeOrchestrationResult;
    inputsFingerprint: string;
    evaluationFingerprint: string;
  };
  metrics: {
    ltv: number;
    dti: number;
    monthlyPiti: number;
    pmiMonthly: number;
    loanAmount: number;
    monthlyIncome: number;
    monthlyDebts: number;
    borrowerCount: number;
    /** "urla_line_items" (fact-based, per-borrower) or "application_summary" (fallback). */
    incomeBasis: "urla_line_items" | "application_summary";
    /** Verified liquid reserves (post-haircut) and how many PITI payments they cover. */
    liquidAssets: number;
    /**
     * Post-closing months of reserves: liquid assets REMAINING AFTER the down
     * payment, divided by PITI — the same basis as preUnderwriting's
     * computeMonthsOfReserves, so the two surfaces can never quote different
     * reserve pictures for the same borrower. Floored at 0.
     */
    monthsOfReserves: number;
  } | null;
}

// Map free-text URLA account types to the engine's asset buckets.
// Exported: the LO-2 scenario simulator buckets the same URLA assets.
export function classifyAsset(accountType: string): AssetProfile["type"] {
  const t = (accountType || "").toLowerCase();
  if (/retire|ira|401|403b|pension|annuity/.test(t)) return "RETIREMENT_IRA_401K";
  if (/stock|bond|mutual|brokerage|investment|securit|equity/.test(t)) return "STOCK_INVESTMENT";
  return "CHECKING_SAVINGS"; // checking, savings, money market, CD, cash
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim().replace(/[,$\s]/g, "");
  // Accounting/tax-form negatives are parenthesized, e.g. a K-1 loss of
  // "(21,400)". parseFloat would read this as NaN (then get zeroed by safe),
  // silently deleting the loss from qualifying income — so normalize it to a
  // real negative before parsing.
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  return negative ? -n : n;
}

function safe(v: unknown): number {
  const n = toNumber(v);
  return isNaN(n) ? 0 : n;
}

/**
 * True for infrastructure errors — anything carrying a SQLSTATE-shaped pg
 * error code — which must surface as real faults, never be translated into
 * borrower "missing info". Exported for tests.
 */
export function isSystemFault(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
}

/**
 * Translate a PRICING exception (generateLoanEstimate) into borrower/staff-facing
 * "missing info" labels — surfacing raw messages verbatim would leak internal
 * jargon into the decision UI. Order matters — the specific loan-amount case is
 * checked before the generic VALUE INPUT case.
 *
 * NOTE: the underwriting engine itself no longer needs this — every engine
 * throw is a typed UnderwritingError carrying its own borrower-safe
 * publicMessage; this mapper only serves the pricing catch below.
 */
export function describeEngineGap(err: unknown): string[] {
  const msg = err instanceof Error ? err.message : String(err);
  // §1026.36(d)(2): the LO compensation election is a STAFF task — name it
  // honestly instead of the generic gap, or every un-elected file reads as
  // the borrower's fault with nothing actionable anywhere.
  if (/compensation model and rate are required/i.test(msg)) {
    return ["Loan pricing setup by our team — no action needed from you"];
  }
  if (/VA PROTOCOL/i.test(msg)) return ["Household size", "Home square footage"];
  if (/INCOME INPUT/i.test(msg)) return ["Qualifying income"];
  if (/Loan amount must be greater than zero/i.test(msg)) {
    return ["Down payment must be less than the purchase price"];
  }
  if (/VALUE INPUT/i.test(msg)) return ["Property value"];
  if (/unrecognized state/i.test(msg)) return ["Valid property state"];
  return ["Additional information required to complete the decision"];
}

/**
 * Monthly payments on liabilities not being paid off at closing, summed across
 * all borrowers; falls back to the application-level summary figure when no
 * URLA line items exist. Shared by the instant decision and the LO-2 scenario
 * simulator so the two can never quote different debt pictures.
 */
export function sumOpenMonthlyLiabilities(
  liabilities: Array<{ toBePaidOff: boolean | null; monthlyPayment: unknown }>,
  fallbackMonthlyDebts: unknown,
): number {
  if (liabilities.length === 0) return safe(fallbackMonthlyDebts);
  let total = 0;
  for (const liability of liabilities) {
    if (liability.toBePaidOff) continue;
    total += safe(liability.monthlyPayment);
  }
  return total;
}

/** True when a value is present and parses to a real number (incl. negatives). */
function isPresentNumber(v: unknown): boolean {
  if (v === null || v === undefined || String(v).trim() === "") return false;
  return !isNaN(toNumber(v));
}

interface AggregatedFinancials {
  baseMonthlyIncome: number;
  variableMonthlyIncome: number;
  totalMonthlyIncome: number;
  monthlyDebts: number;
  borrowerCount: number;
  incomeBasis: "urla_line_items" | "application_summary";
  assets: AssetProfile[];
  /** The full multi-path evaluation behind this income (UAL P3). */
  income: IncomeOrchestrationResult;
  incomeInputsFingerprint: string;
  incomeEvaluationFingerprint: string;
}

/**
 * Aggregate qualifying income and monthly debts across EVERY borrower on the
 * application, from URLA line items when present. This removes the human step of
 * hand-tallying co-borrower income and debts, and only counts liabilities that
 * are not being paid off at closing. Falls back to the application-level summary
 * figures when line items haven't been captured yet.
 */
async function aggregateBorrowerFinancials(app: LoanApplication): Promise<AggregatedFinancials> {
  const [employment, otherIncome, liabilities, urlaAssets, bankStatementAnalysis, propertyInfo] =
    await Promise.all([
      storage.getEmploymentHistory(app.id),
      storage.getOtherIncomeSources(app.id),
      storage.getUrlaLiabilities(app.id),
      storage.getUrlaAssets(app.id),
      loadLatestBankStatementAnalysis(app.id),
      storage.getUrlaPropertyInfo(app.id),
    ]);

  // Assets across all borrowers, bucketed for the engine's reserve haircuts.
  const assets: AssetProfile[] = urlaAssets
    .map((a) => ({ type: classifyAsset(a.accountType), balance: safe(a.cashOrMarketValue) }))
    .filter((a) => a.balance > 0);

  const borrowerSeqs = new Set<number>();
  for (const e of employment) borrowerSeqs.add(e.borrowerSequenceNumber ?? 1);

  // Income: the multi-path orchestrator (UAL P3) is the single income
  // producer. It reconciles the wage math this function used to inline (agency
  // wage path) AND — the fix this cutover lands — routes self-employment
  // through the cited Form 1084 calculator instead of counting a raw captured
  // figure, plus surfaces rental / gated non-QM paths. The engine only uses
  // base+bonus as a sum, so the split is free; self-employment folds into base
  // (stable income), keeping wage-only decisions byte-identical to before.
  const rentalProperties = ((app.incomeSources as IncomeSourceEntry[] | null) ?? [])
    .filter((s) => s.type === "rental")
    .flatMap((s) => s.rentalProperties ?? []);
  const incomeInput: IncomePathsCoreInput = {
    employment,
    otherIncome,
    rentalProperties,
    fallbackAnnualIncome: app.annualIncome,
    bankStatementAnalysis,
    // B3-3.8-01 rental application (docs/fannie-mae/rental-income-reference.md):
    // positive offsets and subject-property rent only on decision-grade
    // provenance; losses always (platform-rental-preliminary-asymmetry).
    applyRentalToDti: isDecisionGrade(app.financialDataProvenance as DataProvenance),
    hasMortgageLiabilityRows: hasMortgageTypeLiability(liabilities),
    subjectProperty: propertyInfo
      ? {
          numberOfUnits: propertyInfo.numberOfUnits,
          occupancyType: propertyInfo.occupancyType,
          estimatedMarketRent: propertyInfo.estimatedMarketRent,
          estimatedPitia: estimateSubjectPitia(app.purchasePrice, app.downPayment),
        }
      : null,
    // S-07: a converting departing residence joins the per-property offsets.
    departingResidence: departingResidenceInput(app),
  };
  const income = computeIncomePaths(incomeInput);

  // Debts: monthly payments not being paid off, summed across all borrowers,
  // plus an applied net rental LOSS — B3-3.8-01 puts it in monthly
  // obligations, the numerator of DTI, never in income as a negative.
  for (const l of liabilities) borrowerSeqs.add(l.borrowerSequenceNumber ?? 1);
  const monthlyDebts =
    sumOpenMonthlyLiabilities(liabilities, app.monthlyDebts) +
    income.primaryBreakdown.rentalLiabilityApplied;

  // Engine split (base+bonus, used only as a sum): agency variable is "bonus";
  // agency base + self-employment are "base"; applied rental income (non-
  // subject positive offsets + subject-property qualifying rent) rides in
  // "variable" so base + variable always equals the primary total. For a
  // wage-only file this is exactly the legacy split.
  return {
    baseMonthlyIncome: income.primaryBreakdown.agencyBase + income.primaryBreakdown.selfEmployment,
    variableMonthlyIncome:
      income.primaryBreakdown.agencyVariable +
      income.primaryBreakdown.rentalIncomeApplied +
      income.primaryBreakdown.subjectRentalIncomeApplied,
    totalMonthlyIncome: income.primaryMonthlyQualifyingIncome,
    monthlyDebts,
    borrowerCount: Math.max(borrowerSeqs.size, 1),
    incomeBasis: income.incomeBasis,
    assets,
    income,
    incomeInputsFingerprint: incomeInputsFingerprint(incomeInput),
    incomeEvaluationFingerprint: incomeEvaluationFingerprint(income),
  };
}

export async function runInstantDecision(applicationId: string): Promise<InstantDecision> {
  const app = await storage.getLoanApplication(applicationId);
  if (!app) {
    throw new Error("Application not found");
  }

  const isVerified = isDecisionGrade(app.financialDataProvenance as DataProvenance);
  const qualifier: InstantDecision["qualifier"] = isVerified ? "VERIFIED" : "PRELIMINARY";

  const fin = await aggregateBorrowerFinancials(app);

  // Every decision (including NEEDS_MORE_INFO) carries the income evaluation
  // that produced its income figure, so recalculateDecision can persist it and
  // link it to the snapshot.
  const base: Pick<InstantDecision, "qualifier" | "isVerified" | "income"> = {
    qualifier,
    isVerified,
    income: {
      result: fin.income,
      inputsFingerprint: fin.incomeInputsFingerprint,
      evaluationFingerprint: fin.incomeEvaluationFingerprint,
    },
  };

  // Completeness — the "Need More Info" state, with the specific gaps.
  const purchasePrice = toNumber(app.purchasePrice);
  const downPayment = toNumber(app.downPayment);
  const missing: string[] = [];
  if (fin.totalMonthlyIncome <= 0) {
    missing.push(
      fin.incomeBasis === "urla_line_items"
        ? "Net qualifying income is zero or negative after business losses — a self-employed income review is required before a decision."
        : "Income (no employment or income sources on file)",
    );
  }
  if (!app.creditScore) missing.push("Credit score");
  if (!purchasePrice || purchasePrice <= 0) missing.push("Purchase price");
  if (isNaN(downPayment) || downPayment < 0) missing.push("Down payment");
  // A down payment at or above the price leaves a zero/negative loan amount,
  // which the engine would otherwise "approve" (LTV <= 0 clears every ceiling).
  if (!isNaN(downPayment) && purchasePrice > 0 && downPayment >= purchasePrice) {
    missing.push("Down payment must be less than the purchase price");
  }
  if (!app.propertyState) missing.push("Property state");
  // VA path: the residual-income evaluation needs both of these — surface them
  // as named gaps here instead of letting the engine throw its protocol error.
  if (app.isVeteran) {
    if (!app.householdFamilySize) missing.push("Household size (required for VA residual income)");
    if (!app.homeSquareFootage) missing.push("Home square footage (required for VA residual income)");
  }

  if (missing.length > 0) {
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: missing, metrics: null, resolvedPolicy: null, ...base };
  }

  // Price the loan to get a proposed PITI (reuses the loan-estimate service).
  let monthlyPiti: number;
  try {
    const le = await generateLoanEstimate(applicationId);
    monthlyPiti = le.projectedPayments.years1Through5.estimatedTotal;
  } catch (err) {
    // A database/system fault must never masquerade as a borrower-info gap —
    // the underwriting catch below already rethrows faults; this catch must
    // match (a missing table once surfaced as "additional information
    // required" and blocked files with an unactionable message).
    if (isSystemFault(err)) throw err;
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: describeEngineGap(err), metrics: null, resolvedPolicy: null, ...base };
  }

  // Subject-property occupancy and unit count drive the agency max-LTV
  // eligibility caps; pull them from the URLA property record when captured so a
  // multi-unit or investment property is not decisioned as an owner-occupied SFR.
  const propertyInfo = await storage.getUrlaPropertyInfo(applicationId);

  // Run the deterministic engine on the aggregated, multi-borrower figures.
  const input: UnderwritingInput = {
    isVeteran: app.isVeteran ?? false,
    baseMonthlyIncome: fin.baseMonthlyIncome,
    bonusMonthlyIncome: fin.variableMonthlyIncome,
    existingMonthlyDebts: fin.monthlyDebts,
    originalLoanAmount: purchasePrice - downPayment,
    contractSalesPrice: purchasePrice,
    appraisalValue: toNumber(app.propertyValue) || purchasePrice,
    representativeFico: app.creditScore!, // guaranteed non-null by the completeness check above
    proposedPiti: monthlyPiti,
    assets: fin.assets,
    subjectPropertyState: app.propertyState ?? undefined,
    occupancyType: propertyInfo?.occupancyType ?? undefined,
    numberOfUnits: propertyInfo?.numberOfUnits ?? undefined,
    // Declared property type, reconciled against the declared unit count. The
    // OBSERVED (vendor-lookup) descriptor is not yet wired — capturing it at
    // intake is the remaining piece to catch a consistent misstatement.
    propertyType: app.propertyType ?? undefined,
    householdFamilySize: app.householdFamilySize ?? undefined,
    homeSquareFootage: app.homeSquareFootage ?? undefined,
  };

  let result;
  try {
    result = await consolidatedUnderwritingEngine.evaluate(input);
  } catch (err) {
    if (err instanceof UnderwritingError) {
      // A genuinely missing/unusable input is the only case that should loop
      // back for more information — and only with a borrower-safe message, never
      // the raw internal detail.
      if (err.kind === "INPUT_INCOMPLETE" || err.kind === "INPUT_INVALID") {
        return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: [err.publicMessage], metrics: null, resolvedPolicy: null, ...base };
      }
      // A profile outside the automated pricing/eligibility matrices is a
      // DECISION, not a documentation gap: route it to a human as MANUAL_REVIEW
      // so it lands in the queue with an auditable reason instead of crashing or
      // looping forever asking for documents that would never resolve it.
      if (err.kind === "POLICY_OUT_OF_BAND") {
        return { status: "DECISION_READY", decision: "MANUAL_REVIEW", reasons: [err.publicMessage], missingItems: [], metrics: null, resolvedPolicy: null, ...base };
      }
    }
    // Anything else (e.g. a missing policy matrix) is a system fault, not an
    // underwriting outcome — let it surface as a real error rather than masking
    // it as "needs more info".
    throw err;
  }

  return {
    status: "DECISION_READY",
    decision: result.decision,
    // Rejections and review reasons both explain the outcome to the borrower/LO;
    // the decision field distinguishes a decline from a "needs a human" review.
    reasons: [...result.rejectionReasons, ...result.reviewReasons],
    missingItems: [],
    resolvedPolicy: result.resolvedPolicy,
    metrics: {
      ltv: result.calculatedLtv,
      dti: result.calculatedDti,
      monthlyPiti,
      pmiMonthly: result.resolvedPmiMonthlyPremium,
      loanAmount: input.originalLoanAmount,
      monthlyIncome: fin.totalMonthlyIncome,
      monthlyDebts: fin.monthlyDebts,
      borrowerCount: fin.borrowerCount,
      incomeBasis: fin.incomeBasis,
      liquidAssets: result.calculatedLiquidAssets,
      // Net of the down payment (post-closing reserves), matching
      // preUnderwriting.computeMonthsOfReserves — previously the gross balance
      // was divided, overstating reserves by the entire down payment.
      monthsOfReserves: monthlyPiti > 0
        ? Math.round((Math.max(result.calculatedLiquidAssets - downPayment, 0) / monthlyPiti) * 10) / 10
        : 0,
    },
    ...base,
  };
}

/**
 * Real-time recalc ("context graph"): re-run the decision and persist an
 * immutable snapshot with the trigger that caused it. Call this fire-and-forget
 * whenever a fact changes (credit pull, income/liability update, verification).
 * Best-effort — it never throws into the calling request.
 */
export async function recalculateDecision(
  applicationId: string,
  trigger: string,
): Promise<InstantDecision | null> {
  try {
    const d = await runInstantDecision(applicationId);

    // Persist the multi-path income evaluation (UAL P3) first, so the decision
    // snapshot can record which evaluation produced its income figure. This is
    // append-only, exactly like the snapshot; a re-run with unchanged inputs
    // makes a new row (the evaluationFingerprint identifies duplicates).
    let incomePathEvaluationId: string | null = null;
    if (d.income) {
      const [evaluation] = await db
        .insert(incomePathEvaluations)
        .values({
          applicationId,
          trigger,
          paths: d.income.result.paths,
          primaryMonthlyQualifyingIncome: String(d.income.result.primaryMonthlyQualifyingIncome),
          recommendedPathId: d.income.result.recommendedPathId,
          incomeBasis: d.income.result.incomeBasis,
          requiresManualReview: d.income.result.requiresManualReview,
          inputsFingerprint: d.income.inputsFingerprint,
          evaluationFingerprint: d.income.evaluationFingerprint,
        })
        .returning({ id: incomePathEvaluations.id });
      incomePathEvaluationId = evaluation.id;
    }

    await db.insert(decisionSnapshots).values({
      applicationId,
      trigger,
      status: d.status,
      decision: d.decision,
      qualifier: d.qualifier,
      dti: d.metrics ? String(d.metrics.dti) : null,
      ltv: d.metrics ? String(d.metrics.ltv) : null,
      monthlyIncome: d.metrics ? String(d.metrics.monthlyIncome) : null,
      monthlyDebts: d.metrics ? String(d.metrics.monthlyDebts) : null,
      monthlyPiti: d.metrics ? String(d.metrics.monthlyPiti) : null,
      loanAmount: d.metrics ? String(d.metrics.loanAmount) : null,
      borrowerCount: d.metrics ? d.metrics.borrowerCount : null,
      incomeBasis: d.metrics ? d.metrics.incomeBasis : null,
      reasons: d.reasons,
      missingItems: d.missingItems,
      resolvedPolicy: d.resolvedPolicy ?? null,
      policyFingerprint: d.resolvedPolicy?.fingerprint ?? null,
      incomePathEvaluationId,
    });
    return d;
  } catch (err) {
    console.error(`[decisionEngine] recalc failed for ${applicationId} (${trigger}):`, err);
    return null;
  }
}

/** Time-ordered decision snapshots for an application (newest first). */
export async function getDecisionHistory(applicationId: string, limit = 20) {
  return db
    .select()
    .from(decisionSnapshots)
    .where(eq(decisionSnapshots.applicationId, applicationId))
    .orderBy(desc(decisionSnapshots.createdAt))
    .limit(limit);
}
