import { describe, it, expect } from "vitest";
import { filterAccessibleActiveApplicationIds } from "../server/routes/cockpit";
import { buildStaffSignals } from "../server/services/signalEngine";
import type { DealTeamMember, LoanApplication } from "@shared/schema";

// -----------------------------------------------------------------------------
// LO-1 cockpit scoping — the deal-team gate on the attention feed.
//
// filterAccessibleActiveApplicationIds is the pure core of the non-admin scope:
// a loan officer's signals/cockpit must be limited to the ACTIVE files they are
// on the deal team for, deduplicated. buildStaffSignals' empty-scope guard is
// the fail-closed backstop (no accessible apps -> empty feed, never the
// platform-wide query). Both are testable without a database.
// -----------------------------------------------------------------------------

function member(appId: string | null, status: string): DealTeamMember & { application?: LoanApplication } {
  return {
    id: `m-${appId}-${status}`,
    application: appId
      ? ({ id: appId, status } as LoanApplication)
      : undefined,
  } as DealTeamMember & { application?: LoanApplication };
}

describe("filterAccessibleActiveApplicationIds", () => {
  it("returns the ids of active applications the staffer is on", () => {
    const ids = filterAccessibleActiveApplicationIds([
      member("app-1", "submitted"),
      member("app-2", "underwriting"),
    ]);
    expect(ids.sort()).toEqual(["app-1", "app-2"]);
  });

  it("excludes draft, funded, and denied files (not in flight)", () => {
    const ids = filterAccessibleActiveApplicationIds([
      member("app-active", "processing"),
      member("app-draft", "draft"),
      member("app-funded", "funded"),
      member("app-denied", "denied"),
    ]);
    expect(ids).toEqual(["app-active"]);
  });

  it("deduplicates when the staffer has multiple memberships on one file", () => {
    const ids = filterAccessibleActiveApplicationIds([
      member("app-1", "submitted"),
      member("app-1", "submitted"),
    ]);
    expect(ids).toEqual(["app-1"]);
  });

  it("skips memberships whose application failed to load", () => {
    const ids = filterAccessibleActiveApplicationIds([member(null, "submitted"), member("app-1", "analyzing")]);
    expect(ids).toEqual(["app-1"]);
  });

  it("treats a null status as draft (excluded)", () => {
    const ids = filterAccessibleActiveApplicationIds([
      { id: "m", application: { id: "app-x", status: null } } as unknown as DealTeamMember & {
        application?: LoanApplication;
      },
    ]);
    expect(ids).toEqual([]);
  });
});

describe("buildStaffSignals — scoped empty-book guard (fail closed)", () => {
  it("returns an empty feed for a scope with no accessible applications, without a DB query", async () => {
    // No await on the database: the guard short-circuits before any select().
    await expect(buildStaffSignals(40, { applicationIds: [] })).resolves.toEqual([]);
  });
});
