import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

/**
 * A send function must not report success for mail it did not send.
 *
 * `sendEmail` returned `true` when no provider was configured. Everything above
 * it reasons about delivery, so that one optimistic return produced two
 * concrete defects in production, where no provider IS configured:
 *
 *   1. POST /api/admin/partner-waitlist/:id/invite wrote `emailSent: true` into
 *      audit_logs for an email that reached nobody — a factually false audit
 *      record, created automatically, at scale.
 *   2. /forgot-password told every user "a reset link is on its way" while the
 *      account was in practice unrecoverable. That page is NOT prelaunch-gated,
 *      so it is reachable on the live site today.
 *
 * The fix is at the root — one honest boolean — so every caller inherits it.
 * These tests pin the honesty, not the plumbing.
 */

const ROOT = path.resolve(__dirname, "..");
const EMAIL_SVC = readFileSync(path.join(ROOT, "server/services/emailService.ts"), "utf8");
const AUTH = readFileSync(path.join(ROOT, "server/auth.ts"), "utf8");
const PARTNERS = readFileSync(path.join(ROOT, "server/routes/partners.ts"), "utf8");

/** The tail of sendEmail: the branch taken when no provider exists. */
const NO_PROVIDER_BRANCH = EMAIL_SVC.slice(EMAIL_SVC.indexOf("// No provider configured"));

describe("sendEmail reports what actually happened", () => {
  it("returns FALSE when no provider is configured", () => {
    expect(NO_PROVIDER_BRANCH).toContain("return false;");
    expect(NO_PROVIDER_BRANCH).not.toContain("return true;");
  });

  it("still logs the message, so local development can read it", () => {
    // The point was never to hide the mail — only to stop claiming it was sent.
    expect(NO_PROVIDER_BRANCH).toContain("To: ${message.to}");
    expect(NO_PROVIDER_BRANCH).toContain("Subject: ${message.subject}");
  });

  it("does not label a production non-delivery as '[DEV]'", () => {
    // "[Email][DEV]" under NODE_ENV=production read as a harmless development
    // notice while being the only trace that a legally-obligated notice went
    // nowhere.
    expect(NO_PROVIDER_BRANCH).toContain("[Email][NOT SENT]");
    expect(NO_PROVIDER_BRANCH).toContain('process.env.NODE_ENV === "production"');
  });

  it("escalates to console.error in production, not console.log", () => {
    expect(NO_PROVIDER_BRANCH).toContain("console.error");
  });
});

describe("boot notice", () => {
  it("is an ERROR in production and names what is broken", () => {
    const boot = EMAIL_SVC.slice(EMAIL_SVC.indexOf("if (!isSendGridConfigured && !isSmtpConfigured)"));
    expect(boot).toContain("NO EMAIL PROVIDER CONFIGURED IN PRODUCTION");
    expect(boot).toContain("console.error");
    // Naming the affected flows is what makes the line actionable rather than
    // scenery in a log.
    expect(boot).toMatch(/[Pp]assword reset/);
    expect(boot).toMatch(/adverse-action/i);
  });
});

describe("password reset stays anti-enumerating but stops being silent", () => {
  it("keeps the uniform user-facing message", () => {
    // Revealing a send failure would leak that the account exists. The generic
    // reply is correct and must not be "fixed".
    expect(AUTH).toContain("If an account exists for that email, a reset link is on its way.");
  });

  it("logs an error server-side when the reset email was not delivered", () => {
    const route = AUTH.slice(AUTH.indexOf("const user = await authStorage.getUserByEmail(email);"));
    expect(route).toContain("const delivered = await issuePasswordReset(");
    expect(route).toContain("if (!delivered)");
    expect(route).toContain("console.error");
    expect(route).toMatch(/unrecoverable/i);
  });
});

describe("partner-invite audit record", () => {
  it("records the real delivery result rather than a constant", () => {
    const block = PARTNERS.slice(PARTNERS.indexOf("partner_waitlist.invited"));
    // emailSent must come from the sendEmail return value, which is now honest.
    expect(PARTNERS).toContain("const emailSent = await sendEmail({");
    expect(block).toContain("emailSent,");
    expect(block).not.toContain("emailSent: true");
  });
});
