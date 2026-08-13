// ---------------------------------------------------------------------------
// Issued Loan Estimate baseline — the TRID good-faith tolerance record.
//
// The problem this exists to fix: generateLoanEstimate() builds the LE from
// live file data on every call, and nothing was ever persisted. So the LE a
// borrower was shown on day one silently became a different LE on day ten, no
// record survived of what had been disclosed, and no tolerance comparison was
// possible because the baseline did not exist.
//
// The rule this implements (Reg Z §1026.19(e)(3)): what was disclosed stands
// until a valid changed circumstance (§1026.19(e)(3)(iv)) resets it. So:
//
//   * First borrower delivery persists version 1. That IS the baseline.
//   * Later retrievals compare the freshly-computed LE against the baseline.
//     - Nothing increased           → the baseline still stands; serve it.
//     - Increases + an open CoC     → redisclose: persist version n+1 linked
//                                     to that CoC, which resets the baseline.
//     - Increases + NO CoC          → do NOT redisclose. The borrower keeps
//                                     seeing what was disclosed, and the delta
//                                     is recorded as a cure the originator
//                                     owes at closing.
//
// That last branch is the whole point. Silently regenerating a higher LE is
// not a disclosure — it is the tolerance violation, hidden.
//
// Determinism: pure comparison lives in shared/compliance/feeTolerance.ts;
// this module is the IO seam around it.
// ---------------------------------------------------------------------------

import { storage } from "../storage";
import {
  authorizationFrom,
  buildDisclosureSnapshot,
  evaluateTolerance,
  type DisclosureSnapshot,
  type ToleranceEvaluation,
} from "@shared/compliance/feeTolerance";
import type { LoanEstimateData } from "./loanEstimate";
import type { LoanEstimateDisclosure } from "@shared/schema";

/** LE → the tolerance-bucketed subset that baselines are compared on. Pure. */
export function snapshotFromLoanEstimate(le: LoanEstimateData): DisclosureSnapshot {
  const costs = le.closingCostDetails;
  const origination = costs.loanCosts.originationCharges;

  return buildDisclosureSnapshot({
    loanAmount: le.loanTerms.loanAmount,
    interestRate: le.loanTerms.interestRate,
    originationCharges: {
      // Itemized since F-7; before that it was folded into the section total.
      originationFee: origination.originationFee,
      points: origination.points,
      applicationFee: origination.applicationFee,
      underwritingFee: origination.underwritingFee,
    },
    servicesYouCannotShopFor: costs.loanCosts.servicesYouCannotShopFor,
    servicesYouCanShopFor: {
      titleInsurance: costs.loanCosts.servicesYouCanShopFor.titleInsurance,
      titleSearch: costs.loanCosts.servicesYouCanShopFor.titleSearch,
      surveyFee: costs.loanCosts.servicesYouCanShopFor.surveyFee,
      pestInspection: costs.loanCosts.servicesYouCanShopFor.pestInspection,
    },
    taxesAndGovernmentFees: costs.otherCosts.taxesAndGovernmentFees,
    prepaids: costs.otherCosts.prepaids,
    initialEscrow: costs.otherCosts.initialEscrowPaymentAtClosing,
    otherItems: costs.otherCosts.otherItems,
  });
}

/**
 * Overlay the fees that were actually DISCLOSED back onto a freshly-computed
 * Loan Estimate, recomputing every dependent total the same way
 * generateLoanEstimate does.
 *
 * Used when the file's charges drifted upward with no changed circumstance:
 * the borrower is entitled to the figures that were disclosed, not to
 * whatever the fee model produces today.
 *
 * Lender credits are carried from the live LE rather than the snapshot — a
 * credit is not a disclosed charge and a larger one only benefits the
 * borrower, so holding it back would be the wrong kind of faithful.
 *
 * Pure.
 */
export function applyDisclosedFees(le: LoanEstimateData, snapshot: DisclosureSnapshot): LoanEstimateData {
  const fee = (id: string): number => snapshot.fees.find(f => f.id === id)?.amount ?? 0;
  const r = (n: number) => Math.round(n);

  const originationFee = fee("origination_fee");
  const points = fee("points");
  const applicationFee = fee("application_fee");
  const underwritingFee = fee("underwriting_fee");
  const sectionA = originationFee + points + applicationFee + underwritingFee;

  const appraisal = fee("appraisal");
  const creditReport = fee("credit_report");
  const floodDetermination = fee("flood_determination");
  const taxService = fee("tax_service");
  const sectionB = appraisal + creditReport + floodDetermination + taxService;

  const titleInsurance = fee("title_insurance");
  const titleSearch = fee("title_search");
  const surveyFee = fee("survey_fee");
  const pestInspection = fee("pest_inspection");
  const sectionC = titleInsurance + titleSearch + surveyFee + pestInspection;

  const recordingFees = fee("recording_fees");
  const transferTaxes = fee("transfer_taxes");
  const govFees = recordingFees + transferTaxes;

  const prepaidHoi = fee("prepaid_hoi");
  const prepaidMi = fee("prepaid_mi");
  const prepaidInterest = fee("prepaid_interest");
  const prepaidTaxes = fee("prepaid_taxes");
  const prepaids = prepaidHoi + prepaidMi + prepaidInterest + prepaidTaxes;

  const escrowHoi = fee("escrow_hoi");
  const escrowMi = fee("escrow_mi");
  const escrowTaxes = fee("escrow_taxes");
  const escrows = escrowHoi + escrowMi + escrowTaxes;

  const ownersTitle = fee("owners_title");

  const loanCostsTotal = sectionA + sectionB + sectionC;
  const otherCostsTotal = govFees + prepaids + escrows + ownersTitle;
  const totalClosingCosts = loanCostsTotal + otherCostsTotal;

  const downPayment = le.cashToClose.downPayment;
  const lenderCredits = le.cashToClose.adjustmentsAndOtherCredits;
  const cashToClose = totalClosingCosts + downPayment - lenderCredits;

  return {
    ...le,
    costsAtClosing: {
      estimatedClosingCosts: r(totalClosingCosts),
      estimatedCashToClose: r(cashToClose),
    },
    closingCostDetails: {
      loanCosts: {
        originationCharges: {
          originationFee: r(originationFee),
          points: r(points),
          applicationFee: r(applicationFee),
          underwritingFee: r(underwritingFee),
          total: r(sectionA),
        },
        servicesYouCannotShopFor: {
          appraisal: r(appraisal),
          creditReport: r(creditReport),
          floodDetermination: r(floodDetermination),
          taxService: r(taxService),
          total: r(sectionB),
        },
        servicesYouCanShopFor: {
          titleInsurance: r(titleInsurance),
          titleSearch: r(titleSearch),
          surveyFee: r(surveyFee),
          pestInspection: r(pestInspection),
          total: r(sectionC),
        },
        totalLoanCosts: r(loanCostsTotal),
      },
      otherCosts: {
        taxesAndGovernmentFees: {
          recordingFees: r(recordingFees),
          transferTaxes: r(transferTaxes),
          total: r(govFees),
        },
        prepaids: {
          homeownersInsurance: r(prepaidHoi),
          mortgageInsurance: r(prepaidMi),
          prepaidInterest: r(prepaidInterest),
          propertyTaxes: r(prepaidTaxes),
          total: r(prepaids),
        },
        initialEscrowPaymentAtClosing: {
          homeownersInsurance: r(escrowHoi),
          mortgageInsurance: r(escrowMi),
          propertyTaxes: r(escrowTaxes),
          total: r(escrows),
        },
        otherItems: {
          ownersTitleInsurance: r(ownersTitle),
          total: r(ownersTitle),
        },
        totalOtherCosts: r(otherCostsTotal),
      },
      totalClosingCosts: r(totalClosingCosts),
    },
    cashToClose: {
      ...le.cashToClose,
      totalClosingCosts: r(totalClosingCosts),
      fundsFromBorrower: r(downPayment + totalClosingCosts),
      cashToClose: r(cashToClose),
    },
  };
}

export interface BaselineDecision {
  /** What the borrower must be shown. */
  action: "issued_first" | "unchanged" | "redisclosed" | "blocked_no_coc";
  /** The disclosure now in force. */
  disclosure: LoanEstimateDisclosure;
  evaluation: ToleranceEvaluation | null;
  /** Set when a redisclosure consumed a change-of-circumstance record. */
  cocId: string | null;
}

/**
 * Reconcile a freshly-computed Loan Estimate against the issued baseline,
 * persisting a new version only when one is authorized.
 *
 * Call this on BORROWER delivery only. A staff preview must not create or
 * reset a disclosure baseline — nothing was delivered to the consumer.
 */
export async function reconcileDisclosure(
  applicationId: string,
  le: LoanEstimateData,
  now: Date = new Date(),
): Promise<BaselineDecision> {
  const revised = snapshotFromLoanEstimate(le);
  const baselineRow = await storage.getLatestLoanEstimateDisclosure(applicationId);

  if (!baselineRow) {
    const created = await storage.createLoanEstimateDisclosure({
      applicationId,
      version: 1,
      issuedAt: now,
      snapshot: revised,
      cocId: null,
      toleranceEvaluation: null,
      // Pin the file to the schedule it was disclosed under. From here on, a
      // platform re-price cannot move its zero-tolerance lines (audit FA-20).
      feeScheduleVersion: le.feeScheduleVersion,
    });
    return { action: "issued_first", disclosure: created, evaluation: null, cocId: null };
  }

  const baseline = baselineRow.snapshot as DisclosureSnapshot;
  const openCocs = await storage.getOpenChangeOfCircumstances(applicationId);
  const coc = openCocs[0] ?? null;

  // §1026.19(e)(3)(iv) resets good faith only for the charges the circumstance
  // affected — never for the platform's own fixed fees (audit FA-21).
  const evaluation = evaluateTolerance(baseline, revised, authorizationFrom(coc));

  // Nothing moved beyond tolerance — the issued disclosure still stands. Note
  // that "within tolerance" still covers charges that went DOWN, which need no
  // redisclosure and no new baseline.
  if (evaluation.verdict === "within_tolerance") {
    return { action: "unchanged", disclosure: baselineRow, evaluation, cocId: null };
  }

  // Increases with a change of circumstance on file: this is a legitimate
  // redisclosure and it resets the baseline.
  if (evaluation.verdict === "increase_justified" && coc) {
    const created = await storage.createLoanEstimateDisclosure({
      applicationId,
      version: baselineRow.version + 1,
      issuedAt: now,
      snapshot: revised,
      cocId: coc.id,
      toleranceEvaluation: evaluation,
      // Carry the pin forward. A redisclosure is authorized by the borrower's
      // circumstance, which is not a reason to adopt a fee schedule the file
      // was never disclosed under.
      feeScheduleVersion: baselineRow.feeScheduleVersion ?? le.feeScheduleVersion,
    });
    return { action: "redisclosed", disclosure: created, evaluation, cocId: coc.id };
  }

  // Increases with nothing authorizing them. The baseline does NOT move: the
  // borrower keeps seeing what was disclosed, and the delta is a cure.
  return { action: "blocked_no_coc", disclosure: baselineRow, evaluation, cocId: null };
}

/**
 * Read-only tolerance posture for staff — no persistence, no side effects.
 * Answers "what would we owe if this file closed on today's numbers?".
 */
export async function getToleranceReview(
  applicationId: string,
  le: LoanEstimateData,
): Promise<{
  hasBaseline: boolean;
  baselineVersion: number | null;
  baselineIssuedAt: Date | null;
  evaluation: ToleranceEvaluation | null;
}> {
  const baselineRow = await storage.getLatestLoanEstimateDisclosure(applicationId);
  if (!baselineRow) {
    return { hasBaseline: false, baselineVersion: null, baselineIssuedAt: null, evaluation: null };
  }
  const openCocs = await storage.getOpenChangeOfCircumstances(applicationId);
  const evaluation = evaluateTolerance(
    baselineRow.snapshot as DisclosureSnapshot,
    snapshotFromLoanEstimate(le),
    authorizationFrom(openCocs[0] ?? null),
  );
  return {
    hasBaseline: true,
    baselineVersion: baselineRow.version,
    baselineIssuedAt: baselineRow.issuedAt,
    evaluation,
  };
}

// ---------------------------------------------------------------------------
// Cost-entry -> disclosure impact (F-0807-03)
// ---------------------------------------------------------------------------

/**
 * What booking a cost entry does to an already-disclosed charge.
 *
 * Four loan-cost categories (appraisal, credit report, flood, title) feed
 * `resolveActualFeesFor` and therefore re-price ZERO-TOLERANCE Loan Estimate
 * lines. Once a baseline exists, the borrower's number is held — so the entry
 * does not change what they see. What it does instead is quietly create CURE
 * LIABILITY: money owed at closing, produced as a side effect of bookkeeping,
 * discovered later in a report nobody reads until it is due.
 *
 * This makes the consequence visible at the moment of the action — the same
 * principle as evaluating the QM cap at the compensation election rather than
 * at submission, when the remedy has expired.
 *
 * It deliberately does NOT block. A real invoice is a real invoice, and
 * refusing to record spend would corrupt the cost ledger to flatter a
 * disclosure. Non-blocking, but never silent.
 */
export interface DisclosedFeeImpact {
  feeId: string;
  label: string;
  bucket: string;
  /** The amount the borrower was disclosed. */
  disclosedAmount: number;
  /** The ledger total for this fee after the new entry. */
  ledgerTotal: number;
  /** ledgerTotal - disclosedAmount, when positive. Zero-tolerance => a cure. */
  increase: number;
  /** True when this increase is a dollar-for-dollar cure absent a documented CoC. */
  createsCureExposure: boolean;
}

export async function evaluateCostEntryDisclosureImpact(
  applicationId: string,
  feeId: string,
  ledgerTotal: number,
): Promise<DisclosedFeeImpact | null> {
  const baselineRow = await storage.getLatestLoanEstimateDisclosure(applicationId);
  if (!baselineRow) return null; // Nothing disclosed yet: no exposure to create.

  const snapshot = baselineRow.snapshot as DisclosureSnapshot | null;
  const disclosed = snapshot?.fees?.find((f) => f.id === feeId);
  if (!disclosed) return null;

  const increase = Math.round((ledgerTotal - disclosed.amount + Number.EPSILON) * 100) / 100;
  return {
    feeId,
    label: disclosed.label,
    bucket: disclosed.bucket,
    disclosedAmount: disclosed.amount,
    ledgerTotal: Math.round((ledgerTotal + Number.EPSILON) * 100) / 100,
    increase: increase > 0 ? increase : 0,
    createsCureExposure: increase > 0 && disclosed.bucket === "zero",
  };
}
