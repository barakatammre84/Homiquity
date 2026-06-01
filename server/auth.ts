import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import {
  setupAuth as setupOIDCAuth,
  registerAuthRoutes,
} from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { setupSocialAuth } from "./socialAuth";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

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
      claims?: {
        sub: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
        exp?: number;
        [key: string]: unknown;
      };
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export async function setupAuth(app: Express) {
  await setupOIDCAuth(app);

  registerAuthRoutes(app);

  setupEmailPasswordAuth(app);
  setupSocialAuth(app);

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPL_DEPLOYMENT;
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

      const isValid = await comparePasswords(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
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
}

function setupDevTestLogin(app: Express) {
  app.post("/api/test-login", async (req, res) => {
    const { email, password } = req.body;

    const testAccounts: Record<string, { password: string; role: string; firstName: string; lastName: string }> = {
      "admin@test.com": { password: "admin123", role: "admin", firstName: "Admin", lastName: "User" },
      "lo@test.com": { password: "lo123", role: "lo", firstName: "Loan", lastName: "Officer" },
      "loa@test.com": { password: "loa123", role: "loa", firstName: "Loan Officer", lastName: "Assistant" },
      "processor@test.com": { password: "processor123", role: "processor", firstName: "Loan", lastName: "Processor" },
      "underwriter@test.com": { password: "underwriter123", role: "underwriter", firstName: "Loan", lastName: "Underwriter" },
      "closer@test.com": { password: "closer123", role: "closer", firstName: "Loan", lastName: "Closer" },
      "broker@test.com": { password: "broker123", role: "broker", firstName: "Mortgage", lastName: "Broker" },
      "lender@test.com": { password: "lender123", role: "lender", firstName: "Lender", lastName: "Rep" },
      "renter@test.com": { password: "renter123", role: "aspiring_owner", firstName: "Aspiring", lastName: "Owner" },
      "buyer@test.com": { password: "buyer123", role: "active_buyer", firstName: "Active", lastName: "Buyer" },
    };

    const account = testAccounts[email];
    if (!account || account.password !== password) {
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
  const user = req.user as any;

  if (user?.id && user?.role && !user?.claims) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return next();
  }

  const oidcNext = () => {
    const u = req.user as any;
    if (!u?.claims?.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    authStorage.getUser(u.claims.sub).then((dbUser) => {
      if (!dbUser) {
        return res.status(401).json({ error: "User not found" });
      }
      u.id = dbUser.id;
      u.email = dbUser.email || undefined;
      u.firstName = dbUser.firstName || undefined;
      u.lastName = dbUser.lastName || undefined;
      u.profileImageUrl = dbUser.profileImageUrl || undefined;
      u.role = dbUser.role;
      next();
    }).catch((error) => {
      console.error("Error fetching user from DB:", error);
      res.status(500).json({ error: "Internal error" });
    });
  };

  const { isAuthenticated: oidcIsAuthenticated } = await import("./replit_integrations/auth");
  (oidcIsAuthenticated as any)(req, res, oidcNext);
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  await (isAuthenticated as any)(req, res, () => {
    if (req.user?.role === "admin") {
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
