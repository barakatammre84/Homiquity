import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReviewTab } from "./ReviewTab";
import type { Task, LoanApplication } from "@shared/schema";

// Characterization for the extracted Review tab: awaiting-review rows expose
// Verify/Reject, "Add Task" hands the application id back to the parent (which
// preselects it in CreateTaskDialog), and the headings stay role-honest
// (admin sees "All Applications", everyone else "Team Applications").

const task = (over: Partial<Task>): Task =>
  ({ id: "t-1", title: "Upload 2025 W-2", assignedToUserId: "u-1", applicationId: "app-1", ...over }) as unknown as Task;
const app = (over: Partial<LoanApplication>): LoanApplication =>
  ({ id: "app-1", userId: "u-1", status: "doc_collection", propertyState: "IL", purchasePrice: "400000", ...over }) as unknown as LoanApplication;

function renderTab(over?: Partial<Parameters<typeof ReviewTab>[0]>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewTab
        submittedTasks={[]}
        applications={[]}
        tasks={[]}
        isAdmin={false}
        getUserName={() => "Active Buyer"}
        onAddTask={vi.fn()}
        {...over}
      />
    </QueryClientProvider>,
  );
}

describe("ReviewTab", () => {
  it("shows Verify and Reject for each task awaiting review", () => {
    renderTab({ submittedTasks: [task({ id: "t-9" })] });
    expect(screen.getByTestId("button-verify-t-9")).toBeTruthy();
    expect(screen.getByTestId("button-reject-t-9")).toBeTruthy();
  });

  it("empty review state explains where submissions land", () => {
    renderTab();
    expect(screen.getByText("Nothing awaiting review")).toBeTruthy();
  });

  it("Add Task hands the application id to the parent", async () => {
    const user = userEvent.setup();
    const onAddTask = vi.fn();
    renderTab({ applications: [app({ id: "app-7" })], onAddTask });
    await user.click(screen.getByTestId("button-add-task-app-7"));
    expect(onAddTask).toHaveBeenCalledWith("app-7");
  });

  it("headings stay role-honest: admin sees all, staff sees team", () => {
    const { unmount } = renderTab({ isAdmin: true });
    expect(screen.getByText("All Applications")).toBeTruthy();
    unmount();
    renderTab({ isAdmin: false });
    expect(screen.getByText("Team Applications")).toBeTruthy();
  });
});
