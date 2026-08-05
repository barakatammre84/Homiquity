// Audit read/verify surface, disclosure getters, AG-1 agent-tool audit + audited external soft-pull persistence (AG-2 seam), audit export package + CSV.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { creditPulls, creditAuditLog, creditAuditChainTips, type CreditConsent, type CreditPull, type AdverseAction } from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { verifyHashChain, type HashChainCoverage } from "./encryptionService";
import {
  logCreditAction,
  auditChainScopeKey,
  NULL_APPLICATION_SCOPE_KEY,
} from "./creditAuditChain";
import { ADVERSE_ACTION_REASONS, CURRENT_DISCLOSURE_VERSION, FCRA_DISCLOSURE_TEXT } from "./creditCatalogs";
import { getActiveConsent, getConsentById } from "./creditConsents";
import { getCreditPullsByApplication } from "./creditPulls";
import { getAdverseActionsByApplication } from "./creditAdverseActions";

export async function getCreditAuditLog(
  applicationId: string,
  limit: number = 100
): Promise<typeof creditAuditLog.$inferSelect[]> {
  return db
    .select()
    .from(creditAuditLog)
    .where(eq(creditAuditLog.applicationId, applicationId))
    .orderBy(desc(creditAuditLog.timestamp))
    .limit(limit);
}

export function getDisclosureText(): string {
  return FCRA_DISCLOSURE_TEXT;
}

export function getDisclosureVersion(): string {
  return CURRENT_DISCLOSURE_VERSION;
}

export function getAdverseActionReasons(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ADVERSE_ACTION_REASONS).map(([key, val]) => [key, val.description])
  );
}

export function getAdverseActionReasonsDetailed(): typeof ADVERSE_ACTION_REASONS {
  return ADVERSE_ACTION_REASONS;
}

export function getReasonBureauCodes(
  reasonKey: string, 
  bureau: "experian" | "equifax" | "transunion" | "fico"
): string[] {
  const reason = ADVERSE_ACTION_REASONS[reasonKey];
  if (!reason) return [];
  return reason.bureauReasonCodes[bureau] || [];
}

/**
 * Result of a full-scope integrity check (F-038).
 *
 * `coverage` exists so a caller cannot mistake "the entries present link to each
 * other" for "nothing has been removed". Those were the same `{valid: true}`
 * before, and the difference between them was the finding.
 */
export interface AuditIntegrityResult {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
  totalEntries: number;
  coverage: HashChainCoverage & {
    /**
     * The chain's END was checked against the externally-recorded tip.
     * `false` means tail truncation could NOT be ruled out for this scope —
     * either the chain predates tip tracking, or its tip row is gone.
     */
    tailAnchored: boolean;
    /**
     * When tail-anchored: entries below this sequence number predate tip
     * tracking and are covered only by the in-chain checks.
     */
    tailAnchoredFromSequence?: number;
  };
}

/**
 * Verify one audit chain end to end.
 *
 * Two independent mechanisms, because neither alone is sufficient:
 *  - `verifyHashChain` proves the entries present are unmodified, start at
 *    genesis, and have no sequence gaps;
 *  - the persisted tip proves the chain still ends where it last ended, which
 *    nothing inside the chain can establish about itself.
 */
async function verifyScopeIntegrity(
  entries: Array<typeof creditAuditLog.$inferSelect>,
  scopeKey: string
): Promise<AuditIntegrityResult> {
  const [tip] = await db
    .select()
    .from(creditAuditChainTips)
    .where(eq(creditAuditChainTips.scopeKey, scopeKey))
    .limit(1);

  const chain = verifyHashChain(
    entries.map(e => ({
      entryHash: e.entryHash,
      previousEntryHash: e.previousEntryHash,
      applicationId: e.applicationId,
      userId: e.userId,
      action: e.action,
      actionDetails: e.actionDetails as Record<string, any> | null,
      timestamp: e.timestamp,
      sequenceNumber: e.sequenceNumber,
    }))
  );

  const coverage = {
    ...chain.coverage,
    tailAnchored: Boolean(tip),
    ...(tip ? { tailAnchoredFromSequence: tip.trackingStartedAtSequence } : {}),
  };

  if (!chain.valid) {
    return { ...chain, coverage, totalEntries: entries.length };
  }

  // The in-chain checks passed. Now the one thing they structurally cannot see:
  // whether the chain still ends where the external record says it ended.
  if (tip) {
    const last = entries[entries.length - 1];
    if (!last) {
      return {
        valid: false,
        reason:
          `Chain tip recorded (sequence ${tip.tipSequenceNumber}) but this scope ` +
          `now has NO entries. The entire log has been deleted.`,
        totalEntries: 0,
        coverage,
      };
    }
    if (last.entryHash !== tip.tipEntryHash) {
      return {
        valid: false,
        brokenAt: entries.length - 1,
        reason:
          `Chain tail truncated: last entry is sequence ${last.sequenceNumber} ` +
          `(${last.entryHash}) but the recorded tip is sequence ` +
          `${tip.tipSequenceNumber} (${tip.tipEntryHash}). ` +
          `${Math.max(0, tip.tipSequenceNumber - (last.sequenceNumber ?? 0))} ` +
          `entries are missing from the end of this chain.`,
        totalEntries: entries.length,
        coverage,
      };
    }
  }

  return { valid: true, totalEntries: entries.length, coverage };
}

export async function verifyAuditLogIntegrity(
  applicationId: string
): Promise<AuditIntegrityResult> {
  const entries = await db
    .select()
    .from(creditAuditLog)
    .where(eq(creditAuditLog.applicationId, applicationId))
    .orderBy(creditAuditLog.timestamp, creditAuditLog.sequenceNumber);

  // NOTE: an empty result is NOT short-circuited to valid any more. A scope with
  // a recorded tip and zero entries means the whole log was deleted, which is
  // the most severe case and used to be the one that reported clean.
  return verifyScopeIntegrity(entries, auditChainScopeKey(applicationId));
}

// ---------------------------------------------------------------------------
// Agent (MCP) audit surface — AG-1.
//
// AI-agent tool invocations must land in the same tamper-evident hash chain
// as every other credit action. Two entry points:
//  - recordExternalSoftPull: audited persistence for soft pulls whose bureau
//    data was fetched by an external caller (the MCP server) rather than the
//    in-app request/complete flow.
//  - logAgentToolInvocation: an invocation-level record (tool name, args
//    hash, outcome, result summary) for every MCP tool call.
//
// AG-2 seam: callerIdentity names the transport ("mcp-stdio") until per-agent
// identity lands; it is stored in performedByRole and in actionDetails.
// ---------------------------------------------------------------------------

export const DEFAULT_AGENT_CALLER_IDENTITY = "mcp-stdio";

export interface ExternalSoftPullVendorData {
  simulated: boolean;
  vendorRequestId: string;
  experianScore: number;
  equifaxScore: number;
  transunionScore: number;
  representativeScore: number;
  vantageScore4: number;
  tradelines: Array<{
    creditor: string;
    type: string;
    balance: number;
    monthlyPayment: number;
    deferred?: boolean;
    openedDaysAgo?: number;
  }>;
  totalDebt: number;
  totalMonthlyPayments: number;
}

/**
 * Persist a completed soft pull fetched by an external caller, writing the
 * chained pull_requested / pull_completed audit entries the in-app flow gets
 * from requestCreditPull + completion. Re-verifies the FCRA consent so no
 * caller can persist a pull the borrower never authorized.
 */
export async function recordExternalSoftPull(params: {
  applicationId: string;
  consentId: string;
  requestedBy: string;
  expiresAt: Date;
  vendor: ExternalSoftPullVendorData;
  callerIdentity?: string;
  /** AG-2: resolved agent identity context (agentId, operator, authenticated,
   * self-reported client) recorded on both audit entries. */
  agentContext?: Record<string, unknown>;
}): Promise<CreditPull> {
  const callerIdentity = params.callerIdentity ?? DEFAULT_AGENT_CALLER_IDENTITY;

  const consent = await getConsentById(params.consentId);
  if (!consent || !consent.consentGiven || !consent.isActive) {
    throw new Error("Valid consent required before credit pull");
  }
  if (consent.userId !== params.requestedBy) {
    throw new Error("Consent on file does not belong to this borrower");
  }

  const { vendor } = params;
  const bureaus = ["experian", "equifax", "transunion"];

  const [pull] = await db
    .insert(creditPulls)
    .values({
      applicationId: params.applicationId,
      consentId: params.consentId,
      requestedBy: params.requestedBy,
      pullType: "soft",
      bureaus,
      status: "completed",
      externalRequestId: vendor.vendorRequestId,
      experianScore: vendor.experianScore,
      equifaxScore: vendor.equifaxScore,
      transunionScore: vendor.transunionScore,
      representativeScore: vendor.representativeScore,
      vantageScore4: vendor.vantageScore4,
      totalTradelines: vendor.tradelines.length,
      openTradelines: vendor.tradelines.length,
      totalDebt: vendor.totalDebt.toFixed(2),
      monthlyPayments: vendor.totalMonthlyPayments.toFixed(2),
      // Machine-readable ledger for deterministic underwriting math
      // (deferred-student-loan 1% rule, new-tradeline detection).
      liabilities: vendor.tradelines,
      vendorRequestId: vendor.vendorRequestId,
      isSimulated: vendor.simulated,
      // AG-2: the row itself records which agent performed the pull;
      // requestedBy stays the borrower (FK to users).
      agentIdentity: callerIdentity,
      completedAt: new Date(),
      expiresAt: params.expiresAt,
    })
    .returning();

  await logCreditAction({
    applicationId: params.applicationId,
    userId: params.requestedBy,
    consentId: params.consentId,
    creditPullId: pull.id,
    action: "pull_requested",
    actionDetails: {
      pullType: "soft",
      bureaus,
      source: callerIdentity,
      ...(params.agentContext ? { agentContext: params.agentContext } : {}),
    },
    performedBy: params.requestedBy,
    performedByRole: callerIdentity,
  });

  await logCreditAction({
    applicationId: params.applicationId,
    userId: params.requestedBy,
    consentId: params.consentId,
    creditPullId: pull.id,
    action: "pull_completed",
    actionDetails: {
      representativeScore: vendor.representativeScore,
      bureausReturned: bureaus,
      vendorRequestId: vendor.vendorRequestId,
      simulated: vendor.simulated,
      source: callerIdentity,
      ...(params.agentContext ? { agentContext: params.agentContext } : {}),
    },
    performedBy: params.requestedBy,
    performedByRole: callerIdentity,
  });

  return pull;
}

/**
 * Chain an invocation-level audit entry for an AI-agent tool call. Entries
 * that resolved to an application join that application's chain; the rest
 * join the shared null-application chain (verifyAgentAuditLogIntegrity).
 */
export async function logAgentToolInvocation(params: {
  toolName: string;
  argsHash: string;
  outcome: "success" | "refused" | "error";
  resultSummary?: Record<string, unknown>;
  applicationId?: string;
  userId?: string;
  consentId?: string;
  creditPullId?: string;
  callerIdentity?: string;
  /** AG-2: resolved agent identity context (agentId, operator, authenticated,
   * self-reported client) recorded alongside the invocation. */
  agentContext?: Record<string, unknown>;
}): Promise<void> {
  const callerIdentity = params.callerIdentity ?? DEFAULT_AGENT_CALLER_IDENTITY;
  await logCreditAction({
    applicationId: params.applicationId,
    userId: params.userId,
    consentId: params.consentId,
    creditPullId: params.creditPullId,
    action: "mcp_tool_invocation",
    actionDetails: {
      toolName: params.toolName,
      argsHash: params.argsHash,
      outcome: params.outcome,
      callerIdentity,
      ...(params.agentContext ? { agentContext: params.agentContext } : {}),
      ...(params.resultSummary ? { resultSummary: params.resultSummary } : {}),
    },
    performedByRole: callerIdentity,
  });
}

/** Integrity check for the null-application chain (agent invocations that
 * never resolved to a loan application). */
export async function verifyAgentAuditLogIntegrity(): Promise<AuditIntegrityResult> {
  const entries = await db
    .select()
    .from(creditAuditLog)
    .where(isNull(creditAuditLog.applicationId))
    .orderBy(creditAuditLog.timestamp, creditAuditLog.sequenceNumber);

  return verifyScopeIntegrity(entries, NULL_APPLICATION_SCOPE_KEY);
}

export interface AuditExportPackage {
  applicationId: string;
  exportedAt: string;
  exportedBy: string;
  integrityVerified: boolean;
  consent: CreditConsent | null;
  creditPulls: CreditPull[];
  adverseActions: AdverseAction[];
  auditEntries: Array<{
    sequenceNumber: number | null;
    action: string;
    timestamp: Date;
    entryHash: string;
    previousEntryHash: string | null;
    actionDetails: Record<string, any> | null;
    performedBy: string | null;
  }>;
  summary: {
    totalPulls: number;
    totalAdverseActions: number;
    totalAuditEntries: number;
    firstActivity: string | null;
    lastActivity: string | null;
  };
}

export async function generateAuditExportPackage(
  applicationId: string,
  exportedBy: string
): Promise<AuditExportPackage> {
  const consent = await getActiveConsent(applicationId);
  const pulls = await getCreditPullsByApplication(applicationId);
  const actions = await getAdverseActionsByApplication(applicationId);
  const auditEntries = await getCreditAuditLog(applicationId, 1000);
  const integrityCheck = await verifyAuditLogIntegrity(applicationId);
  
  const sortedAudit = [...auditEntries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  await logCreditAction({
    applicationId,
    action: "audit_package_exported",
    actionDetails: {
      exportedBy,
      integrityVerified: integrityCheck.valid,
      entryCount: auditEntries.length,
    },
    performedBy: exportedBy,
  });
  
  return {
    applicationId,
    exportedAt: new Date().toISOString(),
    exportedBy,
    integrityVerified: integrityCheck.valid,
    consent,
    creditPulls: pulls,
    adverseActions: actions,
    auditEntries: sortedAudit.map(e => ({
      sequenceNumber: e.sequenceNumber,
      action: e.action,
      timestamp: e.timestamp,
      entryHash: e.entryHash,
      previousEntryHash: e.previousEntryHash,
      actionDetails: e.actionDetails as Record<string, any> | null,
      performedBy: e.performedBy,
    })),
    summary: {
      totalPulls: pulls.length,
      totalAdverseActions: actions.length,
      totalAuditEntries: auditEntries.length,
      firstActivity: sortedAudit[0]?.timestamp.toISOString() || null,
      lastActivity: sortedAudit[sortedAudit.length - 1]?.timestamp.toISOString() || null,
    },
  };
}

export async function generateCSVExport(applicationId: string): Promise<string> {
  const auditEntries = await getCreditAuditLog(applicationId, 1000);
  const sortedAudit = [...auditEntries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const headers = [
    "Sequence",
    "Timestamp",
    "Action",
    "Entry Hash",
    "Previous Hash",
    "Performed By",
    "Details",
  ];
  
  const rows = sortedAudit.map(e => [
    e.sequenceNumber?.toString() || "",
    e.timestamp.toISOString(),
    e.action,
    e.entryHash,
    e.previousEntryHash || "GENESIS",
    e.performedBy || "",
    JSON.stringify(e.actionDetails || {}),
  ]);
  
  const escapeCSV = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  
  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");
  
  return csvContent;
}

// Draft Consent Progress - Save & Resume functionality

