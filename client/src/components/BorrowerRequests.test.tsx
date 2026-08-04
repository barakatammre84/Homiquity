import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BorrowerRequests } from "./BorrowerRequests";

// Borrower Clarity PR 4: the dashboard card now renders visible staff tasks
// as read-only "In progress on our side" rows using the mapping's
// borrowerDisplayText, in addition to the BORROWER-owned actionables it always
// showed. Transparency rows must never grow an action affordance.

interface FixtureTask {
  id: string;
  applicationId: string;
  title: string;
  taskType: string;
  taskTypeCode?: string;
  ownerRole?: string;
  status: string;
  slaStatus: "green" | "amber" | "red";
  timeRemaining: number | null;
  percentageElapsed: number | null;
  borrowerDisplayText?: string;
}

let tasks: FixtureTask[];

const actionable: FixtureTask = {
  id: "t-act",
  applicationId: "app-1",
  title: "Upload Tax Returns",
  taskType: "document_request",
  taskTypeCode: "DOC_TAX_RETURN_REQUEST",
  ownerRole: "BORROWER",
  status: "OPEN",
  slaStatus: "green",
  timeRemaining: 2880,
  percentageElapsed: 10,
};

const transparency: FixtureTask = {
  id: "t-close",
  applicationId: "app-1",
  title: "We're preparing your closing paperwork.",
  taskType: "action",
  taskTypeCode: "CMP_CLOSING_DISC",
  ownerRole: "CLOSER",
  status: "OPEN",
  slaStatus: "green",
  timeRemaining: null,
  percentageElapsed: null,
  borrowerDisplayText: "We're preparing your closing paperwork.",
};

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: async () => tasks } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BorrowerRequests applicationId="app-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  tasks = [actionable, transparency];
});

describe("BorrowerRequests — transparency rows", () => {
  it("renders visible staff tasks read-only under 'In progress on our side'", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("section-in-progress")).toBeTruthy();
    });
    const row = screen.getByTestId("row-transparency-t-close");
    expect(row.textContent).toContain("We're preparing your closing paperwork.");
    // Read-only: no button/link affordance inside a transparency row.
    expect(row.querySelector("button")).toBeNull();
    expect(row.querySelector("a")).toBeNull();
  });

  it("keeps BORROWER-owned actionables with their Upload affordance", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("row-request-t-act")).toBeTruthy();
    });
    expect(screen.getByTestId("button-upload-t-act")).toBeTruthy();
    // The actionable count badge counts actionables only, not transparency rows.
    expect(screen.queryByTestId("row-transparency-t-act")).toBeNull();
  });

  it("shows the in-progress section even when nothing is actionable", async () => {
    tasks = [transparency];
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("section-in-progress")).toBeTruthy();
    });
    expect(screen.queryByTestId("row-request-t-act")).toBeNull();
  });

  it("still shows the all-caught-up state when there are no tasks at all", async () => {
    tasks = [];
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId("text-tasks-caught-up")).toBeTruthy();
    });
    expect(screen.queryByTestId("section-in-progress")).toBeNull();
  });
});
