import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// Intake → loan-officer handoff contract tests (money-path A2).
//
// A self-serve applicant (no referral) is created with no loan officer. Before
// this fix such a file was invisible to every non-admin LO — the readiness /
// AUS / lender routes gate on a deal-team membership row that assignment never
// created, and the pipeline queue is deal-team-scoped. These tests pin the
// handoff that makes an LO able to actually receive and work the file:
//
//   * the file surfaces in the LO intake pool (GET /api/pipeline/unassigned);
//   * claiming it (POST .../claim) atomically grants object-level access AND
//     queue visibility (assignLoanOfficer keeps loanOfficerId and the deal-team
//     row in lockstep);
//   * a second LO cannot steal an already-claimed file (409);
//   * the admin assign/unassign PATCH goes through the same chokepoint;
//   * borrowers can neither see the pool nor claim (403).
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

const INTAKE_PAYLOAD = {
  annualIncome: "120000",
  employmentType: "employed",
  employmentYears: "5",
  monthlyDebts: "500",
  creditScore: "720",
  loanPurpose: "purchase",
  propertyType: "single_family",
  purchasePrice: "400000",
  downPayment: "80000",
  isVeteran: false,
  isFirstTimeBuyer: true,
  propertyState: "IL", // the licensed footprint (#201) — intake 422s outside it
  softPullConsentAccepted: true,
};

async function createSelfServeApp(borrowerCookie: string): Promise<{ id: string; loanOfficerId: string | null }> {
  const res = await fetch(`${BASE_URL}/api/loan-applications`, {
    method: "POST",
    headers: { ...JSON_HTTPS, Cookie: borrowerCookie },
    body: JSON.stringify(INTAKE_PAYLOAD),
  });
  expect(res.status, "create application").toBe(201);
  const body = await res.json();
  return { id: body.id, loanOfficerId: body.loanOfficerId ?? null };
}

async function poolHas(cookie: string, appId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/pipeline/unassigned`, { headers: { Cookie: cookie, ...HTTPS } });
  expect(res.status).toBe(200);
  const body = await res.json();
  return (body.queue as { applicationId: string }[]).some((q) => q.applicationId === appId);
}

async function queueHas(cookie: string, appId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/pipeline/queue`, { headers: { Cookie: cookie, ...HTTPS } });
  expect(res.status).toBe(200);
  const body = await res.json();
  return (body.queue as { applicationId: string }[]).some((q) => q.applicationId === appId);
}

// getLoanApplicationWithAccess-gated read: 404 = no access, 200 = access.
async function accessStatus(cookie: string, appId: string): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/applications/${appId}/team`, { headers: { Cookie: cookie, ...HTTPS } });
  return res.status;
}

describe("intake → LO handoff: pool + claim", () => {
  it("routes a self-serve file from the pool onto the claiming LO's desk", async () => {
    const borrower = await loginAs("buyer@test.com");
    const lo = await loginAs("lo@test.com");
    const loa = await loginAs("loa@test.com");

    const app = await createSelfServeApp(borrower);
    expect(app.loanOfficerId, "self-serve app starts with no LO").toBeNull();

    // Before claim: in the pool, not in the queue, no object-level access.
    expect(await poolHas(lo, app.id), "new file is in the intake pool").toBe(true);
    expect(await queueHas(lo, app.id), "not in the LO queue before claim").toBe(false);
    expect(await accessStatus(lo, app.id), "no file access before claim").toBe(404);

    // Claim.
    const claimRes = await fetch(`${BASE_URL}/api/loan-applications/${app.id}/claim`, {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: lo },
      body: "{}",
    });
    expect(claimRes.status, "claim succeeds").toBe(200);

    // After claim: access + queue granted, out of the pool.
    expect(await accessStatus(lo, app.id), "file access granted after claim").toBe(200);
    expect(await queueHas(lo, app.id), "file in LO queue after claim").toBe(true);
    expect(await poolHas(lo, app.id), "file left the pool after claim").toBe(false);

    // A different LO cannot steal it.
    const stealRes = await fetch(`${BASE_URL}/api/loan-applications/${app.id}/claim`, {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: loa },
      body: "{}",
    });
    expect(stealRes.status, "second LO cannot claim an owned file").toBe(409);
  });

  it("refuses the pool and claim to a borrower (403)", async () => {
    const borrower = await loginAs("buyer@test.com");
    const app = await createSelfServeApp(borrower);

    const poolRes = await fetch(`${BASE_URL}/api/pipeline/unassigned`, { headers: { Cookie: borrower, ...HTTPS } });
    expect(poolRes.status, "borrower cannot see the intake pool").toBe(403);

    const claimRes = await fetch(`${BASE_URL}/api/loan-applications/${app.id}/claim`, {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: borrower },
      body: "{}",
    });
    expect(claimRes.status, "borrower cannot claim").toBe(403);
  });
});

describe("intake → LO handoff: deal-team access matches the queue", () => {
  it("a deal-team LO (not the assigned loanOfficerId) can open the cockpit", async () => {
    const borrower = await loginAs("buyer@test.com");
    const admin = await loginAs("admin@test.com");
    const lo = await loginAs("lo@test.com");
    const app = await createSelfServeApp(borrower);

    // Add the LO as a deal-team member WITHOUT assigning them as loan officer —
    // loanOfficerId stays null, so only the deal-team row grants access. Before
    // the fix, verifyInternalStaffApplicationAccess gated lo/loa on loanOfficerId
    // alone and 403'd here even though the file would show in the LO's queue.
    const add = await fetch(`${BASE_URL}/api/applications/${app.id}/team`, {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: admin },
      body: JSON.stringify({ userId: "test-lo", teamRole: "loan_officer" }),
    });
    expect(add.status, "admin adds LO to the deal team").toBe(201);

    const cockpit = await fetch(`${BASE_URL}/api/staff/applications/${app.id}/cockpit`, {
      headers: { Cookie: lo, ...HTTPS },
    });
    expect(cockpit.status, "deal-team LO can open the cockpit").toBe(200);
  });
});

describe("intake → LO handoff: admin assign/unassign chokepoint", () => {
  it("assign grants access + queue; unassign revokes and returns to the pool", async () => {
    const borrower = await loginAs("buyer@test.com");
    const admin = await loginAs("admin@test.com");
    const loa = await loginAs("loa@test.com");

    const app = await createSelfServeApp(borrower);
    expect(await accessStatus(loa, app.id), "no access before assign").toBe(404);

    const assign = await fetch(`${BASE_URL}/api/loan-applications/${app.id}/loan-officer`, {
      method: "PATCH",
      headers: { ...JSON_HTTPS, Cookie: admin },
      body: JSON.stringify({ loanOfficerId: "test-loa" }),
    });
    expect(assign.status, "admin assign").toBe(200);
    expect(await accessStatus(loa, app.id), "access granted after assign").toBe(200);
    expect(await queueHas(loa, app.id), "in queue after assign").toBe(true);
    expect(await poolHas(admin, app.id), "left the pool after assign").toBe(false);

    const unassign = await fetch(`${BASE_URL}/api/loan-applications/${app.id}/loan-officer`, {
      method: "PATCH",
      headers: { ...JSON_HTTPS, Cookie: admin },
      body: JSON.stringify({ loanOfficerId: null }),
    });
    expect(unassign.status, "admin unassign").toBe(200);
    expect(await accessStatus(loa, app.id), "access revoked after unassign").toBe(404);
    expect(await poolHas(admin, app.id), "back in the pool after unassign").toBe(true);
  });
});
