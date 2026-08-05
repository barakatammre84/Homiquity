import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditChainStatusTiles } from "./AuditChainStatusTiles";
import type { RetentionReport } from "./model";

/**
 * F-039 — the three Compliance-tab assurance tiles were hardcoded green.
 *
 * They were literal markup: no `useQuery`, no props, no reference to any verify
 * endpoint. "Hash Chain Verified / All audit entries are cryptographically
 * linked" rendered identically whether the log was intact or destroyed.
 *
 * The single property worth protecting is that these tiles **can reach a
 * failing state**. A test that only asserted the happy path would have passed
 * against the original hardcoded markup, which is precisely the trap here — so
 * the broken and degraded cases carry the weight below, and the passing case is
 * asserted mainly to prove the tile is not simply always-red now.
 */

type Sweep = {
  scopesTotal: number;
  scopesChecked: number;
  scopesValid: number;
  invalid: Array<{ scopeKey: string; reason: string; totalEntries: number }>;
  tailAnchored: number;
  sequenceHashed: number;
  complete: boolean;
};

const OK_SWEEP: Sweep = {
  scopesTotal: 4,
  scopesChecked: 4,
  scopesValid: 4,
  invalid: [],
  tailAnchored: 4,
  sequenceHashed: 4,
  complete: true,
};

/** Supplies the sweep straight through queryFn — the house pattern for query tests. */
function renderTiles(sweep: Sweep | "error", report?: RetentionReport) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => {
          if (sweep === "error") throw new Error("verification unavailable");
          return sweep;
        },
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuditChainStatusTiles report={report} />
    </QueryClientProvider>,
  );
}

describe("F-039: the hash-chain tile reflects a real sweep", () => {
  it("goes RED when a chain fails, naming the scope and the reason", async () => {
    // The case the old tile could not express at all.
    renderTiles({
      ...OK_SWEEP,
      scopesValid: 3,
      invalid: [
        { scopeKey: "app-42", reason: "Chain tail truncated: 3 entries missing", totalEntries: 7 },
      ],
    });
    await waitFor(() => expect(screen.getByTestId("tile-hash-chain-broken")).toBeTruthy());
    const tile = screen.getByTestId("tile-hash-chain-broken");
    expect(tile.textContent).toContain("app-42");
    expect(tile.textContent).toContain("tail truncated");
    expect(screen.queryByTestId("tile-hash-chain-ok")).toBeNull();
  });

  it("does NOT claim a pass when the check itself fails", async () => {
    // The old tile's failure mode was to keep saying "verified". An unknown
    // result must not read as a passing one.
    renderTiles("error");
    await waitFor(() => expect(screen.getByTestId("tile-hash-chain-error")).toBeTruthy());
    expect(screen.getByTestId("tile-hash-chain-error").textContent).toContain("not a pass");
    expect(screen.queryByTestId("tile-hash-chain-ok")).toBeNull();
  });

  it("reports full coverage only when the sweep was complete and fully anchored", async () => {
    renderTiles(OK_SWEEP);
    await waitFor(() => expect(screen.getByTestId("tile-hash-chain-ok")).toBeTruthy());
    expect(screen.getByTestId("tile-hash-chain-ok").textContent).toContain("full coverage");
  });

  it("qualifies the pass when the sweep was capped or coverage is partial", async () => {
    // Passing-but-narrower. Saying "verified" flatly here would be the same
    // overclaim as the hardcoded tile, just arrived at by a different route.
    renderTiles({
      scopesTotal: 213,
      scopesChecked: 50,
      scopesValid: 50,
      invalid: [],
      tailAnchored: 12,
      sequenceHashed: 8,
      complete: false,
    });
    await waitFor(() => expect(screen.getByTestId("tile-hash-chain-ok")).toBeTruthy());
    const text = screen.getByTestId("tile-hash-chain-ok").textContent ?? "";
    expect(text).toContain("50 of 213");
    expect(text).toContain("not yet tail-anchored");
    expect(text).toContain("predate sequence hashing");
    expect(text).not.toContain("full coverage");
  });
});

describe("F-039: the retention tile reflects the retention report", () => {
  const report = (overrides: Partial<RetentionReport>): RetentionReport =>
    ({
      generatedAt: "2026-08-05T00:00:00.000Z",
      policies: [],
      recordCounts: {},
      archiveEligibleCounts: {},
      deleteEligibleCounts: {},
      retentionReviewCounts: {},
      recommendations: [],
      ...overrides,
    }) as RetentionReport;

  it("goes RED when records are past their retention window", async () => {
    renderTiles(OK_SWEEP, report({ retentionReviewCounts: { credit_pulls: 4, consents: 2 } }));
    await waitFor(() => expect(screen.getByTestId("tile-retention-due")).toBeTruthy());
    expect(screen.getByTestId("tile-retention-due").textContent).toContain("6 due for review");
  });

  it("reports on-policy when nothing is overdue", async () => {
    renderTiles(OK_SWEEP, report({ archiveEligibleCounts: { credit_pulls: 3 } }));
    await waitFor(() => expect(screen.getByTestId("tile-retention-ok")).toBeTruthy());
    expect(screen.getByTestId("tile-retention-ok").textContent).toContain("3 eligible to archive");
  });
});

describe("F-039: the export tile makes a capability claim, not a status claim", () => {
  it("does not present itself as a passing check", async () => {
    renderTiles(OK_SWEEP);
    const tile = screen.getByTestId("tile-export");
    // Nothing verifies that an export would succeed, so it must not borrow the
    // vocabulary of the checks that ARE verified. "Ready" was the old wording.
    expect(tile.textContent).not.toContain("Ready");
    expect(tile.textContent).toContain("Export Available");
  });
});
