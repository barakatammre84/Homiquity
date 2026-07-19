import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConditionsTab } from "./ConditionsTab";
import { type LoanCondition } from "@shared/schema";

// Characterization for the extracted conditions tab: bucket routing, the
// staff-only action buttons, and the audit-trail rule (waive / N-A demand a
// written reason before the confirm button arms).

const condition = (over: Partial<LoanCondition>): LoanCondition =>
  ({
    id: "c-1",
    title: "Verify reserves",
    description: null,
    category: "assets",
    priority: "prior_to_approval",
    status: "outstanding",
    clearanceNotes: null,
    clearedAt: null,
    ...over,
  }) as unknown as LoanCondition;

function renderTab(conditions: LoanCondition[], isStaff = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConditionsTab applicationId="app-1" conditions={conditions} isStaff={isStaff} />
    </QueryClientProvider>,
  );
}

describe("ConditionsTab", () => {
  it("routes conditions into Outstanding (incl. submitted) and Resolved buckets", () => {
    renderTab([
      condition({ id: "c-1", status: "outstanding" }),
      condition({ id: "c-2", status: "submitted", title: "Pay stub" }),
      condition({ id: "c-3", status: "cleared", title: "VOE", clearedAt: new Date().toISOString() as never }),
      condition({ id: "c-4", status: "waived", title: "Gift letter" }),
    ]);
    expect(screen.getByText("Outstanding (2)")).toBeTruthy();
    expect(screen.getByText("Resolved (2)")).toBeTruthy();
    expect(screen.getByTestId("condition-outstanding-c-2").textContent).toContain("Submitted");
    expect(screen.getByTestId("condition-resolved-c-4").textContent).toContain("Waived");
  });

  it("hides clear/waive/N-A actions from non-staff", () => {
    renderTab([condition({ id: "c-1" })], false);
    expect(screen.queryByTestId("button-clear-condition-c-1")).toBeNull();
    expect(screen.queryByTestId("button-waive-condition-c-1")).toBeNull();
  });

  it("waiving demands a written reason before the confirm button arms (audit trail)", async () => {
    const user = userEvent.setup();
    renderTab([condition({ id: "c-1" })]);
    await user.click(screen.getByTestId("button-waive-condition-c-1"));
    expect(screen.getByText("Waive Condition")).toBeTruthy();
    const confirm = screen.getByTestId("button-confirm-condition-action");
    expect(confirm.hasAttribute("disabled")).toBe(true);
    await user.type(screen.getByTestId("input-condition-notes"), "Covered by updated VOD");
    expect(confirm.hasAttribute("disabled")).toBe(false);
  });

  it("clearing needs no reason — notes stay optional", async () => {
    const user = userEvent.setup();
    renderTab([condition({ id: "c-1" })]);
    await user.click(screen.getByTestId("button-clear-condition-c-1"));
    expect(screen.getByText("Clear Condition")).toBeTruthy();
    expect(screen.getByTestId("button-confirm-condition-action").hasAttribute("disabled")).toBe(false);
  });
});
