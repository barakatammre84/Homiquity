import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// MCP run_soft_credit_pull: the FCRA gate must run BEFORE any disclosure.
// (F-014 slice 3; proves and then guards F-042.)
//
// What this replaces. complianceInvariants.test.ts guards this tool with:
//
//     expect(source).toContain("creditConsents");
//     expect(source).toMatch(/FCRA: no active credit consent/);
//
// Both strings are present in the file and always have been. F-042 is the
// reason that is not reassuring: the cached-pull branch RETURNS bureau scores,
// total debt and DTI several steps BEFORE control ever reaches the consent
// check. A borrower who revoked consent still had their report re-disclosed to
// any agent for up to 90 days, and the compliance suite was green throughout —
// because the gate's source text exists, it just wasn't reachable in time.
//
// Ordering is not expressible as a string match. It is expressible as a test:
// revoke the consent, leave a cached pull in place, call the tool, and require
// a refusal.
//
// The tool is exercised for real. server/mcp/index.ts is not importable as-is
// (it ends in a top-level `await server.connect(stdio)`), so the MCP SDK is
// stubbed to capture the registered handler instead of speaking JSON-RPC. The
// consent/cache logic under test is the module's own.
// ---------------------------------------------------------------------------

type Handler = (args: any) => Promise<any>;
const handlers = new Map<string, Handler>();

vi.mock("../server/mcp/bootstrap", () => ({}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    // agentContext() reads server.server.getClientVersion() for the
    // self-reported client info stamped on audit entries.
    server = { getClientVersion: () => ({ name: "vitest", version: "0" }) };
    registerTool(name: string, _schema: unknown, handler: Handler) {
      handlers.set(name, handler);
    }
    async connect() {}
  },
}));
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class {},
}));

vi.mock("../server/mcp/identity", () => ({
  resolveAgentIdentity: () => ({
    callerIdentity: "test-agent",
    agentId: "test",
    operator: "test",
    authenticated: true,
  }),
  assertDeploymentAllowed: () => {},
}));

// Vendor adapter — if the gate leaks, this is what would be called for a FRESH
// pull. Tracked so a test can prove no bureau call was attempted on refusal.
const vendorCalls: string[] = [];
vi.mock("../server/mcp/vendors", () => ({
  softPullCredit: async () => {
    vendorCalls.push("softPullCredit");
    return {
      vendorRequestId: "v1", experianScore: 700, equifaxScore: 700, transunionScore: 700,
      representativeScore: 700, vantageScore4: 690, tradelines: [], totalDebt: 0,
      totalMonthlyPayments: 0, simulated: true,
    };
  },
  fetchAvm: async () => ({ simulated: true }),
  withTimeout: async (p: Promise<unknown>) => p,
}));

const persisted: string[] = [];
vi.mock("../server/services/creditService", () => ({
  logAgentToolInvocation: async () => {},
  recordExternalSoftPull: async () => {
    persisted.push("recordExternalSoftPull");
    return { id: "pull_new", representativeScore: 700 };
  },
}));

vi.mock("../server/pricing", () => ({ calculateLLPA: async () => ({}) }));

// ---------------------------------------------------------------------------
// A drizzle-shaped stub that dispatches on the table reached via .from().
// Each scenario declares what each table returns; anything unset returns [].
// ---------------------------------------------------------------------------
interface TableData {
  users?: unknown[];
  loan_applications?: unknown[];
  credit_pulls?: unknown[];
  credit_consents?: unknown[];
}
let tableData: TableData = {};
const queriedTables: string[] = [];
/** Columns each table's WHERE clause actually referenced, at runtime. */
const wherePredicates = new Map<string, string[]>();

/**
 * Walk a drizzle condition tree and collect the column names it CONSTRAINS.
 *
 * The subtlety that made the first version of this vacuous: every Column object
 * holds a back-reference to its Table, and the Table holds every column on it.
 * A naive deep walk therefore reports the whole schema for any predicate at all,
 * so `toContain("is_active")` passed even with is_active removed from the query.
 * Mutation testing caught it. So: record a Column's name and STOP — never
 * descend through it into its table.
 */
function columnsIn(condition: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<unknown>();
  const isColumn = (n: Record<string, unknown>) =>
    typeof n.name === "string" && "table" in n && "columnType" in n;

  (function walk(node: unknown, depth: number) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
    seen.add(node);
    const rec = node as Record<string, unknown>;
    if (isColumn(rec)) {
      found.push(rec.name as string);
      return; // hard stop — descending reaches the table and every sibling column
    }
    for (const value of Object.values(rec)) walk(value, depth + 1);
  })(condition, 0);
  return [...new Set(found)];
}

function tableNameOf(t: any): string {
  return (
    t?.[Symbol.for("drizzle:BaseName")] ??
    t?.[Symbol.for("drizzle:Name")] ??
    t?._?.name ??
    "unknown"
  );
}

vi.mock("../server/db", () => {
  const makeChain = (rows: unknown[], table: string) => {
    const chain: any = {
      where: (cond: unknown) => {
        wherePredicates.set(table, columnsIn(cond));
        return chain;
      },
      orderBy: () => chain,
      limit: async (n: number) => rows.slice(0, n),
      then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
    };
    return chain;
  };
  return {
    db: {
      select: () => ({
        from: (t: any) => {
          const name = tableNameOf(t);
          queriedTables.push(name);
          return makeChain(((tableData as Record<string, unknown[]>)[name] ?? []) as unknown[], name);
        },
      }),
      insert: () => ({ values: () => ({ returning: async () => [{ id: "x" }] }) }),
    },
  };
});

const BORROWER = { id: "user_1", email: "b@test.local" };
const APPLICATION = { id: "app_1", annualIncome: "120000" };
const CACHED_PULL = {
  id: "pull_cached",
  representativeScore: 742,
  experianScore: 740,
  equifaxScore: 744,
  transunionScore: 742,
  vantageScore4: 730,
  totalDebt: "15000.00",
  monthlyPayments: "600.00",
  expiresAt: new Date(Date.now() + 30 * 86_400_000),
};
const ACTIVE_CONSENT = { id: "consent_1" };

async function callTool() {
  const handler = handlers.get("run_soft_credit_pull");
  if (!handler) throw new Error("run_soft_credit_pull was not registered");
  return handler({ firstName: "Dana", lastName: "Borrower", address: "1 Main St", email: undefined });
}

/** The tool returns MCP content; a refusal sets isError. */
const isRefusal = (r: any) => r?.isError === true;
const textOf = (r: any) => JSON.stringify(r?.content ?? r);

beforeEach(async () => {
  tableData = {};
  queriedTables.length = 0;
  wherePredicates.clear();
  vendorCalls.length = 0;
  persisted.length = 0;
  handlers.clear();
  vi.resetModules();
  await import("../server/mcp/index");
});

describe("MCP run_soft_credit_pull — FCRA gate precedes disclosure (F-042)", () => {
  it("REFUSES to re-disclose a cached report when consent has been revoked", async () => {
    // The F-042 scenario exactly: a valid cached pull is on file, and the
    // borrower has since revoked. No active consent row is returned.
    tableData = {
      users: [BORROWER],
      loan_applications: [APPLICATION],
      credit_pulls: [CACHED_PULL],
      credit_consents: [], // revoked
    };

    const result = await callTool();

    expect(isRefusal(result), "a revoked borrower's report was re-disclosed from cache").toBe(true);
    expect(textOf(result)).toMatch(/FCRA/i);
    // And the substance never leaves: no score, no debt figure in the payload.
    expect(textOf(result)).not.toContain("742");
    expect(textOf(result)).not.toContain("15000");
  });

  it("still serves the cached report when consent IS active — the fix must not break caching", async () => {
    tableData = {
      users: [BORROWER],
      loan_applications: [APPLICATION],
      credit_pulls: [CACHED_PULL],
      credit_consents: [ACTIVE_CONSENT],
    };

    const result = await callTool();

    expect(isRefusal(result)).toBe(false);
    expect(textOf(result)).toContain("742");
    // Served from cache, so no bureau call and no new persistence.
    expect(vendorCalls).toEqual([]);
    expect(persisted).toEqual([]);
  });

  it("checks consent BEFORE it reads the cache — ordering, not just outcome", async () => {
    tableData = {
      users: [BORROWER],
      loan_applications: [APPLICATION],
      credit_pulls: [CACHED_PULL],
      credit_consents: [ACTIVE_CONSENT],
    };
    await callTool();

    const consentAt = queriedTables.indexOf("credit_consents");
    const cacheAt = queriedTables.indexOf("credit_pulls");
    expect(consentAt, "credit_consents was never queried").toBeGreaterThan(-1);
    expect(cacheAt, "credit_pulls was never queried").toBeGreaterThan(-1);
    expect(
      consentAt,
      "the cache is read before the FCRA gate — the F-042 ordering. A future refactor that " +
        "returns early from the cache branch would silently re-open re-disclosure.",
    ).toBeLessThan(cacheAt);
  });

  it("refuses without consent even when no cache exists, and calls no bureau", async () => {
    tableData = {
      users: [BORROWER],
      loan_applications: [APPLICATION],
      credit_pulls: [],
      credit_consents: [],
    };

    const result = await callTool();

    expect(isRefusal(result)).toBe(true);
    expect(vendorCalls).toEqual([]);
    expect(persisted).toEqual([]);
  });

  it("performs a fresh pull when consent is active and nothing is cached", async () => {
    tableData = {
      users: [BORROWER],
      loan_applications: [APPLICATION],
      credit_pulls: [],
      credit_consents: [ACTIVE_CONSENT],
    };

    const result = await callTool();

    expect(isRefusal(result)).toBe(false);
    expect(vendorCalls).toEqual(["softPullCredit"]);
    expect(persisted).toEqual(["recordExternalSoftPull"]);
  });
});

describe("MCP run_soft_credit_pull — the consent query itself is correctly scoped", () => {
  // The stub above cannot evaluate a WHERE clause, so "seed no rows" proves the
  // REFUSAL path but not that the query would have EXCLUDED a revoked row.
  // Mutation testing caught exactly that hole: dropping `isActive` from the
  // gate's predicate left every other test in this file green. So assert on the
  // predicate the code actually executes at runtime — not on the file's text.
  it("filters on consentGiven AND isActive, so a revoked row cannot satisfy it", async () => {
    tableData = {
      users: [BORROWER],
      loan_applications: [APPLICATION],
      credit_pulls: [CACHED_PULL],
      credit_consents: [ACTIVE_CONSENT],
    };
    await callTool();

    const columns = wherePredicates.get("credit_consents") ?? [];
    expect(columns.length, "the consent query ran with no WHERE clause at all").toBeGreaterThan(0);
    for (const required of ["user_id", "consent_given", "is_active"]) {
      expect(
        columns,
        `the FCRA consent query no longer constrains ${required}. Dropping is_active means a ` +
          `REVOKED consent row satisfies the gate — the borrower withdrew permission and the ` +
          `pull proceeds anyway.`,
      ).toContain(required);
    }
  });
});
