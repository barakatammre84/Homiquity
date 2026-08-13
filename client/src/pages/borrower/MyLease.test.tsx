import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LeaseView } from "@shared/leaseView";

// The lease capture surface, rendered.
//
// tests/leaseCapture.test.ts covers the server side (encryption round-trip, UTC dates,
// validation). This covers what the borrower actually sees and sends — in particular
// that the page never implies rent is being reported, and that an empty optional field
// is omitted from the payload rather than sent as "".

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

import MyLease from "./MyLease";

let leases: LeaseView[];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["/api/leases"], { leases });
  return render(
    <QueryClientProvider client={client}>
      <MyLease />
    </QueryClientProvider>,
  );
}

const lease = (over: Partial<LeaseView> = {}): LeaseView => ({
  id: "lease-1",
  landlordName: "Acme Property Group",
  landlordEmail: "leasing@acme.com",
  propertyAddress: "123 Main St, Chicago, IL",
  monthlyRentAmount: "1450.00",
  leaseStartDate: "2026-06-30",
  leaseEndDate: "2027-06-29",
  status: "active",
  verificationStatus: "unverified",
  furnishingEnrolled: false,
  ...over,
});

beforeEach(() => {
  apiRequest.mockReset();
  toast.mockReset();
  apiRequest.mockResolvedValue({ json: async () => ({ lease: lease() }) });
  leases = [];
});

describe("MyLease — what the borrower sees", () => {
  it("states that saving a lease reports nothing to the bureaus", () => {
    renderPage();
    const alert = screen.getByTestId("alert-lease-not-reported");
    expect(alert.textContent).toMatch(/does not report anything to the credit bureaus/i);
    expect(alert.textContent).toMatch(/not an approved furnisher yet/i);
  });

  it("offers no enrolment control — there is nothing to enrol in yet", () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/start reporting|enroll|enrol\b/i);
    expect(container.querySelector('[role="switch"]')).toBeNull();
  });

  it("shows an empty state before any lease exists", () => {
    renderPage();
    expect(screen.getByTestId("text-lease-empty")).toBeTruthy();
  });

  it("renders a saved lease and labels it as not being reported", () => {
    leases = [lease()];
    renderPage();
    expect(screen.getByTestId("card-lease-lease-1").textContent).toMatch(/1450\.00/);
    expect(screen.getByTestId("text-lease-furnishing-lease-1").textContent).toMatch(
      /not being reported/i,
    );
  });

  it("renders lease dates as calendar days, not instants", () => {
    leases = [lease()];
    renderPage();
    const card = screen.getByTestId("card-lease-lease-1").textContent ?? "";
    expect(card).toContain("2026-06-30");
    expect(card).not.toMatch(/T00:00|Z\b|GMT/);
  });
});

describe("MyLease — submission", () => {
  it("posts only the fields the borrower filled in", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("button-add-lease"));
    fireEvent.change(screen.getByTestId("input-lease-rent"), { target: { value: "1450" } });
    fireEvent.submit(screen.getByTestId("form-lease"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    const [method, url, payload] = apiRequest.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/leases");
    // Empty optionals are dropped, not sent as "" — the server treats key presence as
    // intent, so a stray "" would read as "clear this field".
    expect(payload).toEqual({ monthlyRentAmount: "1450" });
  });

  it("includes the optional fields once they are filled", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("button-add-lease"));
    fireEvent.change(screen.getByTestId("input-lease-rent"), { target: { value: "1450" } });
    fireEvent.change(screen.getByTestId("input-lease-landlord-email"), {
      target: { value: "leasing@acme.com" },
    });
    fireEvent.change(screen.getByTestId("input-lease-start"), { target: { value: "2026-06-30" } });
    fireEvent.submit(screen.getByTestId("form-lease"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1));
    expect(apiRequest.mock.calls[0][2]).toEqual({
      monthlyRentAmount: "1450",
      landlordEmail: "leasing@acme.com",
      leaseStartDate: "2026-06-30",
    });
  });

  it("does not post when the amount is missing", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("button-add-lease"));
    fireEvent.submit(screen.getByTestId("form-lease"));

    await waitFor(() => expect(screen.getByTestId("form-lease")).toBeTruthy());
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("does not post an end date that precedes the start date", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("button-add-lease"));
    fireEvent.change(screen.getByTestId("input-lease-rent"), { target: { value: "1450" } });
    fireEvent.change(screen.getByTestId("input-lease-start"), { target: { value: "2026-06-30" } });
    fireEvent.change(screen.getByTestId("input-lease-end"), { target: { value: "2026-06-29" } });
    fireEvent.submit(screen.getByTestId("form-lease"));

    await waitFor(() => expect(screen.getByTestId("form-lease")).toBeTruthy());
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
