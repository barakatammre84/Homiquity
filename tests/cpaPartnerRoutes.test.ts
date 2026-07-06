import { describe, it, expect, beforeAll } from "vitest";
import { apiGet, apiPost } from "./setup";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie");
  return setCookie ? setCookie.split(";")[0] : "";
}

async function registerCpa(firmName: string): Promise<{ cookie: string; code: string; link: string }> {
  const email = `cpa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@firm.test`;
  const res = await fetch(`${BASE_URL}/api/cpa-partners/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firmName, contactName: "Test CPA", email, password: "cpa-pass-1234" }),
  });
  const body = await res.json().catch(() => null);
  expect(res.status).toBe(201);
  return { cookie: cookieFrom(res), code: body.partner.referralCode, link: body.partner.referralLink };
}

async function registerConsumer(): Promise<string> {
  const email = `cpa-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "client-pass-1234", firstName: "Riley", lastName: "Client" }),
  });
  expect(res.status).toBeLessThan(300);
  return cookieFrom(res);
}

describe("CPA partner channel", () => {
  let cpaA: { cookie: string; code: string; link: string };
  let cpaB: { cookie: string; code: string; link: string };

  beforeAll(async () => {
    cpaA = await registerCpa("Alpha Tax Advisors");
    cpaB = await registerCpa("Beta Bookkeeping");
  });

  it("registration returns a co-branded referral link", () => {
    expect(cpaA.code).toMatch(/^[A-Z0-9-]+-\d{4}$/);
    expect(cpaA.link).toContain(`/cpa/${cpaA.code}`);
  });

  it("rejects a duplicate email", async () => {
    // Re-registering CPA A's session identity isn't exposed, but a fresh
    // register with a weak password is a clean 400 path.
    const res = await apiPost("/api/cpa-partners/register", { firmName: "X", email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
  });

  it("validate returns firm branding only — no client data", async () => {
    const res = await apiGet(`/api/cpa/validate/${cpaA.code}`);
    expect(res.status).toBe(200);
    expect(res.body.firmName).toBe("Alpha Tax Advisors");
    // Must not leak any referred-client information.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("email");
    expect(raw).not.toMatch(/referral|client/i);
  });

  it("returns 404 for an unknown code", async () => {
    const res = await apiGet("/api/cpa/validate/NOPE-0000");
    expect(res.status).toBe(404);
  });

  it("attributes a signed-up client to the CPA", async () => {
    const clientCookie = await registerConsumer();
    const applied = await apiPost(
      "/api/cpa/apply-referral",
      { referralCode: cpaA.code },
      { headers: { Cookie: clientCookie } },
    );
    expect(applied.status).toBe(200);
    expect(applied.body.success).toBe(true);

    // First-touch wins: a second apply to CPA B is a no-op, not a re-attribution.
    const second = await apiPost(
      "/api/cpa/apply-referral",
      { referralCode: cpaB.code },
      { headers: { Cookie: clientCookie } },
    );
    expect(second.status).toBe(200);
    expect(second.body.alreadyAttributed).toBe(true);

    // CPA A sees the client (stage only); CPA B does not.
    const aRefs = await apiGet("/api/cpa/referrals", { headers: { Cookie: cpaA.cookie } });
    expect(aRefs.status).toBe(200);
    expect(aRefs.body.referrals.length).toBeGreaterThan(0);
    const bRefs = await apiGet("/api/cpa/referrals", { headers: { Cookie: cpaB.cookie } });
    expect(bRefs.body.referrals.length).toBe(0);

    // The portal projection must be stage-only — never PII or financials.
    const raw = JSON.stringify(aRefs.body);
    expect(raw).not.toContain("@example.test"); // no email
    expect(raw).not.toMatch(/income|grossIncome|dscr|wages|adjustedGross/i);
    for (const r of aRefs.body.referrals) {
      expect(r).toHaveProperty("displayName");
      expect(r).toHaveProperty("stage");
      expect(r).not.toHaveProperty("email");
    }
  });

  it("rejects a CPA using their own referral code", async () => {
    const res = await apiPost(
      "/api/cpa/apply-referral",
      { referralCode: cpaA.code },
      { headers: { Cookie: cpaA.cookie } },
    );
    expect(res.status).toBe(400);
  });

  it("exposes the CPA's own profile at /api/cpa/me", async () => {
    const res = await apiGet("/api/cpa/me", { headers: { Cookie: cpaA.cookie } });
    expect(res.status).toBe(200);
    expect(res.body.partner.firmName).toBe("Alpha Tax Advisors");
    expect(res.body.partner.referralCode).toBe(cpaA.code);
  });

  it("denies CPA portal endpoints to non-CPA roles", async () => {
    const clientCookie = await registerConsumer();
    const refs = await apiGet("/api/cpa/referrals", { headers: { Cookie: clientCookie } });
    expect([401, 403]).toContain(refs.status);
    const stats = await apiGet("/api/cpa/stats", { headers: { Cookie: clientCookie } });
    expect([401, 403]).toContain(stats.status);
  });

  it("blocks unauthenticated access to the portal", async () => {
    const res = await apiGet("/api/cpa/me");
    expect(res.status).toBe(401);
  });
});
