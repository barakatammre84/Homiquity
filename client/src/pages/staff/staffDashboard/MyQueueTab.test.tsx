import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MyQueueTab } from "./MyQueueTab";
import { type QueueTask } from "./model";

const qt = (over: Partial<QueueTask>): QueueTask =>
  ({
    id: "q-1",
    title: "Collect bank statements",
    taskType: "document_request",
    applicationId: "app-1",
    status: "OPEN",
    slaStatus: "green",
    slaClass: "STANDARD",
    timeRemaining: 3600,
    escalationLevel: 0,
    triggerSource: "MANUAL",
    ...over,
  }) as unknown as QueueTask;

function renderTab(over?: Partial<Parameters<typeof MyQueueTab>[0]>) {
  return render(
    <TooltipProvider>
      <MyQueueTab
        sortedQueueTasks={[]}
        queueLoading={false}
        queueBreached={0}
        automatedTasks={[]}
        {...over}
      />
    </TooltipProvider>,
  );
}

describe("MyQueueTab", () => {
  it("shows the clear-queue empty state", () => {
    renderTab();
    expect(screen.getByText("Queue is clear")).toBeTruthy();
  });

  it("renders queue rows with SLA status and escalation badges", () => {
    renderTab({
      sortedQueueTasks: [qt({ id: "q-2", slaStatus: "red", escalationLevel: 2 })],
      queueBreached: 1,
    });
    expect(screen.getByTestId("queue-task-q-2")).toBeTruthy();
    expect(screen.getByTestId("badge-escalation-q-2").textContent).toBe("L2");
    expect(screen.getByTestId("badge-breached-alert").textContent).toContain("1 SLA breached");
  });
});
