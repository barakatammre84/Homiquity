import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// One-time re-anchor of credit_audit_log (scripts/reanchor-audit-chains.ts).
//
// Entries written before the sorted-key canonicalization fix carry hashes of
// insertion-ordered JSON, which can never re-verify after a jsonb round trip.
// These tests seed such legacy chains against an in-memory fake of the drizzle
// `db` singleton (same pattern as tests/mcpAudit.test.ts, extended with
// update/transaction support) and assert the re-anchor rewrites them into
// canonically-hashed, verifiable chains — recording the rewrite as a chained
// audit event — while leaving already-canonical entries byte-identical.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const state = {
    rows: new Map<string, any[]>(),
    idCounter: 0,
  };
  const tableRows = (name: string): any[] => {
    if (!state.rows.has(name)) state.rows.set(name, []);
    return state.rows.get(name)!;
  };
  return { state, tableRows };
});

vi.mock("../server/db", async () => {
  const { Column, getTableColumns, getTableName } = await import("drizzle-orm");

  const isColumn = (x: any): boolean => x instanceof Column;
  const isSql = (x: any): boolean => !!x && Array.isArray(x.queryChunks);
  const isParam = (x: any): boolean =>
    !!x && typeof x === "object" && "encoder" in x && "value" in x;
  const chunkText = (x: any): string =>
    !!x && !isParam(x) && Array.isArray(x.value) ? x.value.join("") : "";

  // TS property key for a drizzle column of `table` (rows are stored with
  // property names, not SQL column names).
  const columnKey = (table: any, col: any): string => {
    for (const [key, c] of Object.entries(getTableColumns(table))) {
      if (c === col) return key;
    }
    return col.name;
  };

  // Flatten a condition tree into atomic predicates, ANDed together.
  const collectAtoms = (node: any, table: any, atoms: Array<(row: any) => boolean>): void => {
    let col: any = null;
    let text = "";
    let param: any;
    let hasParam = false;
    for (const chunk of node.queryChunks) {
      if (isSql(chunk)) {
        collectAtoms(chunk, table, atoms);
      } else if (isColumn(chunk)) {
        col = chunk;
      } else if (isParam(chunk)) {
        param = chunk.value;
        hasParam = true;
      } else {
        text += chunkText(chunk);
      }
    }
    if (!col) return;
    const key = columnKey(table, col);
    if (text.includes("is null")) {
      atoms.push((row) => row[key] == null);
    } else if (text.includes("=") && hasParam) {
      atoms.push((row) => row[key] === param);
    } else {
      throw new Error(`fake db: unsupported condition on ${key}: "${text}"`);
    }
  };

  const buildPredicate = (cond: any, table: any): ((row: any) => boolean) => {
    if (!cond) return () => true;
    const atoms: Array<(row: any) => boolean> = [];
    collectAtoms(cond, table, atoms);
    return (row) => atoms.every((a) => a(row));
  };

  const sortValue = (v: any): number => (v instanceof Date ? v.getTime() : v ?? 0);

  const orderComparator = (table: any, orderArgs: any[]) => {
    const parts = orderArgs.map((arg) => {
      if (isColumn(arg)) return { key: columnKey(table, arg), dir: 1 };
      let col: any = null;
      let text = "";
      for (const chunk of arg.queryChunks ?? []) {
        if (isColumn(chunk)) col = chunk;
        else text += chunkText(chunk);
      }
      return { key: col ? columnKey(table, col) : "", dir: text.includes("desc") ? -1 : 1 };
    });
    return (a: any, b: any) => {
      for (const { key, dir } of parts) {
        const d = sortValue(a[key]) - sortValue(b[key]);
        if (d !== 0) return d * dir;
      }
      return 0;
    };
  };

  class SelectBuilder {
    private table: any = null;
    private cond: any = null;
    private order: any[] = [];
    private max = Infinity;
    from(t: any) {
      this.table = t;
      return this;
    }
    where(c: any) {
      this.cond = c;
      return this;
    }
    orderBy(...args: any[]) {
      this.order = args;
      return this;
    }
    limit(n: number) {
      this.max = n;
      return this;
    }
    then(resolve: any, reject: any) {
      try {
        let rows = h.tableRows(getTableName(this.table)).filter(buildPredicate(this.cond, this.table));
        if (this.order.length) rows = [...rows].sort(orderComparator(this.table, this.order));
        return Promise.resolve(rows.slice(0, this.max).map((r) => ({ ...r }))).then(resolve, reject);
      } catch (err) {
        return Promise.reject(err).then(resolve, reject);
      }
    }
  }

  class InsertBuilder {
    private row: any = null;
    private done = false;
    constructor(private table: any) {}
    values(v: any) {
      // A real database reads unset columns back as NULL, never undefined —
      // and the audit hash canonicalization treats the two differently.
      const normalized = Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, x === undefined ? null : x]),
      );
      this.row = { id: `row-${++h.state.idCounter}`, ...normalized };
      return this;
    }
    private exec() {
      if (!this.done) {
        h.tableRows(getTableName(this.table)).push(this.row);
        this.done = true;
      }
      return [{ ...this.row }];
    }
    returning(_fields?: any) {
      return this;
    }
    then(resolve: any, reject: any) {
      return Promise.resolve(this.exec()).then(resolve, reject);
    }
  }

  class UpdateBuilder {
    private patch: any = null;
    private cond: any = null;
    constructor(private table: any) {}
    set(v: any) {
      this.patch = Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, x === undefined ? null : x]),
      );
      return this;
    }
    where(c: any) {
      this.cond = c;
      return this;
    }
    then(resolve: any, reject: any) {
      try {
        const pred = buildPredicate(this.cond, this.table);
        for (const row of h.tableRows(getTableName(this.table))) {
          if (pred(row)) Object.assign(row, this.patch);
        }
        return Promise.resolve(undefined).then(resolve, reject);
      } catch (err) {
        return Promise.reject(err).then(resolve, reject);
      }
    }
  }

  const fakeDb: any = {
    select: (_fields?: any) => new SelectBuilder(),
    insert: (table: any) => new InsertBuilder(table),
    update: (table: any) => new UpdateBuilder(table),
    execute: async (_query?: any) => ({ rows: [] }),
    transaction: async (fn: (tx: any) => Promise<any>) => {
      const snapshot = new Map(
        [...h.state.rows.entries()].map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]),
      );
      try {
        return await fn(fakeDb);
      } catch (err) {
        h.state.rows.clear();
        for (const [name, rows] of snapshot) h.state.rows.set(name, rows);
        throw err;
      }
    },
  };

  return { db: fakeDb, pool: { end: async () => {} } };
});

import { getTableName } from "drizzle-orm";
import { creditAuditLog } from "@shared/schema";
import {
  REANCHOR_ACTION,
  reanchorAuditChains,
} from "../scripts/reanchor-audit-chains";
import { verifyAuditLogIntegrity } from "../server/services/creditService";
import { verifyHashChain } from "../server/services/encryptionService";

const AUDIT = getTableName(creditAuditLog);
const auditRows = () => h.tableRows(AUDIT);
const nullScopeRows = () =>
  auditRows()
    .filter((r) => r.applicationId == null)
    .sort(
      (a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime() ||
        (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0),
    );

// The pre-fix hash algorithm, frozen here as the historical format: plain
// JSON.stringify over insertion-ordered keys (no recursive key sort).
function legacyEntryHash(entry: {
  applicationId: string | null;
  userId: string | null;
  action: string;
  actionDetails: Record<string, any> | null;
  timestamp: Date;
  previousEntryHash: string | null;
}): string {
  const canonical = JSON.stringify({
    applicationId: entry.applicationId,
    userId: entry.userId,
    action: entry.action,
    actionDetails: entry.actionDetails,
    timestamp: entry.timestamp.toISOString(),
    previousHash: entry.previousEntryHash || "GENESIS",
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// Reorder an object's keys the way a jsonb read-back would (any order other
// than insertion order demonstrates the failure).
function jsonbReorder(details: Record<string, any>): Record<string, any> {
  const reordered: Record<string, any> = {};
  for (const key of Object.keys(details).sort().reverse()) {
    reordered[key] = details[key];
  }
  return reordered;
}

let clock = Date.parse("2026-05-01T00:00:00.000Z");
const nextTimestamp = () => new Date((clock += 60_000));

// Seed one legacy entry: hash computed from insertion-ordered actionDetails
// (as the pre-fix code did), but the stored jsonb hands keys back in a
// different order — the historical corruption this migration repairs.
function seedLegacyEntry(data: {
  applicationId: string | null;
  userId?: string | null;
  action: string;
  actionDetails: Record<string, any>;
  previousEntryHash: string | null;
  sequenceNumber: number;
}) {
  const timestamp = nextTimestamp();
  const entryHash = legacyEntryHash({
    applicationId: data.applicationId,
    userId: data.userId ?? null,
    action: data.action,
    actionDetails: data.actionDetails,
    timestamp,
    previousEntryHash: data.previousEntryHash,
  });
  const row = {
    id: `seed-${++h.state.idCounter}`,
    applicationId: data.applicationId,
    userId: data.userId ?? null,
    action: data.action,
    actionDetails: jsonbReorder(data.actionDetails),
    entryHash,
    previousEntryHash: data.previousEntryHash,
    sequenceNumber: data.sequenceNumber,
    timestamp,
  };
  auditRows().push(row);
  return row;
}

function seedLegacyChain(applicationId: string, actions: string[]) {
  let prev: string | null = null;
  for (let i = 0; i < actions.length; i++) {
    const row = seedLegacyEntry({
      applicationId,
      userId: "borrower-1",
      action: actions[i],
      actionDetails: { zStep: i, consentVersion: "v2.1", method: "web" },
      previousEntryHash: prev,
      sequenceNumber: i + 1,
    });
    prev = row.entryHash;
  }
}

beforeEach(() => {
  h.state.rows.clear();
  h.state.idCounter = 0;
  clock = Date.parse("2026-05-01T00:00:00.000Z");
});

describe("reanchorAuditChains", () => {
  it("rewrites legacy chains per scope so they verify under sorted-key canonicalization", async () => {
    seedLegacyChain("app-1", ["consent_given", "pull_requested", "pull_completed"]);
    seedLegacyChain("app-2", ["consent_given", "consent_revoked"]);
    // Legacy null-application entries: the old writer never chained them —
    // every one landed as sequence 1 with a GENESIS previous hash.
    seedLegacyEntry({
      applicationId: null,
      action: "system_key_rotated",
      actionDetails: { keyId: "v2", rotatedFrom: "v1" },
      previousEntryHash: null,
      sequenceNumber: 1,
    });
    seedLegacyEntry({
      applicationId: null,
      action: "system_key_rotated",
      actionDetails: { keyId: "v3", rotatedFrom: "v2" },
      previousEntryHash: null,
      sequenceNumber: 1,
    });

    expect(await verifyAuditLogIntegrity("app-1")).toMatchObject({ valid: false });

    const report = await reanchorAuditChains({ execute: true, log: () => {} });

    expect(report).toMatchObject({
      executed: true,
      totalEntries: 7,
      entriesRewritten: 7,
      entriesUnchanged: 0,
      scopesTouched: 3,
      totalScopes: 3,
      eventWritten: true,
    });

    expect(await verifyAuditLogIntegrity("app-1")).toMatchObject({ valid: true, totalEntries: 3 });
    expect(await verifyAuditLogIntegrity("app-2")).toMatchObject({ valid: true, totalEntries: 2 });

    // Null scope: legacy genesis rows are now a real chain (renumbered 1..N),
    // capped by the chained re-anchor event carrying the migration record.
    const agentScope = nullScopeRows();
    expect(agentScope).toHaveLength(3);
    expect(agentScope.map((r) => r.sequenceNumber)).toEqual([1, 2, 3]);
    expect(verifyHashChain(agentScope)).toMatchObject({ valid: true });

    const event = agentScope[2];
    expect(event.action).toBe(REANCHOR_ACTION);
    expect(event.previousEntryHash).toBe(agentScope[1].entryHash);
    expect(event.performedByRole).toBe("migration-script");
    expect(event.actionDetails).toMatchObject({
      totalEntries: 7,
      entriesRewritten: 7,
      entriesUnchanged: 0,
      scopesTouched: 3,
      totalScopes: 3,
      script: "scripts/reanchor-audit-chains.ts",
    });
  });

  it("re-anchored hashes survive a jsonb key-order round trip", async () => {
    seedLegacyChain("app-1", ["consent_given", "pull_requested"]);
    await reanchorAuditChains({ execute: true, log: () => {} });

    for (const row of auditRows()) {
      if (row.actionDetails) row.actionDetails = jsonbReorder(row.actionDetails);
    }
    expect(await verifyAuditLogIntegrity("app-1")).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it("cascades through already-canonical entries chained onto a legacy head", async () => {
    seedLegacyChain("app-3", ["consent_given"]);
    const legacyHead = auditRows()[0];

    // A post-fix append: canonically hashed, but its previousEntryHash points
    // at the legacy head's stale (insertion-ordered) hash.
    const { computeAuditEntryHash } = await import("../server/services/encryptionService");
    const timestamp = nextTimestamp();
    const details = { outcome: "success", toolName: "run_soft_credit_pull" };
    const postFixHash = computeAuditEntryHash({
      applicationId: "app-3",
      userId: "borrower-1",
      action: "mcp_tool_invocation",
      actionDetails: details,
      timestamp,
      previousEntryHash: legacyHead.entryHash,
    });
    auditRows().push({
      id: `seed-${++h.state.idCounter}`,
      applicationId: "app-3",
      userId: "borrower-1",
      action: "mcp_tool_invocation",
      actionDetails: details,
      entryHash: postFixHash,
      previousEntryHash: legacyHead.entryHash,
      sequenceNumber: 2,
      timestamp,
    });

    const report = await reanchorAuditChains({ execute: true, log: () => {} });

    // Both entries change: the legacy head's hash is rewritten, so the
    // post-fix entry's previous link (and therefore its own hash) must follow.
    expect(report.entriesRewritten).toBe(2);
    const [head, tail] = auditRows().filter((r) => r.applicationId === "app-3");
    expect(tail.previousEntryHash).toBe(head.entryHash);
    expect(tail.entryHash).not.toBe(postFixHash);
    expect(await verifyAuditLogIntegrity("app-3")).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it("dry run reports the rewrite without touching any rows", async () => {
    seedLegacyChain("app-1", ["consent_given", "pull_requested"]);
    const before = JSON.parse(JSON.stringify(auditRows()));

    const report = await reanchorAuditChains({ execute: false, log: () => {} });

    expect(report).toMatchObject({
      executed: false,
      totalEntries: 2,
      entriesRewritten: 2,
      eventWritten: false,
    });
    expect(JSON.parse(JSON.stringify(auditRows()))).toEqual(before);
    expect(auditRows().some((r) => r.action === REANCHOR_ACTION)).toBe(false);
  });

  it("is idempotent: a second run rewrites nothing and records no event", async () => {
    seedLegacyChain("app-1", ["consent_given", "pull_requested", "pull_completed"]);
    await reanchorAuditChains({ execute: true, log: () => {} });

    const after = JSON.parse(JSON.stringify(auditRows()));
    const report = await reanchorAuditChains({ execute: true, log: () => {} });

    expect(report).toMatchObject({
      entriesRewritten: 0,
      entriesUnchanged: 4, // 3 chain entries + the first run's re-anchor event
      scopesTouched: 0,
      eventWritten: false,
    });
    expect(JSON.parse(JSON.stringify(auditRows()))).toEqual(after);
  });
});
