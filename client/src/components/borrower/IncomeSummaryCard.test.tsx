import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BorrowerIncomeSummary } from "@shared/borrowerIncomeView";
import {
  BORROWER_INCOME_DISCLAIMER,
  INCOME_ANALYSIS_EDUCATION,
} from "@shared/borrowerIncomeView";
import { IncomeSummaryCard } from "./IncomeSummaryCard";

// Borrower Clarity PR 7: post-decision the card shows the verified breakdown
// with the not-a-commitment disclaimer; pre-decision it is educational —
// sources under analysis, "finding your full purchasing power", NO figures.

let response: BorrowerIncomeSummary;

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: async () => response } },
  });
  return render(
    <QueryClientProvider client={client}>
      <IncomeSummaryCard applicationId="app-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  response = {
    available: true,
    evaluatedAt: "2026-08-04T12:00:00.000Z",
    incomeBasis: "urla_line_items",
    totalMonthlyQualifyingIncome: 13412.34,
    paths: [
      {
        pathId: "agency_wage",
        label: "Employment income",
        monthlyQualifyingIncome: 5000,
        appliedToDti: true,
        citations: [{ doc: "Fannie Mae Selling Guide", section: "B3-3.1-01" }],
      },
      {
        pathId: "self_employment",
        label: "Business & self-employment income",
        monthlyQualifyingIncome: 8412.34,
        appliedToDti: true,
        citations: [{ doc: "Fannie Mae Selling Guide", section: "B3-3.5-01" }],
      },
    ],
    disclaimer: BORROWER_INCOME_DISCLAIMER,
  };
});

describe("IncomeSummaryCard — available (post-decision)", () => {
  it("shows the qualifying total, per-source figures, and citations", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("card-income-summary")).toBeTruthy();
    });
    expect(screen.getByTestId("text-income-total").textContent).toContain("13,412");
    const se = screen.getByTestId("row-income-path-self_employment");
    expect(se.textContent).toContain("Business & self-employment income");
    expect(se.textContent).toContain("8,412");
    expect(se.textContent).toContain("B3-3.5-01");
  });

  it("always shows the not-a-commitment disclaimer", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("text-income-disclaimer").textContent).toBe(
        BORROWER_INCOME_DISCLAIMER,
      );
    });
  });
});

describe("IncomeSummaryCard — analyzing (pre-decision)", () => {
  beforeEach(() => {
    response = {
      available: false,
      state: "analyzing",
      sourcesUnderReview: ["Employment income", "Rental income"],
      education: INCOME_ANALYSIS_EDUCATION,
    };
  });

  it("shows the educational copy and the sources under analysis — no figures", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("card-income-analyzing")).toBeTruthy();
    });
    const card = screen.getByTestId("card-income-analyzing");
    expect(card.textContent).toContain("full purchasing power");
    expect(card.textContent).toContain("Employment income");
    expect(card.textContent).toContain("Rental income");
    expect(card.textContent).not.toMatch(/\$\s?\d/);
  });
});
