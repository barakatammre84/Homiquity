// Borrower routes: Deal rescue escalations, strategy sessions, accelerator.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isStaffRole, isInternalStaffRole, type CoachingSession, type User } from "@shared/schema";
import { isAdmin } from "@shared/roles";
import { firstQueryValue } from "../queryParams";
import { routeParam } from "../../http/routeParams";
import { z } from "zod";
import {
  ACCELERATOR_PHASES,
  BORROWER_CREATED_SESSION_STATUS,
  PENDING_SESSION_STATUSES,
  canTransitionSession,
  deriveAcceleratorProgress,
  enrollmentProgressPatch,
  outcomeIsReportable,
  type SessionStatus,
} from "@shared/acceleratorProgram";
import {
  notifyBorrowerOfSessionOutcome,
  notifyLoanOfficerOfBorrowerChange,
  notifySessionRequested,
} from "../../services/acceleratorSessionNotifications";

/**
 * What a borrower may send when asking for a session. Note what is NOT here:
 * `status` and `assignedToUserId` are server-decided, and `durationMinutes`,
 * `notes` and `actionItems` belong to the loan officer who runs the meeting.
 * The route previously accepted the raw body, so all of those were settable by
 * the borrower.
 */
/** `attended` decides between the two outcome statuses; nothing else is settable. */
const sessionOutcomeSchema = z.object({ attended: z.boolean() });

const sessionRescheduleSchema = z.object({
  scheduledAt: z.coerce
    .date()
    .refine((d) => d.getTime() > Date.now(), { message: "Pick a time in the future." }),
});

function displayName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "A borrower";
}

/**
 * Resolve a session the caller actually owns, through their own enrollment.
 * Returns a discriminated result rather than throwing so each route states its
 * own status code at the call site.
 */
async function requireOwnSession(
  storage: IStorage,
  user: User,
  sessionId: string,
): Promise<{ session: CoachingSession } | { error: string; status: number }> {
  const enrollment = await storage.getAcceleratorEnrollment(user.id);
  if (!enrollment) return { error: "Access denied", status: 403 };
  const session = await storage.getCoachingSessionById(sessionId);
  if (!session || session.enrollmentId !== enrollment.id) {
    return { error: "Session not found", status: 404 };
  }
  return { session };
}

/** Look up the loan officer's name, then tell the borrower. Never throws. */
async function notifyBorrowerOutcome(
  storage: IStorage,
  outcome: "confirmed" | "cancelled" | "completed" | "no_show",
  session: CoachingSession,
  actor: User,
): Promise<void> {
  try {
    const enrollment = await storage.getAcceleratorEnrollmentById(session.enrollmentId);
    if (!enrollment) return;
    await notifyBorrowerOfSessionOutcome(storage, outcome, {
      sessionId: session.id,
      borrowerUserId: enrollment.userId,
      scheduledAt: new Date(session.scheduledAt),
      loanOfficerName: displayName(actor),
    });
  } catch (error) {
    console.error("[accelerator] borrower outcome notification failed:", error);
  }
}

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
        if (!canTransitionSession(existing.status, "confirmed", "staff")) {
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

        void notifyBorrowerOutcome(storage, "confirmed", existing, user);

        res.json({ success: true, session: updated });
      } catch (error) {
        console.error("Confirm accelerator session error:", error);
        res.status(500).json({ error: "Failed to confirm session" });
      }
    },
  );

  // Declined by the desk. Same destination as a borrower withdrawing it —
  // the meeting is not happening — but the borrower is told, because somebody
  // is waiting on an answer they did not get to choose.
  app.post(
    "/api/accelerator/sessions/:id/decline",
    requireRole("admin", "lo", "loa"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const existing = await storage.getCoachingSessionById(routeParam(req, "id"));
        if (!existing) return res.status(404).json({ error: "Session not found" });
        if (!canTransitionSession(existing.status, "cancelled", "staff")) {
          return res.status(409).json({ error: `This session is already ${existing.status}.` });
        }

        const updated = await storage.updateCoachingSession(routeParam(req, "id"), {
          status: "cancelled",
        });
        const { logAudit } = await import("../../auditLog");
        logAudit(req, "accelerator_session.declined", "coaching_session", existing.id, {
          loanOfficerId: user.id,
        });
        void notifyBorrowerOutcome(storage, "cancelled", existing, user);

        res.json({ success: true, session: updated });
      } catch (error) {
        console.error("Decline accelerator session error:", error);
        res.status(500).json({ error: "Failed to decline session" });
      }
    },
  );

  // What actually happened. The only pair of transitions that makes a claim
  // about the past, so it is the only one with a clock rail: a meeting cannot
  // be reported as having happened before it starts.
  app.post(
    "/api/accelerator/sessions/:id/outcome",
    requireRole("admin", "lo", "loa"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const parsed = sessionOutcomeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "attended must be true or false." });
        }
        const outcome: SessionStatus = parsed.data.attended ? "completed" : "no_show";

        const existing = await storage.getCoachingSessionById(routeParam(req, "id"));
        if (!existing) return res.status(404).json({ error: "Session not found" });
        if (existing.assignedToUserId && existing.assignedToUserId !== user.id && !isAdmin(user)) {
          return res
            .status(409)
            .json({ error: "This session belongs to another loan officer." });
        }
        if (!canTransitionSession(existing.status, outcome, "staff")) {
          return res.status(409).json({ error: `This session is already ${existing.status}.` });
        }
        if (!outcomeIsReportable(new Date(existing.scheduledAt), new Date())) {
          return res
            .status(409)
            .json({ error: "This session has not started yet." });
        }

        const updated = await storage.updateCoachingSession(routeParam(req, "id"), {
          status: outcome,
          completedAt: new Date(),
        });
        const { logAudit } = await import("../../auditLog");
        logAudit(req, `accelerator_session.${outcome}`, "coaching_session", existing.id, {
          loanOfficerId: user.id,
        });
        void notifyBorrowerOutcome(storage, outcome, existing, user);

        res.json({ success: true, session: updated });
      } catch (error) {
        console.error("Record accelerator session outcome error:", error);
        res.status(500).json({ error: "Failed to record the outcome" });
      }
    },
  );

  // The borrower calls it off. Their own session only — scoped through their
  // enrollment, exactly like every other borrower-side accelerator route.
  app.post("/api/accelerator/sessions/:id/withdraw", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const owned = await requireOwnSession(storage, user, routeParam(req, "id"));
      if ("error" in owned) return res.status(owned.status).json({ error: owned.error });

      if (!canTransitionSession(owned.session.status, "cancelled", "borrower")) {
        return res
          .status(409)
          .json({ error: `This session is already ${owned.session.status}.` });
      }

      const updated = await storage.updateCoachingSession(routeParam(req, "id"), {
        status: "cancelled",
      });
      void notifyLoanOfficerOfBorrowerChange(storage, "cancelled", {
        sessionId: owned.session.id,
        assignedToUserId: owned.session.assignedToUserId,
        borrowerName: displayName(user),
        scheduledAt: new Date(owned.session.scheduledAt),
      });

      res.json({ success: true, session: updated });
    } catch (error) {
      console.error("Withdraw accelerator session error:", error);
      res.status(500).json({ error: "Failed to cancel the session" });
    }
  });

  // Moving the time re-opens the ask. The loan officer agreed to a slot, not to
  // the borrower's calendar, so a confirmed session goes back to `requested`
  // and returns to the desk's queue — it does NOT stay confirmed at a time
  // nobody on our side has agreed to.
  app.post("/api/accelerator/sessions/:id/reschedule", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const parsed = sessionRescheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Please pick a date and time in the future.",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const owned = await requireOwnSession(storage, user, routeParam(req, "id"));
      if ("error" in owned) return res.status(owned.status).json({ error: owned.error });

      if (!canTransitionSession(owned.session.status, "requested", "borrower")) {
        return res
          .status(409)
          .json({ error: `A ${owned.session.status} session cannot be moved.` });
      }

      const updated = await storage.updateCoachingSession(routeParam(req, "id"), {
        status: "requested",
        scheduledAt: parsed.data.scheduledAt,
        // The loan officer who took it keeps it — they are this borrower's
        // contact now — but their agreement to the OLD time is cleared.
        confirmedAt: null,
      });
      void notifyLoanOfficerOfBorrowerChange(storage, "rescheduled", {
        sessionId: owned.session.id,
        assignedToUserId: owned.session.assignedToUserId,
        borrowerName: displayName(user),
        scheduledAt: parsed.data.scheduledAt,
      });

      res.json({ success: true, session: updated });
    } catch (error) {
      console.error("Reschedule accelerator session error:", error);
      res.status(500).json({ error: "Failed to move the session" });
    }
  });

  // A loan officer's own confirmed sessions — the surface that makes
  // `completed` and `no_show` reachable at all. Without it those two statuses
  // would exist in the vocabulary and in the API and be unwritable from the UI,
  // which is the "engine nobody can reach" defect this program keeps producing.
  app.get(
    "/api/accelerator/sessions/mine",
    requireRole("admin", "lo", "loa"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const mine = await storage.getCoachingSessionsForLoanOfficer(user.id);
        res.json({ total: mine.length, sessions: mine });
      } catch (error) {
        console.error("Get my accelerator sessions error:", error);
        res.status(500).json({ error: "Failed to get your sessions" });
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
