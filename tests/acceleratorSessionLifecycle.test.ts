import { describe, it, expect } from "vitest";
import {
  SESSION_STATUSES,
  SESSION_TRANSITIONS,
  TERMINAL_SESSION_STATUSES,
  canTransitionSession,
  normalizeSessionStatus,
  outcomeIsReportable,
  type SessionStatus,
} from "@shared/acceleratorProgram";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The defect these pin: shipping `requested` → `confirmed` and stopping there
// left THREE of the five statuses unreachable — nothing could write
// `completed`, `cancelled` or `no_show`. A confirmed session was frozen for
// good, so the borrower's page would go on showing a confirmed meeting for a
// date that had already passed.

const routeSource = readFileSync(
  resolve(__dirname, "../server/routes/borrower/realtorPrograms.ts"),
  "utf8",
);

describe("every status is reachable", () => {
  it("something can write each of the five", () => {
    for (const status of SESSION_STATUSES as readonly SessionStatus[]) {
      const reachable =
        status === "requested" || SESSION_TRANSITIONS.some((t) => t.to === status);
      expect(reachable, `nothing can write "${status}"`).toBe(true);
    }
  });

  it("the three that used to be unreachable have a writer", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(SESSION_TRANSITIONS.some((t) => t.to === status)).toBe(true);
    }
  });
});

describe("who may make each move", () => {
  it("only staff confirm", () => {
    expect(canTransitionSession("requested", "confirmed", "staff")).toBe(true);
    expect(canTransitionSession("requested", "confirmed", "borrower")).toBe(false);
  });

  it("only staff report what happened", () => {
    for (const outcome of ["completed", "no_show"] as const) {
      expect(canTransitionSession("confirmed", outcome, "staff")).toBe(true);
      expect(canTransitionSession("confirmed", outcome, "borrower")).toBe(false);
    }
  });

  it("either side can call off a booked session", () => {
    expect(canTransitionSession("confirmed", "cancelled", "staff")).toBe(true);
    expect(canTransitionSession("confirmed", "cancelled", "borrower")).toBe(true);
  });

  it("only the borrower moves the time, and it re-opens the ask", () => {
    expect(canTransitionSession("confirmed", "requested", "borrower")).toBe(true);
    expect(canTransitionSession("confirmed", "requested", "staff")).toBe(false);
  });

  it("an outcome cannot be reported on a session nobody confirmed", () => {
    expect(canTransitionSession("requested", "completed", "staff")).toBe(false);
    expect(canTransitionSession("requested", "no_show", "staff")).toBe(false);
  });
});

describe("terminal means terminal", () => {
  it("cancelled, completed and no_show have no way out", () => {
    expect([...TERMINAL_SESSION_STATUSES].sort()).toEqual(
      ["cancelled", "completed", "no_show"].sort(),
    );
  });

  it("no actor can move a terminal session anywhere", () => {
    for (const from of TERMINAL_SESSION_STATUSES) {
      for (const to of SESSION_STATUSES as readonly SessionStatus[]) {
        for (const actor of ["borrower", "staff"] as const) {
          expect(canTransitionSession(from, to, actor), `${from} → ${to} by ${actor}`).toBe(false);
        }
      }
    }
  });
});

describe("rows written before the split are not stranded", () => {
  it('legacy "scheduled" is treated as confirmed for transitions only', () => {
    expect(normalizeSessionStatus("scheduled")).toBe("confirmed");
    expect(canTransitionSession("scheduled", "completed", "staff")).toBe(true);
    expect(canTransitionSession("scheduled", "cancelled", "borrower")).toBe(true);
    // …but it is still not a member of the vocabulary.
    expect(SESSION_STATUSES).not.toContain("scheduled");
  });

  it("an unrecognised status can move nowhere", () => {
    expect(canTransitionSession("banana", "cancelled", "staff")).toBe(false);
  });
});

describe("a meeting cannot be reported before it starts", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("refuses a session still in the future", () => {
    expect(outcomeIsReportable(new Date("2026-08-20T12:00:01.000Z"), now)).toBe(false);
  });

  it("allows one that has started", () => {
    expect(outcomeIsReportable(new Date("2026-08-20T12:00:00.000Z"), now)).toBe(true);
    expect(outcomeIsReportable(new Date("2026-08-19T09:00:00.000Z"), now)).toBe(true);
  });

  it("the outcome route enforces it", () => {
    expect(routeSource).toContain("outcomeIsReportable(new Date(existing.scheduledAt), new Date())");
    expect(routeSource).toContain("This session has not started yet.");
  });
});

describe("the routes read the same table the UI does", () => {
  it("every status-changing route gates on canTransitionSession", () => {
    for (const route of ["confirm", "decline", "outcome", "withdraw", "reschedule"]) {
      expect(routeSource).toContain(`/api/accelerator/sessions/:id/${route}`);
    }
    // Five routes, five gate calls — no route sets a status without asking.
    const gates = routeSource.match(/canTransitionSession\(/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(5);
  });

  it("the borrower routes are scoped through the caller's own enrollment", () => {
    const borrowerBlock = routeSource.slice(
      routeSource.indexOf('"/api/accelerator/sessions/:id/withdraw"'),
    );
    expect(borrowerBlock).toContain("requireOwnSession(storage, user,");
  });

  it("moving a time clears the loan officer's agreement to the old one", () => {
    const block = routeSource.slice(routeSource.indexOf('sessions/:id/reschedule'));
    expect(block).toContain('status: "requested"');
    expect(block).toContain("confirmedAt: null");
  });
});

describe("the borrower is told what happened", () => {
  it("confirm, decline and outcome all notify the borrower", () => {
    for (const outcome of ["confirmed", "cancelled"]) {
      expect(routeSource).toContain(`notifyBorrowerOutcome(storage, "${outcome}"`);
    }
    expect(routeSource).toContain("notifyBorrowerOutcome(storage, outcome, existing, user)");
  });

  it("the borrower's own actions tell the loan officer instead", () => {
    expect(routeSource).toContain('notifyLoanOfficerOfBorrowerChange(storage, "cancelled"');
    expect(routeSource).toContain('notifyLoanOfficerOfBorrowerChange(storage, "rescheduled"');
  });
});
