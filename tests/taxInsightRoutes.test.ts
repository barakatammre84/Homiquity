import { describe, it, expect, beforeAll } from "vitest";
import { apiPost, apiGet } from "./setup";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

// Dev test-login accounts all share DEV_TEST_PASSWORD (see TEST_ACCOUNTS.md).
const TEST_PASSWORD = process.env.DEV_TEST_PASSWORD || "test1234";

// Log in as a role and return the session cookie for authenticated requests.
async function loginCookie(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/test-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie");
  return setCookie ? setCookie.split(";")[0] : "";
}

/**
 * Tax Return Insight routes. Run the server with EXTRACTION_SIMULATE=true so
 * extraction is deterministic without Gemini credentials; the suite still
 * passes without the flag (the empty low-confidence path also persists a row).
 *
 * renter@test.com is the incubator persona (no application) — exactly the
 * user this consumer-direct flow serves.
 */
describe("Tax insight routes", () => {
  let renterCookie: string;
  let documentId: string;

  beforeAll(async () => {
    renterCookie = await loginCookie("renter@test.com", TEST_PASSWORD);
    expect(renterCookie).toBeTruthy();

    // Register an application-less tax-return document. Object storage is
    // unconfigured in local dev, so registration trusts the supplied path
    // (dev-only behavior) and simulated extraction never reads the file.
    const reg = await apiPost(
      "/api/documents/upload",
      {
        objectPath: `/objects/test-tax-insight-${Date.now()}.pdf`,
        fileName: "test-tax-return-2025.pdf",
        fileSize: 123456,
        mimeType: "application/pdf",
        documentType: "tax_return",
      },
      { headers: { Cookie: renterCookie } },
    );
    expect(reg.status).toBeLessThan(300);
    documentId = reg.body?.id;
    expect(documentId).toBeTruthy();
  });

  it("rejects unauthenticated processing and listing", async () => {
    const process_ = await apiPost("/api/tax-insights/process", { documentId: "any" });
    expect(process_.status).toBe(401);
    const me = await apiGet("/api/tax-insights/me");
    expect(me.status).toBe(401);
  });

  it("gates processing on tax_document_use consent, then processes after consent", async () => {
    // Consent may already exist from a prior run (borrower_consents persist).
    const consents = await apiGet("/api/consents/me", { headers: { Cookie: renterCookie } });
    const hadConsent =
      Array.isArray(consents.body) &&
      consents.body.some(
        (c: any) => c.consentType === "tax_document_use" && c.consentGiven && !c.isRevoked,
      );

    if (!hadConsent) {
      const blocked = await apiPost(
        "/api/tax-insights/process",
        { documentId },
        { headers: { Cookie: renterCookie } },
      );
      expect(blocked.status).toBe(403);
      expect(blocked.body?.code).toBe("CONSENT_REQUIRED");
      expect(blocked.body?.consentType).toBe("tax_document_use");

      const consent = await apiPost(
        "/api/consents",
        { consentType: "tax_document_use", consentGiven: true, consentMethod: "click" },
        { headers: { Cookie: renterCookie } },
      );
      expect(consent.status).toBe(201);
    }

    const processed = await apiPost(
      "/api/tax-insights/process",
      { documentId },
      { headers: { Cookie: renterCookie } },
    );
    expect(processed.status).toBe(200);
    expect(processed.body?.insight?.taxYear).toBeTypeOf("number");
    expect(processed.body?.insight?.confidence).toBeTruthy();

    // The encrypted raw model response must never reach the client.
    const raw = JSON.stringify(processed.body);
    expect(raw).not.toContain("rawResponseEncrypted");
    expect(raw).not.toContain("rawResponseIv");
    expect(raw).not.toContain("rawResponseKeyId");
  });

  it("returns the caller's insights from /api/tax-insights/me", async () => {
    const me = await apiGet("/api/tax-insights/me", { headers: { Cookie: renterCookie } });
    expect(me.status).toBe(200);
    expect(Array.isArray(me.body?.insights)).toBe(true);
    expect(me.body.insights.length).toBeGreaterThan(0);
    expect(me.body.insights[0].taxYear).toBeTypeOf("number");
  });

  it("refuses to process another user's document", async () => {
    const buyerCookie = await loginCookie("buyer@test.com", TEST_PASSWORD);
    expect(buyerCookie).toBeTruthy();
    const res = await apiPost(
      "/api/tax-insights/process",
      { documentId },
      { headers: { Cookie: buyerCookie } },
    );
    expect([403, 404]).toContain(res.status);
  });

  it("rejects a non-tax-return document type", async () => {
    const reg = await apiPost(
      "/api/documents/upload",
      {
        objectPath: `/objects/test-paystub-${Date.now()}.pdf`,
        fileName: "test-paystub.pdf",
        fileSize: 4567,
        mimeType: "application/pdf",
        documentType: "pay_stub",
      },
      { headers: { Cookie: renterCookie } },
    );
    expect(reg.status).toBeLessThan(300);
    const res = await apiPost(
      "/api/tax-insights/process",
      { documentId: reg.body.id },
      { headers: { Cookie: renterCookie } },
    );
    expect(res.status).toBe(400);
  });
});
