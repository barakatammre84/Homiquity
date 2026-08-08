// Agent/broker routes: Own agent profile + listings, broker referrals/stats/commissions, admin pending commissions.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isAdmin, isPartnerRole } from "@shared/roles";
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
  BROKER_COMMISSION_STATUSES,
} from "@shared/schema";
import {
  MAX_COMMISSION_RATE,
  evaluateCommissionPayout,
  fundedSubmissionOf,
} from "@shared/commissionPayout";
import { parseBodyOr400 } from "../validate";
import { firstQueryValue } from "../queryParams";
import { routeParams } from "../../http/routeParams";


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

  // ---------------------------------------------------------------------
  // Read side: the largest payout this file may carry, and why (audit F-21).
  //
  // Exists so an admin learns the ceiling before choosing a rate rather than
  // by tripping the 422 below — the same read/write pairing the compensation
  // election got under F-18. Both surfaces score off `evaluateCommissionPayout`
  // so they cannot disagree about a file.
  // ---------------------------------------------------------------------
  app.get("/api/broker/commissions/quote/:applicationId", requireRole("admin"), async (req, res) => {
    try {
      const applicationId = String(req.params.applicationId);
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const rateRaw = firstQueryValue(req.query.rate);
      // With no rate supplied, probe at the platform ceiling: the evaluation
      // reports the same maxAmount/maxRate either way, and a refusal here is
      // information rather than an error.
      const rate = rateRaw !== undefined ? Number(rateRaw) : MAX_COMMISSION_RATE;

      const submissions = await storage.getLenderSubmissionsByApplication(applicationId);
      const funded = fundedSubmissionOf(submissions);

      res.json(
        evaluateCommissionPayout({
          applicationStatus: application.status,
          submissionStatus: funded?.status,
          fundedLoanAmount: funded?.fundedLoanAmount,
          compensationReceivedAmount: funded?.compensationReceivedAmount,
          compensationExpectedAmount: funded?.compensationExpectedAmount,
          rate,
        }),
      );
    } catch (error) {
      console.error("Commission payout quote error:", error);
      res.status(500).json({ error: "Failed to evaluate the commission payout" });
    }
  });

  // Commission creation is restricted to admin only.
  //
  // Every input to the amount is derived server-side — the client supplies only
  // a rate. Audit F-21: the basis is the FUNDED loan amount from the lender
  // submission, not `purchasePrice − downPayment` off the application, and the
  // payout is bounded by the compensation it is a share of. Before that, a 10%
  // rate on a $250k loan opened a $25,000 payable against $5,000 of revenue on
  // a file that need not even have funded.
  app.post("/api/broker/commissions", requireRole("admin"), async (req, res) => {
    try {
      const { applicationId, brokerId, commissionRate } = req.body;

      if (!applicationId || !brokerId || !commissionRate) {
        return res.status(400).json({ error: "applicationId, brokerId, and commissionRate are required" });
      }

      // commissionRate is a decimal fraction (e.g. 0.025 = 2.5%).
      const rate = Number(commissionRate);

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const submissions = await storage.getLenderSubmissionsByApplication(applicationId);
      const funded = fundedSubmissionOf(submissions);
      const evaluation = evaluateCommissionPayout({
        applicationStatus: application.status,
        submissionStatus: funded?.status,
        fundedLoanAmount: funded?.fundedLoanAmount,
        compensationReceivedAmount: funded?.compensationReceivedAmount,
        compensationExpectedAmount: funded?.compensationExpectedAmount,
        rate,
      });

      if (!evaluation.allowed) {
        // A bad rate is a client error; everything else is a refusal about the
        // state of the file, which is 422 rather than 400.
        const status = evaluation.verdict === "rate_out_of_range" ? 400 : 422;

        // Audit the refusal, not only the success. A blocked payout is the
        // interesting event — it is an admin trying to pay more than the file
        // earned, or paying on a file that has not funded.
        const { logAudit } = await import("../../auditLog");
        logAudit(req, "broker_commission.refused", "loan_application", applicationId, {
          brokerId,
          commissionRate: rate,
          verdict: evaluation.verdict,
          attemptedAmount: evaluation.amount,
          maxAmount: evaluation.maxAmount,
        });

        return res.status(status).json({
          error: evaluation.message,
          verdict: evaluation.verdict,
          remediation: evaluation.remediation,
          maxAmount: evaluation.maxAmount,
          maxRate: evaluation.maxRate,
        });
      }

      const loanAmount = evaluation.loanAmount!;
      const commissionAmount = evaluation.amount!.toFixed(2);

      const commission = await storage.createBrokerCommission({
        brokerId,
        applicationId,
        loanAmount: loanAmount.toString(),
        commissionRate: rate.toString(),
        commissionAmount,
        status: "pending",
      });

      // Money out of the company leaves a trail. A $30 credit-pull cost entry
      // is audited (`loan_cost.recorded`); creating a payout obligation worth
      // up to 10% of the loan amount was not, which left the only cash-
      // disbursement path on the platform with no record of who opened it.
      const { logAudit } = await import("../../auditLog");
      logAudit(req, "broker_commission.created", "loan_application", applicationId, {
        commissionId: commission.id,
        brokerId,
        loanAmount,
        commissionRate: rate,
        commissionAmount,
        // The revenue it was bounded against, so the trail shows what the
        // ceiling was at the moment the payable was opened.
        revenueBasis: evaluation.revenueBasis,
        revenueBasisSource: evaluation.revenueBasisSource,
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

      const { id } = routeParams(req);

      const body = parseBodyOr400(
        z.object({
          notes: z.string().max(5000).optional(),
          status: z.enum(BROKER_COMMISSION_STATUSES).optional(),
        }),
        req.body,
        res,
      );
      if (body === undefined) return;

      // Fetch the commission first to enforce ownership
      const existing = await storage.getBrokerCommission(id);
      if (!existing) {
        return res.status(404).json({ error: "Commission not found" });
      }

      // Status transitions (including "paid", "approved", "rejected") are admin-only.
      // Brokers and LOs can only update the notes field.
      if (body.status !== undefined && !isAdmin(user)) {
        return res.status(403).json({ error: "Only admins can change commission status" });
      }

      // Brokers may only update notes on their own commission records.
      // LOs have notes access on all commissions they manage (no object-level restriction).
      if (user.role === "broker" && existing.brokerId !== user.id) {
        return res.status(403).json({ error: "You may only update your own commission records" });
      }

      const updateData: Record<string, any> = {};
      // Only admit fields that callers are permitted to set
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.status !== undefined && isAdmin(user)) {
        updateData.status = body.status;
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

      // Only status transitions are audited — a notes edit is not a financial
      // event. "paid" is the disbursement, and it is the same admin who could
      // have created the payable, so the trail is the only separation there is.
      if (updateData.status !== undefined) {
        const { logAudit } = await import("../../auditLog");
        logAudit(req, "broker_commission.status_changed", "loan_application", existing.applicationId, {
          commissionId: existing.id,
          brokerId: existing.brokerId,
          previousStatus: existing.status,
          newStatus: updateData.status,
          commissionAmount: existing.commissionAmount,
        });
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
