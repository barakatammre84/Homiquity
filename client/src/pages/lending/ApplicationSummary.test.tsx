import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dashboardKeys } from "@/lib/queryClient";
import type { LoanApplication } from "@shared/schema";

// Pins the summary's migration onto the pattern components: the financial
// section declares its source and why-we-ask, income/debts render dual-unit
// with the monthly column DERIVED from the annual figure, and the
// client-computed loan amount is labeled Calculated instead of unlabeled.

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { firstName: "Alex", lastName: "Rivera", email: "alex@example.com" },
    isLoading: false,
  }),
}));

import ApplicationSummary from "./ApplicationSummary";

const app = {
  id: "app-1",
  status: "submitted",
  annualIncome: "84000",
  monthlyDebts: "500",
  purchasePrice: "400000",
  downPayment: "80000",
  propertyCity: "Chicago",
  propertyState: "IL",
} as unknown as LoanApplication;

function renderPage(applications: LoanApplication[]) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: () => new Promise(() => {}),
      },
    },
  });
  client.setQueryData(dashboardKeys.root(), { applications });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationSummary />
    </QueryClientProvider>,
  );
}

describe("ApplicationSummary", () => {
  it("declares the financial section's source and explanation", () => {
    renderPage([app]);

    expect(screen.getByTestId("summary-financial-provenance").textContent).toBe(
      "You told us",
    );
    expect(
      screen.getByTestId("summary-financial-why-we-ask").textContent,
    ).toContain("debt-to-income");
  });

  it("renders income and debts dual-unit, monthly derived from annual", () => {
    renderPage([app]);

    const income = screen.getByTestId("text-income").textContent!;
    expect(income).toContain("$84,000");
    expect(income).toContain("$7,000");

    // Debts entered monthly ($500) render as $6,000/yr and $500/mo — one
    // source figure, two units, derived not duplicated.
    const debts = screen.getByTestId("text-debts").textContent!;
    expect(debts).toContain("$6,000");
    expect(debts).toContain("$500");

    // J-0820-04: this line used to assert the opposite — it pinned the note
    // "From your soft credit check — the kind that never affects your credit
    // score." That claim was false for every organic file: the figure is typed
    // by the borrower at funnel step 11, and no pull has happened. The test
    // was green because it asserted the defect, which is how a fixture keeps a
    // bug alive.
    //
    // Now it asserts the honest direction, and asserts the absence of the
    // false attribution so it cannot come back quietly. The section already
    // declares SELF_REPORTED provenance — these two must agree.
    expect(screen.queryByText(/from your soft credit check/i)).toBeNull();
    expect(screen.getByText(/the monthly total you gave us/i)).toBeTruthy();
  });

  it("labels the client-computed loan amount Calculated", () => {
    renderPage([app]);

    expect(screen.getByTestId("text-loan-amount").textContent).toContain("$320,000");
    expect(screen.getByTestId("provenance-loan-amount").textContent).toBe("Calculated");
  });

  it("shows a scoped empty state when there is no active application", () => {
    renderPage([]);

    expect(screen.getByTestId("empty-state").textContent).toContain(
      "No active application yet",
    );
    expect(screen.getByTestId("button-start-application")).toBeTruthy();
  });
});
