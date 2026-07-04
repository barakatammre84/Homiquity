import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// AG-1: agent (MCP) actions land in the tamper-evident credit_audit_log.
//
// These tests exercise the creditService agent-audit surface against an
// in-memory fake of the drizzle `db` singleton (server/db.ts needs a live
// DATABASE_URL, so mocking it keeps the suite hermetic). The fake stores rows
// per table and interprets the only condition shapes the code under test
// uses: eq(...), isNull(...), and(...), plus orderBy asc/desc with the
// sequenceNumber tiebreak.
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

  return {
    db: {
      select: (_fields?: any) => new SelectBuilder(),
      insert: (table: any) => new InsertBuilder(table),
    },
  };
});

import { getTableName } from "drizzle-orm";
import { creditAuditLog, creditConsents, creditPulls } from "@shared/schema";
import {
  DEFAULT_AGENT_CALLER_IDENTITY,
  logAgentToolInvocation,
  recordExternalSoftPull,
  verifyAgentAuditLogIntegrity,
  verifyAuditLogIntegrity,
  type ExternalSoftPullVendorData,
} from "../server/services/creditService";

const AUDIT = getTableName(creditAuditLog);
const CONSENTS = getTableName(creditConsents);
const PULLS = getTableName(creditPulls);

const auditRows = () => h.tableRows(AUDIT);

function seedConsent(overrides: Record<string, any> = {}) {
  h.tableRows(CONSENTS).push({
    id: "consent-1",
    applicationId: "app-1",
    userId: "borrower-1",
    consentGiven: true,
    isActive: true,
    ...overrides,
  });
}

function vendorFixture(): ExternalSoftPullVendorData {
  return {
    simulated: true,
    vendorRequestId: "sim-crs-abc123",
    experianScore: 712,
    equifaxScore: 705,
    transunionScore: 718,
    representativeScore: 712,
    vantageScore4: 718,
    tradelines: [
      { creditor: "Chase Card", type: "revolving", balance: 4200, monthlyPayment: 126 },
      { creditor: "Dept of Education / Nelnet", type: "student_loan", balance: 32000, monthlyPayment: 0, deferred: true },
    ],
    totalDebt: 36200,
    totalMonthlyPayments: 126,
  };
}

function recordPull(overrides: Record<string, any> = {}) {
  return recordExternalSoftPull({
    applicationId: "app-1",
    consentId: "consent-1",
    requestedBy: "borrower-1",
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    vendor: vendorFixture(),
    ...overrides,
  });
}

beforeEach(() => {
  h.state.rows.clear();
  h.state.idCounter = 0;
});

describe("logAgentToolInvocation (AG-1)", () => {
  it("writes hash-chained mcp_tool_invocation entries with the tool metadata", async () => {
    await logAgentToolInvocation({
      toolName: "get_best_execution_rates",
      argsHash: "a".repeat(64),
      outcome: "success",
      resultSummary: { offerCount: 8 },
    });
    await logAgentToolInvocation({
      toolName: "retrieve_property_valuation",
      argsHash: "b".repeat(64),
      outcome: "error",
      resultSummary: { error: "AVM lookup timed out" },
    });

    const rows = auditRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.action).toBe("mcp_tool_invocation");
      expect(row.applicationId).toBeNull();
      expect(row.performedByRole).toBe(DEFAULT_AGENT_CALLER_IDENTITY);
      expect(row.entryHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(rows[0].actionDetails).toMatchObject({
      toolName: "get_best_execution_rates",
      argsHash: "a".repeat(64),
      outcome: "success",
      callerIdentity: DEFAULT_AGENT_CALLER_IDENTITY,
      resultSummary: { offerCount: 8 },
    });

    // The chain: entry 2 links back to entry 1 in the null-application scope.
    expect(rows[0].sequenceNumber).toBe(1);
    expect(rows[0].previousEntryHash).toBeNull();
    expect(rows[1].sequenceNumber).toBe(2);
    expect(rows[1].previousEntryHash).toBe(rows[0].entryHash);
  });

  it("carries a caller-identity override (AG-2 seam)", async () => {
    await logAgentToolInvocation({
      toolName: "run_soft_credit_pull",
      argsHash: "c".repeat(64),
      outcome: "refused",
      callerIdentity: "agent:underwriting-copilot",
    });
    expect(auditRows()[0].performedByRole).toBe("agent:underwriting-copilot");
    expect(auditRows()[0].actionDetails.callerIdentity).toBe("agent:underwriting-copilot");
  });

  it("hashes survive the jsonb round trip (Postgres does not preserve key order)", async () => {
    await logAgentToolInvocation({
      toolName: "get_best_execution_rates",
      argsHash: "f".repeat(64),
      outcome: "success",
      resultSummary: { offerCount: 8, bestLender: "UWM", llpaPoints: 0.25 },
    });

    // Simulate the jsonb read-back: same content, different key order.
    const row = auditRows()[0];
    const reordered: Record<string, any> = {};
    for (const key of Object.keys(row.actionDetails).sort().reverse()) {
      reordered[key] = row.actionDetails[key];
    }
    row.actionDetails = reordered;

    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: true, totalEntries: 1 });
  });

  it("concurrent invocations serialize instead of forking the chain head", async () => {
    await Promise.all(
      ["a", "b", "c", "d"].map((c) =>
        logAgentToolInvocation({
          toolName: "retrieve_property_valuation",
          argsHash: c.repeat(64),
          outcome: "success",
        }),
      ),
    );
    const rows = auditRows();
    expect(rows.map((r) => r.sequenceNumber).sort()).toEqual([1, 2, 3, 4]);
    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: true, totalEntries: 4 });
  });

  it("verifyAgentAuditLogIntegrity validates the chain and detects tampering and deletion", async () => {
    for (let i = 0; i < 3; i++) {
      await logAgentToolInvocation({
        toolName: "get_best_execution_rates",
        argsHash: String(i).repeat(64),
        outcome: "success",
      });
    }
    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: true, totalEntries: 3 });

    // Tampering with a stored entry's payload breaks its hash.
    const original = auditRows()[1].actionDetails.outcome;
    auditRows()[1].actionDetails.outcome = "refused";
    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: false, brokenAt: 1 });
    auditRows()[1].actionDetails.outcome = original;
    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: true });

    // Deleting a mid-chain entry breaks the linkage.
    auditRows().splice(1, 1);
    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: false, brokenAt: 1 });
  });
});

describe("recordExternalSoftPull (AG-1)", () => {
  it("persists the pull and writes chained pull_requested + pull_completed entries", async () => {
    seedConsent();
    const pull = await recordPull();

    const pullRows = h.tableRows(PULLS);
    expect(pullRows).toHaveLength(1);
    expect(pullRows[0]).toMatchObject({
      id: pull.id,
      applicationId: "app-1",
      consentId: "consent-1",
      requestedBy: "borrower-1",
      pullType: "soft",
      status: "completed",
      representativeScore: 712,
      totalDebt: "36200.00",
      monthlyPayments: "126.00",
      isSimulated: true,
    });
    expect(pullRows[0].liabilities).toHaveLength(2);

    const rows = auditRows();
    expect(rows.map((r) => r.action)).toEqual(["pull_requested", "pull_completed"]);
    for (const row of rows) {
      expect(row.applicationId).toBe("app-1");
      expect(row.consentId).toBe("consent-1");
      expect(row.creditPullId).toBe(pull.id);
      expect(row.performedByRole).toBe(DEFAULT_AGENT_CALLER_IDENTITY);
    }
    expect(rows[1].actionDetails).toMatchObject({ representativeScore: 712, simulated: true });
    expect(rows[1].previousEntryHash).toBe(rows[0].entryHash);

    expect(await verifyAuditLogIntegrity("app-1")).toMatchObject({ valid: true, totalEntries: 2 });
  });

  it("refuses without a consent row on file", async () => {
    await expect(recordPull()).rejects.toThrow(/consent required/i);
    expect(h.tableRows(PULLS)).toHaveLength(0);
    expect(auditRows()).toHaveLength(0);
  });

  it("refuses a revoked or declined consent", async () => {
    seedConsent({ isActive: false });
    await expect(recordPull()).rejects.toThrow(/consent required/i);

    h.state.rows.clear();
    seedConsent({ consentGiven: false });
    await expect(recordPull()).rejects.toThrow(/consent required/i);
    expect(h.tableRows(PULLS)).toHaveLength(0);
  });

  it("refuses a consent that belongs to a different borrower", async () => {
    seedConsent({ userId: "someone-else" });
    await expect(recordPull()).rejects.toThrow(/does not belong/i);
    expect(h.tableRows(PULLS)).toHaveLength(0);
    expect(auditRows()).toHaveLength(0);
  });

  it("invocation entries join the application chain; agent-scope chain stays independent", async () => {
    seedConsent();
    const pull = await recordPull();

    // Invocation entry for the same application continues that chain…
    await logAgentToolInvocation({
      toolName: "run_soft_credit_pull",
      argsHash: "d".repeat(64),
      outcome: "success",
      applicationId: "app-1",
      userId: "borrower-1",
      creditPullId: pull.id,
    });
    const appRows = auditRows().filter((r) => r.applicationId === "app-1");
    expect(appRows.map((r) => r.sequenceNumber)).toEqual([1, 2, 3]);
    expect(appRows[2].previousEntryHash).toBe(appRows[1].entryHash);
    expect(await verifyAuditLogIntegrity("app-1")).toMatchObject({ valid: true, totalEntries: 3 });

    // …while an application-less invocation starts the null scope at 1,
    // never chaining onto the application's entries.
    await logAgentToolInvocation({
      toolName: "get_best_execution_rates",
      argsHash: "e".repeat(64),
      outcome: "success",
    });
    const agentRow = auditRows().find((r) => r.applicationId == null)!;
    expect(agentRow.sequenceNumber).toBe(1);
    expect(agentRow.previousEntryHash).toBeNull();
    expect(await verifyAgentAuditLogIntegrity()).toMatchObject({ valid: true, totalEntries: 1 });
  });
});
