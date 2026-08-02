// Agent/broker routes: Application invites: create/list/validate/applied/resend/revoke.
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
import { routeParams } from "../../http/routeParams";


export function registerInviteRoutes(
  app: Express,
  storage: IStorage,
) {
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

      const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.get("host")}`;
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

      // Partner progress signal: referring agents see how far their client's
      // application has progressed (stage only — no financials, no PII).
      const linkedIds = invites
        .map((i) => i.loanApplicationId)
        .filter((id): id is string => !!id);
      const stageById = new Map<string, string>();
      if (linkedIds.length > 0) {
        const rows = await db
          .select({ id: loanApplications.id, status: loanApplications.status })
          .from(loanApplications)
          .where(inArray(loanApplications.id, linkedIds));
        for (const row of rows) stageById.set(row.id, row.status);
      }

      const invitesWithStatus = invites.map(invite => ({
        ...invite,
        isExpired: new Date(invite.expiresAt) < new Date(),
        applicationStatus: invite.loanApplicationId
          ? stageById.get(invite.loanApplicationId) ?? null
          : null,
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
      const { token } = routeParams(req);
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
      const { id } = routeParams(req);
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
      const { id } = routeParams(req);
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
      const { id } = routeParams(req);

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
}
