import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// F-042: the MCP soft-pull tool must run its FCRA consent gate BEFORE reading
// any bureau data — cached results included — and the gate must verify the
// consent's TYPE covers a soft pull, not merely that a consent exists.
//
// These tests drive server/mcp/softPullGate.ts (the composition the tool
// handler calls) against an in-memory fake of the drizzle `db` singleton, in
// the same style as tests/mcpAudit.test.ts. The fake additionally records the
// ORDER in which tables are queried: on a refusal, the credit_pulls table must
// never have been touched — that is the difference between "refused" and
// "disclosed, then refused".
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const state = {
    rows: new Map<string, any[]>(),
    queriedTables: [] as string[],
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

  const columnKey = (table: any, col: any): string => {
    for (const [key, c] of Object.entries(getTableColumns(table))) {
      if (c === col) return key;
    }
    return col.name;
  };

  // Flatten a condition tree into atomic predicates, ANDed together.
  // Supports the shapes softPullGate uses: eq(col, v) and gt(col, v).
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
    if (text.includes(">") && hasParam) {
      atoms.push((row) => row[key] > param);
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

  // orderBy argument: desc(col) — an SQL node whose chunks carry the column
  // and the literal "desc".
  const buildComparator = (orderNode: any, table: any): ((a: any, b: any) => number) => {
    let col: any = null;
    let text = "";
    for (const chunk of orderNode.queryChunks ?? []) {
      if (isColumn(chunk)) col = chunk;
      else text += chunkText(chunk);
    }
    if (!col) return () => 0;
    const key = columnKey(table, col);
    const dir = text.includes("desc") ? -1 : 1;
    return (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * dir;
  };

  const db = {
    select(fields?: Record<string, any>) {
      let table: any = null;
      let rows: any[] = [];
      const chain = {
        from(t: any) {
          table = t;
          h.state.queriedTables.push(getTableName(t));
          rows = [...h.tableRows(getTableName(t))];
          return chain;
        },
        where(cond: any) {
          rows = rows.filter(buildPredicate(cond, table));
          return chain;
        },
        orderBy(...orderNodes: any[]) {
          for (const node of [...orderNodes].reverse()) {
            rows.sort(buildComparator(node, table));
          }
          return chain;
        },
        limit(n: number): Promise<any[]> {
          const projected = fields
            ? rows.map((row) => {
                const out: Record<string, any> = {};
                for (const [key, col] of Object.entries(fields)) {
                  out[key] = row[columnKey(table, col)];
                }
                return out;
              })
            : rows;
          return Promise.resolve(projected.slice(0, n));
        },
      };
      return chain;
    },
  };

  return { db };
});

import { authorizeSoftPull, evaluateSoftPull } from "../server/mcp/softPullGate";

const BORROWER = "user-1";
const APPLICATION = "app-1";

const DAY = 24 * 60 * 60 * 1000;

function seedConsent(overrides: Partial<Record<string, any>> = {}) {
  h.tableRows("credit_consents").push({
    id: overrides.id ?? `consent-${h.tableRows("credit_consents").length + 1}`,
    userId: BORROWER,
    consentType: "soft_pull",
    consentGiven: true,
    isActive: true,
    consentTimestamp: new Date(Date.now() - DAY),
    ...overrides,
  });
}

function seedFreshCachedPull(overrides: Partial<Record<string, any>> = {}) {
  h.tableRows("credit_pulls").push({
    id: overrides.id ?? `pull-${h.tableRows("credit_pulls").length + 1}`,
    applicationId: APPLICATION,
    pullType: "soft",
    status: "completed",
    requestedAt: new Date(Date.now() - 10 * DAY),
    expiresAt: new Date(Date.now() + 80 * DAY),
    representativeScore: 742,
    monthlyPayments: "1850",
    ...overrides,
  });
}

beforeEach(() => {
  h.state.rows.clear();
  h.state.queriedTables.length = 0;
});

describe("F-042: consent gate runs before any bureau data is read", () => {
  it("refuses a revoked-consent borrower even when a fresh cached pull exists — and never reads the pulls table", async () => {
    // The exact F-042 scenario: consent revoked, cached soft pull still
    // unexpired (soft pulls cache for 90 days).
    seedConsent({ isActive: false });
    seedFreshCachedPull();

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result).toEqual({ outcome: "refused", reason: "no_active_consent" });
    expect(h.state.queriedTables).toContain("credit_consents");
    expect(h.state.queriedTables).not.toContain("credit_pulls");
  });

  it("refuses when no consent was ever given, cached pull or not", async () => {
    seedFreshCachedPull();

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result).toEqual({ outcome: "refused", reason: "no_active_consent" });
    expect(h.state.queriedTables).not.toContain("credit_pulls");
  });

  it("refuses a consent whose type does not cover a soft pull (deny by default), without reading the pulls table", async () => {
    // `monitoring` is in the schema's taxonomy but deliberately authorizes
    // nothing (see CONSENT_PULL_COVERAGE in creditConsents.ts).
    seedConsent({ consentType: "monitoring" });
    seedFreshCachedPull();

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result).toMatchObject({
      outcome: "refused",
      reason: "consent_scope_mismatch",
      consent: { consentType: "monitoring" },
    });
    expect(h.state.queriedTables).not.toContain("credit_pulls");
  });

  it("the newest active consent decides: a newer non-covering consent refuses even if an older covering one exists", async () => {
    // Matches getActiveConsent / requestCreditPull semantics (fix 02a4d8a):
    // newest-first, limit 1 — an older consent does not resurrect access.
    seedConsent({ consentType: "soft_pull", consentTimestamp: new Date(Date.now() - 30 * DAY) });
    seedConsent({ consentType: "monitoring", consentTimestamp: new Date(Date.now() - DAY) });
    seedFreshCachedPull();

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result).toMatchObject({ outcome: "refused", reason: "consent_scope_mismatch" });
    expect(h.state.queriedTables).not.toContain("credit_pulls");
  });
});

describe("authorized flows keep their existing behavior", () => {
  it("returns the cached pull under an active soft_pull consent", async () => {
    seedConsent();
    seedFreshCachedPull({ id: "pull-cached" });

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result.outcome).toBe("cached");
    if (result.outcome === "cached") {
      expect(result.pull.id).toBe("pull-cached");
      expect(result.consent.consentType).toBe("soft_pull");
    }
  });

  it("a hard_pull consent covers a soft pull as lesser-included", async () => {
    seedConsent({ consentType: "hard_pull" });
    seedFreshCachedPull();

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result.outcome).toBe("cached");
  });

  it("an expired cached pull does not satisfy the cache — a fresh pull is required", async () => {
    seedConsent();
    seedFreshCachedPull({ expiresAt: new Date(Date.now() - DAY) });

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result).toMatchObject({ outcome: "pull_required" });
  });

  it("no cached pull at all — pull_required, with the authorizing consent attached", async () => {
    seedConsent({ id: "consent-live" });

    const result = await evaluateSoftPull({ borrowerUserId: BORROWER, applicationId: APPLICATION });

    expect(result).toMatchObject({ outcome: "pull_required", consent: { id: "consent-live" } });
  });

  it("authorizeSoftPull alone: refusal carries no consent for no_active_consent, and the consent for scope mismatch", async () => {
    expect(await authorizeSoftPull(BORROWER)).toEqual({
      outcome: "refused",
      reason: "no_active_consent",
    });

    seedConsent({ id: "c-mon", consentType: "monitoring" });
    expect(await authorizeSoftPull(BORROWER)).toEqual({
      outcome: "refused",
      reason: "consent_scope_mismatch",
      consent: { id: "c-mon", consentType: "monitoring" },
    });
  });
});
