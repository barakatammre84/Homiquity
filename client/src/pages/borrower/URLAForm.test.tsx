import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { dashboardKeys, urlaKeys } from "@/lib/queryClient";

// The #451 defect, for the OTHER borrower.
//
// `POST /api/urla/:id/save` is upsert-only and the client drops any row the
// database would reject (`isUrlaRowSaveable` — an asset with no `account_type`
// violates NOT NULL). #451 made that honest: `describeUnsavedRows()` names the
// dropped rows so the toast stops claiming "Everything is safely stored" over
// a row that vanished.
//
// It named `borrowerData[1]` rows only. `buildPayload()` filters slot 2 through
// the SAME predicate whenever `hasCoBorrower` is set, so a co-borrower's
// half-filled asset was: dropped from the payload, reported as a clean save,
// and then erased from the screen by the post-save refetch — no state existed
// in which the borrower could tell. Co-borrower assets and liabilities are
// qualifying data; losing them silently understates the file.
//
// These tests drive the real page: hydrate a co-borrower, switch to their tab,
// type into an asset row without an account type, save. Verified honest by
// reverting the fix — case 1 then fails with the "Application saved /
// Everything is safely stored" toast, which is exactly the bug.

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
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isLoading: false }) }));
vi.mock("@/hooks/useActivityTracker", () => ({
  useTrackActivity: () => vi.fn(),
  useTrackFormStart: () => vi.fn(),
}));
vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

import URLAForm from "./URLAForm";

const APP_ID = "app-1";

const application = {
  id: APP_ID,
  status: "documents_pending",
  propertyAddress: "1 Main St",
  purchasePrice: "400000",
  preferredLoanType: "conventional",
  amortizationType: "fixed",
};

/**
 * Seeds a file that already has a co-borrower, so `hasCoBorrower` latches from
 * hydration rather than from a click. Nothing here is incomplete — the
 * incomplete row is what the test types in, because the server cannot hold one
 * (that is the whole point of the NOT NULL filter).
 */
function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: () => new Promise(() => {}),
      },
      mutations: { retry: false },
    },
  });
  client.setQueryData(dashboardKeys.root(), { applications: [application] });
  client.setQueryData(urlaKeys.detail(APP_ID), {
    application,
    allPersonalInfo: [
      { borrowerSequenceNumber: 1, firstName: "Ada", lastName: "Primary" },
      { borrowerSequenceNumber: 2, firstName: "Cleo", lastName: "Coborrower" },
    ],
    employmentHistory: [],
    assets: [],
    liabilities: [],
    allDeclarations: [],
    hmdaDemographics: [],
    otherIncomeSources: [],
    propertyInfo: {},
  });

  return render(
    <QueryClientProvider client={client}>
      <URLAForm />
    </QueryClientProvider>,
  );
}

/**
 * Walk to the Assets step the way a borrower does — the page's own Continue
 * button. Radix `TabsTrigger` does not activate under `fireEvent.click` in
 * happy-dom, and driving the real control is the more faithful path anyway.
 * Each Continue fires a SILENT save (no toast), which is why the assertions
 * below read the LAST toast/request rather than the first.
 */
async function continueToAssets() {
  for (const _ of ["borrower", "employment"]) {
    fireEvent.click(await screen.findByTestId("button-urla-continue"));
  }
  return screen.findByTestId("input-institution-0");
}

/** The save toast's description, whichever variant fired. */
function lastToastDescription(): string {
  const call = toast.mock.calls.at(-1);
  return String(call?.[0]?.description ?? "");
}

describe("URLAForm — rows the save drops are reported for BOTH borrowers", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ json: async () => ({ ok: true }) });
    toast.mockReset();
    window.sessionStorage.clear();
  });

  it("names the co-borrower's incomplete asset row instead of claiming a clean save", async () => {
    renderPage();

    // Switch to the co-borrower, then to their Assets section.
    fireEvent.click(await screen.findByTestId("button-borrower-co"));

    // A bank with no account type — the exact shape `isUrlaRowSaveable`
    // filters out, because `urla_assets.account_type` is NOT NULL.
    fireEvent.change(await continueToAssets(), {
      target: { value: "Second National" },
    });

    fireEvent.click(screen.getByTestId("button-save-urla-top"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(lastToastDescription()).toContain("co-borrower asset row still needs an account type");
    expect(lastToastDescription()).not.toContain("Everything is safely stored");
  });

  it("still drops the row from the payload — the fix is the telling, not the sending", async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId("button-borrower-co"));
    fireEvent.change(await continueToAssets(), {
      target: { value: "Second National" },
    });
    apiRequest.mockClear(); // drop the two silent step saves
    fireEvent.click(screen.getByTestId("button-save-urla-top"));

    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [, url, payload] = apiRequest.mock.calls[0] as [string, string, Record<string, any>];
    expect(url).toBe(`/api/urla/${APP_ID}/save`);
    expect(payload.coApplicants?.[0]?.assets ?? []).toHaveLength(0);
  });

  it("names whose rows they are once a second borrower exists", async () => {
    renderPage();

    // Primary's own asset row, same incomplete shape.
    fireEvent.change(await continueToAssets(), {
      target: { value: "First National" },
    });
    fireEvent.click(screen.getByTestId("button-save-urla-top"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    // "an asset row" would be ambiguous with two borrowers on the file.
    expect(lastToastDescription()).toContain("your asset row still needs an account type");
  });
});
