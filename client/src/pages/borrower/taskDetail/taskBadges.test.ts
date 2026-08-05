import { describe, it, expect } from "vitest";
import { priorityBadgeSpec, statusBadgeSpec } from "./taskBadges";
import type { Task, TaskPriority } from "@shared/schema";

const t = (status: Task["status"], verificationStatus: Task["verificationStatus"] = null) =>
  ({ status, verificationStatus }) as Pick<Task, "status" | "verificationStatus">;

describe("statusBadgeSpec", () => {
  it("labels each lifecycle status", () => {
    expect(statusBadgeSpec(t("OPEN")).label).toBe("Pending");
    expect(statusBadgeSpec(t("IN_PROGRESS")).label).toBe("In Progress");
    expect(statusBadgeSpec(t("BLOCKED")).label).toBe("Blocked");
    expect(statusBadgeSpec(t("COMPLETED")).label).toBe("Completed");
    expect(statusBadgeSpec(t("EXPIRED")).label).toBe("Expired");
  });

  it("lets a rejection outrank the lifecycle label", () => {
    // The server reopens a rejected task to OPEN. Without this precedence the
    // borrower would see a bland "Pending" and lose the fact that their
    // document was sent back — the one thing they need to act on.
    expect(statusBadgeSpec(t("OPEN", "rejected"))).toEqual({ variant: "destructive", label: "Rejected" });
    expect(statusBadgeSpec(t("IN_PROGRESS", "rejected")).label).toBe("Rejected");
    expect(statusBadgeSpec(t("BLOCKED", "rejected")).label).toBe("Rejected");
  });

  it("does not let a stale rejection override a completed task", () => {
    expect(statusBadgeSpec(t("COMPLETED", "rejected")).label).toBe("Completed");
  });

  it("distinguishes awaiting-review from generic in-progress", () => {
    expect(statusBadgeSpec(t("IN_PROGRESS", "pending")).label).toBe("Submitted - Awaiting Review");
    expect(statusBadgeSpec(t("IN_PROGRESS", "verified")).label).toBe("In Progress");
    expect(statusBadgeSpec(t("IN_PROGRESS")).label).toBe("In Progress");
  });

  it("only the rejected badge is destructive", () => {
    const statuses: Task["status"][] = ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "EXPIRED"];
    for (const s of statuses) {
      expect(statusBadgeSpec(t(s)).variant, s).not.toBe("destructive");
    }
    expect(statusBadgeSpec(t("OPEN", "rejected")).variant).toBe("destructive");
  });

  it("shows an unmapped status raw rather than rendering blank", () => {
    expect(statusBadgeSpec(t("SOMETHING_NEW" as Task["status"]))).toEqual({
      variant: "secondary",
      label: "SOMETHING_NEW",
    });
  });
});

describe("priorityBadgeSpec", () => {
  it("labels every priority", () => {
    const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];
    expect(priorities.map(p => priorityBadgeSpec(p).label)).toEqual([
      "Low Priority", "Normal Priority", "High Priority", "Urgent",
    ]);
  });

  it("falls back to normal for a legacy or unknown value", () => {
    // Rows written before migration 0034 can carry a priority outside the
    // current vocabulary; a missing badge would read as no priority at all.
    expect(priorityBadgeSpec("critical" as TaskPriority)).toEqual(priorityBadgeSpec("normal"));
    expect(priorityBadgeSpec(undefined as unknown as TaskPriority)).toEqual(priorityBadgeSpec("normal"));
  });

  it("gives every priority a distinct style", () => {
    const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];
    const classes = priorities.map(p => priorityBadgeSpec(p).className);
    expect(new Set(classes).size).toBe(4);
  });
});
