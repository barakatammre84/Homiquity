import { describe, it, expect } from "vitest";
import {
  countOutstanding,
  isBorrowerOwned,
  isPendingTask,
  isRejectedTask,
  needsBorrowerAction,
  selectOutstanding,
  type BorrowerActionableTask,
} from "./outstandingWork";

// Pins the one definition of "outstanding" both borrower surfaces now share.
// The cases that matter are the ones the dashboard used to miss: a BLOCKED
// task, and a task whose verification came back rejected while its status is
// something other than OPEN.

const t = (over: Partial<BorrowerActionableTask>): BorrowerActionableTask => ({
  status: "OPEN",
  ...over,
});

describe("needsBorrowerAction", () => {
  it("counts an open borrower task", () => {
    expect(needsBorrowerAction(t({ status: "OPEN" }))).toBe(true);
  });

  it("counts a BLOCKED task — blocked is still the borrower's to clear", () => {
    expect(needsBorrowerAction(t({ status: "BLOCKED" }))).toBe(true);
  });

  it("counts a REJECTED task whatever its lifecycle status", () => {
    for (const status of ["OPEN", "BLOCKED", "IN_PROGRESS"]) {
      expect(
        needsBorrowerAction(t({ status, verificationStatus: "rejected" })),
      ).toBe(true);
    }
  });

  it("does not count work that is done or dead", () => {
    for (const status of ["COMPLETED", "EXPIRED", "CANCELLED"]) {
      expect(needsBorrowerAction(t({ status }))).toBe(false);
      // …not even when a stale rejection is still attached to it.
      expect(
        needsBorrowerAction(t({ status, verificationStatus: "rejected" })),
      ).toBe(false);
    }
  });

  it("does not count a plain IN_PROGRESS task — submitted, awaiting review", () => {
    expect(needsBorrowerAction(t({ status: "IN_PROGRESS" }))).toBe(false);
  });

  it("does not count staff-owned work shown for transparency", () => {
    expect(needsBorrowerAction(t({ status: "OPEN", ownerRole: "UW" }))).toBe(false);
    expect(needsBorrowerAction(t({ status: "OPEN", ownerRole: "BORROWER" }))).toBe(true);
    // A row with no owner is already borrower-scoped by its caller.
    expect(isBorrowerOwned(t({ status: "OPEN" }))).toBe(true);
  });
});

describe("bucketing", () => {
  it("keeps rejected and pending disjoint, so no task is counted twice", () => {
    const rejected = t({ status: "OPEN", verificationStatus: "rejected" });
    expect(isRejectedTask(rejected)).toBe(true);
    expect(isPendingTask(rejected)).toBe(false);

    const pending = t({ status: "OPEN" });
    expect(isPendingTask(pending)).toBe(true);
    expect(isRejectedTask(pending)).toBe(false);
  });
});

describe("selectOutstanding / countOutstanding", () => {
  it("selects only outstanding work and tolerates missing data", () => {
    const tasks = [
      t({ status: "OPEN" }),
      t({ status: "BLOCKED" }),
      t({ status: "IN_PROGRESS", verificationStatus: "rejected" }),
      t({ status: "IN_PROGRESS" }),
      t({ status: "COMPLETED" }),
      t({ status: "EXPIRED" }),
      t({ status: "OPEN", ownerRole: "PROCESSOR" }),
    ];

    expect(countOutstanding(tasks)).toBe(3);
    expect(selectOutstanding(tasks)).toHaveLength(3);
    expect(countOutstanding(undefined)).toBe(0);
    expect(selectOutstanding(null)).toEqual([]);
  });
});
