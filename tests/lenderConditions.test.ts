import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// Lender-condition tracker contract tests (broker-bottleneck B3).
//
// Wholesale-lender conditions are transcribed by staff against a submission
// (POST /api/loan-applications/:id/lender-submissions/:submissionId/conditions)
// and land in loan_conditions with category "lender_condition", so they ride
// the existing conditions surfaces; clearing stays on PATCH /api/conditions/:id.
//
// These tests pin the route contract: staff-only role gate, validation before
// any lookup, and 404 on unknown ids. The full log → rollup → clear → hint
// loop requires a submittable file (readiness-gated), so it is exercised in
// dev verification against a seeded demo file, not here.
//
// Uses the dev test-login accounts (DEV_TEST_PASSWORD). The session cookie is
// secure-only, so every request sends X-Forwarded-Proto: https.
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

const CONDITIONS_PATH = (appId: string, submissionId: string) =>
  `${BASE_URL}/api/loan-applications/${appId}/lender-submissions/${submissionId}/conditions`;

const VALID_BODY = JSON.stringify({
  conditions: [{ title: "Updated homeowners insurance binder" }],
});

describe("lender-condition logging — route contract", () => {
  it("rejects borrowers and external partner roles (staff-only, same gate as the submission routes)", async () => {
    for (const email of ["buyer@test.com", "broker@test.com", "lender@test.com"]) {
      const cookie = await loginAs(email);
      const res = await fetch(CONDITIONS_PATH("any-app", "any-submission"), {
        method: "POST",
        headers: { ...JSON_HTTPS, Cookie: cookie },
        body: VALID_BODY,
      });
      expect(res.status, `${email} must be rejected`).toBe(403);
    }
  });

  it("validates the payload before any lookup (400 on garbage even with unknown ids)", async () => {
    const lo = await loginAs("lo@test.com");
    for (const body of [
      JSON.stringify({}),
      JSON.stringify({ conditions: [] }),
      JSON.stringify({ conditions: [{ title: "" }] }),
      JSON.stringify({ conditions: [{ title: "x", priority: "not_a_priority" }] }),
    ]) {
      const res = await fetch(CONDITIONS_PATH("unknown-app", "unknown-submission"), {
        method: "POST",
        headers: { ...JSON_HTTPS, Cookie: lo },
        body,
      });
      expect(res.status).toBe(400);
    }
  });

  it("404s an unknown application for staff with a valid payload", async () => {
    const lo = await loginAs("lo@test.com");
    const res = await fetch(CONDITIONS_PATH("00000000-0000-0000-0000-000000000000", "unknown-submission"), {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: lo },
      body: VALID_BODY,
    });
    expect(res.status).toBe(404);
  });
});
