import { storage } from "../storage";
import { consolidatedUnderwritingEngine, type UnderwritingInput } from "../underwritingEngine";
import { generateLoanEstimate } from "./loanEstimate";
import { isDecisionGrade, type DataProvenance } from "@shared/dataProvenance";
import type { LoanApplication } from "@shared/schema";

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
  } | null;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  return parseFloat(String(v).replace(/[,$]/g, ""));
}

function safe(v: unknown): number {
  const n = toNumber(v);
  return isNaN(n) ? 0 : n;
}

interface AggregatedFinancials {
  baseMonthlyIncome: number;
  variableMonthlyIncome: number;
  totalMonthlyIncome: number;
  monthlyDebts: number;
  borrowerCount: number;
  incomeBasis: "urla_line_items" | "application_summary";
}

/**
 * Aggregate qualifying income and monthly debts across EVERY borrower on the
 * application, from URLA line items when present. This removes the human step of
 * hand-tallying co-borrower income and debts, and only counts liabilities that
 * are not being paid off at closing. Falls back to the application-level summary
 * figures when line items haven't been captured yet.
 */
async function aggregateBorrowerFinancials(app: LoanApplication): Promise<AggregatedFinancials> {
  const [employment, otherIncome, liabilities] = await Promise.all([
    storage.getEmploymentHistory(app.id),
    storage.getOtherIncomeSources(app.id),
    storage.getUrlaLiabilities(app.id),
  ]);

  const borrowerSeqs = new Set<number>();

  // Income: base vs variable (overtime/bonus/commission/other), summed across all borrowers.
  let base = 0;
  let variable = 0;
  for (const e of employment) {
    borrowerSeqs.add(e.borrowerSequenceNumber ?? 1);
    const b = safe(e.baseIncome);
    const varComponents = safe(e.overtimeIncome) + safe(e.bonusIncome) + safe(e.commissionIncome) + safe(e.otherIncome);
    if (b + varComponents > 0) {
      base += b;
      variable += varComponents;
    } else {
      // Only a rolled-up total was captured for this job.
      base += safe(e.totalMonthlyIncome);
    }
  }
  for (const o of otherIncome) {
    variable += safe(o.monthlyAmount);
  }

  // Debts: monthly payments not being paid off, summed across all borrowers.
  let monthlyDebts = 0;
  for (const l of liabilities) {
    borrowerSeqs.add(l.borrowerSequenceNumber ?? 1);
    if (l.toBePaidOff) continue;
    monthlyDebts += safe(l.monthlyPayment);
  }

  const hasUrlaIncome = employment.length > 0 && base + variable > 0;
  const hasUrlaLiabilities = liabilities.length > 0;

  // Fall back to the application-level summary when line items are absent.
  if (!hasUrlaIncome) {
    const annual = safe(app.annualIncome);
    base = annual / 12;
    variable = 0;
  }
  if (!hasUrlaLiabilities) {
    monthlyDebts = safe(app.monthlyDebts);
  }

  return {
    baseMonthlyIncome: base,
    variableMonthlyIncome: variable,
    totalMonthlyIncome: base + variable,
    monthlyDebts,
    borrowerCount: Math.max(borrowerSeqs.size, 1),
    incomeBasis: hasUrlaIncome ? "urla_line_items" : "application_summary",
  };
}

export async function runInstantDecision(applicationId: string): Promise<InstantDecision> {
  const app = await storage.getLoanApplication(applicationId);
  if (!app) {
    throw new Error("Application not found");
  }

  const isVerified = isDecisionGrade(app.financialDataProvenance as DataProvenance);
  const qualifier: InstantDecision["qualifier"] = isVerified ? "VERIFIED" : "PRELIMINARY";
  const base: Pick<InstantDecision, "qualifier" | "isVerified"> = { qualifier, isVerified };

  const fin = await aggregateBorrowerFinancials(app);

  // Completeness — the "Need More Info" state, with the specific gaps.
  const purchasePrice = toNumber(app.purchasePrice);
  const downPayment = toNumber(app.downPayment);
  const missing: string[] = [];
  if (fin.totalMonthlyIncome <= 0) missing.push("Income (no employment or income sources on file)");
  if (!app.creditScore) missing.push("Credit score");
  if (!purchasePrice || purchasePrice <= 0) missing.push("Purchase price");
  if (isNaN(downPayment) || downPayment < 0) missing.push("Down payment");
  if (!app.propertyState) missing.push("Property state");

  if (missing.length > 0) {
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: missing, metrics: null, ...base };
  }

  // Price the loan to get a proposed PITI (reuses the loan-estimate service).
  let monthlyPiti: number;
  try {
    const le = await generateLoanEstimate(applicationId);
    monthlyPiti = le.projectedPayments.years1Through5.estimatedTotal;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unable to price loan";
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: [detail], metrics: null, ...base };
  }

  // Run the deterministic engine on the aggregated, multi-borrower figures.
  const input: UnderwritingInput = {
    isVeteran: app.isVeteran ?? false,
    baseMonthlyIncome: fin.baseMonthlyIncome,
    bonusMonthlyIncome: fin.variableMonthlyIncome,
    existingMonthlyDebts: fin.monthlyDebts,
    originalLoanAmount: purchasePrice - downPayment,
    contractSalesPrice: purchasePrice,
    appraisalValue: toNumber(app.propertyValue) || purchasePrice,
    representativeFico: app.creditScore,
    proposedPiti: monthlyPiti,
    assets: [],
    subjectPropertyState: app.propertyState ?? undefined,
  };

  let result;
  try {
    result = await consolidatedUnderwritingEngine.evaluate(input);
  } catch (err) {
    // The engine throws for missing VA inputs (family size / square footage) or
    // invalid values — surface as a "need more info" gap rather than a 500.
    const detail = err instanceof Error ? err.message : "additional information required";
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: [detail], metrics: null, ...base };
  }

  return {
    status: "DECISION_READY",
    decision: result.decision,
    reasons: result.rejectionReasons,
    missingItems: [],
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
    },
    ...base,
  };
}
