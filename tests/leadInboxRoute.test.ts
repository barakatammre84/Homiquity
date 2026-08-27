import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROUTE_GATES } from "../client/src/lib/routeGates";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("lead inbox authorization stays aligned", () => {
  it("uses the same internal sales roles as the server", () => {
    expect(ROUTE_GATES.leadOps).toEqual(["admin", "lo", "loa"]);
    const server = read("server/routes/leads.ts");
    expect(server).toContain('const LEAD_STAFF_ROLES = ["admin", "lo", "loa"] as const');
    expect(server).toContain('app.get("/api/leads", requireRole(...LEAD_STAFF_ROLES)');
  });

  it("wires the page through the named route gate and staff navigation", () => {
    expect(read("client/src/App.tsx")).toContain('<PrivateLayout requiredRoles={ROUTE_GATES.leadOps}><LeadInbox /></PrivateLayout>');
    expect(read("client/src/components/app-sidebar.tsx")).toContain('href: "/lead-inbox"');
  });
});
