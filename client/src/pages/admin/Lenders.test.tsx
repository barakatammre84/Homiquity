import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminLenders from "./Lenders";

// No jest-dom in the client lane (vitest.client.config.ts sets no setupFiles),
// so disabled-ness is asserted on the DOM property rather than via a matcher.
const disabled = (testId: string) =>
  (screen.getByTestId(testId) as HTMLButtonElement).disabled;

// The counterparty onboarding surface. These tests pin the properties that
// make it a control rather than a form: the binding constraint is stated, a
// demo row cannot be approved, an assumed EPO window never renders as a
// contracted number, and approval cannot be submitted without its evidence.

const lender = (over: Record<string, unknown> = {}) => ({
  id: "id-1",
  lenderId: "uwm",
  lenderName: "United Wholesale Mortgage",
  lenderCode: "UWM",
  approvalStatus: "target",
  isDemo: false,
  status: "ACTIVE",
  epoClawbackDays: null,
  primaryContact: null,
  contactEmail: null,
  portalUrl: null,
  specialty: null,
  brokerCompensation: null,
  ...over,
});

function renderPage(rows: Record<string, unknown>[] = [lender()]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } },
  });
  client.setQueryData(["/api/wholesale-lenders"], rows);
  return render(
    <QueryClientProvider client={client}>
      <AdminLenders />
    </QueryClientProvider>,
  );
}

describe("AdminLenders — counterparty capacity is the headline", () => {
  it("states the blocked position when nothing is approved (F-5)", () => {
    renderPage();
    const text = screen.getByTestId("alert-approved-count").textContent ?? "";
    expect(text).toMatch(/no approved counterparty/i);
    expect(text).toMatch(/production submissions are blocked/i);
  });

  it("does not count a demo row as capacity, however its columns are set", () => {
    // isApprovedLender() excludes demo rows; the page must agree or it would
    // report revenue capacity the server will refuse to act on.
    renderPage([lender({ isDemo: true, approvalStatus: "approved" })]);
    expect(screen.getByTestId("alert-approved-count").textContent).toMatch(
      /no approved counterparty/i,
    );
  });

  it("nudges toward the three-lender best-execution target", () => {
    renderPage([lender({ approvalStatus: "approved" })]);
    const text = screen.getByTestId("alert-approved-count").textContent ?? "";
    expect(text).toMatch(/1 approved counterparty/i);
    expect(text).toMatch(/below the three-lender target/i);
  });
});

describe("AdminLenders — the row tells the truth about the agreement", () => {
  it("never renders an assumed EPO window as a contracted number", () => {
    renderPage();
    const cell = screen.getByTestId("text-epo-uwm").textContent ?? "";
    expect(cell).toMatch(/not on record/i);
    expect(cell).toMatch(/assumes 180 days/i);
  });

  it("shows a contracted window plainly once recorded", () => {
    renderPage([lender({ approvalStatus: "approved", epoClawbackDays: 365 })]);
    expect(screen.getByTestId("text-epo-uwm").textContent).toMatch(/365 days/);
  });

  it("marks a demo row and refuses to offer approval for it", () => {
    renderPage([lender({ isDemo: true })]);
    expect(screen.getByTestId("badge-demo-uwm").textContent).toMatch(/not a real company/i);
    expect(disabled("button-approval-uwm")).toBe(true);
  });

  it("offers the terms correction only once a lender is approved", () => {
    renderPage();
    expect(disabled("button-terms-uwm")).toBe(true);
  });
});

describe("AdminLenders — approval requires its evidence", () => {
  it("cannot be saved on a reason alone when approving", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-approval-uwm"));

    const dialog = screen.getByTestId("dialog-approval");
    await user.type(within(dialog).getByTestId("input-approval-reason"), "Agreement signed");

    // Default selection is the lender's current status (target), which needs
    // no agreement — so Save is available.
    expect(disabled("button-approval-save")).toBe(false);

    // Switching to "approved" demands the agreement reference and the EPO term.
    await user.click(screen.getByTestId("select-approval-status"));
    await user.click(screen.getByTestId("option-approval-approved"));
    expect(disabled("button-approval-save")).toBe(true);

    await user.type(screen.getByTestId("input-agreement-ref"), "UWM-BA-2026-0142");
    expect(disabled("button-approval-save")).toBe(true); // still no EPO term

    await user.type(screen.getByTestId("input-epo-days"), "180");
    expect(disabled("button-approval-save")).toBe(false);
  });

  it("explains why the EPO term is being asked for", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-approval-uwm"));
    await user.click(screen.getByTestId("select-approval-status"));
    await user.click(screen.getByTestId("option-approval-approved"));

    expect(screen.getByTestId("dialog-approval").textContent).toMatch(
      /largest contingent liability/i,
    );
  });
});

describe("AdminLenders — a new lender cannot be born approved", () => {
  it("says so, and asks only for identity", async () => {
    const user = userEvent.setup();
    renderPage([]);
    await user.click(screen.getByTestId("button-add-lender"));

    const dialog = screen.getByTestId("dialog-create-lender");
    expect(dialog.textContent).toMatch(/starts as a.*target/i);
    // No approval control on the create form: authorization is a separate,
    // audited step, and the server strips the column regardless.
    expect(within(dialog).queryByTestId("select-approval-status")).toBeNull();
  });
});
