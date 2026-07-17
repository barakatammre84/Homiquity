// Credit pull request + deterministic simulation completion + lookups.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { creditPulls, adverseActions, type InsertCreditPull, type CreditPull, type AdverseAction } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { encryptSensitiveData, computeHash } from "./encryptionService";
import { logCreditAction } from "./creditAuditChain";
import { getActiveConsent } from "./creditConsents";

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
  };

  const [result] = await db.insert(creditPulls).values(pull).returning();

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

