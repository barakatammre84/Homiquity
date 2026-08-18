import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The #451 pattern, found by sweeping for it outside URLAForm.
//
// `PATCH /api/loan-applications/:id` validates with
// `loanApplicationIntakeUpdateSchema`, which requires non-empty for every
// field it receives — an empty string is a 400. So the profile editor skips
// blanks before sending. It skipped them in SILENCE:
//
//   * clear a field alongside another edit → the PATCH succeeds, the toast
//     says "Your self-reported details were saved", the invalidation refetches
//     and puts the old value straight back on screen;
//   * clear a field on its own → the payload is empty, the mutation returns
//     early, the editor closes with NO message at all.
//
// Either way the borrower's edit is gone and nothing said so. These tests pin
// the telling. Verified honest by reverting the fix: cases 1 and 2 then fail,
// case 1 receiving the old "Your self-reported details were saved to your
// draft application." success copy.

const apiRequest = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

import Profile from "./Profile";

/** A draft application with two figures on file, both clearable text inputs. */
function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) },
      mutations: { retry: false },
    },
  });
  client.setQueryData(["/api/profile/financial"], {
    user: { firstName: "Ada", lastName: "Borrower", email: "ada@example.com", role: "client" },
    application: {
      id: "app-1",
      status: "draft",
      editable: true,
      financialDataProvenance: "self_reported",
      incomeVerified: false,
      assetsVerified: false,
      creditVerified: false,
      updatedAt: null,
      fields: { annualIncome: "85000", monthlyDebts: "450" },
    },
    readiness: null,
    coachCapture: null,
  });

  const view = render(
    <QueryClientProvider client={client}>
      <Profile />
    </QueryClientProvider>,
  );
  return view;
}

function lastToast() {
  return (toast.mock.calls.at(-1)?.[0] ?? {}) as { title?: string; description?: string };
}

async function startEditing(container: HTMLElement) {
  fireEvent.click(await screen.findByTestId("button-edit-profile"));
  return (key: string) => container.querySelector<HTMLInputElement>(`#edit-${key}`)!;
}

describe("Profile — a field the borrower empties cannot be sent, and now says so", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ json: async () => ({ id: "app-1" }) });
    toast.mockReset();
  });

  it("names the field it could not clear even when the rest of the edit saved", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("monthlyDebts"), { target: { value: "" } });   // cleared
    fireEvent.change(input("annualIncome"), { target: { value: "90000" } }); // real edit
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(lastToast().title).toBe("Saved — but some fields can't be left blank");
    expect(lastToast().description).toContain("Monthly debts");
    // The old lie.
    expect(lastToast().description).not.toContain("Your self-reported details were saved");

    // The real edit still went, unchanged — the fix is the telling, not the sending.
    const [, , payload] = apiRequest.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload).toEqual({ annualIncome: "90000" });
  });

  it("speaks up when clearing was the ONLY change — previously a silent close", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("monthlyDebts"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(lastToast().title).toBe("We couldn't clear those fields");
    expect(apiRequest).not.toHaveBeenCalled(); // nothing sendable, so nothing sent
  });

  it("keeps the editor open so the borrower can fix the field being complained about", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("monthlyDebts"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    // Closing would discard the very edit they are being asked to correct.
    expect(screen.getByTestId("button-save-profile")).toBeTruthy();
    expect(container.querySelector("#edit-monthlyDebts")).toBeTruthy();
  });

  it("still reports a clean save when nothing was cleared", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("annualIncome"), { target: { value: "90000" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(lastToast().title).toBe("Profile updated");
    expect(screen.queryByTestId("button-save-profile")).toBeNull(); // editor closed
  });

  it("says nothing about a field that was already blank", async () => {
    // Blanking an already-blank field is imperceptible; reporting it is noise.
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("employerName"), { target: { value: "" } }); // was never set
    fireEvent.change(input("annualIncome"), { target: { value: "90000" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(lastToast().title).toBe("Profile updated");
  });
});
