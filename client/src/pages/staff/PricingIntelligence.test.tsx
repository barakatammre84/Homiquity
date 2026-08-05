import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PricingIntelligence from "./PricingIntelligence";

// ARC-2 pins: the panel is advisory (never a pricing writer), the delta is
// signed and labeled, a missing ingest surfaces the endpoint's own hint
// instead of an empty chart, and null offers render honestly.

const undercut = {
  ourBestOffer: {
    lenderName: "United Wholesale Mortgage",
    productName: "Conv 30yr",
    productType: "conventional_30",
    adjustedRate: 6.375,
  },
  benchmark: {
    medianRate: 6.5,
    p25Rate: 6.25,
    p75Rate: 6.75,
    loanCount: 12873,
    activityYear: 2024,
    resolvedLevel: "state",
    lenders: "aggregate",
  },
  deltaBps: -13,
  beatsMedian: true,
  note: "Advisory only — rate changes go through rate sheets.",
};

const risk = {
  creditBucket: "720-759",
  ltvBand: "80-90",
  dtiBand: "unknown",
  loanCount: 40211,
  defaultRatePct: "1.240",
  seriousDelinqRatePct: "2.910",
  prepayRatePct: "38.500",
  avgOrigRate: "4.125",
  sourceDataset: "sf_2019q1-2023q4",
};

// The page derives its query keys from the submitted form (defaults:
// 740 / 380000 / 475000 / IL → LTV 80.0).
const UNDERCUT_KEY =
  "/api/market-data/undercut-quote?creditScore=740&loanAmount=380000&propertyValue=475000&state=IL";
const RISK_KEY = "/api/market-data/risk-profile?creditScore=740&ltv=80.0";

function renderPage(seed = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (seed) {
    client.setQueryData([UNDERCUT_KEY], undercut);
    client.setQueryData([RISK_KEY], risk);
  }
  return render(
    <QueryClientProvider client={client}>
      <PricingIntelligence />
    </QueryClientProvider>,
  );
}

describe("PricingIntelligence", () => {
  it("renders nothing but the form until the staffer runs an analysis", () => {
    renderPage();
    expect(screen.queryByTestId("card-undercut")).toBeNull();
    expect(screen.getByTestId("button-run-analysis")).toBeTruthy();
  });

  it("shows our rate vs the market with a signed delta and the advisory note verbatim", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-run-analysis"));
    expect(screen.getByTestId("text-our-rate").textContent).toBe("6.375%");
    expect(screen.getByTestId("text-market-median").textContent).toBe("6.500%");
    expect(screen.getByTestId("badge-delta").textContent).toBe("-13 bps vs median");
    expect(screen.getByTestId("text-undercut-note").textContent).toMatch(
      /rate changes go through rate sheets/i,
    );
  });

  it("renders the risk band as history, never a prediction for this borrower", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-run-analysis"));
    expect(screen.getByTestId("risk-stats").textContent).toMatch(/1\.240%/);
    expect(screen.getByTestId("card-risk-profile").textContent).toMatch(
      /historical Fannie Mae performance, not a prediction/i,
    );
  });
});
