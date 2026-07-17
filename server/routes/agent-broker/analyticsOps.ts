// Agent/broker routes: Pipeline analytics, SLA configurations, application milestones.
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


export function registerAnalyticsOpsRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/analytics/pipeline", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const metrics = await storage.computePipelineMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get pipeline metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get bottleneck analysis
  app.get("/api/analytics/bottlenecks", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const analysis = await storage.getBottleneckAnalysis();
      res.json(analysis);
    } catch (error) {
      console.error("Get bottleneck analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  // Get staff workload metrics
  app.get("/api/analytics/workload", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const metrics = await storage.getStaffWorkloadMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Get workload metrics error:", error);
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get historical snapshots
  app.get("/api/analytics/history", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const days = parseInt(firstQueryValue(req.query.days) ?? "") || 30;
      const snapshots = await storage.getAnalyticsSnapshots(days);
      res.json(snapshots);
    } catch (error) {
      console.error("Get analytics history error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  // Get SLA configurations
  app.get("/api/sla-configurations", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
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

  // Internal staff roles that are permitted to read/write milestone data.
  // Partner roles (broker, lender) are excluded because milestone fields include
  // sensitive disposition data (deniedAt, closedAt, fundedAt, etc.).
  const MILESTONE_INTERNAL_STAFF = new Set(["admin", "lo", "loa", "processor", "underwriter", "closer"]);

  // Get application milestones
  app.get("/api/application-milestones/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = (req.user as User).id;
      const userRole = (req.user as User).role;

      if (MILESTONE_INTERNAL_STAFF.has(userRole)) {
        // Non-admin internal staff must be assigned to the application (deal-team member or LO).
        if (userRole !== "admin") {
          const application = await storage.getLoanApplication(applicationId);
          if (!application) {
            return res.status(404).json({ error: "Application not found" });
          }
          const teamMembers = await storage.getDealTeamMembers(applicationId);
          const isOnTeam = teamMembers.some(m => m.userId === userId);
          const isLoanOfficer = application.loanOfficerId === userId;
          if (!isOnTeam && !isLoanOfficer) {
            return res.status(403).json({ error: "Access denied: you are not assigned to this application" });
          }
        }
      } else {
        // Borrowers (and any other role): must own the application
        const application = await storage.getLoanApplication(applicationId);
        if (!application || application.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const milestone = await storage.getApplicationMilestone(applicationId);
      res.json(milestone || null);
    } catch (error) {
      console.error("Get application milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  // Update application milestones — admin only.
  // Milestone fields include sensitive loan disposition data (deniedAt, closedAt, fundedAt,
  // withdrawalReason, etc.). Restricting to admin eliminates cross-application manipulation
  // by any staff role without requiring a deal-team assignment table.
  app.patch("/api/application-milestones/:applicationId", requireRole("admin"), async (req, res) => {
    try {
      const { applicationId } = req.params;

      // Verify the application exists before writing milestone data
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Get or create milestone record
      let milestone = await storage.getApplicationMilestone(applicationId);
      if (!milestone) {
        milestone = await storage.createApplicationMilestone({ applicationId });
      }

      const data = parseBodyOr400(insertApplicationMilestoneSchema.omit({ applicationId: true }).partial(), req.body, res);
      if (data === undefined) return;
      const updated = await storage.updateApplicationMilestone(applicationId, data);
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
}
