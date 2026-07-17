// Borrower routes: Deal rescue escalations, strategy sessions, accelerator.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { isStaffRole, isInternalStaffRole, type User } from "@shared/schema";
import { firstQueryValue } from "../queryParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerRealtorProgramRoutes(
  app: Express,
  storage: IStorage,
) {
  // Deal Rescue Escalation Routes
  // =============================================
  app.get("/api/deal-rescue", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const status = firstQueryValue(req.query.status);
      const escalations = await storage.getDealRescueEscalations({
        status,
        reportedByUserId: req.user!.id,
      });
      res.json(escalations);
    } catch (error) {
      console.error("Get deal rescue escalations error:", error);
      res.status(500).json({ error: "Failed to get escalations" });
    }
  });

  app.post("/api/deal-rescue", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const urgency = req.body.urgency || "medium";
      const slaHours: Record<string, number> = {
        critical: 2,
        high: 4,
        medium: 8,
        low: 24,
      };
      const hours = slaHours[urgency] || 8;
      const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

      const escalation = await storage.createDealRescueEscalation({
        ...req.body,
        reportedByUserId: req.user!.id,
        slaDeadline,
      });
      res.status(201).json(escalation);
    } catch (error) {
      console.error("Create deal rescue escalation error:", error);
      res.status(500).json({ error: "Failed to create escalation" });
    }
  });

  app.put("/api/deal-rescue/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      // Object-level authorization: external partners (broker/lender) may only
      // update escalations they reported; internal staff work the whole queue.
      const existing = await storage.getDealRescueEscalation(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      if (!isInternalStaffRole(req.user!.role) && existing.reportedByUserId !== req.user!.id) {
        return res.status(403).json({ error: "You may only update escalations you reported" });
      }
      const escalation = await storage.updateDealRescueEscalation(req.params.id, req.body);
      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      res.json(escalation);
    } catch (error) {
      console.error("Update deal rescue escalation error:", error);
      res.status(500).json({ error: "Failed to update escalation" });
    }
  });

  // =============================================
  // Strategy Sessions Routes
  // =============================================
  app.get("/api/strategy-sessions", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const sessions = await storage.getStrategySessions(req.user!.id);
      res.json(sessions);
    } catch (error) {
      console.error("Get strategy sessions error:", error);
      res.status(500).json({ error: "Failed to get strategy sessions" });
    }
  });

  app.post("/api/strategy-sessions", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const session = await storage.createStrategySession({
        ...req.body,
        agentUserId: req.user!.id,
      });
      res.status(201).json(session);
    } catch (error) {
      console.error("Create strategy session error:", error);
      res.status(500).json({ error: "Failed to create strategy session" });
    }
  });

  app.put("/api/strategy-sessions/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      // Object-level authorization: sessions belong to the agent who booked
      // them (agentUserId); internal staff may manage any session.
      const existing = await storage.getStrategySession(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Strategy session not found" });
      }
      if (!isInternalStaffRole(req.user!.role) && existing.agentUserId !== req.user!.id) {
        return res.status(403).json({ error: "You may only update your own strategy sessions" });
      }
      const session = await storage.updateStrategySession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Strategy session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update strategy session error:", error);
      res.status(500).json({ error: "Failed to update strategy session" });
    }
  });

  // =============================================
  // Accelerator Routes
  // =============================================
  app.get("/api/accelerator/enrollment", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.getAcceleratorEnrollment(req.user!.id);
      res.json(enrollment || null);
    } catch (error) {
      console.error("Get accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to get enrollment" });
    }
  });

  app.post("/api/accelerator/enrollment", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.createAcceleratorEnrollment({
        ...req.body,
        userId: req.user!.id,
      });

      const defaultPhases = [
        {
          phase: 1,
          phaseName: "Financial Assessment",
          milestones: ["Review credit report", "Calculate current DTI", "Set budget"],
        },
        {
          phase: 2,
          phaseName: "Credit Optimization",
          milestones: ["Dispute errors on credit report", "Pay down high-utilization cards", "Avoid new credit inquiries"],
        },
        {
          phase: 3,
          phaseName: "Savings Plan",
          milestones: ["Open dedicated savings account", "Set up automatic transfers", "Reach 25% of down payment goal"],
        },
        {
          phase: 4,
          phaseName: "Debt Reduction",
          milestones: ["Create debt payoff plan", "Reduce DTI below 43%", "Close unnecessary accounts"],
        },
        {
          phase: 5,
          phaseName: "Pre-Approval Ready",
          milestones: ["Gather income documents", "Complete pre-approval application", "Get pre-approved"],
        },
        {
          phase: 6,
          phaseName: "Home Shopping",
          milestones: ["Connect with real estate agent", "Attend open houses", "Make an offer"],
        },
      ];

      for (const phaseData of defaultPhases) {
        for (const title of phaseData.milestones) {
          await storage.createAcceleratorMilestone({
            enrollmentId: enrollment.id,
            phase: phaseData.phase,
            title,
            category: phaseData.phaseName,
          });
        }
      }

      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Create accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.put("/api/accelerator/enrollment/:id", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.getAcceleratorEnrollment(req.user!.id);
      if (!enrollment || enrollment.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateAcceleratorEnrollment(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to update enrollment" });
    }
  });

  app.get("/api/accelerator/milestones/:enrollmentId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== req.params.enrollmentId) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      const milestones = await storage.getAcceleratorMilestones(req.params.enrollmentId);
      res.json(milestones);
    } catch (error) {
      console.error("Get accelerator milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  app.put("/api/accelerator/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getAcceleratorMilestoneById(req.params.id);
      if (!existing || existing.enrollmentId !== enrollment.id) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      // Strip enrollmentId from body to prevent ownership-link reassignment
      const { enrollmentId: _stripM, ...milestoneBody } = req.body;
      const milestone = await storage.updateAcceleratorMilestone(req.params.id, milestoneBody, enrollment.id);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Update accelerator milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.get("/api/accelerator/coaching/:enrollmentId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== req.params.enrollmentId) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      const sessions = await storage.getCoachingSessions(req.params.enrollmentId);
      res.json(sessions);
    } catch (error) {
      console.error("Get coaching sessions error:", error);
      res.status(500).json({ error: "Failed to get coaching sessions" });
    }
  });

  app.post("/api/accelerator/coaching", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== req.body.enrollmentId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const session = await storage.createCoachingSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      console.error("Create coaching session error:", error);
      res.status(500).json({ error: "Failed to create coaching session" });
    }
  });

  app.put("/api/accelerator/coaching/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getCoachingSessionById(req.params.id);
      if (!existing || existing.enrollmentId !== enrollment.id) {
        return res.status(404).json({ error: "Coaching session not found" });
      }
      // Strip enrollmentId from body to prevent ownership-link reassignment
      const { enrollmentId: _stripC, ...sessionBody } = req.body;
      const session = await storage.updateCoachingSession(req.params.id, sessionBody, enrollment.id);
      if (!session) {
        return res.status(404).json({ error: "Coaching session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update coaching session error:", error);
      res.status(500).json({ error: "Failed to update coaching session" });
    }
  });

  // =============================================
}
