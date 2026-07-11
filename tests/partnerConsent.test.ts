import { describe, it, expect, beforeAll } from "vitest";
import { apiGet, BASE_URL } from "./setup";

/**
 * Integration coverage for the PH-2 progress-sharing consent spine.
 *
 * Charter DONE-WHEN, live against the dev server:
 *  - a partner sees a referred borrower as existence-only ("invited") until the
 *    borrower opts in; on opt-in the real masked stage appears; on revoke it
 *    collapses back to "invited" (charter §5-C6)
 *  - a second partner sees nothing of that borrower (scoping)
 *  - the consent is borrower-directed: an unauthenticated caller can't toggle,
 *    and a borrower whose referrer is NOT a partner has no partner to share with
 */

const HTTPS = { "X-Forwarded-Proto": "https" };

function cookieFrom(headers: Headers): string {
  const c = headers.get("set-cookie");
  return c ? c.split(";")[0] : "";
}

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HTTPS, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return res;
}

async function put(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...HTTPS, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function registerRealtor(name: string) {
  const email = `realtor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@brokerage.test`;
  const res = await post("/api/partners/register", {
    persona: "realtor",
    contactName: name,
    firmName: `${name} Homes`,
    email,
    password: "agent-pass-1234",
  });
  const body = await res.json();
  expect(res.status).toBe(201);
  return { cookie: cookieFrom(res.headers), slug: body.partner.referralSlug as string };
}

async function registerConsumer(firstName: string) {
  const email = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const res = await post("/api/auth/register", { email, password: "cust-pass-1234", firstName, lastName: "Ngdata" });
  expect(res.status).toBeLessThan(300);
  return cookieFrom(res.headers);
}

function hubHeaders(cookie: string) {
  return { headers: { Cookie: cookie, ...HTTPS } };
}

describe("PH-2 partner progress-sharing consent", () => {
  let agentA: Awaited<ReturnType<typeof registerRealtor>>;
  let agentB: Awaited<ReturnType<typeof registerRealtor>>;
  let buyer: string;

  beforeAll(async () => {
    agentA = await registerRealtor("Ava");
    agentB = await registerRealtor("Ben");
    buyer = await registerConsumer("Cleo");
    // Attribute the buyer to agent A via the existing referral rail.
    const applied = await post("/api/apply-referral", { referralCode: agentA.slug }, buyer);
    expect(applied.status).toBe(200);
  });

  it("default OFF: the partner sees the borrower as existence-only 'invited', not a real stage", async () => {
    const res = await apiGet("/api/partners/me/referrals", hubHeaders(agentA.cookie));
    expect(res.status).toBe(200);
    const row = res.body.referrals.find((r: any) => r.displayName === "Cleo N.");
    expect(row).toBeTruthy();
    expect(row.shared).toBe(false);
    expect(row.stage).toBe("invited");
  });

  it("the borrower sees their referring partner and default-off sharing", async () => {
    const res = await apiGet("/api/me/referring-partner", hubHeaders(buyer));
    expect(res.status).toBe(200);
    expect(res.body.partner?.firmName).toBe("Ava Homes");
    expect(res.body.shared).toBe(false);
  });

  it("on borrower opt-in the partner gains the real masked stage; revoke collapses it back", async () => {
    const grant = await put("/api/me/referring-partner/consent", { share: true }, buyer);
    expect(grant.status).toBe(200);
    expect(grant.body.shared).toBe(true);

    let res = await apiGet("/api/partners/me/referrals", hubHeaders(agentA.cookie));
    let row = res.body.referrals.find((r: any) => r.displayName === "Cleo N.");
    expect(row.shared).toBe(true);
    expect(row.stage).not.toBe("invited"); // real stage now visible

    const revoke = await put("/api/me/referring-partner/consent", { share: false }, buyer);
    expect(revoke.status).toBe(200);
    expect(revoke.body.shared).toBe(false);

    res = await apiGet("/api/partners/me/referrals", hubHeaders(agentA.cookie));
    row = res.body.referrals.find((r: any) => r.displayName === "Cleo N.");
    expect(row.shared).toBe(false);
    expect(row.stage).toBe("invited");
  });

  it("a second partner sees nothing of that borrower even after consent to the first", async () => {
    await put("/api/me/referring-partner/consent", { share: true }, buyer);
    const res = await apiGet("/api/partners/me/referrals", hubHeaders(agentB.cookie));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.referrals)).not.toContain("Cleo");
    // reset
    await put("/api/me/referring-partner/consent", { share: false }, buyer);
  });

  it("consent is borrower-directed: unauthenticated cannot toggle", async () => {
    const res = await put("/api/me/referring-partner/consent", { share: true });
    expect(res.status).toBe(401);
  });

  it("a borrower with no partner referrer has nothing to share", async () => {
    const orphan = await registerConsumer("Dana");
    const view = await apiGet("/api/me/referring-partner", hubHeaders(orphan));
    expect(view.status).toBe(200);
    expect(view.body.partner).toBeNull();
    const toggle = await put("/api/me/referring-partner/consent", { share: true }, orphan);
    expect(toggle.status).toBe(404);
  });
});
