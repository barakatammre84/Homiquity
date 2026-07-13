import { describe, it, expect } from "vitest";
import { computeRevisedLeDueDate, isRevisedLeOverdue } from "../server/services/changeOfCircumstance";

// ---------------------------------------------------------------------------
// Revised-LE deadline math — Reg Z §1026.19(e)(4)(i): the revised Loan
// Estimate must be provided within 3 business days of receiving information
// sufficient to establish the changed circumstance. Business-day math comes
// from services/businessDays.ts (weekends + US federal holidays); these tests
// pin the COC-specific composition: due-date derivation, the end-of-due-day
// overdue convention (same as the original-LE clock in services/trid.ts),
// and determinism (same inputs → same outputs).
// ---------------------------------------------------------------------------

describe("computeRevisedLeDueDate — 3 business days (§1026.19(e)(4)(i))", () => {
  it("skips a weekend: information received Friday → due Wednesday", () => {
    // 2026-07-10 is a Friday. +3 business days = Mon 13th, Tue 14th, Wed 15th.
    const due = computeRevisedLeDueDate(new Date("2026-07-10T15:00:00Z"));
    expect(due.toISOString().split("T")[0]).toBe("2026-07-15");
  });

  it("counts consecutive weekdays: received Monday → due Thursday", () => {
    // 2026-07-13 is a Monday. +3 business days = Tue, Wed, Thu 16th.
    const due = computeRevisedLeDueDate(new Date("2026-07-13T09:00:00Z"));
    expect(due.toISOString().split("T")[0]).toBe("2026-07-16");
  });

  it("skips a federal holiday: received the Thursday before July 4th weekend", () => {
    // 2026-07-02 is a Thursday. July 4 2026 falls on Saturday, observed
    // Friday 2026-07-03 — so business days are Mon 6th, Tue 7th, Wed 8th.
    const due = computeRevisedLeDueDate(new Date("2026-07-02T12:00:00Z"));
    expect(due.toISOString().split("T")[0]).toBe("2026-07-08");
  });

  it("is deterministic — same input, same output", () => {
    const input = new Date("2026-07-10T15:00:00Z");
    expect(computeRevisedLeDueDate(input).getTime()).toBe(computeRevisedLeDueDate(input).getTime());
  });
});

describe("isRevisedLeOverdue — end-of-due-day convention", () => {
  const due = new Date("2026-07-15T00:00:00Z");

  it("is not overdue during the due day itself", () => {
    expect(isRevisedLeOverdue(due, new Date("2026-07-15T23:00:00Z"))).toBe(false);
  });

  it("becomes overdue once the due day has fully elapsed", () => {
    expect(isRevisedLeOverdue(due, new Date("2026-07-16T00:00:01Z"))).toBe(true);
  });

  it("is not overdue before the due date", () => {
    expect(isRevisedLeOverdue(due, new Date("2026-07-13T12:00:00Z"))).toBe(false);
  });
});
