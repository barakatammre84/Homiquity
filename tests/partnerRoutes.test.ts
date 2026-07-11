import { describe, it, expect, beforeAll } from "vitest";
import { apiGet, apiPost, BASE_URL } from "./setup";

/**
 * Integration coverage for the PartnerHub identity spine (PH-1).
 *
 * Charter §3 invariants under test, live against the dev server:
 *  - realtor registration allocates a slug on BOTH rails (partner_profiles +
 *    users.referral_code) and the existing /api/apply-referral attribution works
 *  - /api/p/:slug returns branding ONLY (no email/license/referral data)
 *  - referral views are scoped to the calling partner (no cross-partner reads)
 *  - a partner role reaches NO staff, admin, or CPA surface (IDOR negatives)
 *  - the admin queue can license-review and suspend; suspension kills the slug
 *  - waitlist invite stamps invited_at
 *
 * Uses the dev test-login accounts (DEV_TEST_PASSWORD) for the admin leg; the
 * session cookie is secure-only, so every request sends X-Forwarded-Proto: https.
 */

const TEST_PASSWORD = process.env.DEV_TEST_PASSWORD || "test1234";
const HTTPS = { "X-Forwarded-Proto": "https" };

function cookieFrom(headers: Headers): string {
  const setCookie = headers.get("set-cookie");
  return setCookie ? setCookie.split(";")[0] : "";
}

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HTTPS },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  expect(res.status, `test-login as ${email}`).toBe(200);
  const cookie = cookieFrom(res.headers);
  expect(cookie, `session cookie for ${email}`).toBeTruthy();
  return cookie;
}

async function registerRealtor(contactName: string, firmName: string) {
  const email = `realtor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@brokerage.test`;
  const res = await fetch(`${BASE_URL}/api/partners/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HTTPS },
    body: JSON.stringify({
      persona: "realtor",
      contactName,
      firmName,
      email,
      password: "agent-pass-1234",
      licenseNumber: "475.000111",
      licenseState: "IL",
    }),
  });
  const body = await res.json().catch(() => null);
  expect(res.status, `realtor register ${contactName}`).toBe(201);
  return { cookie: cookieFrom(res.headers), partner: body.partner as { id: string; referralSlug: string; referralLink: string } };
}

async function registerConsumer(): Promise<string> {
  const email = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HTTPS },
    body: JSON.stringify({ email, password: "client-pass-1234", firstName: "Riley", lastName: "Client" }),
  });
  expect(res.status).toBeLessThan(300);
  return cookieFrom(res.headers);
}

describe("PartnerHub identity spine (PH-1)", () => {
  let agentA: Awaited<ReturnType<typeof registerRealtor>>;
  let agentB: Awaited<ReturnType<typeof registerRealtor>>;

  beforeAll(async () => {
    agentA = await registerRealtor("Alpha Agent", "Alpha Homes");
    agentB = await registerRealtor("Beta Agent", "Beta Brokerage");
  });

  it("registration returns a /p/ referral link with a users.referral_code-sized slug", () => {
    expect(agentA.partner.referralSlug).toMatch(/^[A-Z0-9-]+-\d{4}$/);
    expect(agentA.partner.referralSlug.length).toBeLessThanOrEqual(20);
    expect(agentA.partner.referralLink).toContain(`/p/${agentA.partner.referralSlug}`);
  });

  it("rejects non-realtor personas and malformed input", async () => {
    const bad = await apiPost(
      "/api/partners/register",
      { persona: "cpa", contactName: "X", firmName: "Y", email: "x@y.test", password: "12345678" },
      { headers: HTTPS },
    );
    expect(bad.status).toBe(400);
    const weak = await apiPost(
      "/api/partners/register",
      { persona: "realtor", contactName: "X", firmName: "Y", email: "not-an-email", password: "short" },
      { headers: HTTPS },
    );
    expect(weak.status).toBe(400);
  });

  it("public slug lookup returns branding only — no email, license, or referral data", async () => {
    const res = await apiGet(`/api/p/${agentA.partner.referralSlug}`, { headers: HTTPS });
    expect(res.status).toBe(200);
    expect(res.body.firmName).toBe("Alpha Homes");
    // Exact key set: branding + the (public-by-design) slug, nothing else —
    // no email, no license identifiers, no referral rows, no user ids.
    expect(Object.keys(res.body).sort()).toEqual(
      ["displayName", "firmName", "persona", "referralSlug", "valid"],
    );
    expect(JSON.stringify(res.body)).not.toContain("@");
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await apiGet("/api/p/NOPE-0000", { headers: HTTPS });
    expect(res.status).toBe(404);
  });

  it("attributes a consumer via the existing apply-referral rail, visible only to the referring agent", async () => {
    const clientCookie = await registerConsumer();
    const applied = await apiPost(
      "/api/apply-referral",
      { referralCode: agentA.partner.referralSlug },
      { headers: { Cookie: clientCookie, ...HTTPS } },
    );
    expect(applied.status).toBe(200);

    const mineA = await apiGet("/api/partners/me/referrals", { headers: { Cookie: agentA.cookie, ...HTTPS } });
    expect(mineA.status).toBe(200);
    expect(mineA.body.referrals.length).toBeGreaterThanOrEqual(1);
    const names = JSON.stringify(mineA.body.referrals);
    // Privacy-minimized projection: first name + last initial, no emails.
    expect(names).toContain("Riley C.");
    expect(names).not.toContain("@");

    // Scoping: agent B must NOT see agent A's referral.
    const mineB = await apiGet("/api/partners/me/referrals", { headers: { Cookie: agentB.cookie, ...HTTPS } });
    expect(mineB.status).toBe(200);
    expect(JSON.stringify(mineB.body.referrals)).not.toContain("Riley C.");
  });

  it("a consumer cannot reach partner surfaces", async () => {
    const clientCookie = await registerConsumer();
    const me = await apiGet("/api/partners/me", { headers: { Cookie: clientCookie, ...HTTPS } });
    expect(me.status).toBe(403);
  });

  it("a realtor reaches NO staff, admin, or CPA surface (partner ≠ staff)", async () => {
    const h = { headers: { Cookie: agentA.cookie, ...HTTPS } };
    expect((await apiGet("/api/admin/partners", h)).status).toBe(403);
    expect((await apiGet("/api/admin/partner-waitlist", h)).status).toBe(403);
    expect((await apiGet("/api/broker/referrals", h)).status).toBe(403);
    expect((await apiGet("/api/cpa/referrals", h)).status).toBe(403);
    expect((await apiGet("/api/analytics/pipeline", h)).status).toBe(403);
  });

  it("a realtor CANNOT reach the LO referral rail that joins full borrower rows (security-review fix)", async () => {
    // The realtor's slug attributes buyers via users.referred_by_user_id — the
    // same column /api/my-referrals reads. That endpoint joins full users rows +
    // loan applications, so an inviter-only partner must be refused here and use
    // the minimized /api/partners/me/referrals instead.
    const h = { headers: { Cookie: agentA.cookie, ...HTTPS } };
    expect((await apiGet("/api/my-referrals", h)).status).toBe(403);
    expect((await apiGet("/api/my-referral-stats", h)).status).toBe(403);
  });

  it("admin queue lists the realtor; license review and suspension work; suspension kills the slug", async () => {
    const adminCookie = await loginAs("admin@test.com");
    const h = { headers: { Cookie: adminCookie, ...HTTPS } };

    const list = await apiGet("/api/admin/partners", h);
    expect(list.status).toBe(200);
    const row = list.body.partners.find((p: any) => p.id === agentA.partner.id);
    expect(row).toBeTruthy();
    expect(row.licenseVerificationStatus).toBe("pending_review");

    const verified = await apiPost(`/api/admin/partners/${agentA.partner.id}/license-review`, { decision: "verified" }, h);
    expect(verified.status).toBe(200);
    expect(verified.body.partner.licenseVerificationStatus).toBe("verified");

    const suspended = await apiPost(`/api/admin/partners/${agentA.partner.id}/status`, { status: "suspended" }, h);
    expect(suspended.status).toBe(200);
    const deadSlug = await apiGet(`/api/p/${agentA.partner.referralSlug}`, { headers: HTTPS });
    expect(deadSlug.status).toBe(404);
<<<<<<< HEAD
    // Suspension takes effect on the read side too: the hub pipeline is refused.
    const suspendedHub = await apiGet("/api/partners/me/referrals", { headers: { Cookie: agentA.cookie, ...HTTPS } });
    expect(suspendedHub.status).toBe(403);
=======
>>>>>>> origin/main

    const reactivated = await apiPost(`/api/admin/partners/${agentA.partner.id}/status`, { status: "active" }, h);
    expect(reactivated.status).toBe(200);
    const liveSlug = await apiGet(`/api/p/${agentA.partner.referralSlug}`, { headers: HTTPS });
    expect(liveSlug.status).toBe(200);
<<<<<<< HEAD
    const liveHub = await apiGet("/api/partners/me/referrals", { headers: { Cookie: agentA.cookie, ...HTTPS } });
    expect(liveHub.status).toBe(200);
=======
>>>>>>> origin/main
  });

  it("waitlist invite stamps invited_at and reports email delivery honestly", async () => {
    const email = `waitlist-${Date.now()}@brokerage.test`;
    const joined = await apiPost(
      "/api/partner-waitlist",
      { name: "Waity Agent", email, partnerType: "real_estate_agent", company: "Wait Homes" },
      { headers: HTTPS },
    );
    expect(joined.status).toBeLessThan(300);

    const adminCookie = await loginAs("admin@test.com");
    const h = { headers: { Cookie: adminCookie, ...HTTPS } };
    const rows = await apiGet("/api/admin/partner-waitlist", h);
    const row = rows.body.find((r: any) => r.email === email);
    expect(row).toBeTruthy();
    expect(row.invitedAt).toBeNull();

    const invited = await apiPost(`/api/admin/partner-waitlist/${row.id}/invite`, {}, h);
    expect(invited.status).toBe(200);
    expect(invited.body.invited).toBe(true);
    expect(invited.body.invitedAt).toBeTruthy();
    expect(typeof invited.body.emailSent).toBe("boolean");
  });
});
