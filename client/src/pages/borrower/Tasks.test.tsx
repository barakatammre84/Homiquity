import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taskKeys, dashboardKeys } from "@/lib/queryClient";
import type { Task, LoanApplication } from "@shared/schema";

// The borrower's task surface had no test file. These pin the two honesty
// properties the page now owes (DESIGN_SYSTEM §13):
//
//   AGREEMENT — the progress denominator is snapshotted, so an LO assigning a
//   task mid-session cannot make the borrower's percentage run backwards, and
//   the count derives from the same scoped list every bucket below filters.
//
//   SCOPE — the zero state speaks only for THIS application's tasks; it may
//   never claim the borrower is globally caught up.

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u-1" }, isLoading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-upload", () => ({
  useUpload: () => ({ uploadFile: vi.fn(), isUploading: false, progress: 0, cancel: vi.fn() }),
}));

import Tasks from "./Tasks";

afterEach(() => {
  vi.restoreAllMocks();
});

const app = { id: "app-1", status: "processing" } as unknown as LoanApplication;

const task = (overrides: Partial<Task>): Task =>
  ({
    id: "t-1",
    applicationId: "app-1",
    status: "OPEN",
    taskType: "other",
    title: "Confirm your employer",
    verificationStatus: null,
    ...overrides,
  }) as unknown as Task;

function renderTasks(tasks: Task[]) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, queryFn: () => new Promise(() => {}) },
    },
  });
  client.setQueryData(dashboardKeys.root(), { applications: [app] });
  client.setQueryData(taskKeys.all(), tasks);
  const utils = render(
    <QueryClientProvider client={client}>
      <Tasks />
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

describe("Tasks — progress honesty", () => {
  it("says what it measures and counts the scoped list", () => {
    renderTasks([
      task({ id: "t-1", status: "COMPLETED" }),
      task({ id: "t-2", status: "OPEN" }),
      task({ id: "t-3", status: "IN_PROGRESS" }),
    ]);

    expect(screen.getByText("Tasks completed on this application")).toBeTruthy();
    expect(screen.getByTestId("tasks-progress-count").textContent).toBe("1 of 3");
  });

  it("excludes other applications' and EXPIRED tasks from the count", () => {
    renderTasks([
      task({ id: "t-1", status: "COMPLETED" }),
      task({ id: "t-2", status: "OPEN" }),
      task({ id: "t-3", status: "EXPIRED" }),
      task({ id: "t-4", status: "OPEN", applicationId: "app-other" }),
    ]);

    expect(screen.getByTestId("tasks-progress-count").textContent).toBe("1 of 2");
  });

  it("the denominator does not move when a task is assigned mid-session", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, rerender } = renderTasks([
      task({ id: "t-1", status: "COMPLETED" }),
      task({ id: "t-2", status: "OPEN" }),
    ]);
    expect(screen.getByTestId("tasks-progress-count").textContent).toBe("1 of 2");

    // The loan officer adds a task while the borrower is looking at the page.
    client.setQueryData(taskKeys.all(), [
      task({ id: "t-1", status: "COMPLETED" }),
      task({ id: "t-2", status: "OPEN" }),
      task({ id: "t-3", status: "OPEN" }),
    ]);
    rerender(
      <QueryClientProvider client={client}>
        <Tasks />
      </QueryClientProvider>,
    );

    // Before the migration this read "1 of 3" — the same completed work
    // rendering as LESS progress than a moment earlier.
    expect(screen.getByTestId("tasks-progress-count").textContent).toBe("1 of 2");
  });
});

describe("Tasks — empty state scope", () => {
  it("speaks only for this application's tasks", () => {
    renderTasks([]);

    const empty = screen.getByTestId("tasks-empty").textContent!;
    expect(empty).toContain("No tasks on this application yet");
    expect(empty).not.toMatch(/caught up/i);
    expect(empty).toContain("loan officer will assign");
  });
});
