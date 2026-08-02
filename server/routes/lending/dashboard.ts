// Lending routes: Borrower dashboard aggregate, document checklist, action items.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import {
  insertBorrowerDeclarationsSchema,
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_PRIORITY_RANK,
  type TaskPriority,
  type User,
} from "@shared/schema";
import { computeNextAction } from "../../services/nextAction";
import { getUserActivitySummary } from "../../services/activitySummary";
import { buildDocumentChecklist } from "../../services/documentChecklist";
import { isTerminalLoanAppStatus } from "@shared/schema";
import { db } from "../../db";
import { creditConsents, dealActivities, hmdaDemographics, loanOptions, tasks, verifications } from "@shared/schema";
import { and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import * as creditService from "../../services/creditService";
import { routeParams } from "../../http/routeParams";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

// Intake validation lives in shared/schema/lending.ts (loanApplicationIntakeSchema),
// derived from the same base schema the funnel validates with client-side — the
// server rejects exactly what the client rejects, and "not_sure" credit maps to
// the named CREDIT_SCORE_UNKNOWN_DEFAULT instead of a silent clamp.

export function registerDashboardRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const [applications, documents, stats, unreadMessages, activitySummary] = await Promise.all([
        storage.getLoanApplicationsByUser(userId),
        storage.getDocumentsByUser(userId),
        storage.getDashboardStats(userId),
        storage.getUnreadMessageCount(userId),
        getUserActivitySummary(userId),
      ]);

      // One batched query per table across the visible applications, all in a
      // single parallel wave — the previous version issued 8 + ~13×N serial
      // queries (N = application count), which is what pushes dashboard loads
      // past a second on hosted Postgres round-trip latencies.
      if (applications.length === 0) {
        return res.json({
          applications,
          documents,
          recentOptions: [],
          stats,
          unreadMessages,
          pendingTaskCount: 0,
          pendingTasksByApplication: {},
          activities: [],
          loanOptionCounts: {},
          hmdaStatus: {},
          verificationStatus: {},
          activitySummary,
          nextAction: computeNextAction({
            application: null,
            pendingTasks: { total: 0, documents: 0 },
            pendingDocuments: stats?.pendingDocuments || 0,
            unreadMessages,
            activitySummary,
          }),
        });
      }

      const topAppIds = applications.slice(0, 3).map((a) => a.id);
      const allAppIds = applications.map((a) => a.id);

      const [optionRows, activityRows, taskRows, hmdaRows, consentRows, verificationRows] =
        await Promise.all([
          db
            .select({
              // Card fields only — full rows carry pricing-grid JSON that
              // inflates the dashboard payload for no rendering benefit.
              id: loanOptions.id,
              applicationId: loanOptions.applicationId,
              interestRate: loanOptions.interestRate,
              loanType: loanOptions.loanType,
              loanTerm: loanOptions.loanTerm,
              monthlyPayment: loanOptions.monthlyPayment,
              isRecommended: loanOptions.isRecommended,
              lockedAt: loanOptions.lockedAt,
            })
            .from(loanOptions)
            .where(inArray(loanOptions.applicationId, topAppIds))
            // Match storage.getLoanOptionsByApplication's ordering so the
            // recentOptions slice(0,5) picks the same rows as before.
            .orderBy(loanOptions.isRecommended, loanOptions.createdAt),
          db
            .select()
            .from(dealActivities)
            .where(inArray(dealActivities.applicationId, topAppIds))
            .orderBy(desc(dealActivities.createdAt)),
          db
            .select({ applicationId: tasks.applicationId, status: tasks.status, taskType: tasks.taskType })
            .from(tasks)
            .where(inArray(tasks.applicationId, allAppIds)),
          db
            .select({ applicationId: hmdaDemographics.applicationId })
            .from(hmdaDemographics)
            .where(inArray(hmdaDemographics.applicationId, topAppIds)),
          db
            .select({ applicationId: creditConsents.applicationId })
            .from(creditConsents)
            .where(inArray(creditConsents.applicationId, topAppIds)),
          db
            .select({
              applicationId: verifications.applicationId,
              verificationType: verifications.verificationType,
              identityVerified: verifications.identityVerified,
            })
            .from(verifications)
            .where(
              and(
                inArray(verifications.applicationId, topAppIds),
                inArray(verifications.verificationType, ["identity", "income"]),
              ),
            ),
        ]);

      const recentOptions: typeof optionRows = [];
      const loanOptionCounts: Record<string, number> = {};
      for (const appId of topAppIds) {
        const options = optionRows.filter((o) => o.applicationId === appId);
        recentOptions.push(...options);
        loanOptionCounts[appId] = options.length;
      }

      const activitiesMap: Record<string, any[]> = {};
      for (const appId of topAppIds) {
        activitiesMap[appId] = activityRows.filter((a) => a.applicationId === appId).slice(0, 10);
      }

      // ACTIVE_TASK_STATUSES, not a hand-listed array: the previous filter
      // compared verificationStatus values ("pending", "rejected") against
      // tasks.status, so engine tasks (OPEN/IN_PROGRESS/BLOCKED) were never
      // counted and completed legacy rows never dropped out.
      const pendingTaskRows = taskRows.filter((t) =>
        ACTIVE_TASK_STATUSES.includes(t.status),
      );
      const pendingTaskCount = pendingTaskRows.length;
      // Per-application counts so the dashboard's "next step" signal reflects
      // the ACTIVE application, not noise summed across every application the
      // user has ever had (the "Complete 56 pending tasks" defect).
      const pendingTasksByApplication: Record<string, { total: number; documents: number }> = {};
      for (const t of pendingTaskRows) {
        const bucket = (pendingTasksByApplication[t.applicationId] ??= { total: 0, documents: 0 });
        bucket.total += 1;
        if (t.taskType === "document_request") bucket.documents += 1;
      }

      const hmdaStatus: Record<string, boolean> = {};
      const hmdaApps = new Set(hmdaRows.map((r) => r.applicationId));
      for (const appId of topAppIds) hmdaStatus[appId] = hmdaApps.has(appId);

      const consentApps = new Set(consentRows.map((r) => r.applicationId));
      const verificationStatus: Record<string, { hasCreditConsent: boolean; hasIdVerification: boolean; hasBankConnected: boolean; hasRateLocked: boolean }> = {};
      for (const appId of topAppIds) {
        const appVerifications = verificationRows.filter((v) => v.applicationId === appId);
        verificationStatus[appId] = {
          hasCreditConsent: consentApps.has(appId),
          hasIdVerification: appVerifications.some(
            (v) => v.verificationType === "identity" && v.identityVerified,
          ),
          hasBankConnected: appVerifications.some((v) => v.verificationType === "income"),
          // "lockedAt" is the real column — the old check read a field
          // ("rateLockedAt") that never existed, so this flag was always false.
          hasRateLocked: recentOptions.some(
            (o) => o.applicationId === appId && o.lockedAt,
          ),
        };
      }

      const allActivities = Object.values(activitiesMap).flat()
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      // The single server-computed "what should the borrower do next" for the
      // active (first non-terminal) application — replaces four drifting
      // client-side copies of the stage→action mapping.
      const activeApplication = applications.find((a) => !isTerminalLoanAppStatus(a.status)) || null;
      const activeTasks = activeApplication
        ? pendingTasksByApplication[activeApplication.id] || { total: 0, documents: 0 }
        : { total: 0, documents: 0 };
      const nextAction = computeNextAction({
        application: activeApplication,
        pendingTasks: activeTasks,
        pendingDocuments: stats?.pendingDocuments || 0,
        unreadMessages,
        activitySummary,
      });

      res.json({
        applications,
        documents,
        recentOptions: recentOptions.slice(0, 5),
        stats,
        unreadMessages,
        pendingTaskCount,
        pendingTasksByApplication,
        activities: allActivities,
        loanOptionCounts,
        hmdaStatus,
        verificationStatus,
        activitySummary,
        nextAction,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  // Document Checklist API — the personalized requirements the pipeline
  // engine wrote as loan_conditions (self-employed → P&L etc.), with the
  // legacy 5-item standard list as the no-conditions fallback. All derivation
  // rules live in the pure builder (server/services/documentChecklist.ts).
  app.get("/api/applications/:applicationId/document-checklist", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = routeParams(req);
      const userId = req.user!.id;
      const userRole = (req.user as User).role;

      // Use getLoanApplicationWithAccess so broker/lender are validated against
      // deal-team membership rather than receiving blanket staff access.
      const application = await storage.getLoanApplicationWithAccess(applicationId, userId, userRole);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [conditions, uploadedDocs, tasks] = await Promise.all([
        storage.getLoanConditionsByApplication(applicationId),
        storage.getDocumentsByApplication(applicationId),
        storage.getTasksByApplication(applicationId),
      ]);

      res.json(
        buildDocumentChecklist({
          conditions,
          documents: uploadedDocs,
          tasks,
        }),
      );
    } catch (error) {
      console.error("Document checklist error:", error);
      res.status(500).json({ error: "Failed to load document checklist" });
    }
  });

  // Action Items API - shows pending tasks and required actions
  app.get("/api/applications/:applicationId/action-items", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = routeParams(req);
      const user = req.user as User;

      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all tasks for this application that are borrower-relevant
      // Include tasks assigned to borrower OR unassigned tasks OR document request tasks
      const allTasks = await storage.getTasksByApplication(applicationId);
      const borrowerTasks = allTasks.filter(t => 
        t.assignedToUserId === user.id || 
        !t.assignedToUserId || 
        t.taskType === "document_request"
      );

      // Get conditions that need attention
      const conditions = await storage.getLoanConditionsByApplication(applicationId);
      const outstandingConditions = conditions.filter((c: any) => c.status === "outstanding");

      // Get existing consents for this application
      const existingConsents = await storage.getBorrowerConsentsByApplication(applicationId);
      
      // Check for required consent types that haven't been given
      const requiredConsentTypes = ["credit_pull", "disclosure", "privacy_policy"];
      const givenConsentTypes = existingConsents
        .filter((c: any) => c.consentGiven && !c.isRevoked)
        .map((c: any) => c.consentType);
      const pendingConsentTypes = requiredConsentTypes.filter(type => !givenConsentTypes.includes(type));

      // Build action items list
      const items: any[] = [];

      // Add tasks still in flight. The old lowercase filter ("completed"/
      // "verified") never matched the engine's COMPLETED, so finished tasks
      // kept rendering as open borrower action items.
      for (const task of borrowerTasks.filter(t => !TERMINAL_TASK_STATUSES.includes(t.status))) {
        items.push({
          id: task.id,
          type: task.taskType === "document_request" ? "document" : task.taskType,
          title: task.title,
          description: task.description || task.documentInstructions,
          priority: task.priority || "normal",
          dueDate: task.dueDate?.toISOString(),
          // Action-item DISPLAY status (its own client-facing vocabulary):
          // in_progress once the borrower has acted (doc submitted → task
          // IN_PROGRESS), pending while the ball is in their court.
          status: task.status === "IN_PROGRESS" ? "in_progress" : "pending",
          actionUrl: `/tasks/${task.id}`,
          actionLabel: task.taskType === "document_request" ? "Upload" : "Complete",
        });
      }

      // Add pending consent types as action items
      if (pendingConsentTypes.length > 0) {
        items.push({
          id: `consent-pending`,
          type: "consent",
          title: "Sign Required Disclosures",
          description: `${pendingConsentTypes.length} consent(s) need your signature`,
          priority: "high",
          status: "pending",
          actionUrl: `/econsent/${applicationId}`,
          actionLabel: "Review & Sign",
        });
      }

      // Add outstanding conditions that borrower can address
      for (const condition of outstandingConditions.slice(0, 3)) {
        if (condition.requiredDocumentTypes && condition.requiredDocumentTypes.length > 0) {
          items.push({
            id: `condition-${condition.id}`,
            type: "document",
            title: condition.title,
            description: condition.description,
            priority: condition.priority === "prior_to_approval" ? "urgent" : "normal",
            status: "pending",
            actionUrl: `/documents`,
            actionLabel: "Upload Documents",
          });
        }
      }

      // Sort by priority (urgent first) then by due date. ?? not ||: "urgent"
      // ranks 0, which the old || fallback swallowed — urgent items sorted as
      // normal, below high. The ?? fallback also keeps any not-yet-remapped
      // legacy value (pre-0034 rows) at normal instead of NaN-ing the sort.
      items.sort((a, b) => {
        const priorityDiff =
          (TASK_PRIORITY_RANK[a.priority as TaskPriority] ?? TASK_PRIORITY_RANK.normal) -
          (TASK_PRIORITY_RANK[b.priority as TaskPriority] ?? TASK_PRIORITY_RANK.normal);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });

      const stats = {
        total: items.length,
        urgent: items.filter(i => i.priority === "urgent").length,
        pending: items.filter(i => i.status === "pending").length,
        completed: borrowerTasks.filter(t => t.status === "COMPLETED").length,
      };

      res.json({ items, stats });
    } catch (error) {
      console.error("Action items error:", error);
      res.status(500).json({ error: "Failed to load action items" });
    }
  });

}
