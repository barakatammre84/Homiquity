import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// Rate-lock desk contract tests.
//
// GET /api/rate-locks/expiring backs the LO Command Center's expiring-locks
// alert strip. It must stay:
//   1. internal-staff-only (broker/lender/borrower get 403);
//   2. deal-team-scoped for non-admin staff — an LO's expiring locks are a
//      subset of the platform-wide admin view (the scoping added alongside the
//      getActiveRateLock/getExpiringRateLocks "extended"-status fix);
//   3. returning only *live* locks (active OR extended) inside the window — the
//      regression guard: an earlier bug matched status="active" only, so an
//      extended lock silently dropped out of the expiring-alerts query.
//
// Uses the dev test-login accounts (DEV_TEST_PASSWORD). The session cookie is
// secure-only, so every request sends X-Forwarded-Proto: https.
// ---------------------------------------------------------------------------

const TEST_PASSWORD = process.env.DEV_TEST_PASSWORD || "test1234";
const HTTPS_PROXY_HEADER = { "X-Forwarded-Proto": "https" };

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...HTTPS_PROXY_HEADER },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  expect(res.status, `test-login as ${email}`).toBe(200);
  const setCookie = res.headers.get("set-cookie");
  expect(setCookie, `session cookie for ${email}`).toBeTruthy();
  return setCookie!.split(";")[0];
}

async function getExpiring(cookie: string) {
  const res = await fetch(`${BASE_URL}/api/rate-locks/expiring`, {
    method: "GET",
    headers: { Cookie: cookie, ...HTTPS_PROXY_HEADER },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

interface ExpiringLock {
  id: string;
  applicationId: string;
  status: string;
  expiresAt: string;
}

describe("rate-lock expiring role gate", () => {
  it("rejects an authenticated broker with 403", async () => {
    const { status } = await getExpiring(await loginAs("broker@test.com"));
    expect(status).toBe(403);
  });

  it("rejects an authenticated lender with 403", async () => {
    const { status } = await getExpiring(await loginAs("lender@test.com"));
    expect(status).toBe(403);
  });

  it("rejects an authenticated borrower with 403", async () => {
    const { status } = await getExpiring(await loginAs("buyer@test.com"));
    expect(status).toBe(403);
  });
});

describe("rate-lock expiring scoping + live-status contract", () => {
  it("scopes a loan officer to a subset of the admin (platform-wide) view", async () => {
    const loCookie = await loginAs("lo@test.com");
    const adminCookie = await loginAs("admin@test.com");

    const loRes = await getExpiring(loCookie);
    const adminRes = await getExpiring(adminCookie);
    expect(loRes.status).toBe(200);
    expect(adminRes.status).toBe(200);

    const loLocks: ExpiringLock[] = loRes.body;
    const adminLocks: ExpiringLock[] = adminRes.body;
    expect(Array.isArray(loLocks)).toBe(true);
    expect(Array.isArray(adminLocks)).toBe(true);

    // The LO's view must be a subset of the platform-wide (admin) view: a lock
    // visible to the LO that the admin cannot see would mean the two scoping
    // paths disagree about what exists.
    const adminAppIds = new Set(adminLocks.map((l) => l.applicationId));
    for (const lock of loLocks) {
      expect(adminAppIds.has(lock.applicationId), `LO sees lock on ${lock.applicationId} that admin cannot`).toBe(true);
    }

    // Every returned lock is live (active OR extended) and inside the 7-day
    // window — the "extended"-status regression guard.
    const now = Date.now();
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    for (const lock of adminLocks) {
      expect(["active", "extended"], `unexpected status ${lock.status}`).toContain(lock.status);
      const untilMs = new Date(lock.expiresAt).getTime() - now;
      expect(untilMs, `lock ${lock.id} must be within the expiry window`).toBeLessThanOrEqual(windowMs + 60_000);
    }
  });
});
