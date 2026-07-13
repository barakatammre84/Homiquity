import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// Change-of-circumstance route contract tests (TRID, Reg Z §1026.19(e)).
//
// Staff record a §1026.19(e)(3)(iv) changed circumstance; the server computes
// the 3-business-day revised-LE due date (§1026.19(e)(4)(i)). These tests pin
// the contract: staff-only gates, validation before lookup, future-date
// rejection, and 404 on unknown application. The full record → overdue →
// submission-block → borrower-retrieval-stamps loop is exercised in dev
// verification (needs a seeded file + LE retrieval as the borrower).
// ---------------------------------------------------------------------------

const TEST_PASSWORD = process.env.DEV_TEST_PASSWORD || "test1234";
const HTTPS = { "X-Forwarded-Proto": "https" };
const JSON_HTTPS = { "Content-Type": "application/json", ...HTTPS };

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: JSON_HTTPS,
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  expect(res.status, `test-login as ${email}`).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

const COC_PATH = (appId: string) => `${BASE_URL}/api/loan-applications/${appId}/change-of-circumstances`;

const VALID_BODY = JSON.stringify({
  reasonType: "changed_circumstance_settlement",
  description: "Title company corrected the recording fee after county schedule change.",
});

describe("change-of-circumstance routes — contract", () => {
  it("rejects borrowers and external partner roles on record + list (staff-only)", async () => {
    for (const email of ["buyer@test.com", "broker@test.com", "lender@test.com"]) {
      const cookie = await loginAs(email);
      const post = await fetch(COC_PATH("any-app"), {
        method: "POST",
        headers: { ...JSON_HTTPS, Cookie: cookie },
        body: VALID_BODY,
      });
      expect(post.status, `${email} POST must be rejected`).toBe(403);
      const list = await fetch(COC_PATH("any-app"), { headers: { Cookie: cookie, ...HTTPS } });
      expect(list.status, `${email} GET must be rejected`).toBe(403);
    }
  });

  it("validates the payload before any lookup (400 on garbage even with an unknown id)", async () => {
    const lo = await loginAs("lo@test.com");
    for (const body of [
      JSON.stringify({}),
      JSON.stringify({ reasonType: "not_a_reason", description: "x" }),
      JSON.stringify({ reasonType: "rate_lock", description: "" }),
    ]) {
      const res = await fetch(COC_PATH("unknown-app"), {
        method: "POST",
        headers: { ...JSON_HTTPS, Cookie: lo },
        body,
      });
      expect(res.status).toBe(400);
    }
  });

  it("rejects a future informationReceivedAt (the clock cannot start in the future)", async () => {
    const lo = await loginAs("lo@test.com");
    const res = await fetch(COC_PATH("unknown-app"), {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: lo },
      body: JSON.stringify({
        reasonType: "rate_lock",
        description: "Lock executed.",
        informationReceivedAt: "2099-01-01T00:00:00Z",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("404s an unknown application for staff with a valid payload", async () => {
    const lo = await loginAs("lo@test.com");
    const res = await fetch(COC_PATH("00000000-0000-0000-0000-000000000000"), {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: lo },
      body: VALID_BODY,
    });
    expect(res.status).toBe(404);
  });
});
