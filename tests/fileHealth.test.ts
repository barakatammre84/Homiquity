import { describe, it, expect } from "vitest";
import {
  computeFileHealth,
  daysSince,
  STALL_DAYS,
  IDLE_WARNING_DAYS,
  PIPELINE_AGE_RED_DAYS,
  CONDITIONS_WARNING_COUNT,
  type FileHealthInput,
} from "../server/services/fileHealth";

// ---------------------------------------------------------------------------
// File Health is the LO Command Center's "No-Stall" signal: deterministic
// green/yellow/red per file. These tests pin the rule thresholds — if a
// threshold changes, the No-Stall pitch changes with it, so the change must
// be deliberate.
// ---------------------------------------------------------------------------

function activeFile(overrides: Partial<FileHealthInput> = {}): FileHealthInput {
  return {
    status: "doc_collection",
    daysIdle: 0,
    daysInPipeline: 5,
    conditionsOutstanding: 2,
    preApprovalAmount: null,
    purchasePrice: null,
    ...overrides,
  };
}

describe("computeFileHealth — green", () => {
  it("is green for an active file touched today with a normal condition load", () => {
    const health = computeFileHealth(activeFile());
    expect(health.light).toBe("green");
    expect(health.reasons).toEqual([]);
  });

  it("treats unknown idle time as not-idle rather than manufacturing a stall", () => {
    const health = computeFileHealth(activeFile({ daysIdle: null }));
    expect(health.light).toBe("green");
  });

  it("is green for a funded file", () => {
    const health = computeFileHealth(activeFile({ status: "funded", daysIdle: 90, daysInPipeline: 90 }));
    expect(health.light).toBe("green");
  });
});

describe("computeFileHealth — yellow (early warning)", () => {
  it("warns after one idle day (below the stall threshold)", () => {
    const health = computeFileHealth(activeFile({ daysIdle: IDLE_WARNING_DAYS }));
    expect(health.light).toBe("yellow");
    expect(health.reasons.join(" ")).toContain("No activity");
  });

  it("warns when outstanding conditions cross the pipeline engine's high band", () => {
    const health = computeFileHealth(
      activeFile({ conditionsOutstanding: CONDITIONS_WARNING_COUNT + 1 }),
    );
    expect(health.light).toBe("yellow");
    expect(health.reasons.join(" ")).toContain("conditions outstanding");
  });

  it("does NOT tint the light for a normal condition load — conditions are the work list", () => {
    const health = computeFileHealth(activeFile({ conditionsOutstanding: CONDITIONS_WARNING_COUNT }));
    expect(health.light).toBe("green");
  });
});

describe("computeFileHealth — red (stalled or incoherent)", () => {
  it(`flags a stall at ${STALL_DAYS} idle days — the >48h No-Stall threshold`, () => {
    const health = computeFileHealth(activeFile({ daysIdle: STALL_DAYS }));
    expect(health.light).toBe("red");
    expect(health.reasons[0]).toContain("No activity for");
  });

  it("flags a file that outlived the 30-day pipeline limit", () => {
    const health = computeFileHealth(activeFile({ daysInPipeline: PIPELINE_AGE_RED_DAYS + 1 }));
    expect(health.light).toBe("red");
  });

  it("flags an amount-bearing status with no coherent loan amount", () => {
    const health = computeFileHealth(
      activeFile({ status: "pre_approved", preApprovalAmount: null, purchasePrice: null }),
    );
    expect(health.light).toBe("red");
    expect(health.reasons[0]).toContain("loan amount");
  });

  it("clears the amount rule once a coherent amount exists", () => {
    const health = computeFileHealth(
      activeFile({ status: "pre_approved", preApprovalAmount: "450000" }),
    );
    expect(health.light).toBe("green");
  });

  it("reports a denied file as red with the outcome as the reason", () => {
    const health = computeFileHealth(activeFile({ status: "denied" }));
    expect(health.light).toBe("red");
    expect(health.reasons[0].toLowerCase()).toContain("denied");
  });

  it("keeps yellow-band reasons visible on a red file — the LO sees the whole picture", () => {
    const health = computeFileHealth(
      activeFile({ daysIdle: STALL_DAYS, conditionsOutstanding: CONDITIONS_WARNING_COUNT + 2 }),
    );
    expect(health.light).toBe("red");
    expect(health.reasons.join(" ")).toContain("No activity for");
    expect(health.reasons.join(" ")).toContain("conditions outstanding");
  });
});

describe("daysSince", () => {
  const now = new Date("2026-07-04T12:00:00Z");

  it("returns null for missing or unparseable timestamps", () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince(undefined, now)).toBeNull();
    expect(daysSince("not-a-date", now)).toBeNull();
  });

  it("floors to whole days", () => {
    expect(daysSince(new Date("2026-07-01T13:00:00Z"), now)).toBe(2);
    expect(daysSince(new Date("2026-07-01T11:00:00Z"), now)).toBe(3);
  });

  it("clamps future timestamps to zero instead of going negative", () => {
    expect(daysSince(new Date("2026-07-05T12:00:00Z"), now)).toBe(0);
  });
});
