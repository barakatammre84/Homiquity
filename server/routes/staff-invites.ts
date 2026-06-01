import type { Express } from "express";
import type { IStorage } from "../storage";
import type { User } from "@shared/schema";
import crypto from "crypto";
import { logAudit } from "../auditLog";
import { sendNotificationEmail } from "../services/emailService";
import { isAuthenticated, requireRole } from "../auth";

export function registerStaffInviteRoutes(app: Express, storage: IStorage) {
  app.post("/api/staff-invites", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const { role, email, expiresInDays } = req.body;
      
      const validRoles = ["lo", "loa", "processor", "underwriter", "closer", "broker", "lender"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role", validRoles });
      }
      
      const code = crypto.randomBytes(6).toString("hex").toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));
      
      const invite = await storage.createStaffInvite({
        code,
        role,
        email: email || null,
        expiresAt,
        createdBy: user.id,
      });

      if (email) {
        sendNotificationEmail({
          type: "invite_sent",
          recipientEmail: email,
          data: {
            role,
            code,
            inviterName: user.firstName || "Admin",
          },
        });
      }
      
      res.status(201).json({ invite });
    } catch (error) {
      console.error("Error creating staff invite:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  app.get("/api/staff-invites", requireRole("admin"), async (req, res) => {
    try {
      const invites = await storage.getStaffInvites();
      res.json({ invites });
    } catch (error) {
      console.error("Error listing invites:", error);
      res.status(500).json({ error: "Failed to list invites" });
    }
  });

  app.get("/api/staff-invites/validate/:code", async (req, res) => {
    try {
      const invite = await storage.getStaffInviteByCode(req.params.code);
      if (!invite) {
        return res.status(404).json({ valid: false, error: "Invalid invite code" });
      }
      if (invite.usedAt) {
        return res.json({ valid: false, error: "Invite already used" });
      }
      if (new Date(invite.expiresAt!) < new Date()) {
        return res.json({ valid: false, error: "Invite has expired" });
      }
      res.json({ valid: true, role: invite.role, email: invite.email });
    } catch (error) {
      console.error("Error validating invite:", error);
      res.status(500).json({ error: "Failed to validate invite" });
    }
  });

  app.post("/api/staff-invites/redeem", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Invite code is required" });
      }
      
      const invite = await storage.getStaffInviteByCode(code.toUpperCase());
      if (!invite) {
        return res.status(404).json({ error: "Invalid invite code" });
      }
      if (invite.usedAt) {
        return res.status(400).json({ error: "This invite has already been used" });
      }
      if (new Date(invite.expiresAt!) < new Date()) {
        return res.status(400).json({ error: "This invite has expired" });
      }
      if (invite.email && invite.email !== user.email) {
        return res.status(403).json({ error: "This invite is for a different email address" });
      }
      
      const redeemed = await storage.redeemStaffInvite(code.toUpperCase(), user.id);
      if (!redeemed) {
        return res.status(400).json({ error: "Failed to redeem invite" });
      }
      
      await storage.updateUserRole(user.id, invite.role);
      logAudit(req, "invite.redeemed", "staff_invite", code, { role: invite.role, userId: user.id });
      
      res.json({ 
        success: true, 
        role: invite.role,
        message: `Your account has been upgraded to ${invite.role.replace(/_/g, " ")}` 
      });
    } catch (error) {
      console.error("Error redeeming invite:", error);
      res.status(500).json({ error: "Failed to redeem invite" });
    }
  });
}
