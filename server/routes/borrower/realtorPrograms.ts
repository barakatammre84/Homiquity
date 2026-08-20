// Borrower routes: Deal rescue escalations, strategy sessions, accelerator.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isStaffRole, isInternalStaffRole, type User } from "@shared/schema";
import { firstQueryValue } from "../queryParams";
import { routeParam } from "../../http/routeParams";
import { z } from "zod";
import {
  ACCELERATOR_PHASES,
  BORROWER_CREATED_SESSION_STATUS,
  PENDING_SESSION_STATUSES,
  deriveAcceleratorProgress,
  enrollmentProgressPatch,
  type SessionStatus,
} from "@shared/acceleratorProgram";
import { notifySessionRequested } from "../../services/acceleratorSessionNotifications";

/**
 * What a borrower may send when asking for a session. Note what is NOT here:
 * `status` and `assignedToUserId` are server-decided, and `durationMinutes`,
 * `notes` and `actionItems` belong to the loan officer who runs the meeting.
 * The route previously accepted the raw body, so all of those were settable by
 * the borrower.
 */
const sessionRequestSchema = z.object({
  enrollmentId: z.string().min(1),
  scheduledAt: z.coerce
    .date()
    // A request for a time that has already passed is not a request. The old
    // route accepted any datetime the browser's picker would emit.
    .refine((d) => d.getTime() > Date.now(), { message: "Pick a time in the future." }),
  topic: z.string().trim().max(500).optional().nullable(),
});

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
      const existing = await storage.getDealRescueEscalation(routeParam(req, "id"));
      if (!existing) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      if (!isInternalStaffRole(req.user!.role) && existing.reportedByUserId !== req.user!.id) {
        return res.status(403).json({ error: "You may only update escalations you reported" });
      }
      const escalation = await storage.updateDealRescueEscalation(routeParam(req, "id"), req.body);
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
      const existing = await storage.getStrategySession(routeParam(req, "id"));
      if (!existing) {
        return res.status(404).json({ error: "Strategy session not found" });
      }
      if (!isInternalStaffRole(req.user!.role) && existing.agentUserId !== req.user!.id) {
        return res.status(403).json({ error: "You may only update your own strategy sessions" });
      }
      const session = await storage.updateStrategySession(routeParam(req, "id"), req.body);
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

      // The plan is seeded from the one shared definition the client also
      // renders its phase names from — see shared/acceleratorProgram.ts.
      for (const phaseData of ACCELERATOR_PHASES) {
        for (const title of phaseData.milestones) {
          await storage.createAcceleratorMilestone({
            enrollmentId: enrollment.id,
            phase: phaseData.phase,
            title,
            category: phaseData.name,
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
      if (!enrollment || enrollment.id !== routeParam(req, "id")) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateAcceleratorEnrollment(routeParam(req, "id"), req.body);
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
      if (!enrollment || enrollment.id !== routeParam(req, "enrollmentId")) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      const milestones = await storage.getAcceleratorMilestones(routeParam(req, "enrollmentId"));
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
      const existing = await storage.getAcceleratorMilestoneById(routeParam(req, "id"));
      if (!existing || existing.enrollmentId !== enrollment.id) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      // Strip enrollmentId from body to prevent ownership-link reassignment
      const { enrollmentId: _stripM, ...milestoneBody } = req.body;
      const milestone = await storage.updateAcceleratorMilestone(routeParam(req, "id"), milestoneBody, enrollment.id);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // The program's phase follows its milestones. Without this the header
      // read "Phase 1 of 6 · 17%" forever — a borrower could finish all 18
      // milestones and the progress bar would never move. Derived from the
      // whole set rather than incremented, so un-ticking walks it back too.
      const allMilestones = await storage.getAcceleratorMilestones(enrollment.id);
      const progress = deriveAcceleratorProgress(allMilestones, enrollment.totalPhases ?? undefined);
      const patch = enrollmentProgressPatch(progress, enrollment, new Date());
      if (patch) {
        await storage.updateAcceleratorEnrollment(enrollment.id, patch);
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
      if (!enrollment || enrollment.id !== routeParam(req, "enrollmentId")) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      const sessions = await storage.getCoachingSessions(routeParam(req, "enrollmentId"));
      res.json(sessions);
    } catch (error) {
      console.error("Get coaching sessions error:", error);
      res.status(500).json({ error: "Failed to get coaching sessions" });
    }
  });

  // A borrower ASKS for a 1:1 with a loan officer. They do not book one.
  //
  // This route used to hand `req.body` straight to the insert, so the row took
  // the column default ("scheduled") and the UI said the session "has been
  // scheduled" — while nothing on the staff side read the table at all. The
  // status is now server-decided and the request is fanned out to the session
  // desk, so a human actually learns it exists.
  app.post("/api/accelerator/coaching", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const parsed = sessionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Please pick a date and time in the future.",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== parsed.data.enrollmentId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const session = await storage.createCoachingSession({
        enrollmentId: enrollment.id,
        scheduledAt: parsed.data.scheduledAt,
        topic: parsed.data.topic ?? null,
        // Server-decided, never client-supplied: a borrower may only ever
        // create a REQUEST. Only a loan officer moves it to "confirmed".
        status: BORROWER_CREATED_SESSION_STATUS,
        assignedToUserId: null,
      });

      // Fire-and-forget: a notification failure must not cost the borrower
      // their request (leadNotifications / complaintEscalation pattern).
      void notifySessionRequested(storage, {
        sessionId: session.id,
        borrowerName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "A borrower",
        requestedFor: parsed.data.scheduledAt,
        topic: parsed.data.topic ?? null,
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Create coaching session error:", error);
      res.status(500).json({ error: "Failed to create coaching session" });
    }
  });

  // The session desk: every request still waiting on a loan officer.
  //
  // These borrowers are aspiring owners with no loan application, so they are
  // invisible to every application-shaped queue in the product — the intake
  // inbox reads loan_applications, and tasks.application_id is NOT NULL. This
  // is the only surface that can see them.
  app.get(
    "/api/accelerator/sessions/pending",
    requireRole("admin", "lo", "loa"),
    async (_req, res) => {
      try {
        const pending = await storage.getPendingCoachingSessions(PENDING_SESSION_STATUSES);
        res.json({ total: pending.length, sessions: pending });
      } catch (error) {
        console.error("Get pending accelerator sessions error:", error);
        res.status(500).json({ error: "Failed to get pending sessions" });
      }
    },
  );

  // A loan officer takes the meeting. Mirrors the intake-inbox claim
  // (POST /api/loan-applications/:id/claim): 409 if someone else already has
  // it, idempotent if it is already yours.
  app.post(
    "/api/accelerator/sessions/:id/confirm",
    requireRole("admin", "lo", "loa"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const existing = await storage.getCoachingSessionById(routeParam(req, "id"));
        if (!existing) {
          return res.status(404).json({ error: "Session not found" });
        }
        if (existing.assignedToUserId && existing.assignedToUserId !== user.id) {
          return res
            .status(409)
            .json({ error: "Another loan officer has already confirmed this session." });
        }
        if (!PENDING_SESSION_STATUSES.includes(existing.status as SessionStatus)) {
          return res
            .status(409)
            .json({ error: `This session is already ${existing.status}.` });
        }

        const updated = await storage.updateCoachingSession(routeParam(req, "id"), {
          status: "confirmed",
          assignedToUserId: user.id,
          confirmedAt: new Date(),
        });

        const { logAudit } = await import("../../auditLog");
        logAudit(req, "accelerator_session.confirmed", "coaching_session", existing.id, {
          loanOfficerId: user.id,
        });

        res.json({ success: true, session: updated });
      } catch (error) {
        console.error("Confirm accelerator session error:", error);
        res.status(500).json({ error: "Failed to confirm session" });
      }
    },
  );

  app.put("/api/accelerator/coaching/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getCoachingSessionById(routeParam(req, "id"));
      if (!existing || existing.enrollmentId !== enrollment.id) {
        return res.status(404).json({ error: "Coaching session not found" });
      }
      // Strip enrollmentId from body to prevent ownership-link reassignment
      const { enrollmentId: _stripC, ...sessionBody } = req.body;
      const session = await storage.updateCoachingSession(routeParam(req, "id"), sessionBody, enrollment.id);
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
