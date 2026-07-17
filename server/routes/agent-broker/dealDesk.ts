// Agent/broker routes: Deal-desk threads/messages, agent pipeline, pre-approval letter co-branding.
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


export function registerDealDeskRoutes(
  app: Express,
  storage: IStorage,
) {
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
      const agentProfileId = firstQueryValue(req.query.agentProfileId);

      if (!agentProfileId) {
        return res.status(400).json({ error: "agentProfileId query parameter is required" });
      }

      const { db: database } = await import("../../db");
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

      // Verify the caller has access to the underlying loan application
      const user = req.user as any;
      const application = await storage.getLoanApplicationWithAccess(
        letter.applicationId,
        user.id,
        user.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
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

      const { db: database } = await import("../../db");
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
