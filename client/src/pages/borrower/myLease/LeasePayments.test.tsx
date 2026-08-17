import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RentPaymentView } from "@shared/leaseView";

// The rent payment history surface.
//
// The server pins every row this can create to `self_reported`, so the thing worth
// testing here is that the UI says so honestly, and that a "missed" month posts no
// paid-date/amount — the API distinguishes an absent key from an empty one.

const apiRequest = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
    queryClient: { invalidateQueries: vi.fn() },
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import { LeasePayments } from "./LeasePayments";

let payments: RentPaymentView[];

const payment = (over: Partial<RentPaymentView> = {}): RentPaymentView => ({
  id: "pay-1",
  leaseId: "lease-1",
  dueDate: "2026-07-01",
  paidDate: "2026-07-01",
  amountDue: "1450.00",
  amountPaid: "1450.00",
  status: "paid",
  provenance: "self_reported",
  furnishable: false,
  ...over,
});

function renderPayments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["/api/leases", "lease-1", "payments"], { payments });
  return render(
    <QueryClientProvider client={client}>
      <LeasePayments leaseId="lease-1" monthlyRent="1450.00" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  toast.mockReset();
  apiRequest.mockResolvedValue({ json: async () => ({ payment: payment() }) });
  payments = [];
});

describe("LeasePayments — history", () => {
  it("shows an empty state before any month is recorded", () => {
    renderPayments();
    expect(screen.getByTestId("text-payments-empty-lease-1")).toBeTruthy();
  });

  it("renders recorded months with their outcome", () => {
    payments = [payment(), payment({ id: "pay-2", dueDate: "2026-08-01", status: "missed", paidDate: null, amountPaid: null })];
    renderPayments();
    expect(screen.getByTestId("payment-pay-1").textContent).toMatch(/2026-07-01/);
    expect(screen.getByTestId("payment-pay-1").textContent).toMatch(/Paid/);
    expect(screen.getByTestId("payment-pay-2").textContent).toMatch(/Missed/);
  });

  it("says plainly that self-reported months have not been reported", () => {
    payments = [payment()];
    renderPayments();
    const note = screen.getByTestId("text-payments-not-reported-lease-1").textContent ?? "";
    expect(note).toMatch(/recorded these yourself/i);
    expect(note).toMatch(/none of them have been reported/i);
  });

  it("changes the wording only if the server says a row is furnishable", () => {
    // `furnishable` is computed server-side from the furnishing gate's own constant, so
    // this copy tracks the gate rather than restating it.
    payments = [payment({ furnishable: true })];
    renderPayments();
    expect(screen.getByTestId("text-payments-not-reported-lease-1").textContent).toMatch(
      /eligible to be reported/i,
    );
  });
});

describe("LeasePayments — recording", () => {
  async function openForm() {
    renderPayments();
    fireEvent.click(screen.getByTestId("button-add-payment-lease-1"));
    await waitFor(() => expect(screen.getByTestId("form-payment-lease-1")).toBeTruthy());
  }

  it("posts a paid month with its date and amount", async () => {
    await openForm();
    fireEvent.change(screen.getByTestId("input-payment-due-lease-1"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByTestId("input-payment-paid-lease-1"), { target: { value: "2026-07-01" } });
    fireEvent.submit(screen.getByTestId("form-payment-lease-1"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    const [method, url, body] = apiRequest.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/leases/lease-1/payments");
    expect(body).toEqual({
      dueDate: "2026-07-01",
      amountDue: "1450.00",
      status: "paid",
      paidDate: "2026-07-01",
      amountPaid: "1450.00",
    });
  });

  it("posts a missed month with NO paid date or amount", async () => {
    // Absent, not "". The API treats key presence as intent, and a missed period has
    // no payment to describe.
    await openForm();
    fireEvent.change(screen.getByTestId("input-payment-due-lease-1"), { target: { value: "2026-07-01" } });
    fireEvent.click(screen.getByTestId("option-payment-status-missed-lease-1"));
    fireEvent.submit(screen.getByTestId("form-payment-lease-1"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    const body = apiRequest.mock.calls[0][2];
    expect(body).toEqual({ dueDate: "2026-07-01", amountDue: "1450.00", status: "missed" });
    expect("paidDate" in body).toBe(false);
    expect("amountPaid" in body).toBe(false);
  });

  it("hides the paid fields once the month is marked missed", async () => {
    await openForm();
    expect(screen.queryByTestId("input-payment-paid-lease-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("option-payment-status-missed-lease-1"));
    await waitFor(() => expect(screen.queryByTestId("input-payment-paid-lease-1")).toBeNull());
  });

  it("does not post a late month that was actually paid on time", async () => {
    await openForm();
    fireEvent.change(screen.getByTestId("input-payment-due-lease-1"), { target: { value: "2026-07-01" } });
    fireEvent.click(screen.getByTestId("option-payment-status-late-lease-1"));
    fireEvent.change(screen.getByTestId("input-payment-paid-lease-1"), { target: { value: "2026-06-28" } });
    fireEvent.submit(screen.getByTestId("form-payment-lease-1"));

    await new Promise((r) => setTimeout(r, 0));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("does not post without a due date", async () => {
    await openForm();
    fireEvent.submit(screen.getByTestId("form-payment-lease-1"));
    await new Promise((r) => setTimeout(r, 0));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("explains a duplicate period rather than showing a generic failure", async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error("409: dup"), { status: 409 }));
    await openForm();
    fireEvent.change(screen.getByTestId("input-payment-due-lease-1"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByTestId("input-payment-paid-lease-1"), { target: { value: "2026-07-01" } });
    fireEvent.submit(screen.getByTestId("form-payment-lease-1"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(toast.mock.calls[0][0].title).toMatch(/already recorded/i);
  });
});
