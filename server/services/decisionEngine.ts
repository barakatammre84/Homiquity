import { storage } from "../storage";
import { consolidatedUnderwritingEngine, type UnderwritingInput } from "../underwritingEngine";
import { generateLoanEstimate } from "./loanEstimate";
import { isDecisionGrade, type DataProvenance } from "@shared/dataProvenance";

// =============================================================================
// INSTANT DECISION ORCHESTRATOR (Tinman-style)
//
// Composes existing deterministic pieces into a single "instant decision":
//   1. Completeness check  -> NEEDS_MORE_INFO with the exact missing items.
//   2. Loan pricing (reuses generateLoanEstimate) -> proposed PITI.
//   3. Deterministic underwriting (ConsolidatedUnderwritingEngine, matrix-driven,
//      AI-free for Fair Lending) -> APPROVED / REJECTED / MANUAL_REVIEW + reasons.
//   4. Provenance tag: self-reported data yields a PRELIMINARY decision; only
//      verified data yields a VERIFIED (binding-grade) decision.
//
// This is read-only: it computes and returns a decision. It does NOT change the
// application status or issue any commitment. Wiring it to a binding outcome must
// go through the verified-data gate (see shared/dataProvenance.ts) and human
// review per the underwriting policy.
// =============================================================================

export type DecisionStatus = "DECISION_READY" | "NEEDS_MORE_INFO";
export type Decision = "APPROVED" | "REJECTED" | "MANUAL_REVIEW";

export interface InstantDecision {
  status: DecisionStatus;
  decision: Decision | null;
  /** PRELIMINARY (self-reported data) vs VERIFIED (document/credit-backed). */
  qualifier: "PRELIMINARY" | "VERIFIED";
  isVerified: boolean;
  /** Rejection / manual-review reasons from the deterministic engine. */
  reasons: string[];
  /** What's needed before a decision can be produced. */
  missingItems: string[];
  metrics: {
    ltv: number;
    dti: number;
    monthlyPiti: number;
    pmiMonthly: number;
    loanAmount: number;
  } | null;
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  return parseFloat(String(v).replace(/[,$]/g, ""));
}

export async function runInstantDecision(applicationId: string): Promise<InstantDecision> {
  const app = await storage.getLoanApplication(applicationId);
  if (!app) {
    throw new Error("Application not found");
  }

  const isVerified = isDecisionGrade(app.financialDataProvenance as DataProvenance);
  const qualifier: InstantDecision["qualifier"] = isVerified ? "VERIFIED" : "PRELIMINARY";

  const base: Pick<InstantDecision, "qualifier" | "isVerified"> = { qualifier, isVerified };

  // 1. Completeness — the "Need More Info" state, with the specific gaps.
  const annualIncome = toNumber(app.annualIncome);
  const monthlyDebts = toNumber(app.monthlyDebts);
  const purchasePrice = toNumber(app.purchasePrice);
  const downPayment = toNumber(app.downPayment);

  const missing: string[] = [];
  if (!annualIncome || annualIncome <= 0) missing.push("Annual income");
  if (isNaN(monthlyDebts)) missing.push("Monthly debt payments");
  if (!app.creditScore) missing.push("Credit score");
  if (!purchasePrice || purchasePrice <= 0) missing.push("Purchase price");
  if (isNaN(downPayment) || downPayment < 0) missing.push("Down payment");
  if (!app.propertyState) missing.push("Property state");

  if (missing.length > 0) {
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: missing, metrics: null, ...base };
  }

  // 2. Price the loan to get a proposed PITI (reuses the loan-estimate service).
  let monthlyPiti: number;
  try {
    const le = await generateLoanEstimate(applicationId);
    monthlyPiti = le.projectedPayments.years1Through5.estimatedTotal;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unable to price loan";
    return { status: "NEEDS_MORE_INFO", decision: null, reasons: [], missingItems: [detail], metrics: null, ...base };
  }

  // 3. Run the deterministic engine.
  const input: UnderwritingInput = {
    isVeteran: app.isVeteran ?? false,
    baseMonthlyIncome: annualIncome / 12,
    bonusMonthlyIncome: 0, // v1: base income only; additional income sources added later
    existingMonthlyDebts: monthlyDebts,
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
    },
    ...base,
  };
}
