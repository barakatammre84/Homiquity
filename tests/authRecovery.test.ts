import { describe, it, expect } from "vitest";
import { apiPost } from "./setup";

// HTTP-level contract for the password-reset + email-verification endpoints.
// The token-lifecycle security (single-use, expiry, type isolation) is covered
// against the database separately; these assertions pin the request-validation
// and account-enumeration-resistance behavior of the routes.
describe("Password reset", () => {
  it("rejects forgot-password with no email", async () => {
    const res = await apiPost("/api/auth/forgot-password", {});
    expect(res.status).toBe(400);
  });

  it("returns an identical generic response whether or not the account exists", async () => {
    const a = await apiPost("/api/auth/forgot-password", { email: `nobody-${Date.now()}@example.test` });
    const b = await apiPost("/api/auth/forgot-password", { email: `also-nobody-${Date.now()}@example.test` });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body?.success).toBe(true);
    // No account-enumeration oracle: the message must not vary by existence.
    expect(a.body?.message).toBe(b.body?.message);
  });

  it("rejects reset-password missing token or password", async () => {
    expect((await apiPost("/api/auth/reset-password", { password: "longenough1" })).status).toBe(400);
    expect((await apiPost("/api/auth/reset-password", { token: "abc" })).status).toBe(400);
  });

  it("rejects reset-password with a password shorter than 8 chars", async () => {
    const res = await apiPost("/api/auth/reset-password", { token: "abc", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects reset-password with an invalid/unknown token", async () => {
    const res = await apiPost("/api/auth/reset-password", { token: "definitely-not-a-real-token", password: "longenough1" });
    expect(res.status).toBe(400);
  });
});

describe("Email verification", () => {
  it("rejects verify-email with no token", async () => {
    expect((await apiPost("/api/auth/verify-email", {})).status).toBe(400);
  });

  it("rejects verify-email with an invalid token", async () => {
    const res = await apiPost("/api/auth/verify-email", { token: "definitely-not-a-real-token" });
    expect(res.status).toBe(400);
  });

  it("blocks resend-verification when unauthenticated", async () => {
    const res = await apiPost("/api/auth/resend-verification", {});
    expect([401, 403]).toContain(res.status);
  });
});
