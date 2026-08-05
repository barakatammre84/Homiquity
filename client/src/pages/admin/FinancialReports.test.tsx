import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FinancialReports from "./FinancialReports";

// Characterization tests for the admin financial-reports page — the consumer
// that closes UNCONSUMED_CAPABILITIES' report-endpoint entry. Pins the three
// honesty rules the page must not erode: null metrics render as "—" (never a
// fake zero), the liability sum is labelled a floor with its unquantified
// count beside it, and the unit-economics notes (the upper-bound caveat)
// render verbatim.

const compensationReport = {
  inFlightCount: 2,
  fundedCount: 1,
  deadCount: 1,
  pullThroughPct: 50,
  fundedVolume: 400000,
  expectedCompensation: 8000,
  receivedCompensation: 7000,
  compensationVariance: -1000,
  shortPaidCount: 1,
  awaitingRemittanceCount: 0,
  approvedLenderCount: 0,
  discrepancies: [
    {
      submissionId: "s1",
      applicationId: "a1",
      lender: "United Wholesale Mortgage",
      fundedAt: "2026-08-01T00:00:00.000Z",
      status: "short_paid",
      expectedAmount: 8000,
      receivedAmount: 7000,
      variance: -1000,
      variancePct: -12.5,
      message: "Short-paid by $1000.00",
    },
  ],
  clawbackExposure: {
    atRiskCount: 1,
    totalAtRisk: 7000,
    indeterminateCount: 1,
    usesAssumedWindow: true,
    nextExpiry: "2027-01-28T00:00:00.000Z",
    entries: [],
  },
  costs: { totalCost: 710, simulatedCost: 30, byCategory: [], entryCount: 3, filesWithCost: 2 },
  unitEconomics: {
    revenue: 7000,
    directCost: 710,
    grossMargin: 6290,
    grossMarginPct: 89.9,
    costPerFundedLoan: 710,
    marginPerFundedLoan: 6290,
    costPerFileTouched: 355,
    costSideIncomplete: true,
    notes: [
      "Direct vendor spend only — loan-officer compensation, processing labour and overhead are not captured, so gross margin is an upper bound.",
    ],
  },
};

const liabilityRegister = {
  quantifiedFloor: 8650,
  unquantifiedCount: 3,
  incomplete: true,
  entries: [
    {
      category: "epo_clawback",
      label: "Early-payoff compensation clawback",
      basis: "computed",
      amount: 7000,
      count: 1,
      window: "From funding until the EPO window closes",
      trigger: "A funded loan pays off inside the lender's early-payoff window",
      assumptions: [],
      action: null,
      note: "",
    },
    {
      category: "minimum_net_worth",
      label: "Minimum net worth (state licensing)",
      basis: "policy_unquantified",
      amount: null,
      count: 0,
      window: "Continuous while licensed",
      trigger: "A condition of maintaining the residential mortgage license",
      assumptions: [],
      action: "Verify the minimum net worth against the state statute.",
      note: "",
    },
  ],
  assumptions: ["EPO window length is the platform default."],
  actions: ["Verify the minimum net worth against the state statute."],
  summary: "$8650.00 of contingent liability is measurable today across 4 exposure types. 3 further exposure(s) are real but unquantified here, so this is a FLOOR, not a reserve figure.",
};

const cycleReport = {
  windowDays: 90,
  totalCreated: 6,
  outcomes: { funded: 2, denied: 1, withdrawn: 1, expired: 0, inFlight: 2 },
  pullThroughResolvedPct: 50,
  pullThroughOverallPct: 33.3,
  cycleTime: { measuredCount: 1, unmeasuredFundedCount: 1, medianDays: 11, p90Days: 11 },
  notes: [
    "Resolved pull-through divides funded by files that reached any terminal state — the number the >70% gate means. Overall divides by everything created in the window; in-flight files drag it down.",
    "1 funded file(s) have no usable funding transition in the audit trail — counted in pull-through, excluded from cycle time.",
  ],
};

function renderPage(overrides?: {
  comp?: Record<string, unknown> | null;
  liabilities?: Record<string, unknown> | null;
  cycle?: Record<string, unknown> | null;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } },
  });
  const comp = overrides?.comp === undefined ? compensationReport : overrides.comp;
  const liabilities =
    overrides?.liabilities === undefined ? liabilityRegister : overrides.liabilities;
  const cycle = overrides?.cycle === undefined ? cycleReport : overrides.cycle;
  if (comp) client.setQueryData(["/api/reports/compensation"], comp);
  if (liabilities) client.setQueryData(["/api/reports/contingent-liabilities"], liabilities);
  if (cycle) client.setQueryData(["/api/reports/cycle-time"], cycle);
  return render(
    <QueryClientProvider client={client}>
      <FinancialReports />
    </QueryClientProvider>,
  );
}

describe("FinancialReports — funnel cycle-time card (G-C)", () => {
  it("renders both pull-through denominators and the median with its gate", () => {
    renderPage();
    const card = screen.getByTestId("card-cycle-time");
    expect(screen.getByTestId("stat-pull-through-resolved").textContent).toMatch(/gate is >70%/);
    expect(screen.getByTestId("stat-median-cycle").textContent).toMatch(/11\.0 days/);
    expect(card.textContent).toMatch(/in-flight files drag it down/i);
  });

  it("renders null funnel metrics as —, never zero, and keeps the unmeasured note verbatim", () => {
    renderPage({
      cycle: {
        ...cycleReport,
        pullThroughResolvedPct: null,
        cycleTime: { measuredCount: 0, unmeasuredFundedCount: 1, medianDays: null, p90Days: null },
      },
    });
    expect(screen.getByTestId("stat-pull-through-resolved").textContent).toMatch(
      /not zero, undefined/i,
    );
    expect(screen.getByTestId("stat-median-cycle").textContent).toContain("—");
    expect(screen.getByTestId("list-cycle-notes").textContent).toMatch(
      /no usable funding transition/,
    );
  });
});

describe("FinancialReports", () => {
  it("flags zero approved lenders as the blocked state it is (F-5)", () => {
    renderPage();
    const stat = screen.getByTestId("stat-approved-lenders");
    expect(stat.textContent).toMatch(/production submissions are blocked/i);
  });

  it("renders a null pull-through as — with the undefined-not-zero hint", () => {
    renderPage({ comp: { ...compensationReport, pullThroughPct: null, fundedCount: 0, deadCount: 0 } });
    const stat = screen.getByTestId("stat-pull-through");
    expect(stat.textContent).toContain("—");
    expect(stat.textContent).toMatch(/not zero, undefined/i);
  });

  it("labels the liability sum a floor and shows the unquantified count beside it", () => {
    renderPage();
    const floor = screen.getByTestId("stat-liability-floor");
    expect(floor.textContent).toMatch(/not a total/i);
    expect(floor.textContent).toMatch(/3 real exposure/);
  });

  it("renders an unpriceable exposure as — never zero", () => {
    renderPage();
    const row = screen.getByTestId("row-exposure-minimum_net_worth");
    expect(row.textContent).toContain("—");
    expect(row.textContent).not.toMatch(/\$0\.00/);
    expect(row.textContent).toMatch(/Unquantified/);
  });

  it("renders the unit-economics upper-bound note verbatim", () => {
    renderPage();
    expect(screen.getByTestId("list-economics-notes").textContent).toMatch(
      /gross margin is an upper bound/i,
    );
  });

  it("lists short-paid remittances with their variance", () => {
    renderPage();
    const row = screen.getByTestId("row-discrepancy-s1");
    expect(row.textContent).toMatch(/Short-paid/);
    expect(row.textContent).toMatch(/United Wholesale Mortgage/);
  });

  it("surfaces the assumed-window and indeterminate clawback flags", () => {
    renderPage();
    expect(screen.getByTestId("badge-clawback-assumed")).toBeTruthy();
    expect(screen.getByTestId("badge-clawback-indeterminate").textContent).toMatch(/unknown amount/i);
  });

  it("shows skeletons, not fabricated numbers, while loading", () => {
    renderPage({ comp: null, liabilities: null });
    expect(screen.getByTestId("skeleton-compensation")).toBeTruthy();
    expect(screen.getByTestId("skeleton-liabilities")).toBeTruthy();
  });
});
