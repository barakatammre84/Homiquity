import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComplianceTab } from "./ComplianceTab";
import { type ComplianceData } from "./model";

// Render pins for the extracted compliance tab. The retention queries stay
// pending in tests (no server) — the section headers and the ECOA counter
// logic are what this pins; the live data path is covered by the dashboard's
// KPI cards reading the same complianceData query.

function renderTab(complianceData?: ComplianceData) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ComplianceTab complianceData={complianceData} />
    </QueryClientProvider>,
  );
}

describe("ComplianceTab", () => {
  it("renders the section frame with no data: readiness counters at 0, empty loans state", () => {
    renderTab(undefined);
    expect(screen.getByTestId("text-gse-ready").textContent).toBe("0");
    expect(screen.getByTestId("text-uldd-compliant").textContent).toBe("0");
    expect(screen.getByText("No active loans to validate")).toBeTruthy();
    expect(screen.getByText("Data Retention & Archival")).toBeTruthy();
    expect(screen.getByText("Compliance Audit Log")).toBeTruthy();
  });

  it("ECOA §1002.9 counter escalates: baseline → warning → breach copy", () => {
    const base = { gseReady: 0, ulddCompliant: 0, needsAttention: 0, applications: [] };
    const { unmount } = renderTab({ ...base, adverseActionDelivery: { undelivered: 0, warning: 0, breach: 0 } } as unknown as ComplianceData);
    expect(screen.getByTestId("text-aa-delivery-status").textContent).toContain("ECOA §1002.9");
    unmount();
    const { unmount: u2 } = renderTab({ ...base, adverseActionDelivery: { undelivered: 2, warning: 2, breach: 0 } } as unknown as ComplianceData);
    expect(screen.getByTestId("text-aa-delivery-status").textContent).toContain("nearing 30-day deadline");
    u2();
    renderTab({ ...base, adverseActionDelivery: { undelivered: 3, warning: 1, breach: 2 } } as unknown as ComplianceData);
    expect(screen.getByTestId("text-aa-delivery-status").textContent).toContain("past 30-day ECOA window");
    expect(screen.getByTestId("text-aa-undelivered").textContent).toBe("3");
  });
});
