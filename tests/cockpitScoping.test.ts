import { readdirSync, readFileSync } from "fs";
import { join } from "path";
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

// -----------------------------------------------------------------------------
// Single-feed invariant.
//
// The attention feed existed twice: GET /api/staff/signals (routes/cockpit.ts,
// deal-team scoped) and GET /api/signals/staff (routes/jobs.ts, the SAME builder
// run with no scope at all) behind an identical requireRole list. StaffSignalsPanel
// was wired to the unscoped one, so every internal staffer saw signals — carrying
// borrowerName, applicationId and userId — for files outside their book.
//
// The unscoped route is gone. These guards fail if it (or any other unscoped
// caller) comes back, because the leak is invisible at runtime: both routes
// return 200 with a well-formed payload, just with the wrong rows in it.
// -----------------------------------------------------------------------------
describe("staff signals feed is served from exactly one scoped route", () => {
  const routesDir = join(__dirname, "..", "server", "routes");
  const routeFiles = readdirSync(routesDir, {
    recursive: true,
    encoding: "utf8",
  }).filter((f) => typeof f === "string" && f.endsWith(".ts"));

  /**
   * Code only. These guards must key off what the server actually registers,
   * not off prose — the tombstone comment in jobs.ts names both the removed
   * path and the builder on purpose, and must not read as a violation.
   */
  const codeOf = (f: string) =>
    readFileSync(join(routesDir, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  it("no route registers the old unscoped /api/signals/staff path", () => {
    const offenders = routeFiles.filter((f) =>
      /app\.(get|post|all)\(\s*["'`]\/api\/signals\/staff["'`]/.test(codeOf(f)),
    );
    expect(offenders, "an unscoped staff signals route is back").toEqual([]);
  });

  it("buildStaffSignals is only called from the scoped cockpit route", () => {
    const callers = routeFiles.filter((f) => /\bbuildStaffSignals\s*\(/.test(codeOf(f)));
    expect(callers).toEqual(["cockpit.ts"]);
  });

  it("the scoped route derives its scope per-caller rather than hardcoding it", () => {
    const src = readFileSync(join(__dirname, "..", "server", "routes", "cockpit.ts"), "utf8");
    // Non-admins must go through the deal-team lookup, and the platform-wide
    // call must remain reachable only via the "all" branch.
    expect(src).toMatch(/accessibleActiveApplicationIds\(storage,\s*user\)/);
    expect(src).toMatch(/scopeIds === "all"/);
    expect(src).toMatch(/applicationIds: scopeIds/);
  });

  it("no client surface still points at the removed unscoped path", () => {
    const clientSrc = join(__dirname, "..", "client", "src");
    const files = readdirSync(clientSrc, { recursive: true, encoding: "utf8" }).filter(
      (f) => typeof f === "string" && /\.(ts|tsx)$/.test(f),
    );
    const offenders = files.filter((f) =>
      readFileSync(join(clientSrc, f), "utf8").includes('"/api/signals/staff"'),
    );
    expect(offenders, "a client surface still queries the unscoped feed").toEqual([]);
  });
});
