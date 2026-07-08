import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole, hashPassword } from "../auth";
import { authStorage } from "../integrations/auth/storage";
import { logAudit } from "../auditLog";
import { z } from "zod";
import crypto from "crypto";
import type { User, CpaPartner } from "@shared/schema";

/**
 * CPA partner channel (Phase 1 of the tax-insight pipeline).
 *
 * A CPA registers, gets a co-branded referral link, and shares it with clients.
 * The client signs up (attributed to the CPA) and runs the consumer-direct
 * tax-readiness flow. The CPA is an INVITER ONLY — no endpoint here returns a
 * client's tax figures, income, or any borrower financial data, which keeps the
 * CPA outside the IRC §7216 disclosure flow. No compensation is tracked (RESPA §8).
 */

/** Public projection of a partner — safe to hand back to the CPA themselves. */
function publicPartner(partner: CpaPartner, baseUrl: string) {
  return {
    id: partner.id,
    firmName: partner.firmName,
    contactName: partner.contactName,
    email: partner.email,
    referralCode: partner.referralCode,
    referralLink: `${baseUrl}/cpa/${partner.referralCode}`,
    status: partner.status,
    createdAt: partner.createdAt,
  };
}

function baseUrlOf(req: { get: (h: string) => string | undefined }): string {
  return process.env.PUBLIC_BASE_URL || `https://${req.get("host")}`;
}

/** Server-generated, sanitized code slug: FIRM-SLUG-1234. Never client-supplied. */
export function makeReferralCode(firmName: string): string {
  const slug = firmName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "CPA";
  const suffix = crypto.randomInt(1000, 10000);
  return `${slug}-${suffix}`;
}

export function registerCpaPartnerRoutes(app: Express, storage: IStorage) {
  // ---- Public: CPA self-serve onboarding -------------------------------------
  app.post("/api/cpa-partners/register", async (req, res) => {
    try {
      const schema = z.object({
        firmName: z.string().trim().min(1).max(255),
        contactName: z.string().trim().max(255).optional(),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(200),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
      }
      const { firmName, contactName, email: rawEmail, password } = parsed.data;
      const email = rawEmail.toLowerCase();

      if (await authStorage.getUserByEmail(email)) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(password);
      let user: User;
      try {
        user = await authStorage.createUserWithPassword({
          email,
          passwordHash,
          firstName: contactName?.split(" ")[0] || firmName,
          lastName: null,
          role: "cpa",
        });
      } catch (dbError: any) {
        if (dbError?.code === "23505") {
          return res.status(409).json({ error: "An account with this email already exists" });
        }
        throw dbError;
      }

      // Create the partner record with a unique code (retry on the rare slug clash).
      let partner: CpaPartner | undefined;
      for (let attempt = 0; attempt < 5 && !partner; attempt++) {
        try {
          partner = await storage.createCpaPartner({
            userId: user.id,
            firmName,
            contactName: contactName || null,
            email,
            referralCode: makeReferralCode(firmName),
            status: "active",
          });
        } catch (dbError: any) {
          if (dbError?.code === "23505" && attempt < 4) continue; // code collision → retry
          throw dbError;
        }
      }
      if (!partner) {
        return res.status(500).json({ error: "Could not allocate a referral code, please retry" });
      }

      logAudit(req, "cpa_partner.registered", "cpa_partner", partner.id, { firmName });

      req.login(
        {
          id: user.id,
          email: user.email || undefined,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          profileImageUrl: user.profileImageUrl || undefined,
          role: user.role,
        },
        (err: unknown) => {
          if (err) {
            return res.status(500).json({ error: "Registration succeeded but login failed" });
          }
          res.status(201).json({ partner: publicPartner(partner!, baseUrlOf(req)) });
        },
      );
    } catch (error) {
      console.error("CPA partner register error:", error);
      res.status(500).json({ error: "Failed to register CPA partner" });
    }
  });

  // ---- Public: validate a referral code for the branded landing --------------
  app.get("/api/cpa/validate/:code", async (req, res) => {
    try {
      const partner = await storage.getCpaPartnerByCode(req.params.code);
      if (!partner || partner.status !== "active") {
        return res.status(404).json({ error: "Invalid or inactive referral link" });
      }
      // Branding only — no client data of any kind.
      res.json({ valid: true, firmName: partner.firmName, contactName: partner.contactName });
    } catch (error) {
      console.error("CPA validate error:", error);
      res.status(500).json({ error: "Failed to validate referral link" });
    }
  });

  // ---- Authed client: attribute self to a CPA --------------------------------
  app.post("/api/cpa/apply-referral", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const schema = z.object({ referralCode: z.string().trim().min(1).max(40) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Referral code is required" });
      }

      const partner = await storage.getCpaPartnerByCode(parsed.data.referralCode);
      if (!partner || partner.status !== "active") {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      if (partner.userId === user.id) {
        return res.status(400).json({ error: "You cannot use your own referral code" });
      }

      // First-touch wins: if already attributed, keep the original silently.
      const existing = await storage.getCpaReferralByUser(user.id);
      if (existing) {
        return res.json({ success: true, alreadyAttributed: true });
      }

      try {
        await storage.createCpaReferral({
          cpaPartnerId: partner.id,
          referredUserId: user.id,
          clientName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        });
      } catch (dbError: any) {
        if (dbError?.code === "23505") {
          return res.json({ success: true, alreadyAttributed: true }); // race — someone else won
        }
        throw dbError;
      }

      logAudit(req, "cpa_referral.created", "cpa_partner", partner.id, {});
      res.json({ success: true, firmName: partner.firmName });
    } catch (error) {
      console.error("CPA apply-referral error:", error);
      res.status(500).json({ error: "Failed to apply referral code" });
    }
  });

  // ---- Authed CPA: own profile + stage-only client visibility ----------------
  app.get("/api/cpa/me", requireRole("cpa", "admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const partner = await storage.getCpaPartnerByUserId(user.id);
      if (!partner) {
        return res.status(404).json({ error: "No CPA partner profile for this account" });
      }
      res.json({ partner: publicPartner(partner, baseUrlOf(req)) });
    } catch (error) {
      console.error("CPA me error:", error);
      res.status(500).json({ error: "Failed to load CPA profile" });
    }
  });

  app.get("/api/cpa/referrals", requireRole("cpa", "admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const partner = await storage.getCpaPartnerByUserId(user.id);
      if (!partner) {
        return res.status(404).json({ error: "No CPA partner profile for this account" });
      }
      // Stage + minimal name only — never financials, tax figures, or email.
      const referrals = await storage.getCpaReferralsForPortal(partner.id);
      res.json({ referrals });
    } catch (error) {
      console.error("CPA referrals error:", error);
      res.status(500).json({ error: "Failed to load referrals" });
    }
  });

  app.get("/api/cpa/stats", requireRole("cpa", "admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const partner = await storage.getCpaPartnerByUserId(user.id);
      if (!partner) {
        return res.status(404).json({ error: "No CPA partner profile for this account" });
      }
      const stats = await storage.getCpaReferralStats(partner.id);
      res.json(stats);
    } catch (error) {
      console.error("CPA stats error:", error);
      res.status(500).json({ error: "Failed to load stats" });
    }
  });
}
