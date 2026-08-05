import { describe, it, expect } from "vitest";
import { actionItemsToText, parseActionItems, partitionSessions } from "./derive";
import type { StrategySession } from "./types";

const session = (over: Partial<StrategySession> & { id: string }): StrategySession =>
  ({
    agentUserId: "agent-1",
    loUserId: null,
    scheduledAt: "2026-03-01T10:00:00.000Z",
    durationMinutes: 30,
    sessionType: "weekly_review",
    topic: null,
    notes: null,
    actionItems: null,
    status: "scheduled",
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as StrategySession;

const SESSIONS: StrategySession[] = [
  session({ id: "later", scheduledAt: "2026-03-10T10:00:00.000Z" }),
  session({ id: "soonest", scheduledAt: "2026-03-02T10:00:00.000Z" }),
  session({ id: "mid", scheduledAt: "2026-03-05T10:00:00.000Z" }),
  session({ id: "done-old", status: "completed", scheduledAt: "2026-01-05T10:00:00.000Z" }),
  session({ id: "done-new", status: "completed", scheduledAt: "2026-02-05T10:00:00.000Z" }),
  session({ id: "cancelled", status: "cancelled", scheduledAt: "2026-02-10T10:00:00.000Z" }),
];

describe("partitionSessions", () => {
  it("orders upcoming soonest-first and picks that as the next session", () => {
    const { upcoming, next } = partitionSessions(SESSIONS);
    expect(upcoming.map((s) => s.id)).toEqual(["soonest", "mid", "later"]);
    expect(next?.id).toBe("soonest");
  });

  it("orders the archive most-recent-first", () => {
    const { archived } = partitionSessions(SESSIONS);
    expect(archived.map((s) => s.id)).toEqual(["cancelled", "done-new", "done-old"]);
  });

  it("archives cancelled sessions but does not count them as completed", () => {
    // Deliberate split: the tab is an archive ("Completed and cancelled
    // sessions will appear here"), the stat is an achievement count. A
    // cancelled session belongs in one and not the other.
    const { archived, completedCount } = partitionSessions(SESSIONS);
    expect(archived).toHaveLength(3);
    expect(completedCount).toBe(2);
  });

  it("never reorders the caller's array", () => {
    // sort() mutates; these lists come from the query cache.
    const input = [...SESSIONS];
    const before = input.map((s) => s.id);
    partitionSessions(input);
    expect(input.map((s) => s.id)).toEqual(before);
  });

  it("returns a null next session when nothing is scheduled", () => {
    const { upcoming, next, completedCount } = partitionSessions([
      session({ id: "c", status: "completed" }),
    ]);
    expect(upcoming).toEqual([]);
    expect(next).toBeNull();
    expect(completedCount).toBe(1);
  });

  it("handles an empty list", () => {
    expect(partitionSessions([])).toEqual({
      upcoming: [], archived: [], completedCount: 0, next: null,
    });
  });
});

describe("parseActionItems", () => {
  it("splits on newlines and trims", () => {
    expect(parseActionItems("Follow up on 1234\n  Send report  \nSchedule review")).toEqual([
      "Follow up on 1234",
      "Send report",
      "Schedule review",
    ]);
  });

  it("drops blank lines rather than storing empty items", () => {
    // Trailing newlines are what a textarea produces most often; storing them
    // would render bullet points with no text.
    expect(parseActionItems("One\n\n\nTwo\n   \n")).toEqual(["One", "Two"]);
  });

  it("is empty for empty or whitespace-only input", () => {
    expect(parseActionItems("")).toEqual([]);
    expect(parseActionItems("   \n  \n")).toEqual([]);
  });
});

describe("actionItemsToText", () => {
  it("round-trips a stored list back into the textarea", () => {
    const items = ["One", "Two", "Three"];
    expect(parseActionItems(actionItemsToText(items))).toEqual(items);
  });

  it("renders an absent list as an empty box", () => {
    expect(actionItemsToText(null)).toBe("");
    expect(actionItemsToText(undefined)).toBe("");
  });
});
