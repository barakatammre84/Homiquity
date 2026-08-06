import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { FINANCIAL_VERIFICATION_ROLES } from "@shared/schema";
import { INTERNAL_STAFF_ROLES, STAFF_ROLES } from "@shared/roles";
import { ROUTE_GATES } from "../client/src/lib/routeGates";

// ---------------------------------------------------------------------------
// Client/server role-gate drift regression suite.
//
// A client route gate or action button that admits a role the corresponding
// server API then 403s is a broken page, not a security hole — but it is still
// a defect, and it is invisible until someone signs in as that exact role. The
// audit that produced these tests found three live cases (2026-08-03):
//
//   1. /closing-guarantee was gated to all 8 staff roles, but its primary query
//      GET /api/closing-guarantees is admin-only. Seven roles got a dead page.
//   2. TaskOperations offered "Run Escalation Check" (admin-only server-side)
//      and every role's task queue (canAccessRoleQueue allows a non-admin ONLY
//      its own role) to an underwriter, who 403s on both.
//   3. BorrowerFile gated "Mark Financials Verified" on isStaffRole (all 8),
//      but POST /:id/verify-financials excludes closer, broker, and lender.
//
// These are source-level guards in the same style as statusVocabulary.test.ts:
// they lock the convergence so a future edit can't silently reintroduce the
// hardcoded list that drifted in the first place.
//
// NOTE: authorization is enforced server-side; narrowing a client gate is
// defense-in-depth and never the security boundary itself. See
// tests/roleSeparation.test.ts for the HTTP-level authorization suite.
// ---------------------------------------------------------------------------

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

describe("FINANCIAL_VERIFICATION_ROLES is the single source of truth", () => {
  it("excludes closer and every external partner role", () => {
    // closer is a closing-stage role, not a document reviewer; broker/lender are
    // external partners who never review borrower documentation.
    expect(FINANCIAL_VERIFICATION_ROLES).not.toContain("closer");
    expect(FINANCIAL_VERIFICATION_ROLES).not.toContain("broker");
    expect(FINANCIAL_VERIFICATION_ROLES).not.toContain("lender");
  });

  it("is a strict subset of internal staff", () => {
    for (const role of FINANCIAL_VERIFICATION_ROLES) {
      expect(INTERNAL_STAFF_ROLES as readonly string[]).toContain(role);
    }
    expect(FINANCIAL_VERIFICATION_ROLES.length).toBeLessThan(STAFF_ROLES.length);
  });

  it("gates the verify-financials routes on the server", () => {
    const source = read("server/routes/lending/statusDecisions.ts");
    // Both the all-or-nothing and the per-dimension verification routes must read
    // the shared constant rather than an inline list that can drift from the client.
    expect(source).toContain("requireRole(...FINANCIAL_VERIFICATION_ROLES)");
    expect(source).not.toMatch(
      /requireRole\(\s*"admin",\s*"lo",\s*"loa",\s*"processor",\s*"underwriter"\s*\)/,
    );
  });

  it("gates the BorrowerFile verify button on the same constant", () => {
    const source = read("client/src/pages/staff/BorrowerFile.tsx");
    expect(source).toContain(
      'FINANCIAL_VERIFICATION_ROLES.includes(user?.role || "")',
    );
    // The bug: the button was rendered behind isStaff2 (isStaffRole -> all 8 roles).
    expect(source).toMatch(/\{canVerifyFinancials && \(/);
    expect(source).not.toMatch(
      /\{isStaff2 && \([\s\S]{0,400}button-verify-financials/,
    );
  });
});

describe("client route gates match their server APIs", () => {
  it("/closing-guarantee is admin-only, matching GET /api/closing-guarantees", () => {
    const app = read("client/src/App.tsx");
    const route = app.slice(app.indexOf('<Route path="/closing-guarantee">'));
    const block = route.slice(0, route.indexOf("</Route>"));
    expect(block).toContain("<AdminPage>");
    expect(block).not.toContain("<StaffPage>");

    // ...and the server side really is admin-only, so this stays honest if the
    // endpoint is ever scoped per-caller instead.
    const server = read("server/routes/borrower/guaranteesHomeowner.ts");
    const handler = server.slice(
      server.indexOf('app.get("/api/closing-guarantees"'),
    );
    expect(handler.slice(0, 400)).toContain("!isAdmin(req.user)"); // CH-4: shared predicate
  });
});

describe("TaskOperations only offers what an underwriter can actually call", () => {
  const source = read("client/src/pages/staff/TaskOperations.tsx");

  it("hides the admin-only escalation trigger from non-admins", () => {
    expect(source).toMatch(/\{isAdmin && \([\s\S]{0,400}button-run-escalation/);

    // The server gate this mirrors is an inline admin check, not requireRole.
    const server = read("server/routes/task-engine.ts");
    const handler = server.slice(
      server.indexOf('app.post("/api/task-engine/run-escalation"'),
    );
    expect(handler.slice(0, 400)).toContain('userRole !== "admin"');
  });

  it("offers other roles' task queues to admins only", () => {
    // canAccessRoleQueue lets a non-admin read ONLY its own role's queue, so the
    // cross-role SelectItems must sit behind isAdmin.
    const select = source.slice(
      source.indexOf('<SelectItem value="all">'),
      source.indexOf("</SelectContent>"),
    );
    expect(select).toContain("{isAdmin ? (");
    for (const role of ["LO", "LOA", "PROCESSOR", "UW", "CLOSER", "BORROWER"]) {
      const item = `<SelectItem value="${role}">`;
      if (!select.includes(item)) continue;
      expect(select.indexOf("{isAdmin ? (")).toBeLessThan(select.indexOf(item));
    }
  });
});

describe("lender-match surfaces are staff-gated", () => {
  // matchBorrowerToLenders / matchAndPriceBorrower return wholesale lender
  // identity (lenderName/lenderId) plus uncited rate math — both barred from
  // borrowers (wholesale-identity redaction doctrine, shared/borrowerOfferView.ts;
  // multi-lender fit itself is the tracked B5 deferral, kb log 2026-07-12 §2).
  // Until B5 reopens with a redaction layer + citation-backed pricing (F11),
  // these are internal staff tooling — the same boundary as
  // GET /api/admin/lender-products. Source guard so a future edit can't quietly
  // re-open them to any authenticated borrower.
  it("intelligence.ts gates both lender-matches routes with requireRole(...INTERNAL_STAFF_ROLES)", () => {
    const source = read("server/routes/intelligence.ts");
    for (const route of ['"/api/intelligence/lender-matches"', '"/api/intelligence/lender-matches/top"']) {
      const at = source.indexOf(route);
      expect(at, `${route} registration not found`).toBeGreaterThan(-1);
      const registration = source.slice(at, at + 200);
      expect(registration, `${route} must be staff-gated`).toContain("requireRole(...INTERNAL_STAFF_ROLES)");
      expect(registration, `${route} must not sit behind bare isAuthenticated`).not.toContain("isAuthenticated");
    }
  });

  it("the dead optimizations route stays deleted (OPT-cleanup) — resurrect only with gates", () => {
    // The zero-caller /api/optimizations/* surface (incl. match-and-price,
    // which this suite used to gate-check) was deleted 2026-08-05 with
    // OPT-7/OPT-8. If someone recreates it, this guard forces the
    // staff-gating conversation the old pin enforced.
    expect(existsSync(resolve(repoRoot, "server/routes/optimizations.ts"))).toBe(false);
    expect(read("server/routes.ts")).not.toContain("registerOptimizationRoutes");
  });
});

describe("engine-calculation routes are staff-gated", () => {
  // The six legacy engine endpoints return computed qualifying-income, DTI, and
  // LLPA-pricing figures over unverified self-stated inputs. A borrower-reachable
  // qualifying figure breaches "no live qualifying figures to borrowers before
  // human verification" (kb logs: 2026-08-04 rate-com §6.1, sovereign-stack §3.1).
  // Staff analysis tooling at the same reviewer boundary as
  // POST /:id/verify-financials (FINANCIAL_VERIFICATION_ROLES — closer and the
  // external partner roles excluded). Borrower-facing income transparency arrives
  // via Borrower Clarity PR 7's post-decision whitelisted DTO, never these routes.
  // Source guard so a future edit can't quietly re-open them.
  it("calculations.ts gates all six engine endpoints with requireRole(...FINANCIAL_VERIFICATION_ROLES)", () => {
    const source = read("server/routes/underwriting/calculations.ts");
    for (const route of [
      '"/api/loan-applications/:id/calculate-income"',
      '"/api/loan-applications/:id/calculate-assets"',
      '"/api/loan-applications/:id/calculate-liabilities"',
      '"/api/loan-applications/:id/calculate-dti"',
      '"/api/loan-applications/:id/check-property-eligibility"',
      '"/api/loan-applications/:id/calculate-pricing"',
    ]) {
      const at = source.indexOf(route);
      expect(at, `${route} registration not found`).toBeGreaterThan(-1);
      const registration = source.slice(at, at + 200);
      expect(registration, `${route} must be staff-gated`).toContain(
        "requireRole(...FINANCIAL_VERIFICATION_ROLES)",
      );
      expect(registration, `${route} must not sit behind bare isAuthenticated`).not.toContain(
        "isAuthenticated",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Admin-surface structural guards (2026-08-06 role-gate deep dive).
//
// tests/roleSeparation.test.ts drives real HTTP against a hand-picked list of
// admin endpoints. That proves those six are gated; it cannot prove the NEXT
// one will be. These guards are exhaustive instead of exemplary: they walk
// every registration and every route, so an admin surface added without a gate
// fails the build rather than waiting for someone to sign in as the wrong role.
// ---------------------------------------------------------------------------

/** Every `app.get|post|put|patch|delete("<path>", ...)` in server/routes. */
function serverRouteRegistrations(): { file: string; verb: string; path: string; middleware: string }[] {
  const out: { file: string; verb: string; path: string; middleware: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".ts")) {
        const source = read(rel);
        const re = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*("[^"]*"|'[^']*'|`[^`]*`)\s*,([\s\S]{0,240})/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(source))) {
          // Middleware is everything before the handler function begins.
          const middleware = m[3].split(/async\s*\(|\(req/)[0];
          out.push({ file: rel, verb: m[1].toUpperCase(), path: m[2].slice(1, -1), middleware });
        }
      }
    }
  };
  walk("server/routes");
  return out;
}

describe("every /api/admin/* endpoint carries an explicit role gate", () => {
  const adminRoutes = serverRouteRegistrations().filter((r) => r.path.startsWith("/api/admin/"));

  it("finds the admin surface at all (guards against a regex that silently matches nothing)", () => {
    expect(adminRoutes.length).toBeGreaterThan(30);
  });

  it("gates every one — never bare isAuthenticated, never nothing", () => {
    const ungated = adminRoutes
      .filter((r) => !/requireRole\(|isAdmin/.test(r.middleware))
      .map((r) => `${r.verb} ${r.path}  (${r.file})`);
    expect(ungated, `ungated admin endpoints:\n${ungated.join("\n")}`).toEqual([]);
  });

  it("admits a non-admin role on exactly the two reviewed read/refresh endpoints", () => {
    // Widening an admin endpoint to other staff is a deliberate act, not a
    // default. These two were reviewed: the lender-product catalog is internal
    // staff reference data, and the rate refresh is an operational action any
    // internal role may trigger. A third entry appearing here means someone
    // widened the admin surface — re-review it rather than updating this list.
    const widened = adminRoutes
      .filter((r) => {
        const call = r.middleware.match(/requireRole\(([^)]*)\)/)?.[1] ?? "";
        return call.split(",").map((s) => s.trim().replace(/"/g, "")).filter((s) => s && s !== "admin").length > 0;
      })
      .map((r) => `${r.verb} ${r.path}`)
      .sort();
    expect(widened).toEqual([
      "GET /api/admin/lender-products",
      "POST /api/admin/mortgage-rates/refresh",
    ]);
  });
});

describe("every /admin/* client route is wrapped in AdminPage", () => {
  const app = read("client/src/App.tsx");
  const routes = [...app.matchAll(/<Route path="(\/admin(?:\/[^"]*)?)">([\s\S]*?)<\/Route>/g)];

  it("finds the admin routes at all", () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it("uses AdminPage — the only wrapper that gates on ROUTE_GATES.adminOnly", () => {
    for (const [, path, body] of routes) {
      expect(body, `${path} must be wrapped in <AdminPage>`).toContain("<AdminPage>");
    }
  });

  it("AdminPage really is the admin gate", () => {
    expect(app).toMatch(
      /function AdminPage\(\{[^}]*\}[^)]*\)\s*\{\s*return <PrivateLayout requiredRoles=\{ROUTE_GATES\.adminOnly\}>/,
    );
  });
});

describe("admin pages do not re-derive the role gate the route already applied", () => {
  // PrivateLayout renders children ONLY when useAuthGuard returns "authorized",
  // so an in-page `user.role !== "admin"` branch inside an AdminPage route is
  // unreachable. Four pages carried one anyway — three different "Access
  // Denied" designs for a state that cannot occur — while six other admin pages
  // correctly relied on the route gate. That is the split-brain useAuthGuard
  // was created to end (see its header), so it stays ended.
  it("no admin page hand-rolls its own role check", () => {
    const offenders: string[] = [];
    for (const entry of readdirSync(resolve(repoRoot, "client/src/pages/admin"))) {
      if (!entry.endsWith(".tsx") || entry.includes(".test.")) continue;
      const source = read(`client/src/pages/admin/${entry}`);
      if (/role\s*!==\s*"admin"/.test(source)) offenders.push(entry);
    }
    expect(offenders, `these re-derive the gate: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("PartnersHub's client gate mirrors its server API", () => {
  // ROUTE_GATES.partnerHub admitted "cpa" while GET /api/partners/me and
  // /api/partners/me/referrals are requireRole("realtor","admin"). A CPA who
  // reached /partners/hub rendered a page whose every data call 403s. The gate
  // now matches the server, so a CPA is redirected to /cpa-portal instead.
  it("admits exactly the roles the server accepts", () => {
    const server = read("server/routes/partners.ts");
    const at = server.indexOf('app.get("/api/partners/me"');
    expect(at).toBeGreaterThan(-1);
    const serverRoles = (server.slice(at, at + 200).match(/requireRole\(([^)]*)\)/)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/"/g, ""))
      .filter(Boolean)
      .sort();

    expect(serverRoles).toEqual(["admin", "realtor"]);
    expect([...ROUTE_GATES.partnerHub].sort()).toEqual(serverRoles);
  });
});
