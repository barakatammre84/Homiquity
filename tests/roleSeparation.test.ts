import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// Role-separation regression suite (2026-07-11 access-control audit).
//
// Asserts the tool boundaries between the user populations:
//   admin · internal staff (lo/loa/processor/underwriter/closer) ·
//   external partners (broker/lender) · cpa · consumers (buyer/renter)
//
// Server-side gates are the security layer (authorization is never done by
// hiding UI), so these tests hit the HTTP surface directly:
//   1. /api/admin/* is admin-only — including the content-management routes
//      that historically also admitted "lo".
//   2. Internal operations endpoints reject partners and consumers.
//   3. Policy/pricing governance is admin+underwriter only.
//   4. Agent/co-brand/listing tooling cannot be self-provisioned by consumer
//      or CPA accounts (GET /api/me/agent-profile used to auto-create an
//      agent profile for ANY authenticated session).
//   5. CPAs reach only their own portal lane.
//   6. Deal-rescue updates enforce object-level ownership (reporter or
//      internal staff), not just role membership.
//
// Uses the dev test-login accounts (DEV_TEST_PASSWORD). The session cookie is
// secure-only, so every request sends X-Forwarded-Proto: https. Mutating
// requests also send an Origin header so the suite passes the CSRF check even
// against a production-mode server.
// ---------------------------------------------------------------------------

const TEST_PASSWORD = process.env.DEV_TEST_PASSWORD || "test1234";
const BASE_HEADERS = { "X-Forwarded-Proto": "https", Origin: BASE_URL };

// One login per account for the whole file — sessions are reusable, and
// hammering /api/test-login trips the auth rate limiter (429) even under
// RATE_LIMIT_RELAXED headroom.
const sessionCache = new Map<string, Promise<string>>();

function loginAs(email: string): Promise<string> {
  let session = sessionCache.get(email);
  if (!session) {
    session = (async () => {
      const res = await fetch(`${BASE_URL}/api/test-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...BASE_HEADERS },
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      });
      expect(res.status, `test-login as ${email}`).toBe(200);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie, `session cookie for ${email}`).toBeTruthy();
      return setCookie!.split(";")[0];
    })();
    sessionCache.set(email, session);
  }
  return session;
}

async function send(
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...BASE_HEADERS,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body (e.g. empty 204) — callers only assert on status then
  }
  return { status: res.status, json, text };
}

describe("admin surface is admin-only", () => {
  it("rejects every non-admin role on the core admin endpoints", async () => {
    for (const email of [
      "lo@test.com",
      "broker@test.com",
      "lender@test.com",
      "cpa@test.com",
      "buyer@test.com",
    ]) {
      const cookie = await loginAs(email);
      for (const path of ["/api/admin/stats", "/api/admin/users", "/api/admin/applications"]) {
        const res = await send("GET", path, cookie);
        expect(res.status, `${email} on ${path}`).toBe(403);
      }
    }
  });

  it("rejects a loan officer on the admin content-management routes (regression: used to admit lo)", async () => {
    const cookie = await loginAs("lo@test.com");
    for (const path of [
      "/api/admin/articles",
      "/api/admin/faqs",
      "/api/admin/content-categories",
    ]) {
      const res = await send("GET", path, cookie);
      expect(res.status, `lo on ${path}`).toBe(403);
    }
  });

  it("still serves the admin", async () => {
    const cookie = await loginAs("admin@test.com");
    const res = await send("GET", "/api/admin/stats", cookie);
    expect(res.status).toBe(200);
  });
});

describe("internal operations reject partners and consumers", () => {
  const INTERNAL_ONLY = [
    "/api/staff/applications",
    "/api/staff/users",
    "/api/pipeline/queue",
    "/api/analytics/pipeline",
  ];

  it.each(["broker@test.com", "lender@test.com", "cpa@test.com", "buyer@test.com"])(
    "%s gets 403 on internal staff endpoints",
    async (email) => {
      const cookie = await loginAs(email);
      for (const path of INTERNAL_ONLY) {
        const res = await send("GET", path, cookie);
        expect(res.status, `${email} on ${path}`).toBe(403);
      }
    },
  );

  it("still serves internal staff (lo)", async () => {
    const cookie = await loginAs("lo@test.com");
    const res = await send("GET", "/api/staff/applications", cookie);
    expect(res.status).toBe(200);
  });
});

describe("policy/pricing governance is admin+underwriter only", () => {
  const GOVERNANCE = ["/api/policy-profiles", "/api/lookup-matrices", "/api/task-engine/metrics"];

  it.each(["lo@test.com", "closer@test.com", "broker@test.com", "buyer@test.com"])(
    "%s gets 403 on governance endpoints",
    async (email) => {
      const cookie = await loginAs(email);
      for (const path of GOVERNANCE) {
        const res = await send("GET", path, cookie);
        expect(res.status, `${email} on ${path}`).toBe(403);
      }
    },
  );

  it("still serves an underwriter", async () => {
    const cookie = await loginAs("underwriter@test.com");
    const res = await send("GET", "/api/policy-profiles", cookie);
    expect(res.status).toBe(200);
  });
});

describe("agent/partner tooling cannot be self-provisioned by consumers", () => {
  it.each(["buyer@test.com", "renter@test.com", "cpa@test.com"])(
    "%s cannot mint an agent profile, co-brand page, or listing",
    async (email) => {
      const cookie = await loginAs(email);

      // The GET used to auto-create an agent profile for any session.
      const profileGet = await send("GET", "/api/me/agent-profile", cookie);
      expect(profileGet.status, `${email} GET agent-profile`).toBe(403);

      const profilePatch = await send("PATCH", "/api/me/agent-profile", cookie, {
        agencyName: "Should Not Exist Realty",
      });
      expect(profilePatch.status, `${email} PATCH agent-profile`).toBe(403);

      // Co-brand profiles render on the public /partner/:profileId page.
      const coBrand = await send("POST", "/api/co-brand/profile", cookie, {
        brandName: "Should Not Exist Brand",
      });
      expect(coBrand.status, `${email} POST co-brand`).toBe(403);

      // Listings appear in the public property search.
      const listing = await send("POST", "/api/properties", cookie, {
        address: "1 Nowhere Ln",
        city: "Chicago",
        state: "IL",
        zipCode: "60601",
        price: "500000",
        propertyType: "single_family",
      });
      expect(listing.status, `${email} POST properties`).toBe(403);
    },
  );

  it("still serves staff/partner roles (broker keeps agent tooling)", async () => {
    const cookie = await loginAs("broker@test.com");
    const res = await send("GET", "/api/me/agent-profile", cookie);
    expect(res.status).toBe(200);
  });
});

describe("cpa lane is exactly the cpa portal", () => {
  it("cpa passes the role gate on its own portal endpoints", async () => {
    const cookie = await loginAs("cpa@test.com");
    for (const path of ["/api/cpa/me", "/api/cpa/stats"]) {
      const res = await send("GET", path, cookie);
      // 200 with a registered cpa_partners row, domain 404 without one — either
      // way the requireRole("cpa","admin") gate admitted the CPA (never 401/403).
      expect([200, 404], `cpa on ${path} (got ${res.status})`).toContain(res.status);
    }
  });

  it("cpa is rejected from staff-wide surfaces", async () => {
    const cookie = await loginAs("cpa@test.com");
    for (const path of ["/api/available-staff", "/api/deal-rescue", "/api/broker/referrals"]) {
      const res = await send("GET", path, cookie);
      expect(res.status, `cpa on ${path}`).toBe(403);
    }
  });

  it("consumers cannot read the cpa portal", async () => {
    const cookie = await loginAs("buyer@test.com");
    const res = await send("GET", "/api/cpa/me", cookie);
    expect(res.status).toBe(403);
  });
});

describe("deal-rescue updates enforce object-level ownership", () => {
  it("only the reporter or internal staff may update an escalation", async () => {
    // A broker (external partner, staff role) reports an escalation…
    const brokerCookie = await loginAs("broker@test.com");
    const created = await send("POST", "/api/deal-rescue", brokerCookie, {
      issueType: "financing_gap",
      subject: "Role-separation regression fixture",
      description: "Created by tests/roleSeparation.test.ts — safe to resolve.",
      urgency: "low",
    });
    expect(created.status, "broker creates escalation").toBe(201);
    const id = created.json?.id as string;
    expect(id, "escalation id").toBeTruthy();

    // …a different external partner must NOT be able to touch it…
    const lenderCookie = await loginAs("lender@test.com");
    const lenderPut = await send("PUT", `/api/deal-rescue/${id}`, lenderCookie, {
      status: "resolved",
    });
    expect(lenderPut.status, "lender updating someone else's escalation").toBe(403);

    // …a consumer is stopped at the staff gate…
    const buyerCookie = await loginAs("buyer@test.com");
    const buyerPut = await send("PUT", `/api/deal-rescue/${id}`, buyerCookie, {
      status: "resolved",
    });
    expect(buyerPut.status, "consumer updating an escalation").toBe(403);

    // …internal staff work the whole queue…
    const loCookie = await loginAs("lo@test.com");
    const loPut = await send("PUT", `/api/deal-rescue/${id}`, loCookie, {
      status: "in_progress",
    });
    expect(loPut.status, "internal staff working the escalation").toBe(200);

    // …and the reporter keeps access to their own record (cleanup: resolve it).
    const brokerPut = await send("PUT", `/api/deal-rescue/${id}`, brokerCookie, {
      status: "resolved",
      resolution: "Test fixture resolved.",
    });
    expect(brokerPut.status, "reporter updating their own escalation").toBe(200);
  });

  it("strategy-session updates check the object before writing", async () => {
    // Staff gate first: consumers never reach the object lookup.
    const buyerCookie = await loginAs("buyer@test.com");
    const buyerPut = await send(
      "PUT",
      "/api/strategy-sessions/00000000-0000-0000-0000-000000000000",
      buyerCookie,
      { status: "completed" },
    );
    expect(buyerPut.status).toBe(403);

    // Staff pass the role gate but a missing session 404s (fetch-before-write).
    const lenderCookie = await loginAs("lender@test.com");
    const lenderPut = await send(
      "PUT",
      "/api/strategy-sessions/00000000-0000-0000-0000-000000000000",
      lenderCookie,
      { status: "completed" },
    );
    expect(lenderPut.status).toBe(404);
  });
});
