import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The #451 pattern, found by sweeping for it outside URLAForm — and then
// removed at the root rather than apologised for.
//
// `PATCH /api/loan-applications/:id` validates with
// `loanApplicationIntakeUpdateSchema`, which used to have only two wire states:
// absent ("leave this alone") and present (must be non-empty). "Set this back
// to blank" had nothing to travel as, so the editor dropped such edits before
// sending — in SILENCE:
//
//   * clear a field alongside another edit → the PATCH succeeds, the toast says
//     "Your self-reported details were saved", the invalidation refetches and
//     puts the old value straight back on screen;
//   * clear a field on its own → the payload is empty, the mutation returns
//     early, the editor closes with NO message at all.
//
// The schema now has a third state: `null` means clear
// (CLEARABLE_INTAKE_FIELDS, shared/preApprovalForm.ts). So a clear is a real
// save, and these tests pin the translation — an empty INPUT becomes a null on
// the WIRE, while an empty string stays rejected so an accidental blank can
// never be destructive.
//
// The "we couldn't clear that" path is kept as a last resort for a field that
// is emptyable here but not catalogued. The final test is what keeps that
// branch unreachable in practice, and it is the one that will fail the day
// someone adds an emptyable field without a wire clear.

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

import Profile, { PROFILE_FIELDS } from "./Profile";
import { isClearableIntakeField } from "@shared/preApprovalForm";

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

describe("Profile — a field the borrower empties now travels as a clear", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ json: async () => ({ id: "app-1" }) });
    toast.mockReset();
  });

  it("sends an emptied field as null — the wire's clear — alongside a real edit", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("monthlyDebts"), { target: { value: "" } });      // cleared
    fireEvent.change(input("annualIncome"), { target: { value: "90000" } }); // real edit
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [, , payload] = apiRequest.mock.calls[0] as [string, string, Record<string, unknown>];
    // null, not "" — an empty string is still a 400, deliberately, so that an
    // input blanking itself can never erase a borrower's answer.
    expect(payload).toEqual({ monthlyDebts: null, annualIncome: "90000" });
    expect(lastToast().title).toBe("Profile updated");
  });

  it("sends the clear when it is the ONLY change — previously a silent no-op", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("monthlyDebts"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [, , payload] = apiRequest.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload).toEqual({ monthlyDebts: null });
    expect(lastToast().title).toBe("Profile updated");
  });

  it("closes the editor once the clear has actually been saved", async () => {
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("monthlyDebts"), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    // It stayed open while the edit could not be sent. Now it can be, so this
    // is an ordinary successful save.
    await waitFor(() => expect(screen.queryByTestId("button-save-profile")).toBeNull());
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

  it("sends nothing for a field that was already blank", async () => {
    // Blanking an already-blank field is imperceptible: no clear to send, and
    // no complaint to make. Sending null would be a pointless write.
    const { container } = renderPage();
    const input = await startEditing(container);

    fireEvent.change(input("employerName"), { target: { value: "" } }); // was never set
    fireEvent.change(input("annualIncome"), { target: { value: "90000" } });
    fireEvent.click(screen.getByTestId("button-save-profile"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [, , payload] = apiRequest.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(payload).toEqual({ annualIncome: "90000" });
    expect(lastToast().title).toBe("Profile updated");
  });

  it("INVARIANT: every field this editor can empty has a wire clear", () => {
    // The one that matters long-term. Text/money/years fields are free-text
    // inputs a borrower can blank; selects and switches cannot be emptied. If
    // an emptyable field is ever added without being catalogued, the editor
    // falls back to "we couldn't clear those fields" — honest, but worse than
    // just working — and this test says so at the point the field is added
    // rather than the day a borrower hits it.
    const emptyable = PROFILE_FIELDS.filter(
      (f) => f.kind === "text" || f.kind === "money" || f.kind === "years",
    );
    expect(emptyable.length).toBeGreaterThan(0);
    for (const field of emptyable) {
      expect(
        isClearableIntakeField(field.key),
        `${String(field.key)} can be emptied in the profile editor but is not in CLEARABLE_INTAKE_FIELDS`,
      ).toBe(true);
    }
  });
});
