// The tamper-evident audit hash chain writer. LEAF MODULE: imports no credit sibling, because every domain writes through it.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import {
  creditAuditLog,
  creditAuditChainTips,
  type InsertCreditAuditLog,
} from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { computeAuditEntryHash } from "./encryptionService";

/**
 * Scope key for the chain-tip table (F-038). Entries with no application share
 * one chain, so they share one sentinel key. Exported because the verifier has
 * to derive the identical key to look the tip up.
 */
export const NULL_APPLICATION_SCOPE_KEY = "__null_application__";

export function auditChainScopeKey(applicationId: string | null | undefined): string {
  return applicationId ?? NULL_APPLICATION_SCOPE_KEY;
}

export interface CreditAuditEntryInput {
  applicationId?: string;
  userId?: string;
  consentId?: string;
  creditPullId?: string;
  adverseActionId?: string;
  action: string;
  actionDetails?: Record<string, unknown>;
  performedBy?: string;
  performedByRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Chain appends serialize through an in-process queue: concurrent writers
// would otherwise read the same chain head and fork the chain (MCP clients
// pipeline tool calls, so this happens in practice, not just in theory).
// Writers in OTHER processes can still race; that needs a DB-side lock or a
// unique (application_id, sequence_number) constraint with retry.
let auditChainTail: Promise<unknown> = Promise.resolve();

export function logCreditAction(data: CreditAuditEntryInput): Promise<void> {
  const write = auditChainTail.then(() => appendCreditAuditEntry(data));
  auditChainTail = write.catch(() => undefined);
  return write;
}

async function appendCreditAuditEntry(data: CreditAuditEntryInput): Promise<void> {
  const timestamp = new Date();

  let previousEntryHash: string | null = null;
  let sequenceNumber = 1;

  // Chain scope: application-tied entries chain per application; entries with
  // no application (e.g. agent tool invocations that never resolved to a loan)
  // chain in a shared null-application scope so they stay tamper-evident too.
  // The sequenceNumber tiebreak matters: consecutive entries often land within
  // the same millisecond, and timestamp alone would pick the wrong chain head.
  const chainScope = data.applicationId
    ? eq(creditAuditLog.applicationId, data.applicationId)
    : isNull(creditAuditLog.applicationId);
  const [lastEntry] = await db
    .select({
      entryHash: creditAuditLog.entryHash,
      sequenceNumber: creditAuditLog.sequenceNumber,
    })
    .from(creditAuditLog)
    .where(chainScope)
    .orderBy(desc(creditAuditLog.timestamp), desc(creditAuditLog.sequenceNumber))
    .limit(1);

  if (lastEntry) {
    previousEntryHash = lastEntry.entryHash;
    sequenceNumber = (lastEntry.sequenceNumber || 0) + 1;
  }
  
  const entryHash = computeAuditEntryHash({
    applicationId: data.applicationId || null,
    userId: data.userId || null,
    action: data.action,
    actionDetails: data.actionDetails || null,
    timestamp,
    previousEntryHash,
  });
  
  const log: InsertCreditAuditLog = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentId: data.consentId,
    creditPullId: data.creditPullId,
    adverseActionId: data.adverseActionId,
    action: data.action,
    actionDetails: data.actionDetails,
    performedBy: data.performedBy,
    performedByRole: data.performedByRole,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    entryHash,
    previousEntryHash,
    sequenceNumber,
    timestamp,
  };

  // The entry and the chain tip move together or not at all (F-038). If the
  // insert succeeded but the tip write did not, the tip would name an earlier
  // entry and every subsequent verification would report a truncation that
  // never happened — a false alarm on an audit log is its own kind of damage.
  const scopeKey = auditChainScopeKey(data.applicationId);
  await db.transaction(async (tx) => {
    await tx.insert(creditAuditLog).values(log);
    await tx
      .insert(creditAuditChainTips)
      .values({
        scopeKey,
        tipEntryHash: entryHash,
        tipSequenceNumber: sequenceNumber,
        // Only meaningful on the first write for this scope; the upsert below
        // deliberately leaves it alone thereafter, because it records where
        // tracking BEGAN and that never changes. Pre-existing chains therefore
        // record the sequence they had reached when this shipped, rather than
        // claiming coverage back to genesis they do not have.
        trackingStartedAtSequence: sequenceNumber,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: creditAuditChainTips.scopeKey,
        set: {
          tipEntryHash: entryHash,
          tipSequenceNumber: sequenceNumber,
          updatedAt: timestamp,
        },
      });
  });
}
