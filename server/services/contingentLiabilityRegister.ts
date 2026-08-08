// ---------------------------------------------------------------------------
// Contingent-liability register — the IO seam.
//
// Gathers the live exposures the platform can now measure and hands them to
// the pure model (shared/contingentLiabilities.ts). Every input here became
// measurable only because an earlier finding was fixed:
//
//   TRID cures       ← F-4 persisted the Loan Estimate baselines
//   EPO clawback     ← F-8 modeled the window over F-6's funding columns
//   Lock exposure    ← F-3 made lender confirmation a recorded fact, so an
//                       unconfirmed row is now distinguishable from a real one
//
// Read-only and side-effect free.
// ---------------------------------------------------------------------------

import { storage } from "../storage";
import {
  buildContingentLiabilityRegister,
  type ContingentLiabilityRegister,
} from "@shared/contingentLiabilities";
import { buildClawbackRegister } from "@shared/compensationClawback";
import { summarizeCommissionCosts } from "@shared/costLedger";
import { isLenderConfirmed } from "@shared/rateLockConfirmation";
import type { ToleranceEvaluation } from "@shared/compliance/feeTolerance";
import type { LoanEstimateDisclosure } from "@shared/schema";

/** Locks inside this window are treated as at risk of needing an extension. */
const EXTENSION_RISK_DAYS = 21;

/**
 * Latest disclosure per application. `getAllLoanEstimateDisclosures` returns
 * rows ordered by version descending, so the first row seen for an
 * application id is its current baseline.
 */
function latestPerApplication(rows: LoanEstimateDisclosure[]): LoanEstimateDisclosure[] {
  const seen = new Set<string>();
  const latest: LoanEstimateDisclosure[] = [];
  for (const row of rows) {
    if (seen.has(row.applicationId)) continue;
    seen.add(row.applicationId);
    latest.push(row);
  }
  return latest;
}

export async function buildLiveContingentLiabilityRegister(
  now: Date = new Date(),
): Promise<ContingentLiabilityRegister> {
  const [submissions, disclosures, openLocks, commissionRows, lenderRows] = await Promise.all([
    storage.getAllLenderSubmissions(),
    storage.getAllLoanEstimateDisclosures(),
    storage.getOpenRateLocks(),
    storage.getAllBrokerCommissions(),
    storage.getWholesaleLenders(),
  ]);
  const lenderByKey = new Map(lenderRows.map(l => [l.lenderId, l]));

  // --- TRID cures: only files whose CURRENT baseline evaluated to a cure ---
  // A superseded version's evaluation is history, not exposure, which is why
  // this reads the latest row per application rather than summing all rows.
  let cureAmount = 0;
  let cureFiles = 0;
  for (const disclosure of latestPerApplication(disclosures)) {
    const evaluation = disclosure.toleranceEvaluation as ToleranceEvaluation | null;
    if (evaluation?.verdict === "cure_required" && evaluation.cureAmount > 0) {
      cureAmount += evaluation.cureAmount;
      cureFiles += 1;
    }
  }

  // --- EPO clawback -------------------------------------------------------
  const clawback = buildClawbackRegister(
    submissions.map(s => ({
      submissionId: s.id,
      applicationId: s.applicationId,
      status: s.status,
      lenderId: s.lenderId,
      // The contracted window when an executed agreement supplies one. This
      // register previously omitted it and always fell back to the platform
      // default, so it and the compensation report disagreed about the same
      // loans' exposure.
      epoClawbackDays: lenderByKey.get(s.lenderId)?.epoClawbackDays,
      fundedAt: s.fundedAt,
      compensationReceivedAmount: s.compensationReceivedAmount,
    })),
    now,
  );

  // --- Commission payouts -------------------------------------------------
  // The payable, plus the part of it that has already left the building on a
  // loan the lender could still reclaim compensation from. Keyed on the
  // clawback register's own at-risk set so the two entries cannot disagree
  // about which loans are inside a window.
  const atRiskApplicationIds = new Set(
    clawback.entries.map(e => e.applicationId).filter((id): id is string => !!id),
  );
  const commissionSummary = summarizeCommissionCosts(commissionRows);
  let paidInsideClawbackWindowAmount = 0;
  let paidInsideClawbackWindowCount = 0;
  for (const row of commissionRows) {
    if (row.status !== "paid") continue;
    if (!atRiskApplicationIds.has(row.applicationId)) continue;
    paidInsideClawbackWindowAmount += Number(row.commissionAmount) || 0;
    paidInsideClawbackWindowCount += 1;
  }

  // --- Rate locks ---------------------------------------------------------
  // Split by whether a lender is actually on the hook. A confirmed lock is the
  // lender's obligation; an unconfirmed row is ours, and is exactly what F-3
  // stopped the platform from creating.
  const extensionCutoff = new Date(now.getTime() + EXTENSION_RISK_DAYS * 24 * 3600 * 1000);
  let unconfirmedCount = 0;
  let unconfirmedLoanVolume = 0;
  let expiringSoonCount = 0;
  let expiringSoonLoanVolume = 0;

  for (const lock of openLocks) {
    const loanAmount = Number(lock.loanAmount) || 0;
    const expiresAt = new Date(lock.expiresAt);
    if (expiresAt <= now) continue; // already expired: no forward commitment

    if (!isLenderConfirmed(lock)) {
      unconfirmedCount += 1;
      unconfirmedLoanVolume += loanAmount;
      continue;
    }
    if (expiresAt <= extensionCutoff) {
      expiringSoonCount += 1;
      expiringSoonLoanVolume += loanAmount;
    }
  }

  // --- Reg Z §1026.36 / ATR defects on funded loans -----------------------
  // Counted, never priced: TILA damages need the statute and counsel. A funded
  // loan whose submission captured no compensation model predates the F-1 gate
  // and cannot be shown to be free of the dual-compensation defect.
  const regZExposedLoanCount = submissions.filter(
    s => s.status === "funded" && !s.compensationModel,
  ).length;

  return buildContingentLiabilityRegister({
    tridCure: { amount: cureAmount, fileCount: cureFiles },
    clawback: {
      totalAtRisk: clawback.totalAtRisk,
      atRiskCount: clawback.atRiskCount,
      indeterminateCount: clawback.indeterminateCount,
      usesAssumedWindow: clawback.usesAssumedWindow,
    },
    locks: {
      unconfirmedCount,
      unconfirmedLoanVolume,
      expiringSoonCount,
      expiringSoonLoanVolume,
    },
    regZExposedLoanCount,
    commissions: {
      approvedAmount: commissionSummary.approvedAmount,
      approvedCount: commissionSummary.approvedCount,
      pendingAmount: commissionSummary.pendingAmount,
      pendingCount: commissionSummary.pendingCount,
      paidInsideClawbackWindowAmount: Math.round(paidInsideClawbackWindowAmount * 100) / 100,
      paidInsideClawbackWindowCount,
    },
  });
}
