// Agent/broker routes: Referral links (code/stats/apply) + co-brand profiles and public page.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isPartnerRole } from "@shared/roles";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../../db";
import { inArray } from "drizzle-orm";
import {
  type User,
  isInternalStaffRole,
  isStaffRole,
  insertAgentReferralRequestSchema,
  insertAgentProfileSchema,
  insertApplicationMilestoneSchema,
  loanApplications,
} from "@shared/schema";
import { parseBodyOr400 } from "../validate";
import { firstQueryValue } from "../queryParams";


export function registerReferralCoBrandRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/my-referral-code", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Only LOs, partners, or staff can have referral codes
      const allowedRoles = ['lo', 'loa', 'admin'];
      if (!allowedRoles.includes(user.role) && !user.isPartner) {
        return res.status(403).json({ error: "Only Loan Officers can generate referral codes" });
      }
      
      const referralCode = await storage.generateReferralCode(user.id);
      res.json({ 
        referralCode, 
        referralLink: `/ref/${referralCode}`,
        fullUrl: `${req.protocol}://${req.get('host')}/ref/${referralCode}`
      });
    } catch (error) {
      console.error("Get referral code error:", error);
      res.status(500).json({ error: "Failed to get referral code" });
    }
  });
  
  // Get referral stats for current LO
  app.get("/api/my-referral-stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      // Self-registering partners (cpa, realtor) are inviter-only: they read
      // their own minimized surfaces (/api/cpa/*, /api/partners/me/*), never
      // this LO rail, which joins full borrower rows. Without this gate a
      // realtor whose slug attributed a buyer via users.referred_by_user_id
      // could reach the borrower data below.
      if (isPartnerRole(user.role)) {
        return res.status(403).json({ error: "Not available for partner accounts" });
      }
      const stats = await storage.getReferralStats(user.id);
      res.json(stats);
    } catch (error) {
      console.error("Get referral stats error:", error);
      res.status(500).json({ error: "Failed to get referral stats" });
    }
  });

  // Get list of users referred by current LO
  app.get("/api/my-referrals", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      // See /api/my-referral-stats: external partner roles are inviter-only and
      // must not reach this borrower-data rail.
      if (isPartnerRole(user.role)) {
        return res.status(403).json({ error: "Not available for partner accounts" });
      }
      const referrals = await storage.getReferralsByUser(user.id);

      // Get applications for each referred user
      const referralsWithApps = await Promise.all(referrals.map(async (referredUser) => {
        const apps = await storage.getLoanApplicationsByUser(referredUser.id);
        // Never egress auth-sensitive columns from a full users row, even to an
        // LO: passwordHash and lockout state have no business in an API response.
        const { passwordHash, failedLoginAttempts, lockoutUntil, ...safeUser } = referredUser;
        return {
          ...safeUser,
          applicationCount: apps.length,
          latestApplication: apps[0] || null,
        };
      }));

      res.json(referralsWithApps);
    } catch (error) {
      console.error("Get referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });
  
  // Validate a referral code and get LO info (public route for landing page)
  app.get("/api/referral/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const referrer = await storage.getUserByReferralCode(code);
      
      if (!referrer) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      
      // Return public profile info about the referrer
      res.json({
        valid: true,
        loName: `${referrer.firstName || ''} ${referrer.lastName || ''}`.trim() || 'Your Loan Officer',
        firstName: referrer.firstName,
        lastName: referrer.lastName,
        email: referrer.email,
        profileImageUrl: referrer.profileImageUrl,
        nmlsId: referrer.nmlsId,
        companyName: referrer.partnerCompanyName,
      });
    } catch (error) {
      console.error("Validate referral code error:", error);
      res.status(500).json({ error: "Failed to validate referral code" });
    }
  });
  
  // Apply referral code to current user (called after signup with ref code)
  app.post("/api/apply-referral", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ error: "Referral code is required" });
      }
      
      // Check if user already has a referrer
      if (user.referredByUserId) {
        return res.status(400).json({ error: "You already have a referring loan officer" });
      }
      
      const referrer = await storage.getUserByReferralCode(referralCode);
      if (!referrer) {
        return res.status(404).json({ error: "Invalid referral code" });
      }
      
      // Can't refer yourself
      if (referrer.id === user.id) {
        return res.status(400).json({ error: "Cannot use your own referral code" });
      }
      
      await storage.setUserReferredBy(user.id, referrer.id);
      
      res.json({ 
        success: true, 
        message: `You've been connected with ${referrer.firstName || 'your'} ${referrer.lastName || 'loan officer'}!`
      });
    } catch (error) {
      console.error("Apply referral error:", error);
      res.status(500).json({ error: "Failed to apply referral code" });
    }
  });

  // ================================
  // Agent Co-Branding Portal API Routes
  // ================================

  // Get or create co-brand profile for current user
  app.get("/api/co-brand/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getCoBrandProfileByUser(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      console.error("Get co-brand profile error:", error);
      res.status(500).json({ error: "Failed to get co-brand profile" });
    }
  });

  // Create co-brand profile.
  // Staff/partner roles only: co-brand profiles render on the PUBLIC
  // /partner/:profileId landing page, so a consumer account must not be able
  // to publish arbitrary branding/bio content under the platform's domain.
  app.post("/api/co-brand/profile", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff or partner access required" });
      }
      const existing = await storage.getCoBrandProfileByUser(req.user!.id);
      if (existing) {
        return res.status(409).json({ error: "Co-brand profile already exists", profile: existing });
      }

      const { brandName, tagline, contactEmail, contactPhone, websiteUrl, nmlsId, licenseNumber, disclaimerText, bio, specialties, serviceAreas, primaryColor, accentColor } = req.body;
      if (!brandName) {
        return res.status(400).json({ error: "Brand name is required" });
      }

      const profile = await storage.createCoBrandProfile({
        userId: req.user!.id,
        brandName,
        tagline: tagline || null,
        contactEmail: contactEmail || req.user!.email || null,
        contactPhone: contactPhone || null,
        websiteUrl: websiteUrl || null,
        nmlsId: nmlsId || null,
        licenseNumber: licenseNumber || null,
        disclaimerText: disclaimerText || null,
        bio: bio || null,
        specialties: specialties || null,
        serviceAreas: serviceAreas || null,
        primaryColor: primaryColor || "#1e3a5f",
        accentColor: accentColor || "#10b981",
      });
      res.json(profile);
    } catch (error) {
      console.error("Create co-brand profile error:", error);
      res.status(500).json({ error: "Failed to create co-brand profile" });
    }
  });

  // Update co-brand profile
  app.patch("/api/co-brand/profile/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff or partner access required" });
      }
      const profile = await storage.getCoBrandProfile(req.params.id);
      if (!profile || profile.userId !== req.user!.id) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const allowedFields = [
        "brandName", "tagline", "logoUrl", "heroImageUrl", "primaryColor", "accentColor",
        "contactEmail", "contactPhone", "websiteUrl", "nmlsId", "licenseNumber",
        "disclaimerText", "bio", "specialties", "serviceAreas", "isActive",
      ];
      const safeUpdate: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) safeUpdate[key] = req.body[key];
      }

      const updated = await storage.updateCoBrandProfile(req.params.id, safeUpdate);
      res.json(updated);
    } catch (error) {
      console.error("Update co-brand profile error:", error);
      res.status(500).json({ error: "Failed to update co-brand profile" });
    }
  });

  // Public endpoint - Get co-brand profile by user ID (for public landing pages)
  app.get("/api/co-brand/public/:id", async (req, res) => {
    try {
      let profile = await storage.getCoBrandProfile(req.params.id);
      if (!profile) {
        profile = await storage.getCoBrandProfileByUser(req.params.id);
      }
      if (!profile || !profile.isActive) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const user = await storage.getUser(profile.userId);
      res.json({
        brandName: profile.brandName,
        tagline: profile.tagline,
        logoUrl: profile.logoUrl,
        heroImageUrl: profile.heroImageUrl,
        primaryColor: profile.primaryColor,
        accentColor: profile.accentColor,
        contactEmail: profile.contactEmail,
        contactPhone: profile.contactPhone,
        websiteUrl: profile.websiteUrl,
        nmlsId: profile.nmlsId,
        licenseNumber: profile.licenseNumber,
        disclaimerText: profile.disclaimerText,
        bio: profile.bio,
        specialties: profile.specialties,
        serviceAreas: profile.serviceAreas,
        loName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Loan Officer",
        loProfileImage: user?.profileImageUrl || null,
        // Referral code (if the LO has one) so the co-branded landing page can
        // stash it and attribute the consumer to this LO after they sign up.
        referralCode: user?.referralCode || null,
      });
    } catch (error) {
      console.error("Get public co-brand error:", error);
      res.status(500).json({ error: "Failed to get co-brand profile" });
    }
  });

  // Get referred client statuses for current user
  app.get("/api/co-brand/referrals", isAuthenticated, async (req, res) => {
    try {
      const invites = await storage.getApplicationInvitesByReferrer(req.user!.id);
      const enriched = await Promise.all(invites.map(async (inv: any) => {
        let appStatus = null;
        let appStage = null;
        if (inv.loanApplicationId) {
          const app = await storage.getLoanApplication(inv.loanApplicationId);
          appStatus = app?.status || null;
          appStage = (app as any)?.currentStage || app?.status || null;
        }
        return {
          id: inv.id,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail,
          status: inv.status,
          createdAt: inv.createdAt,
          clickedAt: inv.clickedAt,
          appliedAt: inv.appliedAt,
          applicationStatus: appStatus,
          applicationStage: appStage,
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Get referral statuses error:", error);
      res.status(500).json({ error: "Failed to get referral statuses" });
    }
  });

  // ================================
  // Deal Desk API Routes
  // ================================

  // Create a deal desk thread
}
