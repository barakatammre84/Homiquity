import { randomBytes, createHash } from "crypto";
import type { Request } from "express";
import { authStorage } from "../integrations/auth/storage";
import { sendEmail, emailTemplates } from "./emailService";
import type { User } from "@shared/schema";

// A password-reset link is short-lived; an email-verification link can be more
// forgiving since it isn't security-sensitive in the same way.
export const RESET_TTL_MINUTES = 30;
export const VERIFY_TTL_HOURS = 48;

/** Raw token → the SHA-256 hex we persist. We never store the raw token. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): string {
  // 32 bytes of CSPRNG entropy, URL-safe.
  return randomBytes(32).toString("base64url");
}

/**
 * The public origin to build links against: an explicit PUBLIC_BASE_URL wins
 * (set this in production), otherwise derive it from the forwarded request
 * headers so links are correct behind Vercel's proxy and in local dev.
 */
export function publicBaseUrl(req: Request): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}`;
}

function displayName(user: Pick<User, "firstName" | "email">): string {
  return user.firstName || user.email?.split("@")[0] || "there";
}

/**
 * Issue a password-reset token and email the link. Any outstanding reset tokens
 * for the user are invalidated first so only the newest link works. Returns
 * false only if the email failed to send (the caller should still respond
 * generically to avoid leaking whether an account exists).
 */
export async function issuePasswordReset(user: User, baseUrl: string): Promise<boolean> {
  const rawToken = generateRawToken();
  await authStorage.invalidateAuthTokens(user.id, "password_reset");
  await authStorage.createAuthToken({
    userId: user.id,
    type: "password_reset",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
  });

  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
  const email = emailTemplates.passwordReset(displayName(user), resetUrl, RESET_TTL_MINUTES);
  email.to = user.email!;
  return sendEmail(email);
}

/**
 * Issue an email-verification token and send the confirmation link. Fire-and-
 * forget friendly: failures are logged, not thrown, so signup never fails just
 * because the verification email bounced.
 */
export async function issueEmailVerification(user: User, baseUrl: string): Promise<boolean> {
  if (!user.email) return false;
  const rawToken = generateRawToken();
  await authStorage.invalidateAuthTokens(user.id, "email_verification");
  await authStorage.createAuthToken({
    userId: user.id,
    type: "email_verification",
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3_600_000),
  });

  const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;
  const email = emailTemplates.verifyEmail(displayName(user), verifyUrl);
  email.to = user.email;
  return sendEmail(email);
}
