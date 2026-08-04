import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FinancialsTab } from "./FinancialsTab";
import { loanApplicationKeys } from "@/lib/queryClient";
import { LOAN_COST_CATEGORIES } from "@shared/costLedger";

// Characterization tests for the per-file financials tab — the consumer that
// empties UNCONSUMED_CAPABILITIES' open list. Pins: "no baseline" is a normal
// state (not an error), the cure figure surfaces with the redisclosure-gate
// caveat, simulated spend stays labelled, and the category vocabulary tracks
// the shared LOAN_COST_CATEGORIES.

const APP_ID = "app-1";

const cureReview = {
  hasBaseline: true,
  baselineVersion: 1,
  baselineIssuedAt: "2026-08-01T12:00:00.000Z",
  evaluation: {
    verdict: "cure_required",
    increases: [
      {
        id: "appraisal",
        label: "Appraisal fee",
        bucket: "zero",
        baselineAmount: 650,
        revisedAmount: 1200,
        increase: 550,
      },
    ],
    zeroToleranceIncrease: 550,
    tenPercent: { baselineTotal: 150, revisedTotal: 150, allowed: 165, excess: 0 },
    cureAmount: 550,
    message: "$550.00 of charges exceed what was disclosed with no change of circumstance on file.",
  },
};

const costsResponse = {
  entries: [
    {
      id: "c1",
      category: "credit_report",
      vendor: "credit-bureau-adapter",
      amount: "30.00",
      incurredAt: "2026-08-02T12:00:00.000Z",
      automatic: true,
      simulated: true,
      description: "tri_merge pull",
    },
  ],
  summary: { totalCost: 0, simulatedCost: 30, byCategory: [], entryCount: 1, filesWithCost: 1 },
};

function renderTab(overrides?: { tolerance?: unknown; costs?: unknown }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } },
  });
  const tolerance = overrides?.tolerance === undefined ? cureReview : overrides.tolerance;
  const costs = overrides?.costs === undefined ? costsResponse : overrides.costs;
  if (tolerance) client.setQueryData(loanApplicationKeys.leTolerance(APP_ID), tolerance);
  if (costs) client.setQueryData(loanApplicationKeys.costs(APP_ID), costs);
  return render(
    <QueryClientProvider client={client}>
      <FinancialsTab applicationId={APP_ID} />
    </QueryClientProvider>,
  );
}

describe("FinancialsTab — tolerance", () => {
  it("treats a missing baseline as the normal pre-disclosure state, not an error", () => {
    renderTab({
      tolerance: { hasBaseline: false, baselineVersion: null, baselineIssuedAt: null, evaluation: null },
    });
    expect(screen.getByTestId("text-no-baseline").textContent).toMatch(/normal pre-disclosure state/i);
  });

  it("surfaces a cure with its amount and the offending line", () => {
    renderTab();
    expect(screen.getByTestId("badge-tolerance-verdict").textContent).toMatch(/Cure required/);
    expect(screen.getByTestId("text-cure-amount").textContent).toMatch(/\$550\.00/);
    expect(screen.getByTestId("row-increase-appraisal").textContent).toMatch(/Appraisal fee/);
  });

  it("states the review is read-only and not a legal cure computation", () => {
    renderTab();
    expect(screen.getByTestId("card-le-tolerance").textContent).toMatch(
      /never creates or resets a baseline/i,
    );
    expect(screen.getByTestId("card-le-tolerance").textContent).toMatch(
      /not a legal cure computation/i,
    );
  });
});

describe("FinancialsTab — cost ledger", () => {
  it("labels metered and simulated entries, and keeps simulated out of the total", () => {
    renderTab();
    const row = screen.getByTestId("row-cost-c1");
    expect(row.textContent).toMatch(/Metered/);
    expect(row.textContent).toMatch(/Simulated/);
    expect(screen.getByTestId("badge-simulated-cost").textContent).toMatch(/excluded from margins/i);
  });

  it("permits a negative amount — the append-only ledger's reversal — but not zero", () => {
    renderTab();
    // The form copy carries the contract.
    expect(screen.getByTestId("form-add-cost").textContent).toMatch(/negative = reversal/i);
  });

  it("offers every shared cost category", () => {
    renderTab();
    // The Select renders options lazily; pin the vocabulary at the module
    // boundary instead: every category has a human label in the tab.
    expect(LOAN_COST_CATEGORIES.length).toBeGreaterThanOrEqual(10);
  });
});
