import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The admin affordances on this page, pinned.
//
// The server is the enforcement layer: POST /api/task-engine/run-escalation is
// admin-only via an inline check in server/routes/task-engine.ts, and
// canAccessRoleQueue (server/services/taskEngine.ts) lets a non-admin read ONLY
// its own role's queue. The page is admin+underwriter, so offering an underwriter
// the escalation trigger or another role's queue produces a guaranteed 403 — a
// broken affordance, not a breach.
//
// It is still worth a test. #384 moved this whole page into a hook plus four
// components with no coverage at all, and the reasoning for these two branches
// lived only in a comment. A refactor that widens either one fails silently:
// nothing else in the suite would notice, and the 403 only shows up in a
// staff member's face.

const hook = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./taskOperations/useTaskOperations", () => ({
  useTaskOperations: () => hook.state,
}));

const noopMutation = { mutate: vi.fn(), isPending: false };

function renderPage(over: Record<string, unknown>) {
  hook.state = {
    isAdmin: false,
    taskRole: "UW",
    selectedRole: "UW",
    setSelectedRole: vi.fn(),
    metrics: undefined,
    metricsLoading: false,
    slaClasses: [],
    allTasks: [],
    tasksLoading: false,
    myTasks: [],
    escalateDialogOpen: false,
    setEscalateDialogOpen: vi.fn(),
    escalationReason: "",
    setEscalationReason: vi.fn(),
    escalateMutation: noopMutation,
    runEscalationMutation: noopMutation,
    handleEscalate: vi.fn(),
    handleUpdateStatus: vi.fn(),
    handleRefresh: vi.fn(),
    confirmEscalate: vi.fn(),
    ...over,
  };
  return render(<TaskOperations />);
}

// Imported after the mock is registered.
const { default: TaskOperations } = await import("./TaskOperations");

describe("TaskOperations — admin-only affordances", () => {
  it("offers the escalation trigger to an admin", () => {
    renderPage({ isAdmin: true });
    expect(screen.getByTestId("button-run-escalation")).toBeTruthy();
  });

  it("does NOT offer the escalation trigger to a non-admin", () => {
    // The endpoint is admin-only; showing this to an underwriter buys a 403.
    renderPage({ isAdmin: false });
    expect(screen.queryByTestId("button-run-escalation")).toBeNull();
  });

  it("renders the page for a non-admin — the gate hides one control, not the page", () => {
    renderPage({ isAdmin: false });
    expect(screen.getByTestId("text-page-title")).toBeTruthy();
  });
});
