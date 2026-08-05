import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskTable } from "./TaskTable";
import type { TaskWithSlaStatus } from "./model";

// #384 extracted this table out of a 680-line TaskOperations.tsx but landed no
// tests, so the extraction's whole payoff — testable pieces — went uncollected.
// This collects it for the table: row rendering, the owner-role label lookup, and
// the one real behaviour in here, which is that a COMPLETED task offers no
// actions. That last one matters because both action buttons call mutating
// endpoints; re-completing or escalating a finished task is a nonsense request.

const task = (over: Partial<TaskWithSlaStatus> = {}): TaskWithSlaStatus => ({
  id: "t-1",
  applicationId: "app-1",
  title: "Verify income documents",
  taskType: "DOC_VERIFY",
  taskTypeCode: "DV-01",
  ownerRole: "UW",
  status: "OPEN",
  slaStatus: "green",
  timeRemaining: 3600,
  percentageElapsed: 40,
  ...over,
});

function renderTable(tasks: TaskWithSlaStatus[]) {
  const onEscalate = vi.fn();
  const onUpdateStatus = vi.fn();
  render(<TaskTable tasks={tasks} onEscalate={onEscalate} onUpdateStatus={onUpdateStatus} />);
  return { onEscalate, onUpdateStatus };
}

describe("TaskTable", () => {
  it("renders a row per task, keyed by task id", () => {
    renderTable([task(), task({ id: "t-2", title: "Order appraisal" })]);
    expect(screen.getByTestId("row-task-t-1")).toBeTruthy();
    expect(screen.getByTestId("row-task-t-2")).toBeTruthy();
  });

  it("shows the empty state instead of an empty table", () => {
    renderTable([]);
    expect(screen.getByText("No tasks found")).toBeTruthy();
    expect(screen.queryByTestId("row-task-t-1")).toBeNull();
  });

  it("renders the human role label, not the raw code", () => {
    renderTable([task({ ownerRole: "UW" })]);
    expect(screen.getByText("Underwriter")).toBeTruthy();
    expect(screen.queryByText("UW")).toBeNull();
  });

  it("falls back to the raw role when it has no label", () => {
    renderTable([task({ ownerRole: "NEW_ROLE" })]);
    expect(screen.getByText("NEW_ROLE")).toBeTruthy();
  });

  it("offers complete and escalate on an open task", () => {
    renderTable([task({ status: "OPEN" })]);
    expect(screen.getByTestId("button-complete-t-1")).toBeTruthy();
    expect(screen.getByTestId("button-escalate-t-1")).toBeTruthy();
  });

  it("offers NEITHER action on a completed task", () => {
    // Both buttons hit mutating endpoints. A finished task must not be
    // re-completable or escalatable from the table.
    renderTable([task({ status: "COMPLETED" })]);
    expect(screen.queryByTestId("button-complete-t-1")).toBeNull();
    expect(screen.queryByTestId("button-escalate-t-1")).toBeNull();
  });

  it("passes the task id and COMPLETED to onUpdateStatus", async () => {
    const { onUpdateStatus } = renderTable([task()]);
    await userEvent.click(screen.getByTestId("button-complete-t-1"));
    expect(onUpdateStatus).toHaveBeenCalledWith("t-1", "COMPLETED");
  });

  it("passes the task id to onEscalate", async () => {
    const { onEscalate } = renderTable([task()]);
    await userEvent.click(screen.getByTestId("button-escalate-t-1"));
    expect(onEscalate).toHaveBeenCalledWith("t-1");
  });

  it("renders the SLA badge for the task's status", () => {
    renderTable([task({ slaStatus: "red" })]);
    expect(screen.getByTestId("badge-sla-red")).toBeTruthy();
  });

  it("shows an escalation level only once escalated", () => {
    renderTable([task({ escalationLevel: 2 })]);
    expect(screen.getByText("Level 2")).toBeTruthy();
  });

  it("does not show a level for an unescalated task", () => {
    renderTable([task({ escalationLevel: 0 })]);
    expect(screen.queryByText(/^Level /)).toBeNull();
  });
});
