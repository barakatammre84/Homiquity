import { describe, it, expect } from "vitest";
import {
  formatIssueType,
  formatStatusLabel,
  getStatusClassName,
  getStatusVariant,
  getUrgencyClassName,
  getUrgencyVariant,
  slaRemaining,
  sortEscalations,
  summariseEscalations,
  type DealRescueEscalation,
} from "./escalations";

const esc = (over: Partial<DealRescueEscalation> = {}): DealRescueEscalation => ({
  id: "e1",
  applicationId: null,
  reportedByUserId: "u1",
  assignedToUserId: null,
  urgency: "medium",
  issueType: "other",
  subject: "Something is wrong",
  description: "Details",
  borrowerName: null,
  propertyAddress: null,
  closingDate: null,
  status: "open",
  resolution: null,
  resolvedAt: null,
  slaDeadline: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const HOUR = 60 * 60 * 1000;

describe("badge vocabulary", () => {
  it("maps every urgency and status without falling through to a blank badge", () => {
    for (const urgency of ["critical", "high", "medium", "low"]) {
      expect(getUrgencyVariant(urgency), urgency).toBeTruthy();
    }
    for (const status of ["open", "in_progress", "resolved"]) {
      expect(getStatusVariant(status), status).toBeTruthy();
      expect(getStatusClassName(status), status).not.toBe("");
    }
  });

  it("degrades an unknown urgency or status to a neutral badge rather than crashing", () => {
    expect(getUrgencyVariant("apocalyptic")).toBe("secondary");
    expect(getUrgencyClassName("apocalyptic")).toBe("");
    expect(getStatusVariant("escalated")).toBe("secondary");
    expect(getStatusClassName("escalated")).toBe("");
    // An unmapped status shows its raw value — visibly odd, but never blank.
    expect(formatStatusLabel("escalated")).toBe("escalated");
  });

  it("uses destructive styling for critical only", () => {
    expect(getUrgencyVariant("critical")).toBe("destructive");
    expect(getUrgencyVariant("high")).not.toBe("destructive");
  });

  it("title-cases snake_case issue types", () => {
    expect(formatIssueType("rate_lock_expiring")).toBe("Rate Lock Expiring");
    expect(formatIssueType("other")).toBe("Other");
    expect(formatIssueType("")).toBe("");
  });

  it("labels in_progress with a space", () => {
    expect(formatStatusLabel("in_progress")).toBe("In Progress");
  });
});

describe("sortEscalations", () => {
  it("puts the most urgent first", () => {
    const list = [
      esc({ id: "low", urgency: "low" }),
      esc({ id: "critical", urgency: "critical" }),
      esc({ id: "medium", urgency: "medium" }),
      esc({ id: "high", urgency: "high" }),
    ];
    expect(sortEscalations(list).map(e => e.id)).toEqual(["critical", "high", "medium", "low"]);
  });

  it("breaks ties by newest first", () => {
    const list = [
      esc({ id: "older", urgency: "high", createdAt: "2026-01-01T00:00:00.000Z" }),
      esc({ id: "newer", urgency: "high", createdAt: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(sortEscalations(list).map(e => e.id)).toEqual(["newer", "older"]);
  });

  it("sorts an unrecognised urgency last, never above critical", () => {
    // A value the desk does not understand must not be able to jump the queue
    // ahead of a genuine critical escalation.
    const list = [esc({ id: "weird", urgency: "spicy" }), esc({ id: "critical", urgency: "critical" })];
    expect(sortEscalations(list).map(e => e.id)).toEqual(["critical", "weird"]);
  });

  it("does not mutate the array it was given", () => {
    const list = [esc({ id: "a", urgency: "low" }), esc({ id: "b", urgency: "critical" })];
    sortEscalations(list);
    expect(list.map(e => e.id)).toEqual(["a", "b"]);
  });
});

describe("summariseEscalations", () => {
  it("counts open and in_progress as open, resolved as not", () => {
    const s = summariseEscalations([
      esc({ status: "open" }),
      esc({ status: "in_progress" }),
      esc({ status: "resolved" }),
    ]);
    expect(s.openCount).toBe(2);
  });

  it("excludes resolved items from the critical counter", () => {
    // The critical tile is a call to action; a critical issue that has been
    // dealt with must not keep sounding the alarm.
    const s = summariseEscalations([
      esc({ urgency: "critical", status: "open" }),
      esc({ urgency: "critical", status: "resolved" }),
      esc({ urgency: "high", status: "open" }),
    ]);
    expect(s.criticalCount).toBe(1);
  });

  it("reports N/A rather than 0h before anything has been resolved", () => {
    // "0h" would read as instant resolution; there is simply no data yet.
    expect(summariseEscalations([esc()]).avgResolution).toBe("N/A");
    expect(summariseEscalations([]).avgResolution).toBe("N/A");
  });

  it("averages resolution time in hours under a day", () => {
    const s = summariseEscalations([
      esc({ createdAt: "2026-01-01T00:00:00.000Z", resolvedAt: "2026-01-01T02:00:00.000Z" }),
      esc({ createdAt: "2026-01-01T00:00:00.000Z", resolvedAt: "2026-01-01T06:00:00.000Z" }),
    ]);
    expect(s.avgResolution).toBe("4h");
  });

  it("switches to days at 24 hours and up", () => {
    const s = summariseEscalations([
      esc({ createdAt: "2026-01-01T00:00:00.000Z", resolvedAt: "2026-01-04T00:00:00.000Z" }),
    ]);
    expect(s.avgResolution).toBe("3d");
  });

  it("ignores unresolved items when averaging", () => {
    const withPending = summariseEscalations([
      esc({ createdAt: "2026-01-01T00:00:00.000Z", resolvedAt: "2026-01-01T04:00:00.000Z" }),
      esc({ createdAt: "2026-01-01T00:00:00.000Z", resolvedAt: null }),
    ]);
    expect(withPending.avgResolution).toBe("4h");
  });
});

describe("slaRemaining", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("reports hours and minutes left", () => {
    const r = slaRemaining(new Date(now.getTime() + 5 * HOUR + 30 * 60 * 1000).toISOString(), now);
    expect(r).toMatchObject({ expired: false, hours: 5, minutes: 30 });
  });

  it("flags under four hours as urgent", () => {
    expect(slaRemaining(new Date(now.getTime() + 3 * HOUR).toISOString(), now).isUrgent).toBe(true);
    expect(slaRemaining(new Date(now.getTime() + 4 * HOUR).toISOString(), now).isUrgent).toBe(false);
  });

  it("treats a deadline exactly now as expired", () => {
    // Boundary matters: a countdown reading "0h 0m remaining" at the moment
    // the SLA lapses would understate a breach that has already happened.
    expect(slaRemaining(now.toISOString(), now).expired).toBe(true);
    expect(slaRemaining(new Date(now.getTime() - HOUR).toISOString(), now).expired).toBe(true);
  });

  it("marks an expired SLA urgent so it can never render as calm", () => {
    expect(slaRemaining(new Date(now.getTime() - 100 * HOUR).toISOString(), now).isUrgent).toBe(true);
  });
});
