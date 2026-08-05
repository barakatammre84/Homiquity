/**
 * One-time re-anchor of the credit_audit_log hash chains.
 *
 * Why: computeAuditEntryHash originally hashed insertion-ordered JSON, but
 * actionDetails round-trips through a Postgres jsonb column and jsonb does not
 * preserve key order — so entries written before the sorted-key
 * canonicalization fix carry entryHash values that can never re-verify after a
 * read. This script rewrites every chain to the canonical (sorted-key) hashes.
 *
 * What it does, inside a single transaction holding an EXCLUSIVE lock on the
 * table (reads stay open, concurrent appends block until commit):
 *   1. Loads all entries and groups them into chain scopes: one per
 *      application_id, plus the shared null-application (agent/MCP) scope.
 *   2. Orders each scope by (timestamp, sequence_number) — the exact order
 *      verifyAuditLogIntegrity reads in — normalizes sequence_number to 1..N,
 *      and recomputes entryHash/previousEntryHash link by link.
 *   3. Appends a chained "audit_chain_reanchored" entry to the null scope
 *      recording scope/entry counts and the migration date, so the rewrite is
 *      itself auditable.
 *   4. Re-reads everything through the same driver and verifies every scope
 *      with verifyHashChain before committing; any failure rolls back.
 *
 * sequence_number is not covered by the hash, so renumbering (which repairs
 * legacy null-scope rows that were all written as seq 1 / prev GENESIS) never
 * invalidates an entry by itself.
 *
 * Idempotent: entries already carrying canonical hashes are left untouched,
 * and the audit event is only written when at least one row changed.
 *
 * Run with (dev first, then prod — see server/db.ts driver switch):
 *   npx tsx scripts/reanchor-audit-chains.ts             # dry run (default)
 *   npx tsx scripts/reanchor-audit-chains.ts --execute   # rewrite + commit
 *   DATABASE_URL="$PROD_DATABASE_URL" npx tsx scripts/reanchor-audit-chains.ts --execute
 */
import "../server/load-env";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq, sql } from "drizzle-orm";
import {
  creditAuditLog,
  creditAuditChainTips,
  type CreditAuditLog,
} from "@shared/schema";
import {
  computeAuditEntryHash,
  verifyHashChain,
} from "../server/services/encryptionService";
import { auditChainScopeKey } from "../server/services/creditAuditChain";

export const REANCHOR_ACTION = "audit_chain_reanchored";

const NULL_SCOPE = "<agent/null-application>";

/**
 * Re-point an existing chain tip at a scope's new final entry (F-038).
 *
 * This script rewrites every entryHash, so a tip recorded before it runs names a
 * hash that no longer exists — and the tail check would then report a truncation
 * that never happened. A false alarm on an audit log is its own kind of damage:
 * it burns the credibility of the one signal that is supposed to mean something.
 *
 * UPDATE, never insert. A scope with no tip stays untracked until its next real
 * append. Creating one here would assert "this is where the chain ends" from
 * whatever this script happened to read, which — if the log had already been
 * truncated before the re-anchor — would launder the truncated end into the
 * authoritative record. Same reasoning as the migration's refusal to backfill.
 */
async function repointExistingTip(
  tx: any,
  scopeKey: string,
  finalEntry: { entryHash: string; sequenceNumber: number | null } | undefined,
): Promise<void> {
  if (!finalEntry) return;
  await tx
    .update(creditAuditChainTips)
    .set({
      tipEntryHash: finalEntry.entryHash,
      tipSequenceNumber: finalEntry.sequenceNumber ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(creditAuditChainTips.scopeKey, scopeKey));
}

export interface ScopeReport {
  scope: string;
  totalEntries: number;
  rewritten: number;
}

export interface ReanchorReport {
  executed: boolean;
  totalEntries: number;
  entriesRewritten: number;
  entriesUnchanged: number;
  scopesTouched: number;
  totalScopes: number;
  eventWritten: boolean;
  scopes: ScopeReport[];
}

// Chain order must mirror what verifyAuditLogIntegrity's
// ORDER BY timestamp, sequence_number returns: Postgres sorts ASC NULLs last,
// and id breaks exact ties deterministically (moot once sequence numbers are
// normalized to be unique per scope).
function chainOrder(a: CreditAuditLog, b: CreditAuditLog): number {
  const t = a.timestamp.getTime() - b.timestamp.getTime();
  if (t !== 0) return t;
  const sa = a.sequenceNumber ?? Number.POSITIVE_INFINITY;
  const sb = b.sequenceNumber ?? Number.POSITIVE_INFINITY;
  if (sa !== sb) return sa - sb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function groupScopes(rows: CreditAuditLog[]): Map<string, CreditAuditLog[]> {
  const scopes = new Map<string, CreditAuditLog[]>();
  for (const row of rows) {
    const key = row.applicationId ?? NULL_SCOPE;
    const bucket = scopes.get(key);
    if (bucket) bucket.push(row);
    else scopes.set(key, [row]);
  }
  for (const bucket of scopes.values()) bucket.sort(chainOrder);
  return scopes;
}

function verifyScopes(scopes: Map<string, CreditAuditLog[]>): void {
  for (const [scope, entries] of scopes) {
    const result = verifyHashChain(
      entries.map((e) => ({
        entryHash: e.entryHash,
        previousEntryHash: e.previousEntryHash,
        applicationId: e.applicationId,
        userId: e.userId,
        action: e.action,
        actionDetails: e.actionDetails as Record<string, any> | null,
        timestamp: e.timestamp,
        // The rewrite normalizes sequence numbers to 1..N, so the contiguity
        // check applies here and is worth asserting before committing.
        sequenceNumber: e.sequenceNumber,
      }))
    );
    if (!result.valid) {
      throw new Error(
        `post-rewrite verification failed for scope ${scope}: ${result.reason}`
      );
    }
  }
}

export async function reanchorAuditChains(options: {
  execute: boolean;
  log?: (message: string) => void;
}): Promise<ReanchorReport> {
  const log = options.log ?? console.log;
  const { db } = await import("../server/db");

  return db.transaction(async (tx) => {
    if (options.execute) {
      // Blocks concurrent appends (which would race the chain heads and the
      // re-anchor event) for the duration of the rewrite; reads stay open.
      await tx.execute(sql`LOCK TABLE credit_audit_log IN EXCLUSIVE MODE`);
    }

    const rows: CreditAuditLog[] = await tx.select().from(creditAuditLog);
    const scopes = groupScopes(rows);

    const report: ReanchorReport = {
      executed: options.execute,
      totalEntries: rows.length,
      entriesRewritten: 0,
      entriesUnchanged: 0,
      scopesTouched: 0,
      totalScopes: scopes.size,
      eventWritten: false,
      scopes: [],
    };

    for (const [scope, entries] of scopes) {
      let previousEntryHash: string | null = null;
      let rewritten = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const sequenceNumber = i + 1;
        const entryHash = computeAuditEntryHash({
          applicationId: entry.applicationId,
          userId: entry.userId,
          action: entry.action,
          actionDetails: entry.actionDetails as Record<string, any> | null,
          timestamp: entry.timestamp,
          previousEntryHash,
        });

        if (
          entry.entryHash !== entryHash ||
          entry.previousEntryHash !== previousEntryHash ||
          entry.sequenceNumber !== sequenceNumber
        ) {
          rewritten++;
          if (options.execute) {
            await tx
              .update(creditAuditLog)
              .set({ entryHash, previousEntryHash, sequenceNumber })
              .where(eq(creditAuditLog.id, entry.id));
          }
          // Keep the in-memory row current so the chain walk and the
          // re-anchor event below see the rewritten head.
          entry.entryHash = entryHash;
          entry.previousEntryHash = previousEntryHash;
          entry.sequenceNumber = sequenceNumber;
        }

        previousEntryHash = entryHash;
      }

      // Every hash in this scope may have just changed, so a tip recorded
      // earlier now names a hash that no longer exists (F-038).
      if (options.execute) {
        await repointExistingTip(
          tx,
          auditChainScopeKey(scope === NULL_SCOPE ? null : scope),
          entries[entries.length - 1],
        );
      }

      report.entriesRewritten += rewritten;
      if (rewritten > 0) report.scopesTouched++;
      report.scopes.push({ scope, totalEntries: entries.length, rewritten });
      log(
        `scope ${scope}: ${entries.length} entries, ` +
          `${rewritten} ${options.execute ? "rewritten" : "would rewrite"}`
      );
    }
    report.entriesUnchanged = report.totalEntries - report.entriesRewritten;

    if (options.execute && report.entriesRewritten > 0) {
      const nullScope = scopes.get(NULL_SCOPE) ?? [];
      const head = nullScope[nullScope.length - 1];
      const timestamp = new Date();
      const actionDetails = {
        migrationDate: timestamp.toISOString(),
        script: "scripts/reanchor-audit-chains.ts",
        reason:
          "re-anchored hash chains to sorted-key canonicalization (jsonb does not preserve key order)",
        totalEntries: report.totalEntries,
        entriesRewritten: report.entriesRewritten,
        entriesUnchanged: report.entriesUnchanged,
        scopesTouched: report.scopesTouched,
        totalScopes: report.totalScopes,
      };
      const previousEntryHash = head?.entryHash ?? null;
      const entryHash = computeAuditEntryHash({
        applicationId: null,
        userId: null,
        action: REANCHOR_ACTION,
        actionDetails,
        timestamp,
        previousEntryHash,
      });
      await tx.insert(creditAuditLog).values({
        applicationId: null,
        userId: null,
        action: REANCHOR_ACTION,
        actionDetails,
        performedByRole: "migration-script",
        entryHash,
        previousEntryHash,
        sequenceNumber: (head?.sequenceNumber ?? 0) + 1,
        timestamp,
      });
      // The re-anchor event is itself a new chain end, so the null scope's tip
      // has to advance past the one just written a few lines above.
      await repointExistingTip(tx, auditChainScopeKey(null), {
        entryHash,
        sequenceNumber: (head?.sequenceNumber ?? 0) + 1,
      });
      report.eventWritten = true;
      log(`appended ${REANCHOR_ACTION} event to the null-application scope`);
    }

    // Re-read through the same driver (fresh jsonb round-trip) and verify
    // every chain before the transaction commits; a throw rolls it all back.
    if (options.execute) {
      const reread: CreditAuditLog[] = await tx.select().from(creditAuditLog);
      verifyScopes(groupScopes(reread));
      log("post-rewrite verification passed for all scopes");
    }

    return report;
  });
}

async function main() {
  const execute = process.argv.includes("--execute");
  console.log(
    execute
      ? "re-anchoring credit_audit_log hash chains…"
      : "DRY RUN (pass --execute to rewrite)…"
  );

  const report = await reanchorAuditChains({ execute });

  console.log(
    `${execute ? "done" : "dry run complete"}: ${report.totalEntries} entries in ` +
      `${report.totalScopes} scopes; ${report.entriesRewritten} ` +
      `${execute ? "rewritten" : "would be rewritten"}, ` +
      `${report.entriesUnchanged} already canonical` +
      (report.eventWritten ? `; ${REANCHOR_ACTION} event recorded` : "")
  );

  const { pool } = await import("../server/db");
  await pool.end();
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((err) => {
    console.error("re-anchor failed (transaction rolled back):", err);
    process.exit(1);
  });
}
