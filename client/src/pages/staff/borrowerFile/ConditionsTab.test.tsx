import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConditionsTab } from "./ConditionsTab";
import { CONDITION_VERDICT_ROLES } from "@shared/statusVocabularies";
import type { LoanCondition } from "@shared/schema";

// Characterization for the extracted conditions tab: bucket routing and the
// audit-trail rule (waive / N-A demand a written reason before the confirm
// button arms) — plus, since 2026-08-23, per-role verdict-button visibility.
//
// Offered-vs-permitted (walk record, GATES): this tab rendered Clear / Waive /
// N-A for every staff role while the server's verdict lists (now
// CONDITION_VERDICT_ROLES, shared with the route) exclude `lo` from all three
// and the route gate excludes `loa` entirely — so an LO was offered three
// buttons and 403'd on each ("Only underwriters, processors, closers, and
// admins can clear conditions", lived). The visibility tests pin the buttons
// to the SAME constant the server enforces, so the two sides cannot drift.

const condition = (over: Partial<LoanCondition> = {}): LoanCondition =>
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

function renderTab(conditions: LoanCondition[], userRole: string | undefined = "underwriter") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConditionsTab applicationId="app-1" conditions={conditions} userRole={userRole} />
    </QueryClientProvider>,
  );
}

const CLEAR = "button-clear-condition-c-1";
const WAIVE = "button-waive-condition-c-1";
const NA = "button-na-condition-c-1";

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
    renderTab([condition({ id: "c-1" })], "borrower");
    expect(screen.queryByTestId(CLEAR)).toBeNull();
    expect(screen.queryByTestId(WAIVE)).toBeNull();
    expect(screen.queryByTestId(NA)).toBeNull();
  });

  it("waiving demands a written reason before the confirm button arms (audit trail)", async () => {
    const user = userEvent.setup();
    renderTab([condition({ id: "c-1" })], "underwriter");
    await user.click(screen.getByTestId(WAIVE));
    expect(screen.getByText("Waive Condition")).toBeTruthy();
    const confirm = screen.getByTestId("button-confirm-condition-action");
    expect(confirm.hasAttribute("disabled")).toBe(true);
    await user.type(screen.getByTestId("input-condition-notes"), "Covered by updated VOD");
    expect(confirm.hasAttribute("disabled")).toBe(false);
  });

  it("clearing needs no reason — notes stay optional", async () => {
    const user = userEvent.setup();
    renderTab([condition({ id: "c-1" })], "underwriter");
    await user.click(screen.getByTestId(CLEAR));
    expect(screen.getByText("Clear Condition")).toBeTruthy();
    expect(screen.getByTestId("button-confirm-condition-action").hasAttribute("disabled")).toBe(false);
  });
});

describe("ConditionsTab — verdict buttons follow the server's role policy", () => {
  it("underwriter sees all three verdicts", () => {
    renderTab([condition()], "underwriter");
    expect(screen.getByTestId(CLEAR)).toBeTruthy();
    expect(screen.getByTestId(WAIVE)).toBeTruthy();
    expect(screen.getByTestId(NA)).toBeTruthy();
  });

  it("processor sees Clear and N/A but never Waive (admin/underwriter only)", () => {
    renderTab([condition()], "processor");
    expect(screen.getByTestId(CLEAR)).toBeTruthy();
    expect(screen.queryByTestId(WAIVE)).toBeNull();
    expect(screen.getByTestId(NA)).toBeTruthy();
  });

  it("closer sees Clear only", () => {
    renderTab([condition()], "closer");
    expect(screen.getByTestId(CLEAR)).toBeTruthy();
    expect(screen.queryByTestId(WAIVE)).toBeNull();
    expect(screen.queryByTestId(NA)).toBeNull();
  });

  it("lo sees NO verdict buttons — the server refuses all three (the lived 403)", () => {
    renderTab([condition()], "lo");
    expect(screen.queryByTestId(CLEAR)).toBeNull();
    expect(screen.queryByTestId(WAIVE)).toBeNull();
    expect(screen.queryByTestId(NA)).toBeNull();
    // The condition itself still renders — read-only visibility is unchanged.
    expect(screen.getByTestId("condition-outstanding-c-1")).toBeTruthy();
  });

  it("loa and a missing role see no verdict buttons either", () => {
    // "" stands in for a session with no resolvable role: canSetConditionVerdict
    // fails closed on anything outside the constant. (Passing `undefined` would
    // hit renderTab's default parameter, not the component's undefined branch.)
    for (const role of ["loa", ""]) {
      const { unmount } = renderTab([condition()], role);
      expect(screen.queryByTestId(CLEAR), String(role)).toBeNull();
      expect(screen.queryByTestId(WAIVE), String(role)).toBeNull();
      expect(screen.queryByTestId(NA), String(role)).toBeNull();
      unmount();
    }
  });

  it("every role the shared constant permits gets exactly its buttons (drift-proof sweep)", () => {
    for (const role of ["admin", "underwriter", "processor", "closer", "lo", "loa"]) {
      const { unmount } = renderTab([condition()], role);
      const expectVisible = (verdict: keyof typeof CONDITION_VERDICT_ROLES, testId: string) => {
        const allowed = (CONDITION_VERDICT_ROLES[verdict] as readonly string[]).includes(role);
        expect(!!screen.queryByTestId(testId), `${role}/${verdict}`).toBe(allowed);
      };
      expectVisible("cleared", CLEAR);
      expectVisible("waived", WAIVE);
      expectVisible("not_applicable", NA);
      unmount();
    }
  });
});
