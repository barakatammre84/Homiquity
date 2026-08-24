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

// REACHABILITY — /task/:id is where a borrower finds out WHICH file they sent
// for a task and what the reviewer made of it. Nothing in the app linked to
// it: the whole client held exactly two references to the route, App.tsx's
// declaration and the page's own useRoute. This list is its front door, so
// every bucket that renders a task must offer a way in — including the two
// terminal buckets, which is where the question is actually asked ("you said
// you're reviewing it — reviewing WHAT?").
function detailHrefs(): string[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/task/"]')).map(
    (a) => a.getAttribute("href")!,
  );
}

describe("Tasks — every task can be opened", () => {
  it("links a pending document request to its detail page", () => {
    renderTasks([task({ id: "t-doc", status: "OPEN", taskType: "document_request", documentCategory: "pay_stub" })]);

    expect(detailHrefs()).toContain("/task/t-doc");
  });

  it("links a non-document to-do to its detail page", () => {
    renderTasks([task({ id: "t-todo", status: "OPEN", taskType: "other" })]);

    expect(detailHrefs()).toContain("/task/t-todo");
  });

  it("links a rejected task to its detail page", () => {
    renderTasks([
      task({ id: "t-rej", status: "OPEN", taskType: "document_request", verificationStatus: "rejected" }),
    ]);

    expect(detailHrefs()).toContain("/task/t-rej");
  });

  // The two that matter most: these buckets have no upload dialog, so before
  // this the borrower had no route to the file at all.
  it("links an under-review task to its detail page", () => {
    renderTasks([task({ id: "t-sub", status: "IN_PROGRESS", verificationStatus: "pending" })]);

    expect(screen.getByText("Awaiting review")).toBeTruthy();
    expect(detailHrefs()).toContain("/task/t-sub");
  });

  it("links a completed task to its detail page", () => {
    renderTasks([task({ id: "t-done", status: "COMPLETED" })]);

    expect(detailHrefs()).toContain("/task/t-done");
  });

  // One task in every bucket at once: this is what pins "exactly one door",
  // and it must cover all five, or a duplicate link added to an unexercised
  // bucket walks past the assertion (it did, on the first draft).
  it("offers one door per task, not one per control", () => {
    renderTasks([
      task({ id: "t-rej", status: "OPEN", taskType: "document_request", verificationStatus: "rejected" }),
      task({ id: "t-doc", status: "OPEN", taskType: "document_request" }),
      task({ id: "t-todo", status: "OPEN", taskType: "other" }),
      task({ id: "t-sub", status: "IN_PROGRESS", verificationStatus: "pending" }),
      task({ id: "t-done", status: "COMPLETED" }),
    ]);

    expect(detailHrefs().sort()).toEqual([
      "/task/t-doc",
      "/task/t-done",
      "/task/t-rej",
      "/task/t-sub",
      "/task/t-todo",
    ]);
  });
});
