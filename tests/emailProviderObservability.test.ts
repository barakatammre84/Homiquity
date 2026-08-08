import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * The unconfigured-email-provider gap must not be able to go silent again.
 *
 * emailService resolves its providers once, at module load. In production
 * NEITHER is set — the Railway service carries no SENDGRID_API_KEY and no
 * SMTP_* — so every send fell through to a console log and returned `true`.
 * Callers saw success, the boot line was informational, and nothing on the
 * outside of the process could tell a mail-less deploy from a healthy one.
 * Harmless behind the pre-launch gate; on the public funnel opened 2026-08-06
 * it silently discarded password resets, verification links and waitlist
 * confirmations.
 *
 * These tests pin the three properties that make it observable: production
 * reports failure to the caller, production says so loudly in the log without
 * spilling PII, and the state is probeable from outside via /api/health.
 *
 * Development is asserted separately and deliberately: there the console IS the
 * mailbox, so `true` is the correct answer and must stay that way.
 */

const ENV_KEYS = [
  "NODE_ENV",
  "SENDGRID_API_KEY",
  "SENDGRID_API_KEY1",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const ORIGINAL = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

/**
 * Re-import emailService under a specific environment. The provider flags are
 * module-level consts, so only a fresh module registry can exercise the other
 * branch — mutating process.env after import does nothing.
 */
async function loadWithEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  vi.resetModules();
  return import("../server/services/emailService");
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
  vi.restoreAllMocks();
});

describe("sendEmail with no provider configured", () => {
  it("reports failure to the caller in production", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await loadWithEnv({ NODE_ENV: "production" });

    const sent = await sendEmail({
      to: "borrower@example.com",
      subject: "Reset your password",
      html: "<p>link</p>",
    });

    // The whole point: `true` here is what made the gap invisible.
    expect(sent).toBe(false);
  });

  it("still reports success in development, where the console is the mailbox", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendEmail } = await loadWithEnv({ NODE_ENV: "development" });

    const sent = await sendEmail({
      to: "borrower@example.com",
      subject: "Reset your password",
      html: "<p>link</p>",
    });

    expect(sent).toBe(true);
  });

  it("logs the discard at error level, masking the recipient and omitting the body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await loadWithEnv({ NODE_ENV: "production" });
    errorSpy.mockClear(); // drop the boot-time line; assert on the per-send one

    await sendEmail({
      to: "borrower@example.com",
      subject: "Reset your password",
      html: "<p>Your reset token is abc123</p>",
    });

    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toMatch(/DISCARDED/);
    // Correlatable without being a contact dump — and the body never appears:
    // these messages carry names, amounts and single-use reset tokens.
    expect(logged).toContain("@example.com");
    expect(logged).not.toContain("borrower@example.com");
    expect(logged).not.toContain("abc123");
  });

  it("escalates the boot-time line from informational to error in production", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await loadWithEnv({ NODE_ENV: "production" });

    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toMatch(/NO EMAIL PROVIDER CONFIGURED/);
    // Names the fix, so the log line is actionable without reading this file.
    expect(logged).toMatch(/SENDGRID_API_KEY/);
  });
});

describe("emailProviderStatus", () => {
  it("reports the gap when nothing is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { emailProviderStatus } = await loadWithEnv({ NODE_ENV: "production" });
    expect(emailProviderStatus()).toEqual({ configured: false, providers: [] });
  });

  it("names each configured provider without exposing key material", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { emailProviderStatus } = await loadWithEnv({
      NODE_ENV: "production",
      SENDGRID_API_KEY: "SG.super-secret-value",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "mailer",
      SMTP_PASS: "hunter2",
    });

    const status = emailProviderStatus();
    expect(status.configured).toBe(true);
    expect(status.providers).toEqual(["sendgrid", "smtp"]);

    // This object is served unauthenticated AND written to the request log via
    // RESPONSE_BODY_LOG_ALLOWLIST, so it must never carry a secret or a host.
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("super-secret-value");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("smtp.example.com");
  });
});

describe("GET /api/health", () => {
  const ROUTES = readFileSync(
    path.join(path.resolve(__dirname, ".."), "server/routes.ts"),
    "utf8",
  );

  it("exposes the email state so the gap is probeable from outside", () => {
    const handler = ROUTES.slice(
      ROUTES.indexOf('app.get("/api/health"'),
      ROUTES.indexOf("assertEncryptionConfig()"),
    );
    expect(handler).toContain("emailProviderStatus()");
  });

  it("does not degrade the status code when email is unconfigured", () => {
    // The CI self-host boot step and the verify-deploy poll both require a 200
    // here and neither provisions email. A 503 would red the pipeline instead
    // of surfacing the gap; `email.configured` is the field to alert on.
    const handler = ROUTES.slice(
      ROUTES.indexOf('app.get("/api/health"'),
      ROUTES.indexOf("assertEncryptionConfig()"),
    );
    const okBranch = handler.slice(0, handler.indexOf("catch"));
    expect(okBranch).not.toMatch(/res\.status\(\s*5\d\d\s*\)/);
  });
});
