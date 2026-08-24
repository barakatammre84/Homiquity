import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/queryClient";

/**
 * J-0820-08 — the borrower's Loan Estimate page used to answer every failure
 * with one sentence: "Unable to generate the loan estimate for this
 * application." The `error` object was in scope and never read.
 *
 * The case that matters is a 409 the server writes *for the borrower*:
 * COMPENSATION_ELECTION_PENDING, which says the hold-up is a step our team
 * owes them (F-079). The generic string implies the opposite — that the ball
 * is in their court — on the one surface TRID delivery depends on.
 *
 * This is a unit test on purpose. The branch cannot be reached in the headless
 * browser pane: TanStack pauses a retrying query when it believes it is
 * offline, and the pane reports `navigator.onLine === false`, so the query sits
 * at `status: "pending" / fetchStatus: "paused"` forever — `error` never
 * settles, and the page renders the fallback for a reason that has nothing to
 * do with this code. Verified by reading the query cache directly on
 * 2026-08-24. Asserting it here is what makes the fix provable at all.
 */

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-1", role: "active_buyer" }, isLoading: false }),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: () => ({ id: "app-1" }),
    Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  };
});

import LoanEstimate from "./LoanEstimate";

function renderWithError(error: unknown) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // The component supplies its own `retry` predicate, so this only
        // affects anything it does not own.
        retry: false,
        staleTime: Infinity,
        // Reject the way apiRequest does. Going through the real query
        // lifecycle (rather than hand-writing cache state) is what makes this
        // exercise the component's own `error` branch.
        queryFn: () => Promise.reject(error),
      },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <LoanEstimate />
    </QueryClientProvider>,
  );
}

async function errorDetail(): Promise<string> {
  // The component supplies its own `retry: failureCount < 2`, which a
  // provider-level default cannot override, so the query genuinely retries
  // twice with exponential backoff (~1s + ~2s) before `status` becomes
  // "error". Until then it is `pending` and the page shows its skeleton.
  // Waiting the real duration is the honest option — shortening it would mean
  // asserting on a loading state and calling it a pass.
  const el = await waitFor(() => screen.getByTestId("text-le-error-detail"), { timeout: 8000 });
  return el.textContent ?? "";
}

const PENDING_409 = new ApiError(
  409,
  '409: {"error":"Your Loan Estimate is being prepared — a required pricing setup step by our team is still pending.","code":"COMPENSATION_ELECTION_PENDING"}',
);

describe("LoanEstimate — error copy", () => {
  it("shows the server's explanation, not a generic failure", async () => {
    renderWithError(PENDING_409);
    const detail = await errorDetail();
    expect(detail).toContain("required pricing setup step by our team");
    expect(detail).not.toBe("Unable to generate the loan estimate for this application.");
  });

  it("still falls back for a server fault, so internals never leak", async () => {
    // friendlyApiError deliberately swallows 5xx. A borrower must not be shown
    // "Failed query: select ..." because an internal handler threw.
    renderWithError(new ApiError(500, '500: {"error":"relation \\"loan_estimates\\" does not exist"}'));
    const detail = await errorDetail();
    expect(detail).toBe("Unable to generate the loan estimate for this application.");
    expect(detail).not.toContain("relation");
  });
});
