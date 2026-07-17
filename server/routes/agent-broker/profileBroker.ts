// Agent/broker routes: Own agent profile + listings, broker referrals/stats/commissions, admin pending commissions.
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


export function registerProfileBrokerRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/me/agent-profile", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff or partner access required" });
      }
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
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff or partner access required" });
      }
      const userId = req.user!.id;
      let profile = await storage.getAgentProfileByUserId(userId);
      
      // userId omitted so a caller can't create/reassign a profile for another user.
      const data = parseBodyOr400(insertAgentProfileSchema.omit({ userId: true }).partial(), req.body, res);
      if (data === undefined) return;
      if (!profile) {
        profile = await storage.createAgentProfile({ ...data, userId });
      } else {
        profile = await storage.updateAgentProfile(profile.id, data);
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

  // Commission creation is restricted to admin only.
  // loanAmount is derived server-side from the application record — not client-supplied —
  // to prevent fabrication of inflated commission amounts.
  app.post("/api/broker/commissions", requireRole("admin"), async (req, res) => {
    try {
      const { applicationId, brokerId, commissionRate } = req.body;

      if (!applicationId || !brokerId || !commissionRate) {
        return res.status(400).json({ error: "applicationId, brokerId, and commissionRate are required" });
      }

      // commissionRate is a decimal fraction (e.g. 0.025 = 2.5%). Reject non-numeric
      // or out-of-range values to prevent malformed or fabricated commission records.
      const rate = Number(commissionRate);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 0.1) {
        return res.status(400).json({ error: "commissionRate must be a number between 0 and 0.1 (0%–10%)" });
      }

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Derive the authoritative loan amount from the application record.
      // Purchases: purchase price minus down payment (consistent with pipelineEngine
      // and loanAnalysis). Fall back to the pre-approval amount (e.g. refinances) when a
      // purchase price is not on file.
      const purchasePrice = Number(application.purchasePrice ?? 0);
      const downPayment = Number(application.downPayment ?? 0);
      const loanAmount =
        purchasePrice > 0
          ? purchasePrice - downPayment
          : Number(application.preApprovalAmount ?? 0);
      if (!loanAmount || loanAmount <= 0) {
        return res.status(422).json({ error: "Application does not have a loan amount on file" });
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

  // Commission status transitions are restricted to admin only.
  // Brokers and LOs may only update the notes field on records they own.
  app.patch("/api/broker/commissions/:id", requireRole("admin", "lo", "broker"), async (req, res) => {
    try {
      const user = req.user as User;

      const { id } = req.params;

      // Fetch the commission first to enforce ownership
      const existing = await storage.getBrokerCommission(id);
      if (!existing) {
        return res.status(404).json({ error: "Commission not found" });
      }

      // Status transitions (including "paid", "approved", "rejected") are admin-only.
      // Brokers and LOs can only update the notes field.
      if (req.body.status !== undefined && user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can change commission status" });
      }

      // Brokers may only update notes on their own commission records.
      // LOs have notes access on all commissions they manage (no object-level restriction).
      if (user.role === "broker" && existing.brokerId !== user.id) {
        return res.status(403).json({ error: "You may only update your own commission records" });
      }

      const updateData: Record<string, any> = {};
      // Only admit fields that callers are permitted to set
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.status !== undefined && user.role === "admin") {
        updateData.status = req.body.status;
      }
      // paidAt and paidBy are server-controlled only; never accepted from client body

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided" });
      }

      if (updateData.status === "paid") {
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
}
