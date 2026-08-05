// Credit pull request + deterministic simulation completion + lookups.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { creditPulls, adverseActions, type InsertCreditPull, type CreditPull, type AdverseAction } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { encryptSensitiveData, computeHash } from "./encryptionService";
import { logCreditAction } from "./creditAuditChain";
import { getActiveConsent, consentCoversPullType } from "./creditConsents";

/**
 * Per-pull vendor cost, in dollars, by pull type.
 *
 * PLATFORM ASSUMPTION — no credit vendor contract exists (roadmap F3), so
 * these are working figures, not contracted rates. They exist so the spend is
 * METERED rather than invisible; replace them with the vendor's actual price
 * sheet when the contract lands. Every entry booked from them is flagged
 * `simulated` while the credit adapter is a simulation, so they cannot leak
 * into a real margin figure. Ledger: `platform-credit-pull-unit-cost`.
 */
export const CREDIT_PULL_UNIT_COST: Record<"soft" | "hard" | "tri_merge", number> = {
  soft: 5,
  hard: 15,
  tri_merge: 30,
};

/** True while the credit vendor leg is the deterministic simulation. */
function creditVendorIsSimulated(): boolean {
  return !process.env.CREDIT_VENDOR_API_KEY;
}

async function recordCreditPullCost(input: {
  applicationId: string;
  creditPullId: string;
  pullType: "soft" | "hard" | "tri_merge";
  bureaus: string[];
  requestedBy: string;
}): Promise<void> {
  const { storage } = await import("../storage");
  const unitCost = CREDIT_PULL_UNIT_COST[input.pullType] ?? 0;
  if (unitCost <= 0) return;

  await storage.createLoanCostEntry({
    applicationId: input.applicationId,
    category: "credit_report",
    vendor: "credit-bureau-adapter",
    amount: unitCost.toFixed(2),
    incurredAt: new Date(),
    automatic: true,
    simulated: creditVendorIsSimulated(),
    description: `${input.pullType} pull (${input.bureaus.join(", ") || "no bureaus listed"}) — pull ${input.creditPullId}`,
    recordedBy: input.requestedBy,
  });
}

export async function requestCreditPull(
  data: {
    applicationId: string;
    consentId: string;
    requestedBy: string;
    pullType: "soft" | "hard" | "tri_merge";
    bureaus: string[];
    ipAddress?: string;
  }
): Promise<CreditPull> {
  const consent = await getActiveConsent(data.applicationId);
  if (!consent || consent.id !== data.consentId) {
    throw new Error("Valid consent required before credit pull");
  }

  // The consent must AUTHORIZE this pull type, not merely exist (F-035).
  // Previously the only check was the id comparison above — which is
  // tautological, since the caller gets that id from getActiveConsent — so a
  // `soft_pull` consent from the pre-approval funnel (whose checkbox promises
  // "a soft inquiry, which will not affect my credit score") unblocked a hard
  // tri-merge pull. Every other consent surface in this codebase already
  // resolves BY TYPE via consentGate.ts; this was the one call site that
  // ignored the taxonomy its own schema declares.
  if (!consentCoversPullType(consent.consentType, data.pullType)) {
    throw new Error(
      `Consent scope mismatch: a "${consent.consentType}" consent does not authorize a "${data.pullType}" pull. ` +
        `Obtain the borrower's authorization for this inquiry type before pulling.`,
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 120);

  const pull: InsertCreditPull = {
    applicationId: data.applicationId,
    consentId: data.consentId,
    requestedBy: data.requestedBy,
    pullType: data.pullType,
    bureaus: data.bureaus,
    status: "pending",
    requestedAt: new Date(),
    expiresAt,
    // Flag at INSERT, not at completion (F-036). `isSimulated` is
    // `default(false).notNull()` and the only other assignment lives inside
    // simulateCreditPullCompletion — which throws in production before
    // reaching it. So a production row used to persist forever as
    // `tri_merge / pending / isSimulated: FALSE`, affirmatively asserting a
    // REAL bureau inquiry that never happened, corroborated by a
    // `pull_requested` entry in the tamper-evident audit chain. The column's
    // own contract is "Surfaced so staff and audit can tell a real pull from a
    // simulated one at a glance." L2 invariant I10 requires flag AND throw;
    // flagging here makes the record true regardless of which path runs next.
    isSimulated: creditVendorIsSimulated(),
  };

  const [result] = await db.insert(creditPulls).values(pull).returning();

  // Meter the cost at the moment we incur it (audit F-11). A tri-merge pull is
  // real money and the task engine deliberately re-runs them (CRD_EXPIRED), so
  // a stalled file quietly accumulates spend. Booked automatically rather than
  // recalled from an invoice later — and flagged `simulated` while the vendor
  // leg is the deterministic simulation, so demo spend never lands in a real
  // margin figure. Non-fatal: a ledger failure must never block a credit pull.
  try {
    await recordCreditPullCost({
      applicationId: data.applicationId,
      creditPullId: result.id,
      pullType: data.pullType,
      bureaus: data.bureaus,
      requestedBy: data.requestedBy,
    });
  } catch (err) {
    console.warn("[creditPulls] cost ledger entry failed (non-fatal):", err);
  }

  await logCreditAction({
    applicationId: data.applicationId,
    creditPullId: result.id,
    consentId: data.consentId,
    action: "pull_requested",
    actionDetails: {
      pullType: data.pullType,
      bureaus: data.bureaus,
    },
    performedBy: data.requestedBy,
    ipAddress: data.ipAddress,
  });

  return result;
}

export async function simulateCreditPullCompletion(
  creditPullId: string,
  simulatedScores?: {
    experian?: number;
    equifax?: number;
    transunion?: number;
  }
): Promise<CreditPull> {
  // Simulated bureau data must never ground a real credit decision. Production
  // refuses to fabricate scores unless CREDIT_VENDOR_MODE=simulation is set
  // explicitly (e.g. a staging deploy running a production build). Remove that
  // override entirely once live bureau contracts are wired in.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CREDIT_VENDOR_MODE !== "simulation"
  ) {
    throw new Error(
      "Simulated credit pulls are disabled in production. Set CREDIT_VENDOR_MODE=simulation to explicitly allow fabricated bureau data in non-live environments."
    );
  }
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.id, creditPullId));

  if (!pull) {
    throw new Error("Credit pull not found");
  }

  const experian = simulatedScores?.experian || Math.floor(Math.random() * 200) + 600;
  const equifax = simulatedScores?.equifax || Math.floor(Math.random() * 200) + 600;
  const transunion = simulatedScores?.transunion || Math.floor(Math.random() * 200) + 600;

  const scores = [experian, equifax, transunion].sort((a, b) => a - b);
  const representativeScore = scores[1];

  // Line-item liabilities so the deterministic underwriting layer (deferred
  // student loans at 1% of balance, new-tradeline "sleeper debt") has real
  // structure to work with — aggregates are derived from the lines.
  const creditors = ["Chase Card", "Capital One", "Toyota Financial", "Discover", "Wells Fargo Auto"];
  const lineTypes = ["revolving", "revolving", "auto", "installment", "revolving"];
  const lineCount = Math.floor(Math.random() * 3) + 3;
  const liabilityLines: Array<{
    creditor: string;
    type: string;
    balance: number;
    monthlyPayment: number;
    deferred?: boolean;
    openedDaysAgo?: number;
  }> = Array.from({ length: lineCount }, (_, i) => {
    const balance = Math.floor(Math.random() * 20000) + 1000;
    return {
      creditor: creditors[i % creditors.length],
      type: lineTypes[i % lineTypes.length],
      balance,
      monthlyPayment: Math.max(25, Math.floor(balance * 0.03)),
    };
  });
  if (Math.random() < 0.4) {
    liabilityLines.push({
      creditor: "Dept of Education / Nelnet",
      type: "student_loan",
      balance: Math.floor(Math.random() * 55000) + 15000,
      monthlyPayment: 0,
      deferred: true,
    });
  }
  if (Math.random() < 0.3) {
    const balance = Math.floor(Math.random() * 2500) + 500;
    liabilityLines.push({
      creditor: "Wayfair Retail Card",
      type: "retail",
      balance,
      monthlyPayment: Math.max(25, Math.floor(balance * 0.03)),
      openedDaysAgo: Math.floor(Math.random() * 80) + 5,
    });
  }

  const totalDebt = liabilityLines.reduce((s, l) => s + l.balance, 0);
  const monthlyPayments = liabilityLines.reduce((s, l) => s + l.monthlyPayment, 0);
  const totalTradelines = liabilityLines.length;
  const openTradelines = liabilityLines.length;
  const derogatoryCount = Math.floor(Math.random() * 3);
  const inquiryCount30Days = Math.floor(Math.random() * 3);
  const inquiryCount90Days = Math.floor(Math.random() * 5);

  const simulatedRawResponse = JSON.stringify({
    requestId: `SIM-${Date.now()}`,
    timestamp: new Date().toISOString(),
    bureaus: {
      experian: { score: experian, reportDate: new Date().toISOString() },
      equifax: { score: equifax, reportDate: new Date().toISOString() },
      transunion: { score: transunion, reportDate: new Date().toISOString() },
    },
    tradelines: { total: totalTradelines, open: openTradelines },
    derogatory: derogatoryCount,
    inquiries: { last30Days: inquiryCount30Days, last90Days: inquiryCount90Days },
    debt: { total: totalDebt, monthlyPayment: monthlyPayments },
    simulationMode: true,
  });

  const rawResponseHash = computeHash(simulatedRawResponse);
  const encryptedResponse = encryptSensitiveData(simulatedRawResponse);

  const [updated] = await db
    .update(creditPulls)
    .set({
      status: "completed",
      experianScore: experian,
      equifaxScore: equifax,
      transunionScore: transunion,
      representativeScore,
      totalTradelines,
      openTradelines,
      totalDebt: totalDebt.toString(),
      monthlyPayments: monthlyPayments.toString(),
      derogatoryCount,
      inquiryCount30Days,
      inquiryCount90Days,
      liabilities: liabilityLines,
      encryptedRawResponse: encryptedResponse.encryptedContent,
      encryptionKeyId: encryptedResponse.keyId,
      encryptionIV: encryptedResponse.iv,
      vendorResponseHash: rawResponseHash,
      vendorRequestId: `SIM-${creditPullId.substring(0, 8)}`,
      isSimulated: true,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creditPulls.id, creditPullId))
    .returning();

  await logCreditAction({
    applicationId: pull.applicationId,
    creditPullId: creditPullId,
    consentId: pull.consentId,
    action: "pull_completed",
    actionDetails: {
      representativeScore,
      bureausReturned: pull.bureaus,
      responseHashStored: true,
    },
  });

  return updated;
}

export async function getCreditPullById(creditPullId: string): Promise<CreditPull | null> {
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.id, creditPullId));
  return pull ?? null;
}

export async function getAdverseActionById(adverseActionId: string): Promise<AdverseAction | null> {
  const [action] = await db
    .select()
    .from(adverseActions)
    .where(eq(adverseActions.id, adverseActionId));
  return action ?? null;
}

export async function getCreditPullsByApplication(applicationId: string): Promise<CreditPull[]> {
  return db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.applicationId, applicationId))
    .orderBy(desc(creditPulls.requestedAt));
}

export async function getLatestCreditPull(applicationId: string): Promise<CreditPull | null> {
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(
      and(
        eq(creditPulls.applicationId, applicationId),
        eq(creditPulls.status, "completed")
      )
    )
    .orderBy(desc(creditPulls.completedAt))
    .limit(1);

  return pull || null;
}

