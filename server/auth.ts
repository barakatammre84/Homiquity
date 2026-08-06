import type { Express, RequestHandler } from "express";
import { isAdmin as isAdminRole } from "@shared/roles";
import { storage } from "./storage";
import { setupSessionAuth, registerAuthRoutes } from "./integrations/auth";
import { authStorage } from "./integrations/auth/storage";
import { setupSocialAuth } from "./socialAuth";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { isLockedOut, recordFailure, recordSuccess } from "./services/loginLockout";
import {
  issuePasswordReset,
  issueEmailVerification,
  publicBaseUrl,
  hashToken,
} from "./services/accountRecovery";

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User {
      id: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      role: string;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  // A malformed stored value (missing salt separator, truncated hex) must be
  // an authentication failure, not a thrown 500 — timingSafeEqual throws on
  // length mismatch and Buffer.from(undefined) throws outright.
  const [hashedPassword, salt] = stored.split(".");
  if (!hashedPassword || !salt) return false;
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  if (hashedPasswordBuf.length !== suppliedPasswordBuf.length) return false;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export async function setupAuth(app: Express) {
  // Session + Passport middleware must be installed unconditionally — this is
  // what makes req.isAuthenticated / req.login / req.user exist on every host.
  setupSessionAuth(app);

  registerAuthRoutes(app);

  setupEmailPasswordAuth(app);
  setupSocialAuth(app);

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    app.post("/api/test-login", (_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
  } else {
    setupDevTestLogin(app);
  }
}

function setupEmailPasswordAuth(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email: rawEmail, password, firstName, lastName } = req.body;

      if (!rawEmail || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const email = rawEmail.trim().toLowerCase();

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(password);

      let user;
      try {
        user = await authStorage.createUserWithPassword({
          email,
          passwordHash,
          firstName: firstName || null,
          lastName: lastName || null,
        });
      } catch (dbError: any) {
        if (dbError?.code === "23505") {
          return res.status(409).json({ error: "An account with this email already exists" });
        }
        throw dbError;
      }

      req.login(
        {
          id: user.id,
          email: user.email || undefined,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          profileImageUrl: user.profileImageUrl || undefined,
          role: user.role,
        },
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Registration succeeded but login failed" });
          }
          // Send the confirm-your-email link. Fire-and-forget: a bounced
          // verification email must not fail an otherwise-successful signup.
          issueEmailVerification(user, publicBaseUrl(req)).catch((e) =>
            console.error("[Auth] verification email error:", e),
          );
          res.json({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName,
              lastName: user.lastName,
              emailVerified: false,
            },
          });
        }
      );
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email: rawEmail, password } = req.body;

      if (!rawEmail || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const email = rawEmail.trim().toLowerCase();

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Per-account lockout (see services/loginLockout.ts). The response body
      // is identical to a wrong password so the lockout can't be used to
      // probe whether an account exists.
      const lockoutState = {
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        lockoutUntil: user.lockoutUntil ?? null,
      };
      if (isLockedOut(lockoutState)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValid = await comparePasswords(password, user.passwordHash);
      if (!isValid) {
        await authStorage.setLockoutState(user.id, recordFailure(lockoutState));
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (lockoutState.failedLoginAttempts > 0 || lockoutState.lockoutUntil) {
        await authStorage.setLockoutState(user.id, recordSuccess());
      }

      req.login(
        {
          id: user.id,
          email: user.email || undefined,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          profileImageUrl: user.profileImageUrl || undefined,
          role: user.role,
        },
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Login failed" });
          }
          res.json({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              firstName: user.firstName,
              lastName: user.lastName,
            },
          });
        }
      );
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    });
  });

  // Step 1 of reset: request a link. The response is ALWAYS the same generic
  // success, whether or not the email maps to an account — otherwise this becomes
  // an account-enumeration oracle. Only email/password accounts get a link
  // (social-auth users have no password to reset).
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const rawEmail = req.body?.email;
      if (typeof rawEmail !== "string" || !rawEmail.trim()) {
        return res.status(400).json({ error: "Email is required" });
      }
      const email = rawEmail.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(email);
      if (user && user.passwordHash) {
        const delivered = await issuePasswordReset(user, publicBaseUrl(req));
        if (!delivered) {
          // The RESPONSE stays generic — revealing a send failure would leak
          // that the account exists, which is the whole point of the uniform
          // reply. But the operator must not be left in the dark: with no
          // email provider configured this endpoint tells every user a link is
          // on its way while the account is, in practice, unrecoverable.
          // Logged as an error so it surfaces wherever errors surface.
          console.error(
            "[auth] password reset requested but the email was NOT delivered — " +
              "the account is unrecoverable until an email provider is configured. " +
              "The user was shown the standard 'a reset link is on its way' message.",
          );
        }
      }
      res.json({
        success: true,
        message: "If an account exists for that email, a reset link is on its way.",
      });
    } catch (error) {
      console.error("Forgot-password error:", error);
      // Still respond generically so failures don't leak account existence.
      res.json({
        success: true,
        message: "If an account exists for that email, a reset link is on its way.",
      });
    }
  });

  // Step 2 of reset: redeem the token and set a new password. The token is
  // single-use and expiring (enforced atomically in consumeAuthToken).
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body ?? {};
      if (typeof token !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const consumed = await authStorage.consumeAuthToken(hashToken(token), "password_reset");
      if (!consumed) {
        return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
      }

      const passwordHash = await hashPassword(password);
      await authStorage.setPassword(consumed.userId, passwordHash);
      res.json({ success: true, message: "Your password has been reset. You can now sign in." });
    } catch (error) {
      console.error("Reset-password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Confirm an email-verification link. Idempotent from the user's view: an
  // already-consumed or expired token returns a clear error, a fresh one flips
  // the account to verified.
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const token = req.body?.token;
      if (typeof token !== "string" || !token) {
        return res.status(400).json({ error: "Verification token is required" });
      }
      const consumed = await authStorage.consumeAuthToken(hashToken(token), "email_verification");
      if (!consumed) {
        return res.status(400).json({ error: "This verification link is invalid or has expired." });
      }
      await authStorage.markEmailVerified(consumed.userId);
      res.json({ success: true, message: "Your email is confirmed. Thank you!" });
    } catch (error) {
      console.error("Verify-email error:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  // Resend the verification email to the signed-in user (e.g. the first one
  // was lost). No-op success if already verified.
  app.post("/api/auth/resend-verification", isAuthenticated, async (req, res) => {
    try {
      const sessionUser = req.user as Express.User;
      const user = await authStorage.getUser(sessionUser.id);
      if (!user || !user.email) {
        return res.status(400).json({ error: "No email on file for this account" });
      }
      if (user.emailVerifiedAt) {
        return res.json({ success: true, message: "Your email is already verified." });
      }
      await issueEmailVerification(user, publicBaseUrl(req));
      res.json({ success: true, message: "Verification email sent." });
    } catch (error) {
      console.error("Resend-verification error:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });
}

function setupDevTestLogin(app: Express) {
  app.post("/api/test-login", async (req, res) => {
    const { email, password } = req.body;

    // Test accounts share a single password sourced from the environment so no
    // credential strings live in source / git history. This endpoint is also
    // hard-gated to non-production (returns 404 in prod), but keeping secrets out
    // of the repo is defense-in-depth. Set DEV_TEST_PASSWORD in your .env.
    const devPassword = process.env.DEV_TEST_PASSWORD;
    if (!devPassword) {
      return res
        .status(503)
        .json({ error: "Dev test login is not configured (set DEV_TEST_PASSWORD)" });
    }

    const testAccounts: Record<string, { role: string; firstName: string; lastName: string }> = {
      "admin@test.com": { role: "admin", firstName: "Admin", lastName: "User" },
      "lo@test.com": { role: "lo", firstName: "Loan", lastName: "Officer" },
      "loa@test.com": { role: "loa", firstName: "Loan Officer", lastName: "Assistant" },
      "processor@test.com": { role: "processor", firstName: "Loan", lastName: "Processor" },
      "underwriter@test.com": { role: "underwriter", firstName: "Loan", lastName: "Underwriter" },
      "closer@test.com": { role: "closer", firstName: "Loan", lastName: "Closer" },
      "broker@test.com": { role: "broker", firstName: "Mortgage", lastName: "Broker" },
      "lender@test.com": { role: "lender", firstName: "Lender", lastName: "Rep" },
      "cpa@test.com": { role: "cpa", firstName: "Casey", lastName: "CPA" },
      "renter@test.com": { role: "aspiring_owner", firstName: "Aspiring", lastName: "Owner" },
      "buyer@test.com": { role: "active_buyer", firstName: "Active", lastName: "Buyer" },
    };

    const account = testAccounts[email];
    if (!account || password !== devPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const testUser = await storage.upsertUser({
      id: `test-${email.split("@")[0]}`,
      email,
      firstName: account.firstName,
      lastName: account.lastName,
      profileImageUrl: null,
      role: account.role,
    });

    if (testUser.role !== account.role) {
      await storage.updateUserRole(testUser.id, account.role);
    }

    req.login(
      {
        id: testUser.id,
        email: testUser.email || undefined,
        firstName: testUser.firstName || undefined,
        lastName: testUser.lastName || undefined,
        profileImageUrl: testUser.profileImageUrl || undefined,
        role: account.role,
      },
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        res.json({
          success: true,
          user: {
            id: testUser.id,
            email: testUser.email,
            role: account.role,
            firstName: account.firstName,
            lastName: account.lastName,
          },
        });
      }
    );
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as Express.User;
  if (!user.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Re-read the role from the DB so role changes (or a deleted account) take
  // effect immediately instead of living until the session expires.
  try {
    const dbUser = await authStorage.getUser(user.id);
    if (!dbUser) {
      req.logout(() => {});
      return res.status(401).json({ error: "Unauthorized" });
    }
    user.role = dbUser.role;
  } catch (error) {
    console.error("Error refreshing user role:", error);
    return res.status(500).json({ error: "Internal error" });
  }
  return next();
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  await (isAuthenticated as any)(req, res, () => {
    if (isAdminRole(req.user)) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  });
};

export function requireRole(...allowedRoles: string[]): RequestHandler {
  return async (req, res, next) => {
    await (isAuthenticated as any)(req, res, () => {
      const userRole = req.user?.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    });
  };
}
