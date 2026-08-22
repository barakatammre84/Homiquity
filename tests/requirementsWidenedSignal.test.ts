import { describe, expect, it } from "vitest";
import {
  planRequirementsWidenedSignals,
  WIDENING_GRACE_MINUTES,
  type WidenedConditionRow,
} from "../server/services/signalEngine";

/**
 * Document requirements now derive from the SET of income sources, so a file
 * legitimately grows requirements after intake when a borrower adds a second
 * employer or an other-income row on a later URLA save. That is correct — we
 * were failing to ask — but it can put a new blocker on a file a loan officer
 * believed was clear, so staff see it rather than meeting it at submission.
 */
const T0 = new Date("2026-08-01T10:00:00Z").getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

const row = (applicationId: string, title: string, minutes: number): WidenedConditionRow => ({
  applicationId,
  title,
  createdAt: at(minutes),
});

describe("planRequirementsWidenedSignals", () => {
  it("stays silent for a file whose requirements all came from intake", () => {
    // One pass through generateConditionsFromRequirements — same timestamp cluster.
    expect(planRequirementsWidenedSignals([
      row("app-1", "W-2 Forms Required", 0),
      row("app-1", "Recent Pay Stub Required", 0),
      row("app-1", "Bank Statements Required", 1),
    ])).toEqual([]);
  });

  it("flags the requirements added by a later save, and only those", () => {
    const out = planRequirementsWidenedSignals([
      row("app-1", "W-2 Forms Required", 0),
      row("app-1", "Recent Pay Stub Required", 0),
      // Borrower adds a self-employed employer three days later.
      row("app-1", "2-Year Tax Returns Required (Self-Employed)", 60 * 72),
      row("app-1", "YTD Profit & Loss Statement Required", 60 * 72),
      row("app-1", "Business Bank Statements Required", 60 * 72),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(3);
    expect(out[0].titles).toEqual([
      "2-Year Tax Returns Required (Self-Employed)",
      "YTD Profit & Loss Statement Required",
      "Business Bank Statements Required",
    ]);
    // The intake pair is not reported as new.
    expect(out[0].titles).not.toContain("W-2 Forms Required");
  });

  it("does not mistake a slow intake write for a widening", () => {
    expect(planRequirementsWidenedSignals([
      row("app-1", "First", 0),
      row("app-1", "Last of the same batch", WIDENING_GRACE_MINUTES - 1),
    ])).toEqual([]);
  });

  it("orders busiest file first so the rail leads with the biggest change", () => {
    const out = planRequirementsWidenedSignals([
      row("quiet", "Intake", 0), row("quiet", "One later", 60 * 24),
      row("busy", "Intake", 0),
      row("busy", "A", 60 * 24), row("busy", "B", 60 * 24), row("busy", "C", 60 * 24),
    ]);
    expect(out.map((g) => g.applicationId)).toEqual(["busy", "quiet"]);
  });

  it("reports oldest-first within a file, so staff read the change in order", () => {
    const out = planRequirementsWidenedSignals([
      row("app-1", "Intake", 0),
      row("app-1", "Second addition", 60 * 48),
      row("app-1", "First addition", 60 * 24),
    ]);
    expect(out[0].titles).toEqual(["First addition", "Second addition"]);
  });

  it("skips rows with no usable timestamp instead of guessing which side of intake they fall", () => {
    expect(planRequirementsWidenedSignals([
      { applicationId: "app-1", title: "No timestamp", createdAt: null },
      { applicationId: "app-1", title: "Unparseable", createdAt: "not a date" },
    ])).toEqual([]);
  });

  it("treats a single lone requirement as intake, not as a widening", () => {
    // Nothing to compare against — the earliest IS the only one.
    expect(planRequirementsWidenedSignals([row("app-1", "Only", 0)])).toEqual([]);
  });

  it("keeps files independent", () => {
    const out = planRequirementsWidenedSignals([
      row("app-1", "Intake", 0),
      row("app-2", "Intake", 0),
      row("app-2", "Added later", 60 * 24),
    ]);
    expect(out.map((g) => g.applicationId)).toEqual(["app-2"]);
  });
});
