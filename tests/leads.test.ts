import { describe, it, expect, afterAll } from "vitest";
import { apiPost, apiGet } from "./setup";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

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

const createdLeadIds: string[] = [];

describe("Leads intake API", () => {
  const validLead = {
    source: "integration_test",
    trustedFormCertUrl: "https://cert.trustedform.com/example-cert",
    email: "prospect@example.test",
    phone: "5550001111",
    loanPurpose: "purchase",
    propertyState: "TX",
    estimatedPropertyValue: 450000,
  };

  it("rejects a lead with no TrustedForm certificate", async () => {
    const { trustedFormCertUrl, ...noCert } = validLead;
    const res = await apiPost("/api/leads", noCert);
    expect(res.status).toBe(400);
  });

  it("rejects a lead with neither email nor phone", async () => {
    const { email, phone, ...noContact } = validLead;
    const res = await apiPost("/api/leads", noContact);
    expect(res.status).toBe(400);
  });

  it("creates a lead from an unauthenticated public POST", async () => {
    const res = await apiPost("/api/leads", validLead);
    expect(res.status).toBe(201);
    expect(res.body?.lead?.id).toBeTruthy();
    expect(res.body?.lead?.status).toBe("new");
    createdLeadIds.push(res.body.lead.id);
  });

  it("dedupes on (source, externalLeadId)", async () => {
    const externalLeadId = `ext-${Date.now()}`;
    const first = await apiPost("/api/leads", { ...validLead, externalLeadId });
    expect(first.status).toBe(201);
    createdLeadIds.push(first.body.lead.id);
    const second = await apiPost("/api/leads", { ...validLead, externalLeadId });
    expect(second.status).toBe(200);
    expect(second.body?.duplicate).toBe(true);
    expect(second.body?.lead?.id).toBe(first.body.lead.id);
  });

  it("blocks the staff list for unauthenticated callers", async () => {
    const res = await apiGet("/api/leads");
    expect([401, 403]).toContain(res.status);
  });

  it("lists leads for an admin and includes the created lead", async () => {
    const cookie = await loginCookie("admin@test.com", "admin123");
    expect(cookie).toBeTruthy();
    const res = await apiGet("/api/leads?source=integration_test", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((l: any) => l.id);
    expect(ids).toContain(createdLeadIds[0]);
  });
});

// Self-cleaning: remove every lead this suite created so consecutive runs leave
// the database identical (roadmap #10).
afterAll(async () => {
  if (createdLeadIds.length === 0) return;
  const cookie = await loginCookie("admin@test.com", "admin123");
  for (const id of createdLeadIds) {
    await fetch(`${BASE_URL}/api/leads/${id}`, { method: "DELETE", headers: { Cookie: cookie } });
  }
});
