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

// ---------------------------------------------------------------------------
// Audit F-23 — the cash-conversion cycle.
//
// An asset-light broker's only liquidity risk is working capital: spend goes
// out at application, cash comes back after the lender's wire. Funding is not
// the moment cash arrives. `compensation_received_at` recorded that second half
// on every funded submission and was read by nothing — summarizeCompensation
// reads the amount beside it and ignores the timestamp.
// ---------------------------------------------------------------------------
describe("F-23 — funding→remittance lag and days-to-cash", () => {
  const APPS = [
    { id: "a", createdAt: at(0), status: "funded" },
    { id: "b", createdAt: at(0), status: "funded" },
  ];
  const FUNDED = [
    { applicationId: "a", fundedAt: at(20) },
    { applicationId: "b", fundedAt: at(30) },
  ];

  it("measures the lag from the submission's own timestamps", () => {
    const r = computeCycleTimeReport(90, APPS, FUNDED, [
      { applicationId: "a", fundedAt: at(20), compensationReceivedAt: at(25) },
      { applicationId: "b", fundedAt: at(30), compensationReceivedAt: at(39) },
    ]);
    expect(r.remittanceLag.measuredCount).toBe(2);
    expect(r.remittanceLag.medianDays).toBe(7); // (5 + 9) / 2
    expect(r.remittanceLag.p90Days).toBe(9);
  });

  it("adds the two halves into days-to-cash", () => {
    const r = computeCycleTimeReport(90, APPS, FUNDED, [
      { applicationId: "a", fundedAt: at(20), compensationReceivedAt: at(25) },
      { applicationId: "b", fundedAt: at(30), compensationReceivedAt: at(39) },
    ]);
    // cycle median 25 (20 and 30) + lag median 7
    expect(r.cycleTime.medianDays).toBe(25);
    expect(r.daysToCash.medianDays).toBe(32);
    expect(r.daysToCash.p90Days).toBe(r.cycleTime.p90Days! + r.remittanceLag.p90Days!);
  });

  it("leaves days-to-cash NULL when the lag is unmeasured — the wire is not instant", () => {
    // The dangerous default: reporting the funding cycle as days-to-cash would
    // understate the exact window this figure exists to surface.
    const r = computeCycleTimeReport(90, APPS, FUNDED, []);
    expect(r.cycleTime.medianDays).toBe(25);
    expect(r.remittanceLag.medianDays).toBeNull();
    expect(r.daysToCash.medianDays).toBeNull();
    expect(r.notes.join(" ")).toMatch(/not zero, it is unmeasured/);
  });

  it("excludes and counts a funded file with no remittance timestamp", () => {
    const r = computeCycleTimeReport(90, APPS, FUNDED, [
      { applicationId: "a", fundedAt: at(20), compensationReceivedAt: at(25) },
      { applicationId: "b", fundedAt: at(30), compensationReceivedAt: null },
    ]);
    expect(r.remittanceLag.measuredCount).toBe(1);
    expect(r.remittanceLag.unmeasuredFundedCount).toBe(1);
    expect(r.notes.join(" ")).toMatch(/no usable remittance timestamp/);
  });

  it("treats a remittance dated before funding as corrupt, not a same-day wire", () => {
    const r = computeCycleTimeReport(90, APPS, FUNDED, [
      { applicationId: "a", fundedAt: at(20), compensationReceivedAt: at(19) },
    ]);
    expect(r.remittanceLag.measuredCount).toBe(0);
    expect(r.remittanceLag.unmeasuredFundedCount).toBe(1);
  });

  it("ignores remittances on files outside the window's cohort", () => {
    const r = computeCycleTimeReport(90, APPS, FUNDED, [
      { applicationId: "a", fundedAt: at(20), compensationReceivedAt: at(25) },
      { applicationId: "stranger", fundedAt: at(0), compensationReceivedAt: at(60) },
    ]);
    expect(r.remittanceLag.measuredCount).toBe(1);
    expect(r.remittanceLag.medianDays).toBe(5);
  });

  it("stays backward-compatible when no remittance rows are passed", () => {
    const r = computeCycleTimeReport(90, APPS, FUNDED);
    expect(r.remittanceLag.measuredCount).toBe(0);
    expect(r.daysToCash.p90Days).toBeNull();
  });
});
