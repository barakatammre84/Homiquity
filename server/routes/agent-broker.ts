import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { z } from "zod";
import crypto from "crypto";
import {
  type User,
  insertAgentReferralRequestSchema,
} from "@shared/schema";

export function registerAgentBrokerRoutes(
  app: Express,
  storage: IStorage,
) {
  // Agent Profile Routes
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgentProfiles();
      res.json(agents);
    } catch (error) {
      console.error("Get agents error:", error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.get("/api/agents/search", async (req, res) => {
    try {
      const { location, specialty } = req.query;
      const agents = await storage.searchAgentProfiles({
        location: location as string | undefined,
        specialty: specialty as string | undefined,
      });
      const enriched = await Promise.all(
        agents.map(async (agent) => {
          const user = await storage.getUser(agent.userId);
          return {
            id: agent.id,
            firstName: user?.firstName || "Agent",
            lastName: user?.lastName || "",
            bio: agent.bio,
            brokerage: agent.brokerage,
            specialties: agent.specialties,
            serviceArea: agent.serviceArea,
            photoUrl: agent.photoUrl,
            averageRating: agent.averageRating,
            totalReviews: agent.totalReviews,
            propertiesSold: agent.propertiesSold,
            activeListings: agent.activeListings,
            yearsInBusiness: agent.yearsInBusiness,
            isVerified: agent.isVerified,
          };
        })
      );
      res.json(enriched);
    } catch (error) {
      console.error("Search agents error:", error);
      res.status(500).json({ error: "Failed to search agents" });
    }
  });

  app.post("/api/agent-referral-requests", async (req, res) => {
    try {
      const parsed = insertAgentReferralRequestSchema.parse(req.body);
      const request = await storage.createAgentReferralRequest(parsed);

      let matchedAgent = null;
      let bestMatch = null;

      if (parsed.preferredAgentId) {
        bestMatch = await storage.getAgentProfile(parsed.preferredAgentId);
      }

      if (!bestMatch) {
        const agents = await storage.searchAgentProfiles({
          location: parsed.location,
        });
        if (agents.length > 0) {
          bestMatch = agents[0];
        }
      }

      if (bestMatch) {
        await storage.updateAgentReferralRequest(request.id, {
          matchedAgentId: bestMatch.id,
          status: "matched",
          referralSentAt: new Date(),
        });
        const user = await storage.getUser(bestMatch.userId);
        matchedAgent = {
          firstName: user?.firstName || "Agent",
          lastName: user?.lastName || "",
          brokerage: bestMatch.brokerage,
          photoUrl: bestMatch.photoUrl,
        };
      }

      res.json({
        id: request.id,
        status: matchedAgent ? "matched" : "pending",
        matchedAgent,
      });
    } catch (error) {
      console.error("Create referral request error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to submit referral request" });
    }
  });

  app.get("/api/agent-referral-requests", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const requests = await storage.getAgentReferralRequests();
      res.json(requests);
    } catch (error) {
      console.error("Get referral requests error:", error);
      res.status(500).json({ error: "Failed to get referral requests" });
    }
  });

  app.get("/api/agents/:agentId", async (req, res) => {
    try {
      const agent = await storage.getAgentProfile(req.params.agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const user = await storage.getUser(agent.userId);
      res.json({
        ...agent,
        user: user ? { email: user.email, firstName: user.firstName, lastName: user.lastName } : undefined,
      });
    } catch (error) {
      console.error("Get agent error:", error);
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  app.get("/api/agents/:agentId/listings", async (req, res) => {
    try {
      const properties = await storage.getPropertiesByAgent(req.params.agentId);
      res.json(properties.filter(p => p.status === "active"));
    } catch (error) {
      console.error("Get agent listings error:", error);
      res.status(500).json({ error: "Failed to get agent listings" });
    }
  });

  // Current user agent profile routes
  app.get("/api/me/agent-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getAgentProfileByUserId(userId);
      
      if (!profile) {
        profile = await storage.createAgentProfile({ userId });
      }
      
      const user = await storage.getUser(userId);
      res.json({
        ...profile,
        user: user ? { email: user.email, firstName: user.firstName, lastName: user.lastName } : undefined,
      });
    } catch (error) {
      console.error("Get my agent profile error:", error);
      res.status(500).json({ error: "Failed to get agent profile" });
    }
  });

  app.patch("/api/me/agent-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getAgentProfileByUserId(userId);
      
      if (!profile) {
        profile = await storage.createAgentProfile({ userId, ...req.body });
      } else {
        profile = await storage.updateAgentProfile(profile.id, req.body);
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Update agent profile error:", error);
      res.status(500).json({ error: "Failed to update agent profile" });
    }
  });

  app.get("/api/me/listings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const profile = await storage.getAgentProfileByUserId(userId);
      
      if (!profile) {
        return res.json([]);
      }
      
      const properties = await storage.getPropertiesByAgent(profile.id);
      res.json(properties);
    } catch (error) {
      console.error("Get my listings error:", error);
      res.status(500).json({ error: "Failed to get listings" });
    }
  });

  // Broker Referral Dashboard endpoints
  app.get("/api/broker/referrals", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const user = req.user as User;
      
      const referrals = await storage.getBrokerReferrals(user.id);
      res.json(referrals);
    } catch (error) {
      console.error("Get broker referrals error:", error);
      res.status(500).json({ error: "Failed to get referrals" });
    }
  });

  app.get("/api/broker/stats", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const user = req.user as User;
      
      const stats = await storage.getBrokerReferralStats(user.id);
      res.json(stats);
    } catch (error) {
      console.error("Get broker stats error:", error);
      res.status(500).json({ error: "Failed to get broker stats" });
    }
  });

  app.get("/api/broker/commissions", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const user = req.user as User;
      
      const commissions = await storage.getBrokerCommissions(user.id);
      res.json(commissions);
    } catch (error) {
      console.error("Get broker commissions error:", error);
      res.status(500).json({ error: "Failed to get commissions" });
    }
  });

  app.post("/api/broker/commissions", requireRole("admin", "lo", "broker"), async (req, res) => {
    try {
      const user = req.user as User;
      
      const { brokerId, applicationId, loanAmount, commissionRate } = req.body;
      
      if (!brokerId || !applicationId || !loanAmount || !commissionRate) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const commissionAmount = (Number(loanAmount) * Number(commissionRate)).toFixed(2);
      
      const commission = await storage.createBrokerCommission({
        brokerId,
        applicationId,
        loanAmount: loanAmount.toString(),
        commissionRate: commissionRate.toString(),
        commissionAmount,
        status: "pending",
      });
      
      res.status(201).json(commission);
    } catch (error) {
      console.error("Create broker commission error:", error);
      res.status(500).json({ error: "Failed to create commission" });
    }
  });

  app.patch("/api/broker/commissions/:id", requireRole("admin", "lo", "broker"), async (req, res) => {
    try {
      const user = req.user as User;
      
      const { id } = req.params;

      const updateData: Record<string, any> = {};
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.paidAt !== undefined) updateData.paidAt = req.body.paidAt;
      if (req.body.paidBy !== undefined) updateData.paidBy = req.body.paidBy;

      if (!updateData.status && Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      if (updateData.status === "paid" && !updateData.paidAt) {
        updateData.paidAt = new Date();
        updateData.paidBy = user.id;
      }
      
      const updated = await storage.updateBrokerCommission(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Commission not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update broker commission error:", error);
      res.status(500).json({ error: "Failed to update commission" });
    }
  });

  app.get("/api/admin/commissions/pending", requireRole("admin"), async (req, res) => {
    try {
      const commissions = await storage.getAllPendingCommissions();
      res.json(commissions);
    } catch (error) {
      console.error("Get pending commissions error:", error);
      res.status(500).json({ error: "Failed to get pending commissions" });
    }
  });

  // ===== APPLICATION INVITES (Referral Links) =====
  
  // Create a new invite link (for LOs, LOAs, and agents)
  app.post("/api/application-invites", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const allowedRoles = ["admin", "lo", "loa"];
      
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "Only loan officers and assistants can create invite links" });
      }

      const schema = z.object({
        clientName: z.string().optional(),
        clientEmail: z.string().email().optional().or(z.literal("")),
        clientPhone: z.string().optional(),
        message: z.string().optional(),
        expiresInDays: z.number().min(1).max(90).default(30),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const { clientName, clientEmail, clientPhone, message, expiresInDays } = result.data;

      // Generate unique token
      const token = crypto.randomBytes(32).toString("hex");
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invite = await storage.createApplicationInvite({
        referrerId: user.id,
        referrerType: user.role as "lo" | "loa" | "admin",
        clientName: clientName || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        message: message || null,
        token,
        status: "pending",
        expiresAt,
      });

      const baseUrl = process.env.PUBLIC_BASE_URL
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
        || (process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null)
        || `https://${req.get("host")}`;
      const inviteUrl = `${baseUrl}/apply/${token}`;

      res.status(201).json({ 
        invite,
        inviteUrl,
      });
    } catch (error) {
      console.error("Create application invite error:", error);
      res.status(500).json({ error: "Failed to create invite link" });
    }
  });

  // Get all invites for current user (referrer)
  app.get("/api/application-invites", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const invites = await storage.getApplicationInvitesByReferrer(user.id);
      
      // Add computed fields
      const invitesWithStatus = invites.map(invite => ({
        ...invite,
        isExpired: new Date(invite.expiresAt) < new Date(),
      }));

      res.json(invitesWithStatus);
    } catch (error) {
      console.error("Get application invites error:", error);
      res.status(500).json({ error: "Failed to get invites" });
    }
  });

  // Validate invite token (public endpoint for when client clicks link)
  app.get("/api/application-invites/validate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invite = await storage.getApplicationInviteByToken(token);

      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      // Check if expired
      if (new Date(invite.expiresAt) < new Date()) {
        await storage.updateApplicationInvite(invite.id, { status: "expired" });
        return res.status(410).json({ error: "This invite link has expired" });
      }

      // Check if already used
      if (invite.status === "applied") {
        return res.status(410).json({ error: "This invite link has already been used" });
      }

      // Get referrer info
      const referrer = await storage.getUser(invite.referrerId);

      // Mark as clicked if first time
      if (invite.status === "pending") {
        await storage.updateApplicationInvite(invite.id, { 
          status: "clicked",
          clickedAt: new Date(),
        });
      }

      res.json({
        valid: true,
        invite: {
          id: invite.id,
          clientName: invite.clientName,
          clientEmail: invite.clientEmail,
          message: invite.message,
          referrer: referrer ? {
            firstName: referrer.firstName,
            lastName: referrer.lastName,
            role: referrer.role,
          } : null,
        },
      });
    } catch (error) {
      console.error("Validate invite error:", error);
      res.status(500).json({ error: "Failed to validate invite" });
    }
  });

  app.post("/api/application-invites/:id/applied", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const { loanApplicationId } = req.body;

      if (!loanApplicationId || typeof loanApplicationId !== "string") {
        return res.status(400).json({ error: "loanApplicationId is required" });
      }

      const loanApp = await storage.getLoanApplication(loanApplicationId);
      if (!loanApp || loanApp.userId !== user.id) {
        return res.status(403).json({ error: "You can only link your own application" });
      }

      const updated = await storage.updateApplicationInvite(id, {
        status: "applied",
        appliedAt: new Date(),
        loanApplicationId,
      });

      if (!updated) {
        return res.status(404).json({ error: "Invite not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Mark invite applied error:", error);
      res.status(500).json({ error: "Failed to update invite" });
    }
  });

  app.post("/api/application-invites/:id/resend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const { expiresInDays } = req.body;

      const invites = await storage.getApplicationInvitesByReferrer(user.id);
      const invite = invites.find(i => i.id === id);

      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      if (invite.status === "applied") {
        return res.status(400).json({ error: "This invite has already been used" });
      }

      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + (expiresInDays || 30));

      const updated = await storage.updateApplicationInvite(id, {
        status: "pending",
        expiresAt: newExpiry,
        clickedAt: null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Resend invite error:", error);
      res.status(500).json({ error: "Failed to resend invite" });
    }
  });

  app.post("/api/application-invites/:id/revoke", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const invites = await storage.getApplicationInvitesByReferrer(user.id);
      const invite = invites.find(i => i.id === id);

      if (!invite) {
        return res.status(404).json({ error: "Invite not found" });
      }
      if (invite.status === "applied") {
        return res.status(400).json({ error: "Cannot revoke an applied invite" });
      }

      const updated = await storage.updateApplicationInvite(id, {
        expiresAt: new Date(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Revoke invite error:", error);
      res.status(500).json({ error: "Failed to revoke invite" });
    }
  });

  // ===== ANALYTICS DASHBOARD =====

  // Get pipeline metrics
  app.get("/api/analytics/pipeline", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const metrics = await storage.computePipelineMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get pipeline metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get bottleneck analysis
  app.get("/api/analytics/bottlenecks", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const analysis = await storage.getBottleneckAnalysis();
      res.json(analysis);
    } catch (error) {
      console.error("Get bottleneck analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  // Get staff workload metrics
  app.get("/api/analytics/workload", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const metrics = await storage.getStaffWorkloadMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get workload metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get historical snapshots
  app.get("/api/analytics/history", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const snapshots = await storage.getAnalyticsSnapshots(days);
      res.json(snapshots);
    } catch (error) {
      console.error("Get analytics history error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  // Get SLA configurations
  app.get("/api/sla-configurations", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const configs = await storage.getAllSlaConfigurations();
      res.json(configs);
    } catch (error) {
      console.error("Get SLA configs error:", error);
      res.status(500).json({ error: "Failed to get configurations" });
    }
  });

  // Create SLA configuration (admin only)
  app.post("/api/sla-configurations", requireRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
        applicationToProcessingHours: z.number().optional(),
        processingToUnderwritingHours: z.number().optional(),
        underwritingDecisionHours: z.number().optional(),
        conditionalToCtcHours: z.number().optional(),
        ctcToClosingHours: z.number().optional(),
        totalApplicationToCloseHours: z.number().optional(),
        loanType: z.string().optional(),
        effectiveDate: z.string().transform(s => new Date(s)),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const config = await storage.createSlaConfiguration({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(config);
    } catch (error) {
      console.error("Create SLA config error:", error);
      res.status(500).json({ error: "Failed to create configuration" });
    }
  });

  // Get application milestones
  app.get("/api/application-milestones/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const milestone = await storage.getApplicationMilestone(applicationId);
      res.json(milestone || null);
    } catch (error) {
      console.error("Get application milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  // Update application milestones
  app.patch("/api/application-milestones/:applicationId", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      // Get or create milestone record
      let milestone = await storage.getApplicationMilestone(applicationId);
      if (!milestone) {
        milestone = await storage.createApplicationMilestone({ applicationId });
      }

      const updated = await storage.updateApplicationMilestone(applicationId, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Update application milestones error:", error);
      res.status(500).json({ error: "Failed to update milestones" });
    }
  });

  // ============================================
  // Referral Link System Routes
  // ============================================
  
  // Get or generate referral code for current LO user
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
      const referrals = await storage.getReferralsByUser(user.id);
      
      // Get applications for each referred user
      const referralsWithApps = await Promise.all(referrals.map(async (referredUser) => {
        const apps = await storage.getLoanApplicationsByUser(referredUser.id);
        return {
          ...referredUser,
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

  // Create co-brand profile
  app.post("/api/co-brand/profile", isAuthenticated, async (req, res) => {
    try {
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
  app.post("/api/deal-desk/threads", isAuthenticated, async (req, res) => {
    try {
      const { subject, scenarioType, loanAmount, propertyType, creditScore, borrowerType, notes } = req.body;
      if (!subject) {
        return res.status(400).json({ error: "Subject is required" });
      }

      const thread = await storage.createDealDeskThread({
        agentUserId: req.user!.id,
        subject,
        scenarioType: scenarioType || null,
        loanAmount: loanAmount || null,
        propertyType: propertyType || null,
        creditScore: creditScore || null,
        borrowerType: borrowerType || null,
        notes: notes || null,
        status: "open",
      });

      if (notes) {
        await storage.createDealDeskMessage({
          threadId: thread.id,
          senderUserId: req.user!.id,
          content: notes,
        });
      }

      res.json(thread);
    } catch (error) {
      console.error("Create deal desk thread error:", error);
      res.status(500).json({ error: "Failed to create thread" });
    }
  });

  // Get deal desk threads for current user
  app.get("/api/deal-desk/threads", isAuthenticated, async (req, res) => {
    try {
      const threads = await storage.getDealDeskThreadsByUser(req.user!.id);
      res.json(threads);
    } catch (error) {
      console.error("Get deal desk threads error:", error);
      res.status(500).json({ error: "Failed to get threads" });
    }
  });

  // Get a specific thread with messages
  app.get("/api/deal-desk/threads/:id", isAuthenticated, async (req, res) => {
    try {
      const thread = await storage.getDealDeskThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.agentUserId !== req.user!.id && thread.loUserId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getDealDeskMessagesByThread(thread.id);
      const enrichedMessages = await Promise.all(messages.map(async (msg: any) => {
        const sender = await storage.getUser(msg.senderUserId);
        return {
          ...msg,
          senderName: sender ? `${sender.firstName || ""} ${sender.lastName || ""}`.trim() : "Unknown",
        };
      }));

      res.json({ thread, messages: enrichedMessages });
    } catch (error) {
      console.error("Get deal desk thread error:", error);
      res.status(500).json({ error: "Failed to get thread" });
    }
  });

  // Add message to a deal desk thread
  app.post("/api/deal-desk/threads/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const thread = await storage.getDealDeskThread(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      if (thread.agentUserId !== req.user!.id && thread.loUserId !== req.user!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const message = await storage.createDealDeskMessage({
        threadId: thread.id,
        senderUserId: req.user!.id,
        content,
      });

      res.json(message);
    } catch (error) {
      console.error("Create deal desk message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Close a deal desk thread
  app.patch("/api/deal-desk/threads/:id/close", isAuthenticated, async (req, res) => {
    try {
      const thread = await storage.getDealDeskThread(req.params.id);
      if (!thread || thread.agentUserId !== req.user!.id) {
        return res.status(404).json({ error: "Thread not found" });
      }
      const updated = await storage.updateDealDeskThread(thread.id, { status: "closed", closedAt: new Date() });
      res.json(updated);
    } catch (error) {
      console.error("Close deal desk thread error:", error);
      res.status(500).json({ error: "Failed to close thread" });
    }
  });

  // =============================================
  // Agent Pipeline Routes
  // =============================================
  app.get("/api/agent-pipeline", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const pipeline = await storage.getAgentPipeline(req.user!.id);
      res.json(pipeline);
    } catch (error) {
      console.error("Get agent pipeline error:", error);
      res.status(500).json({ error: "Failed to get agent pipeline" });
    }
  });

  // =============================================
  // Co-Branded Letter Enhancement Routes
  // =============================================
  app.get("/api/pre-approval-letters/:id/co-brand-preview", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const agentProfileId = req.query.agentProfileId as string;

      if (!agentProfileId) {
        return res.status(400).json({ error: "agentProfileId query parameter is required" });
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters, coBrandProfiles } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [letter] = await database
        .select()
        .from(preApprovalLetters)
        .where(eq(preApprovalLetters.id, id))
        .limit(1);

      if (!letter) {
        return res.status(404).json({ error: "Pre-approval letter not found" });
      }

      const coBrandProfile = await storage.getCoBrandProfile(agentProfileId);

      res.json({
        letter,
        coBrand: coBrandProfile || null,
      });
    } catch (error) {
      console.error("Co-brand preview error:", error);
      res.status(500).json({ error: "Failed to get co-brand preview" });
    }
  });

  app.put("/api/pre-approval-letters/:id/co-brand", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { id } = req.params;
      const coBrandSchema = z.object({
        agentName: z.string(),
        agentNmlsId: z.string().optional(),
        agentContactEmail: z.string().email().optional(),
        agentContactPhone: z.string().optional(),
        agentBrandName: z.string().optional(),
        agentLogoUrl: z.string().optional(),
      });

      const validated = coBrandSchema.parse(req.body);

      const { db: database } = await import("../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const [letter] = await database
        .select()
        .from(preApprovalLetters)
        .where(eq(preApprovalLetters.id, id))
        .limit(1);

      if (!letter) {
        return res.status(404).json({ error: "Pre-approval letter not found" });
      }

      res.json({
        letter,
        coBrand: validated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Co-brand update error:", error);
      res.status(500).json({ error: "Failed to update co-branding" });
    }
  });
}
