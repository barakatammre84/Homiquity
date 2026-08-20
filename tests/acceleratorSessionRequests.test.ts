import { describe, it, expect } from "vitest";
import {
  SESSION_STATUSES,
  BORROWER_CREATED_SESSION_STATUS,
  PENDING_SESSION_STATUSES,
  isSessionStatus,
  type SessionStatus,
} from "@shared/acceleratorProgram";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The defect these pin: POST /api/accelerator/coaching handed `req.body`
// straight to the insert, so the row took the column default ("scheduled") and
// the UI said "Coaching session has been scheduled." — while
// storage.getCoachingSessions had exactly ONE reader in the whole codebase, the
// borrower's own page. The borrower held an appointment nobody at Homiquity
// knew existed.

const ROUTE = resolve(__dirname, "../server/routes/borrower/realtorPrograms.ts");
const DIALOG = resolve(
  __dirname,
  "../client/src/pages/education/acceleratorProgram/ScheduleSessionDialog.tsx",
);
const routeSource = readFileSync(ROUTE, "utf8");
const dialogSource = readFileSync(DIALOG, "utf8");

describe("the session status vocabulary", () => {
  it("separates asking from booking", () => {
    expect(SESSION_STATUSES).toContain("requested");
    expect(SESSION_STATUSES).toContain("confirmed");
    expect(BORROWER_CREATED_SESSION_STATUS).toBe("requested");
  });

  it("treats only 'requested' as still owed a loan officer", () => {
    expect(PENDING_SESSION_STATUSES).toEqual(["requested"]);
    expect(PENDING_SESSION_STATUSES).not.toContain("confirmed");
  });

  it("rejects a status the server cannot write", () => {
    expect(isSessionStatus("requested")).toBe(true);
    expect(isSessionStatus("confirmed")).toBe(true);
    // The pre-split default still exists on old rows, and is deliberately NOT
    // in the vocabulary — the badge renders it raw rather than inventing a label.
    expect(isSessionStatus("scheduled")).toBe(false);
    expect(isSessionStatus("")).toBe(false);
    expect(isSessionStatus(undefined)).toBe(false);
  });

  it("every status in the vocabulary is a plain lowercase token", () => {
    for (const s of SESSION_STATUSES) {
      expect(s).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("a borrower may only ever create a REQUEST", () => {
  it("the create route sets the status itself and never reads it from the body", () => {
    // The insert names the constant, so a borrower cannot post status:"confirmed".
    expect(routeSource).toContain("status: BORROWER_CREATED_SESSION_STATUS");
    // And the raw-body insert that allowed it is gone.
    expect(routeSource).not.toContain("createCoachingSession(req.body)");
  });

  it("the create route validates the body instead of trusting it", () => {
    expect(routeSource).toContain("sessionRequestSchema.safeParse(req.body)");
    // `status` and `assignedToUserId` are absent from the request schema on
    // purpose — they are the two fields a borrower must not be able to set.
    const schema = routeSource.slice(
      routeSource.indexOf("const sessionRequestSchema"),
      routeSource.indexOf("export function registerRealtorProgramRoutes"),
    );
    expect(schema).not.toContain("status");
    expect(schema).not.toContain("assignedToUserId");
  });

  it("a request for a time already past is refused", () => {
    const schema = routeSource.slice(
      routeSource.indexOf("const sessionRequestSchema"),
      routeSource.indexOf("export function registerRealtorProgramRoutes"),
    );
    expect(schema).toContain("d.getTime() > Date.now()");
  });
});

describe("the request reaches a human", () => {
  it("the create route fans the request out to the session desk", () => {
    expect(routeSource).toContain("notifySessionRequested(storage, {");
  });

  it("staff can see pending requests and confirm them, role-gated", () => {
    expect(routeSource).toContain('"/api/accelerator/sessions/pending"');
    expect(routeSource).toContain('"/api/accelerator/sessions/:id/confirm"');
    // Both are staff-only. A borrower confirming their own session would put
    // the old lie back, in a new place.
    const staffBlock = routeSource.slice(routeSource.indexOf('"/api/accelerator/sessions/pending"'));
    expect(staffBlock).toContain('requireRole("admin", "lo", "loa")');
  });

  it("confirming names the loan officer who took it", () => {
    expect(routeSource).toContain('status: "confirmed"');
    expect(routeSource).toContain("assignedToUserId: user.id");
  });

  it("a session already taken by someone else is a 409, not a silent overwrite", () => {
    expect(routeSource).toContain(
      "Another loan officer has already confirmed this session.",
    );
  });
});

describe("the borrower is never told a request is a booking", () => {
  it("the success toast does not claim the session is scheduled", () => {
    expect(dialogSource).toContain("Request sent");
    expect(dialogSource).toContain("Nothing is booked yet");
    expect(dialogSource).not.toContain("Coaching session has been scheduled");
  });

  it("the borrower-facing copy calls the person a loan officer, never a coach", () => {
    // Comments and the wire are not copy. The API path and its query key keep
    // the original `coaching` name on purpose — renaming a route contract is
    // churn a borrower never sees — so they are stripped before the assertion.
    const visible = dialogSource
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .filter((l) => !l.includes("/api/accelerator/coaching"))
      .join("\n");
    expect(visible).toMatch(/loan officer/i);
    expect(visible).not.toMatch(/coach/i);
  });
});

describe("no status is renderable without a label", () => {
  it("every vocabulary status has a badge entry on the borrower's page", () => {
    const section = readFileSync(
      resolve(
        __dirname,
        "../client/src/pages/education/acceleratorProgram/CoachingSessionsSection.tsx",
      ),
      "utf8",
    );
    for (const status of SESSION_STATUSES as readonly SessionStatus[]) {
      expect(section).toContain(`  ${status}: { label:`);
    }
  });
});
