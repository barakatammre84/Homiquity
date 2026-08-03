import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { ROUTE_GATES } from "../client/src/lib/routeGates";
import {
  CLIENT_ROLES,
  STAFF_ROLES,
  INTERNAL_STAFF_ROLES,
  ALL_ROLES,
} from "../shared/roles";

// -----------------------------------------------------------------------------
// Client route gates (audit finding M1).
//
// The router (App.tsx `requiredRoles`) and the sidebar (nav item `roles`) both
// answer "who may reach this page". They used to answer it with hand-copied
// literal arrays, so a role added to shared/roles.ts server-side left the client
// behind, and the two client copies could disagree with each other — producing a
// nav link that the route then bounces.
//
// Both now read ROUTE_GATES. These tests keep that true and keep the gates
// anchored to the shared role vocabulary.
//
// SCOPE NOTE: client gates are a UX affordance, never the security boundary —
// the server's own role checks protect the data. Where a gate is knowingly out
// of step with its server counterpart, it is recorded in KNOWN_SERVER_DRIFT
// below rather than silently "fixed": narrowing a role gate is a §9
// security-review change, not a refactor.
// -----------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");
const APP_TSX = readFileSync(join(REPO_ROOT, "client", "src", "App.tsx"), "utf8");
const SIDEBAR_TSX = readFileSync(
  join(REPO_ROOT, "client", "src", "components", "app-sidebar.tsx"),
  "utf8",
);

describe("ROUTE_GATES", () => {
  it("uses only roles that exist in the shared vocabulary", () => {
    for (const [gate, roles] of Object.entries(ROUTE_GATES)) {
      for (const role of roles) {
        expect(ALL_ROLES, `ROUTE_GATES.${gate} contains unknown role "${role}"`).toContain(role);
      }
    }
  });

  it("has no empty gate — an empty list would admit nobody", () => {
    for (const [gate, roles] of Object.entries(ROUTE_GATES)) {
      expect(roles.length, `ROUTE_GATES.${gate} is empty`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate role within a gate", () => {
    for (const [gate, roles] of Object.entries(ROUTE_GATES)) {
      expect(new Set(roles).size, `ROUTE_GATES.${gate} repeats a role`).toBe(roles.length);
    }
  });

  // These three ARE the shared sets — referenced, not restated, so adding a role
  // to shared/roles.ts cannot leave the router behind.
  it("tracks the shared sets by reference", () => {
    expect(ROUTE_GATES.borrower).toBe(CLIENT_ROLES);
    expect(ROUTE_GATES.staff).toBe(STAFF_ROLES);
    expect(ROUTE_GATES.internalStaff).toBe(INTERNAL_STAFF_ROLES);
  });

  it("keeps internal staff a strict subset of staff", () => {
    for (const role of ROUTE_GATES.internalStaff) {
      expect(ROUTE_GATES.staff).toContain(role);
    }
    expect(ROUTE_GATES.internalStaff.length).toBeLessThan(ROUTE_GATES.staff.length);
  });

  it("never lets a client role into a staff gate", () => {
    const staffish = [
      ...ROUTE_GATES.staff,
      ...ROUTE_GATES.internalStaff,
      ...ROUTE_GATES.underwriterOps,
      ...ROUTE_GATES.loTeam,
      ...ROUTE_GATES.adminOnly,
    ];
    for (const clientRole of CLIENT_ROLES) {
      expect(staffish, `client role "${clientRole}" reached a staff gate`).not.toContain(clientRole);
    }
  });

  it("does not spread PARTNER_ROLES into partnerHub", () => {
    // The server gate is requireRole("realtor","admin"); spreading the shared
    // partner set would silently widen the client gate when a partner role is
    // added. Must stay an explicit literal.
    const src = readFileSync(join(REPO_ROOT, "client", "src", "lib", "routeGates.ts"), "utf8");
    const decl = src.slice(src.indexOf("partnerHub:"));
    expect(decl.slice(0, decl.indexOf("\n"))).not.toContain("...PARTNER_ROLES");
  });
});

describe("gate wiring", () => {
  it("App.tsx passes ROUTE_GATES, never an inline role literal", () => {
    const inlineLiterals = [...APP_TSX.matchAll(/requiredRoles=\{\[[^\]]*\]\}/g)].map((m) => m[0]);
    expect(
      inlineLiterals,
      "App.tsx must pass a ROUTE_GATES entry (requiredRoles={ROUTE_GATES.x}), " +
        "not a hand-written array — that is how the router drifted from shared/roles.ts.",
    ).toEqual([]);
  });

  it("every requiredRoles in App.tsx names a real ROUTE_GATES key", () => {
    const used = [...APP_TSX.matchAll(/requiredRoles=\{ROUTE_GATES\.(\w+)\}/g)].map((m) => m[1]);
    expect(used.length, "expected the router to use ROUTE_GATES").toBeGreaterThan(0);
    for (const key of used) {
      expect(Object.keys(ROUTE_GATES), `App.tsx uses unknown gate "${key}"`).toContain(key);
    }
  });

  it("the sidebar gates its nav items from ROUTE_GATES too", () => {
    // The nav is the second copy of the same question. If it re-inlines a
    // literal it can offer a link the route bounces.
    const inline = [...SIDEBAR_TSX.matchAll(/roles:\s*\[[^\]]*\]/g)].map((m) => m[0]);
    expect(
      inline,
      "app-sidebar nav items must gate with ROUTE_GATES.x so the nav and the " +
        "router cannot disagree about who may reach a page.",
    ).toEqual([]);
  });
});

describe("known client/server gate drift", () => {
  // Verified against the server on 2026-08-02. Each entry is a place the client
  // gate admits a role the server then 403s, so the user reaches a page that
  // cannot load. Recorded — not silently narrowed — because changing a role gate
  // requires the §9 security review.
  //
  // When one is fixed, delete its entry. This test only pins that the list has
  // not grown by accident.
  const KNOWN_SERVER_DRIFT = {
    "staff → GET /api/closing-guarantees (admin-only, guaranteesHomeowner.ts:24)":
      ["lo", "loa", "processor", "underwriter", "closer", "broker", "lender"],
    "staff → StaffDashboard internal-only APIs (staff.ts:14,41; pipeline.ts:406)":
      ["broker", "lender"],
    "partnerHub → /api/partners/me (realtor+admin, partners.ts:199,213)": ["cpa"],
    "internalStaff → POST /api/loan-applications/:id/claim (lo,loa only, pipeline.ts:485)":
      ["admin", "processor", "underwriter", "closer"],
    "underwriterOps → PricingMatrices writes + run-escalation (admin-only)": ["underwriter"],
  };

  it("records every known drift against roles that are actually in the gate", () => {
    // Keeps the ledger honest: if a gate is narrowed, its drift entry must go
    // too, rather than lingering as a stale claim.
    const gateFor: Record<string, readonly string[]> = {
      staff: ROUTE_GATES.staff,
      partnerHub: ROUTE_GATES.partnerHub,
      internalStaff: ROUTE_GATES.internalStaff,
      underwriterOps: ROUTE_GATES.underwriterOps,
    };
    for (const [label, roles] of Object.entries(KNOWN_SERVER_DRIFT)) {
      const gateName = label.split(" ")[0];
      for (const role of roles) {
        expect(
          gateFor[gateName],
          `drift entry "${label}" names ${role}, which is no longer in ROUTE_GATES.${gateName} — delete the entry`,
        ).toContain(role);
      }
    }
  });

  it("has not grown — a new drift means a gate was widened without checking the server", () => {
    expect(Object.keys(KNOWN_SERVER_DRIFT).length).toBe(5);
  });
});
