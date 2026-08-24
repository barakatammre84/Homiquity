import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

// ---------------------------------------------------------------------------
// Under-review intake → action items contract.
//
// The founder's walkthrough (2026-08-18): submit a real application, land on
// /loan-options as "under review", and the page — plus the dashboard — showed
// NOTHING to do. Structural cause: initializeLoanPipeline (conditions + the
// borrower's document tasks) ran only inside finalizeIntake's isApproved
// branch, so an under_review file had zero tasks and every action surface
// honestly rendered "You're all caught up."
//
// This pins the fix end to end: a profile the engine routes to under_review
// must, within seconds of the 201, have (a) borrower action items whose
// actionUrls are routes the client actually registers, and (b) loan options.
//
// Uses the dev test-login accounts (DEV_TEST_PASSWORD). The session cookie is
// secure-only, so every request sends X-Forwarded-Proto: https.
// ---------------------------------------------------------------------------

const TEST_PASSWORD = process.env.DEV_TEST_PASSWORD || "test1234";
const HTTPS = { "X-Forwarded-Proto": "https" };
const JSON_HTTPS = { "Content-Type": "application/json", ...HTTPS };

// Client routes that exist (App.tsx registers /documents, /tasks, /e-consent).
// The old action-items payload deep-linked /tasks/:id and /econsent/:id —
// neither ever matched a route.
const VALID_ACTION_URLS = new Set(["/documents", "/tasks", "/e-consent"]);

// Thin income against heavy debts + a weak score: the deterministic engine
// cannot auto-approve this, so finalizeIntake resolves it to under_review.
const UNDER_REVIEW_PAYLOAD = {
  annualIncome: "48000",
  employmentType: "employed",
  employmentYears: "1",
  monthlyDebts: "3500",
  creditScore: "600",
  loanPurpose: "purchase",
  propertyType: "single_family",
  purchasePrice: "400000",
  downPayment: "20000",
  isVeteran: false,
  isFirstTimeBuyer: true,
  propertyState: "IL", // the licensed footprint — intake 422s outside it
  softPullConsentAccepted: true,
};

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: JSON_HTTPS,
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  expect(res.status, `test-login as ${email}`).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

async function getJson(cookie: string, path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookie, ...HTTPS } });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** finalizeIntake runs after the 201 — poll until the condition holds. */
async function pollUntil<T>(
  fn: () => Promise<T | null>,
  label: string,
  timeoutMs = 15000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

describe("under_review intake produces action items", () => {
  it("gives the borrower document tasks, valid action links, and loan options", { timeout: 60_000 }, async () => {
    const borrower = await loginAs("buyer@test.com");

    const createRes = await fetch(`${BASE_URL}/api/loan-applications`, {
      method: "POST",
      headers: { ...JSON_HTTPS, Cookie: borrower },
      body: JSON.stringify(UNDER_REVIEW_PAYLOAD),
    });
    expect(createRes.status, "create application").toBe(201);
    const app = await createRes.json();

    // Wait for finalizeIntake to resolve the outcome. The detail route wraps
    // the row: { application: {...} }.
    const settled = await pollUntil(async () => {
      const { status, body } = await getJson(borrower, `/api/loan-applications/${app.id}`);
      if (status !== 200) return null;
      const application = body.application ?? body;
      return ["under_review", "pre_approved"].includes(application.status) ? application : null;
    }, "intake decision");

    // The premise of this test is the NON-approved branch — if the engine
    // ever starts approving this profile, the fixture must get weaker, not
    // the assertion.
    expect(settled.status, "profile chosen to land under_review").toBe("under_review");

    // (a) Action items exist and every link resolves to a registered route.
    //
    // Poll for the DOCUMENT item, not merely for a non-empty list. The consent
    // item is built from the consents table and therefore exists the instant
    // the row does (`server/routes/lending/dashboard.ts:338-350` — a fresh
    // application is missing `disclosure`/`privacy_policy`), while the document
    // items come from tasks that initializeLoanPipeline writes afterwards.
    // Sampling the live endpoint every 100 ms after the 201 shows the window:
    //
    //     t=0ms    items=1   documents=0  types=[consent]
    //     t=100ms  items=10  documents=9  types=[document,consent]
    //
    // `items.length > 0` therefore returns at t=0 on a loaded runner, and the
    // assertion below fails on a file that was about to be correct. This still
    // fails — via pollUntil's timeout — if the document tasks never arrive,
    // which is the regression the test is actually for.
    const actionItems = await pollUntil(async () => {
      const { status, body } = await getJson(borrower, `/api/applications/${app.id}/action-items`);
      if (status !== 200) return null;
      const items = body.items ?? [];
      return items.some((i: any) => i.type === "document") ? body : null;
    }, "document action items for an under_review file");

    const documentItems = actionItems.items.filter((i: any) => i.type === "document");
    expect(documentItems.length, "document upload items exist").toBeGreaterThan(0);
    for (const item of actionItems.items) {
      expect(
        VALID_ACTION_URLS.has(item.actionUrl),
        `actionUrl "${item.actionUrl}" is a registered client route`,
      ).toBe(true);
      expect(item.actionLabel, "every item carries a CTA label").toBeTruthy();
    }
    expect(actionItems.stats.total).toBe(actionItems.items.length);

    // (b) The borrower-tasks surface (dashboard card) is also non-empty —
    // the exact widget that used to say "You're all caught up".
    const tasks = await getJson(
      borrower,
      `/api/task-engine/applications/${app.id}/borrower-tasks`,
    );
    expect(tasks.status).toBe(200);
    const openTasks = (tasks.body.tasks ?? tasks.body ?? []).filter?.(
      (t: any) => t.status !== "COMPLETED",
    );
    expect(openTasks?.length, "open borrower tasks exist").toBeGreaterThan(0);

    // (c) Loan options were generated for the under_review file too.
    const options = await pollUntil(async () => {
      const { status, body } = await getJson(borrower, `/api/loan-applications/${app.id}/options`);
      if (status !== 200) return null;
      return body.options?.length > 0 ? body : null;
    }, "loan options");
    expect(options.options.length).toBeGreaterThan(0);
  });
});
