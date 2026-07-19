import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineTab } from "./TimelineTab";
import { type ActivityItem } from "./model";

describe("TimelineTab", () => {
  it("shows the empty state when there is no activity", () => {
    render(<TimelineTab activities={[]} />);
    expect(screen.getByText("No activity recorded yet.")).toBeTruthy();
  });

  it("renders activity entries with title and description", () => {
    const activities = [
      { id: "a-1", activityType: "status_change", title: "Status changed", description: "draft → submitted", createdAt: new Date().toISOString() },
      { id: "a-2", activityType: "document_uploaded", title: "Document uploaded", description: "W-2 received", createdAt: new Date().toISOString() },
    ] as unknown as ActivityItem[];
    render(<TimelineTab activities={activities} />);
    expect(screen.getByText("Status changed").textContent).toBeTruthy();
    expect(screen.getByText("W-2 received")).toBeTruthy();
  });
});
