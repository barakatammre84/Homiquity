import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// H8 regression (knowledge-base/logs/lo-audit/2026-07-04.md): the MISMO 3.4 export embeds the
// full SSN (TaxpayerIdentifierValue) and DOB, so the route must be internal-
// staff-only. broker/lender are external partners and must get 403 even when
// authenticated — GSE delivery is not a partner-facing action.
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

async function getWithSession(path: string, cookie: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { Cookie: cookie, ...HTTPS_PROXY_HEADER },
  });
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") };
}

describe("MISMO export role gate (H8)", () => {
  it("rejects an authenticated broker with 403 before any data is fetched", async () => {
    const cookie = await loginAs("broker@test.com");
    const res = await getWithSession(
      "/api/loan-applications/00000000-0000-0000-0000-000000000000/mismo-export",
      cookie,
    );
    expect(res.status).toBe(403);
    expect(res.text).not.toContain("TaxpayerIdentifierValue");
  });

  it("rejects an authenticated lender with 403 before any data is fetched", async () => {
    const cookie = await loginAs("lender@test.com");
    const res = await getWithSession(
      "/api/loan-applications/00000000-0000-0000-0000-000000000000/mismo-export",
      cookie,
    );
    expect(res.status).toBe(403);
    expect(res.text).not.toContain("TaxpayerIdentifierValue");
  });

  it("rejects an authenticated borrower client with 403", async () => {
    const cookie = await loginAs("buyer@test.com");
    const res = await getWithSession(
      "/api/loan-applications/00000000-0000-0000-0000-000000000000/mismo-export",
      cookie,
    );
    expect(res.status).toBe(403);
  });

  // Needs a borrower file with a VAULTED SSN, which `pnpm db:seed` does not
  // create — so on a freshly-provisioned database (CI, a preview branch, a new
  // environment) this assertion cannot distinguish "the staff export is
  // over-masked" from "there was no SSN to export". A skip is the honest answer
  // to that; a pass would be the guard-with-no-artifact trap (routines/LESSONS.md
  // 2026-08-12), and a fail would be a red gate reporting a fixture gap as a
  // regression.
  //
  // It runs wherever the data exists: set INTEGRATION_FULL_FIXTURES=true against
  // a database that has one (the shared dev DB does). TICKET: seed a synthetic
  // vaulted SSN so this role gate — the route that embeds full SSN and DOB — is
  // provable on every PR. Until then the three 403 cases above DO run in CI, so
  // the deny half of H8 is covered and only the allow half is not.
  it.skipIf(process.env.INTEGRATION_FULL_FIXTURES !== "true")("still serves the full GSE XML (real SSN element) to internal staff", async (ctx) => {
    const cookie = await loginAs("admin@test.com");
    const apps = await getWithSession("/api/staff/applications", cookie);
    expect(apps.status).toBe(200);
    const list = JSON.parse(apps.text) as Array<{ id: string }>;
    if (list.length === 0) {
      ctx.skip(); // empty DB — the partner-rejection tests above still ran
      return;
    }

    // Not every seeded application has an SSN on file (the element is omitted
    // when absent), so scan for one that does before asserting it survives.
    let sawSsn = false;
    for (const app of list) {
      const res = await getWithSession(`/api/loan-applications/${app.id}/mismo-export`, cookie);
      expect(res.status).toBe(200);
      expect(res.contentType).toContain("application/xml");
      expect(res.text).toContain("<MESSAGE");
      if (res.text.includes("TaxpayerIdentifierValue")) {
        sawSsn = true;
        break;
      }
    }
    expect(sawSsn, "no application produced a TaxpayerIdentifierValue — staff export may be over-masked").toBe(true);
  });
});
