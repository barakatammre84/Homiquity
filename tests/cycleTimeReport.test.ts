import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { computeCycleTimeReport, CYCLE_TIME_TERMINAL_STATUSES } from "@shared/cycleTimeReport";
import { LOAN_APP_TERMINAL_STATUSES } from "@shared/schema";

// Roadmap G-C: the acquisition gates (>70% pull-through, <12-day cycle time)
// must be reportable, honestly — two named denominators, null-never-zero, and
// funded files without a measurable funding transition counted but excluded
// from the median.

const DAY = 86_400_000;
const T0 = new Date("2026-06-01T00:00:00.000Z").getTime();
const at = (days: number) => new Date(T0 + days * DAY).toISOString();

describe("computeCycleTimeReport", () => {
  it("an empty window yields nulls, not zeros", () => {
    const r = computeCycleTimeReport(90, [], []);
    expect(r.pullThroughResolvedPct).toBeNull();
    expect(r.pullThroughOverallPct).toBeNull();
    expect(r.cycleTime.medianDays).toBeNull();
    expect(r.cycleTime.p90Days).toBeNull();
  });

  it("nothing resolved yet: overall computes, resolved stays null", () => {
    const r = computeCycleTimeReport(
      90,
      [
        { id: "a", createdAt: at(0), status: "processing" },
        { id: "b", createdAt: at(1), status: "underwriting" },
      ],
      [],
    );
    expect(r.pullThroughResolvedPct).toBeNull();
    expect(r.pullThroughOverallPct).toBe(0); // 0 funded of 2 created IS a fact
    expect(r.outcomes.inFlight).toBe(2);
  });

  it("separates the two denominators: resolved vs overall", () => {
    const r = computeCycleTimeReport(
      90,
      [
        { id: "f1", createdAt: at(0), status: "funded" },
        { id: "d1", createdAt: at(0), status: "denied" },
        { id: "w1", createdAt: at(0), status: "withdrawn" },
        { id: "p1", createdAt: at(0), status: "processing" },
      ],
      [{ applicationId: "f1", fundedAt: at(10) }],
    );
    expect(r.pullThroughResolvedPct).toBeCloseTo(33.33, 1); // 1 of 3 resolved
    expect(r.pullThroughOverallPct).toBe(25); // 1 of 4 created
    expect(r.outcomes).toEqual({ funded: 1, denied: 1, withdrawn: 1, expired: 0, inFlight: 1 });
  });

  it("computes median and p90 from created→first-funded intervals", () => {
    const apps = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      createdAt: at(0),
      status: "funded",
    }));
    const events = [
      { applicationId: "a", fundedAt: at(8) },
      { applicationId: "b", fundedAt: at(10) },
      { applicationId: "c", fundedAt: at(12) },
      { applicationId: "d", fundedAt: at(14) },
      { applicationId: "e", fundedAt: at(40) },
    ];
    const r = computeCycleTimeReport(90, apps, events);
    expect(r.cycleTime.measuredCount).toBe(5);
    expect(r.cycleTime.medianDays).toBe(12);
    expect(r.cycleTime.p90Days).toBe(40);
  });

  it("a funded file with no funding transition counts in pull-through but not cycle time, with a note", () => {
    const r = computeCycleTimeReport(
      90,
      [
        { id: "old", createdAt: at(0), status: "funded" },
        { id: "new", createdAt: at(0), status: "funded" },
      ],
      [{ applicationId: "new", fundedAt: at(9) }],
    );
    expect(r.pullThroughResolvedPct).toBe(100);
    expect(r.cycleTime.measuredCount).toBe(1);
    expect(r.cycleTime.unmeasuredFundedCount).toBe(1);
    expect(r.cycleTime.medianDays).toBe(9);
    expect(r.notes.join(" ")).toMatch(/no usable funding transition/);
  });

  it("a funding transition earlier than creation is corrupt data — unmeasured, never a negative day", () => {
    const r = computeCycleTimeReport(
      90,
      [{ id: "x", createdAt: at(5), status: "funded" }],
      [{ applicationId: "x", fundedAt: at(2) }],
    );
    expect(r.cycleTime.measuredCount).toBe(0);
    expect(r.cycleTime.unmeasuredFundedCount).toBe(1);
    expect(r.cycleTime.medianDays).toBeNull();
  });

  it("enumerates exactly the schema's terminal statuses — a new terminal status must teach the switch", () => {
    expect([...CYCLE_TIME_TERMINAL_STATUSES].sort()).toEqual(
      [...LOAN_APP_TERMINAL_STATUSES].sort(),
    );
  });

  it("always explains the two denominators in notes", () => {
    const r = computeCycleTimeReport(90, [], []);
    expect(r.notes.join(" ")).toMatch(/Resolved pull-through/);
    expect(r.notes.join(" ")).toMatch(/in-flight files drag it down/i);
  });
});

describe("route wiring", () => {
  const src = readFileSync(
    resolve(__dirname, "..", "server/routes/underwriting/submissions.ts"),
    "utf8",
  );

  it("the cycle-time report is admin-gated", () => {
    expect(src).toMatch(
      /app\.get\("\/api\/reports\/cycle-time",\s*requireRole\("admin"\)/,
    );
  });

  it("the window is clamped so ?days can't scan unbounded history", () => {
    expect(src).toContain("Math.min(365, Math.max(7, raw))");
  });
});
