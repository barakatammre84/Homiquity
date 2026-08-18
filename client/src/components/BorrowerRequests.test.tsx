import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taskEngineKeys } from "@/lib/queryClient";

// The dashboard's "what we need from you" card. These pin the agreement the
// card broke (DESIGN_SYSTEM §13): it selected `status === "OPEN"` only, so a
// BLOCKED task — and a task whose document came back REJECTED — was invisible
// here while /tasks listed it, the second under "Needs Your Attention". The
// borrower was told nothing was needed at the moment something was wrong.

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return { ...actual, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> };
});

import { BorrowerRequests } from "./BorrowerRequests";

const task = (over: Record<string, unknown>) => ({
  id: "t-1",
  applicationId: "app-1",
  title: "Upload your April pay stub",
  taskType: "document_request",
  taskTypeCode: "DOC_PAYSTUB_REQUEST",
  ownerRole: "BORROWER",
  status: "OPEN",
  slaStatus: "green",
  timeRemaining: null,
  percentageElapsed: null,
  ...over,
});

function renderCard(tasks: Array<Record<string, unknown>>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) },
    },
  });
  client.setQueryData(taskEngineKeys.borrowerTasks("app-1"), tasks);
  return render(
    <QueryClientProvider client={client}>
      <BorrowerRequests applicationId="app-1" />
    </QueryClientProvider>,
  );
}

const emptyText = () => screen.queryByTestId("text-tasks-caught-up")?.textContent ?? null;

describe("BorrowerRequests — outstanding work matches /tasks", () => {
  it("surfaces a REJECTED task instead of claiming nothing is needed", () => {
    renderCard([task({ status: "IN_PROGRESS", verificationStatus: "rejected" })]);

    // Before the fix this rendered the empty state.
    expect(emptyText()).toBeNull();
    expect(screen.getByTestId("row-request-t-1")).toBeTruthy();
  });

  it("surfaces a BLOCKED task", () => {
    renderCard([task({ status: "BLOCKED" })]);

    expect(emptyText()).toBeNull();
    expect(screen.getByTestId("row-request-t-1")).toBeTruthy();
  });

  it("still ignores completed, expired, and submitted-awaiting-review work", () => {
    renderCard([
      task({ id: "a", status: "COMPLETED" }),
      task({ id: "b", status: "EXPIRED" }),
      task({ id: "c", status: "IN_PROGRESS" }),
    ]);

    expect(emptyText()).toBe("Nothing to do on this loan");
  });

  it("does not treat staff-owned transparency rows as the borrower's work", () => {
    renderCard([task({ id: "s", ownerRole: "UW", status: "OPEN" })]);

    // It appears as transparency, not as an action, and does not count.
    expect(screen.getByTestId("section-in-progress")).toBeTruthy();
    expect(screen.queryByTestId("row-request-s")).toBeNull();
  });
});

describe("BorrowerRequests — the empty state speaks only for this loan", () => {
  it("does not make an account-wide 'all caught up' claim", () => {
    renderCard([]);

    const text = emptyText()!;
    expect(text).toBe("Nothing to do on this loan");
    expect(text).not.toMatch(/caught up/i);
  });
});
