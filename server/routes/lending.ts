import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import {
  insertBorrowerDeclarationsSchema,
  isStaffRole,
  LOAN_APP_STATUSES,
  loanApplicationIntakeSchema,
  loanApplicationIntakeUpdateSchema,
  type LoanAppStatus,
  type User,
} from "@shared/schema";
import { updatePipelineStage, PipelineTransitionError } from "../pipelineEngine";
import { computeNextAction } from "../services/nextAction";
import { getUserActivitySummary } from "../services/activitySummary";
import { isTerminalLoanAppStatus } from "@shared/schema";
import { analyzeLoanApplication } from "../gemini";
import { generateMISMO34XML, type MISMOLoanDTO } from "../mismo";
import { db } from "../db";
import {
  creditConsents,
  dealActivities,
  hmdaDemographics,
  loanOptions,
  tasks,
  verifications,
} from "@shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { upload, verifyFileSignature } from "./utils";
import { logAudit } from "../auditLog";
import { hasBorrowerConsent } from "../consentGate";
import * as creditService from "../services/creditService";
import { sendNotificationEmail } from "../services/emailService";
import { COMPANY_CONFIG } from "../config/company";
import { assertVerifiedForDecisioning, type DataProvenance } from "@shared/dataProvenance";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

// Intake validation lives in shared/schema/lending.ts (loanApplicationIntakeSchema),
// derived from the same base schema the funnel validates with client-side — the
// server rejects exactly what the client rejects, and "not_sure" credit maps to
// the named CREDIT_SCORE_UNKNOWN_DEFAULT instead of a silent clamp.

export function registerLendingRoutes(
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

      const pendingTaskRows = taskRows.filter((t) =>
        ["pending", "in_progress", "rejected"].includes(t.status),
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

  // Document Checklist API - shows required documents and their status
  app.get("/api/applications/:applicationId/document-checklist", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const userRole = (req.user as User).role;

      // Use getLoanApplicationWithAccess so broker/lender are validated against
      // deal-team membership rather than receiving blanket staff access.
      const application = await storage.getLoanApplicationWithAccess(applicationId, userId, userRole);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get uploaded documents for this application
      const uploadedDocs = await storage.getDocumentsByApplication(applicationId);
      
      // Get tasks that request documents
      const tasks = await storage.getTasksByApplication(applicationId);
      const documentTasks = tasks.filter(t => t.taskType === "document_request");

      // Define standard document requirements based on loan type
      const standardDocs = [
        { type: "w2", label: "W-2 Forms (Last 2 Years)", required: true },
        { type: "pay_stub", label: "Recent Pay Stubs (Last 30 Days)", required: true },
        { type: "tax_return", label: "Tax Returns (Last 2 Years)", required: true },
        { type: "bank_statement", label: "Bank Statements (Last 2 Months)", required: true },
        { type: "id", label: "Government-Issued ID", required: true },
      ];

      // Build document checklist
      const documents = standardDocs.map(doc => {
        const uploaded = uploadedDocs.find(u => u.documentType === doc.type);
        const task = documentTasks.find(t => t.documentCategory === doc.type);
        
        let status: "needed" | "uploaded" | "verifying" | "verified" | "rejected" = "needed";
        if (uploaded) {
          if (uploaded.status === "verified") status = "verified";
          else if (uploaded.status === "rejected") status = "rejected";
          else status = "uploaded";
        } else if (task && task.status === "submitted") {
          status = "verifying";
        }

        return {
          id: uploaded?.id || doc.type,
          documentType: doc.type,
          label: doc.label,
          status,
          fileName: uploaded?.fileName,
          uploadedAt: uploaded?.createdAt?.toISOString(),
          notes: uploaded?.notes || task?.verificationNotes,
          requestingTeam: task?.requestingTeam,
          isCustomRequest: task?.isCustomRequest,
          instructions: task?.documentInstructions,
        };
      });

      // Add any additional document tasks not in standard list (custom requests)
      for (const task of documentTasks) {
        if (!standardDocs.find(d => d.type === task.documentCategory)) {
          const uploaded = uploadedDocs.find(u => u.documentType === task.documentCategory);
          documents.push({
            id: task.id,
            documentType: task.documentCategory || "other",
            label: task.title,
            status: uploaded ? (uploaded.status === "verified" ? "verified" : "uploaded") : "needed",
            fileName: uploaded?.fileName,
            uploadedAt: uploaded?.createdAt?.toISOString(),
            notes: task.documentInstructions,
            requestingTeam: task.requestingTeam,
            isCustomRequest: task.isCustomRequest,
            instructions: task.documentInstructions,
          });
        }
      }

      const stats = {
        total: documents.length,
        verified: documents.filter(d => d.status === "verified").length,
        uploaded: documents.filter(d => d.status === "uploaded" || d.status === "verifying").length,
        needed: documents.filter(d => d.status === "needed").length,
        rejected: documents.filter(d => d.status === "rejected").length,
      };

      res.json({ documents, stats });
    } catch (error) {
      console.error("Document checklist error:", error);
      res.status(500).json({ error: "Failed to load document checklist" });
    }
  });

  // Action Items API - shows pending tasks and required actions
  app.get("/api/applications/:applicationId/action-items", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
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

      // Add document tasks that aren't completed/verified
      for (const task of borrowerTasks.filter(t => t.status !== "completed" && t.status !== "verified")) {
        items.push({
          id: task.id,
          type: task.taskType === "document_request" ? "document" : task.taskType,
          title: task.title,
          description: task.description || task.documentInstructions,
          priority: task.priority || "normal",
          dueDate: task.dueDate?.toISOString(),
          status: task.status === "submitted" ? "in_progress" : "pending",
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

      // Sort by priority (urgent first) then by due date
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      items.sort((a, b) => {
        const priorityDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                            (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });

      const stats = {
        total: items.length,
        urgent: items.filter(i => i.priority === "urgent").length,
        pending: items.filter(i => i.status === "pending").length,
        completed: borrowerTasks.filter(t => t.status === "completed" || t.status === "verified").length,
      };

      res.json({ items, stats });
    } catch (error) {
      console.error("Action items error:", error);
      res.status(500).json({ error: "Failed to load action items" });
    }
  });

  app.post("/api/loan-applications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;
      
      const parsed = loanApplicationIntakeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      }
      const formData = parsed.data;

      let referringBrokerId: string | undefined = undefined;
      if (user.referredByUserId) {
        referringBrokerId = user.referredByUserId;
      }

      // All figures are schema-required and validated — no "|| 0" fallbacks
      // manufacturing $0 incomes out of missing data.
      const applicationData = {
        userId,
        status: "submitted" as const,
        annualIncome: formData.annualIncome,
        monthlyDebts: formData.monthlyDebts,
        creditScore: formData.creditScore,
        employmentType: formData.employmentType,
        employmentYears: formData.employmentYears,
        propertyType: formData.propertyType,
        purchasePrice: formData.purchasePrice,
        downPayment: formData.downPayment,
        loanPurpose: formData.loanPurpose,
        isVeteran: formData.isVeteran,
        isFirstTimeBuyer: formData.isFirstTimeBuyer,
        propertyState: formData.propertyState,
        incomeSources: formData.incomeSources || null,
        referringBrokerId,
      };

      const application = await storage.createLoanApplication(applicationData);
      logAudit(req, "loan_application.created", "loan_application", application.id);

      // Persist the funnel's FCRA soft-pull acknowledgment as ledger evidence
      // (canonical disclosure text + IP + user agent). Non-fatal: a consent
      // write failure must not lose the application itself.
      if (formData.softPullConsentAccepted === true) {
        try {
          const borrowerFullName =
            [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Borrower";
          const consent = await creditService.createCreditConsent({
            applicationId: application.id,
            userId,
            consentType: "soft_pull",
            borrowerFullName,
            consentGiven: true,
            ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip,
            userAgent: req.get("User-Agent"),
          });
          logAudit(req, "credit_consent.created", "loan_application", application.id, {
            consentId: consent.id,
            consentType: "soft_pull",
            source: "preapproval_funnel",
          });
        } catch (consentErr) {
          console.error("[Consent] Failed to persist funnel soft-pull consent (non-fatal):", consentErr);
        }
      }

      const inviteId = req.body.inviteId;
      if (inviteId && typeof inviteId === "string") {
        try {
          const invite = await storage.updateApplicationInvite(inviteId, {
            status: "applied",
            appliedAt: new Date(),
            loanApplicationId: application.id,
          });
          if (invite) {
            console.log(`[Invite] Linked invite ${inviteId} to application ${application.id}`);
          }
        } catch (inviteErr) {
          console.warn(`[Invite] Failed to link invite ${inviteId}:`, inviteErr);
        }
      }

      await storage.createDealActivity({
        applicationId: application.id,
        activityType: "status_change",
        title: "Application Submitted",
        description: "Your loan application has been received and is being analyzed.",
        performedBy: userId,
      });

      await storage.createNotification({
        userId,
        type: "application_submitted",
        title: "Application Received",
        body: "Your mortgage application has been submitted and is being reviewed.",
        entityType: "loan_application",
        entityId: application.id,
        status: "unread",
      });

      if (user.email) {
        sendNotificationEmail({
          type: "application_submitted",
          recipientEmail: user.email,
          data: { borrowerName: user.firstName || "Borrower", applicationId: application.id },
        });
      }

      res.status(201).json(application);

      try {
        // Single writer: milestone/event/state-machine side effects included.
        await updatePipelineStage(application.id, "analyzing");

        const analysisResult = await analyzeLoanApplication({
          annualIncome: applicationData.annualIncome,
          monthlyDebts: applicationData.monthlyDebts,
          creditScore: String(formData.creditScore),
          purchasePrice: applicationData.purchasePrice,
          downPayment: applicationData.downPayment,
          propertyType: applicationData.propertyType || "single_family",
          loanPurpose: applicationData.loanPurpose || "purchase",
          isVeteran: applicationData.isVeteran,
          isFirstTimeBuyer: applicationData.isFirstTimeBuyer,
          employmentType: applicationData.employmentType || "employed",
          employmentYears: String(formData.employmentYears || 0),
        });

        const newStatus: LoanAppStatus = analysisResult.isApproved ? "pre_approved" : "denied";

        // Analysis figures land first so stage-event handlers see them, then
        // the status moves through the single writer (milestones, task events,
        // state sync). The automated "denied" carries no denial reasons, so
        // no HMDA LAR code is stamped — the formal adverse-action flow owns
        // that disposition.
        await storage.updateLoanApplication(application.id, {
          preApprovalAmount: analysisResult.preApprovalAmount,
          dtiRatio: analysisResult.dtiRatio,
          ltvRatio: analysisResult.ltvRatio,
          aiAnalysis: analysisResult.analysis,
          aiAnalyzedAt: new Date(),
        });
        await updatePipelineStage(application.id, newStatus);

        for (const scenario of analysisResult.scenarios) {
          try {
            await storage.createLoanOption({
              applicationId: application.id,
              ...scenario,
            });
          } catch (optErr) {
            console.error("[Analysis] Failed to create loan option:", optErr);
          }
        }

        try {
          await storage.createDealActivity({
            applicationId: application.id,
            activityType: "status_change",
            title: analysisResult.isApproved ? "Pre-Approval Issued" : "Application Under Review",
            description: analysisResult.isApproved 
              ? `Pre-approval issued for up to $${(parseFloat(analysisResult.preApprovalAmount) || 0).toLocaleString()}. Final terms subject to underwriting review.`
              : "Your application requires additional review by the underwriting team.",
          });
        } catch (actErr) {
          console.error("[Analysis] Failed to create deal activity:", actErr);
        }

        const borrowerName = user.firstName || "Borrower";
        try {
          if (analysisResult.isApproved) {
            await storage.createNotification({
              userId,
              type: "application_pre_approved",
              title: "Pre-Approval Issued",
              body: `Your pre-approval has been issued for up to $${(parseFloat(analysisResult.preApprovalAmount) || 0).toLocaleString()}. Final terms are subject to underwriting review.`,
              entityType: "loan_application",
              entityId: application.id,
              status: "unread",
            });
            if (user.email) {
              sendNotificationEmail({
                type: "application_pre_approved",
                recipientEmail: user.email,
                data: { borrowerName, amount: (parseFloat(analysisResult.preApprovalAmount) || 0).toLocaleString(), applicationId: application.id },
              });
            }
          } else {
            await storage.createNotification({
              userId,
              type: "application_denied",
              title: "Application Under Review",
              body: "Your application requires additional review by the underwriting team. Please check your dashboard for details.",
              entityType: "loan_application",
              entityId: application.id,
              status: "unread",
            });
            if (user.email) {
              sendNotificationEmail({
                type: "application_denied",
                recipientEmail: user.email,
                data: { borrowerName },
              });
            }
          }
        } catch (notifErr) {
          console.error("[Analysis] Failed to send notifications:", notifErr);
        }

        if (analysisResult.isApproved) {
          try {
            const updatedApp = await storage.getLoanApplication(application.id);
            if (updatedApp) {
              const { initializeLoanPipeline } = await import("../pipelineEngine");
              await initializeLoanPipeline(updatedApp, userId);
              
              await storage.createDealActivity({
                applicationId: application.id,
                activityType: "status_change",
                title: "Document Collection Started",
                description: "Required documents have been identified. Please upload them to continue your application.",
                performedBy: "system",
              });
            }
          } catch (pipelineErr) {
            console.error("[Analysis] Pipeline initialization failed (non-fatal):", pipelineErr);
          }
        }

        // Automated pre-underwriting validation the moment intake completes
        // (reserves vs verified assets, complex-income flags, borrower outreach).
        try {
          const { runPreUnderwriting } = await import("../services/preUnderwriting");
          await runPreUnderwriting(application.id, "intake");
        } catch (preUwErr) {
          console.error("[Analysis] Pre-underwriting validation failed (non-fatal):", preUwErr);
        }
      } catch (analysisError) {
        console.error("AI analysis error:", analysisError);
        // Roll back to "submitted" so the file re-enters the review queue
        // rather than sitting in "analyzing" forever.
        try {
          await updatePipelineStage(application.id, "submitted");
        } catch (rollbackErr) {
          console.error("[Analysis] Rollback to submitted failed:", rollbackErr);
        }
      }
    } catch (error) {
      console.error("Create application error:", error);
      res.status(500).json({ error: "Failed to create application" });
    }
  });

  app.get("/api/loan-applications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getLoanApplicationsByUser(userId);
      res.json(applications);
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  app.get("/api/loan-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const application = await storage.getLoanApplicationWithAccess(
        req.params.id, 
        req.user!.id, 
        req.user!.role
      );
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const [options, documents, activities] = await Promise.all([
        storage.getLoanOptionsByApplication(req.params.id),
        storage.getDocumentsByApplication(req.params.id),
        storage.getDealActivitiesByApplication(req.params.id),
      ]);

      res.json({
        application,
        options,
        documents,
        activities,
      });
    } catch (error) {
      console.error("Get application error:", error);
      res.status(500).json({ error: "Failed to get application" });
    }
  });

  app.get("/api/loan-applications/:id/options", isAuthenticated, async (req, res) => {
    try {
      const application = await storage.getLoanApplicationWithAccess(
        req.params.id, 
        req.user!.id, 
        req.user!.role
      );
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const options = await storage.getLoanOptionsByApplication(req.params.id);
      
      res.json({
        application,
        options,
      });
    } catch (error) {
      console.error("Get loan options error:", error);
      res.status(500).json({ error: "Failed to get loan options" });
    }
  });

  // Rate transparency: deterministic decomposition of a quoted rate into its
  // base rate + Fannie-style LLPA components, so the borrower sees exactly
  // why their rate is their rate (points ÷ 4 ≈ rate-equivalent adjustment).
  app.get("/api/loan-options/:id/pricing-breakdown", isAuthenticated, async (req, res) => {
    try {
      const option = await storage.getLoanOption(req.params.id);
      if (!option) {
        return res.status(404).json({ error: "Loan option not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(option.applicationId, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { calculateLLPA } = await import("../pricing");
      const loanAmount = parseFloat(String(option.loanAmount));
      const creditScore = application.creditScore ?? 680;
      const ltv = parseFloat(String(application.ltvRatio ?? "80"));
      const llpa = await calculateLLPA(
        loanAmount,
        creditScore,
        ltv,
        (application.propertyType as "single_family" | "condo" | "townhouse" | "multi_family") || "single_family",
        "primary_residence",
        application.isFirstTimeBuyer ?? false,
        parseFloat(String(application.annualIncome ?? "0")),
        0,
      );

      const quotedRate = parseFloat(String(option.interestRate));
      const rateEquivalent = llpa.totalLLPA / 4;
      res.json({
        optionId: option.id,
        loanType: option.loanType,
        finalRate: quotedRate,
        baseRate: Number((quotedRate - rateEquivalent).toFixed(3)),
        adjustments: {
          creditScoreAndLtv: llpa.baseLLPA,
          propertyType: llpa.propertyTypeAdjustment,
          condo: llpa.condoAdjustment,
          firstTimeBuyerWaiver: llpa.fthbWaiver,
        },
        totalLlpaPoints: llpa.totalLLPA,
        rateEquivalent: Number(rateEquivalent.toFixed(3)),
        llpaFeeAmount: llpa.pricing.lLPAFeeAmount,
        inputs: { creditScore, ltv: Number(ltv.toFixed(1)), loanAmount },
      });
    } catch (error) {
      console.error("Pricing breakdown error:", error);
      res.status(500).json({ error: "Failed to compute pricing breakdown" });
    }
  });

  app.post("/api/loan-options/:id/lock", isAuthenticated, async (req, res) => {
    try {
      const existing = await storage.getLoanOption(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      const application = await storage.getLoanApplicationWithAccess(existing.applicationId, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Reg Z anti-steering: a borrower may not select/lock an option until
      // they have acknowledged the loan-options disclosure. Staff locking on
      // the borrower's behalf is unaffected (their obligation is procedural).
      if (application.userId === req.user!.id) {
        const acknowledged = await hasBorrowerConsent("anti_steering", application.id);
        if (!acknowledged) {
          const { logFriction } = await import("../services/frictionLog");
          logFriction("anti_steering_blocked", {
            userId: req.user!.id,
            applicationId: application.id,
          });
          return res.status(403).json({
            error: "Please review the loan options disclosure before locking a rate.",
            code: "CONSENT_REQUIRED",
            consentType: "anti_steering",
          });
        }
      }

      const option = await storage.lockLoanOption(req.params.id);
      if (!option) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      await storage.createDealActivity({
        applicationId: option.applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: `Your ${option.interestRate}% rate has been locked for 30 days.`,
        performedBy: req.user!.id,
      });

      res.json(option);
    } catch (error) {
      console.error("Lock rate error:", error);
      res.status(500).json({ error: "Failed to lock rate" });
    }
  });

  // MISMO 3.4 XML Export Route - GSE compliant loan delivery format
  app.get("/api/loan-applications/:id/mismo-export", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { id } = req.params;

      // Verify the caller is authorized for this specific application.
      // broker/lender must be deal-team members; internal staff have global access.
      const authorizedApp = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!authorizedApp) {
        return res.status(403).json({ error: "Access denied" });
      }

      const mismoData = await storage.getMISMOLoanData(id);
      
      if (!mismoData) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Build the DTO with declarations from storage
      const dto: MISMOLoanDTO = {
        ...mismoData,
      };

      const xml = generateMISMO34XML(dto);
      
      // Set proper headers for XML download
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="mismo-${id}.xml"`);
      res.send(xml);

      await storage.createDealActivity({
        applicationId: id,
        activityType: "note",
        title: "MISMO XML Exported",
        description: "Loan data exported in MISMO 3.4 format for GSE delivery",
        performedBy: req.user!.id,
      });
    } catch (error) {
      console.error("MISMO export error:", error);
      res.status(500).json({ error: "Failed to generate MISMO XML" });
    }
  });

  // Data Quality Scoring API - for broker dashboard (ownership-scoped query)
  app.get("/api/loan-applications/:id/data-quality", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const quality = await storage.getApplicationDataQuality(id);
      res.json(quality);
    } catch (error) {
      console.error("Data quality error:", error);
      res.status(500).json({ error: "Failed to get data quality" });
    }
  });

  // Borrower Declarations API - with ownership-scoped query
  app.get("/api/loan-applications/:id/declarations", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const declarations = await storage.getBorrowerDeclarations(id);
      res.json(declarations || null);
    } catch (error) {
      console.error("Get declarations error:", error);
      res.status(500).json({ error: "Failed to get declarations" });
    }
  });

  app.post("/api/loan-applications/:id/declarations", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body with Zod schema
      const parseResult = declarationsValidationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid declarations data", 
          details: parseResult.error.flatten() 
        });
      }
      
      // Use ownership-scoped query - authorization happens at database level
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role || "");
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const data = { ...parseResult.data, applicationId: id };
      const declarations = await storage.upsertBorrowerDeclarations(data);
      
      await storage.createDealActivity({
        applicationId: id,
        activityType: "note",
        title: "Declarations Updated",
        description: "Borrower declarations have been submitted",
        performedBy: req.user!.id,
      });
      
      res.json(declarations);
    } catch (error) {
      console.error("Save declarations error:", error);
      res.status(500).json({ error: "Failed to save declarations" });
    }
  });

  app.post("/api/documents/upload", isAuthenticated, upload.single("file"), verifyFileSignature, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentType, applicationId } = req.body;
      const userId = req.user!.id;

      if (applicationId) {
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, (req.user as User).role);
        if (!application) {
          return res.status(403).json({ error: "You do not have access to this application" });
        }
      }

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: documentType || "other",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Document Uploaded",
          description: `${req.file.originalname} has been uploaded.`,
          performedBy: userId,
        });
        
        // Emit document uploaded event for Task Engine
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
        await taskEventEmitter.emitDocumentEvent("DOCUMENT_UPLOADED", {
          applicationId,
          documentId: document.id,
          documentType: documentType || "other",
          triggeredBy: userId,
        });

        // Zero-touch: move matching outstanding conditions to "submitted"
        // and notify the deal team (clearing stays a human decision).
        try {
          const { matchUploadedDocumentToConditions } = await import("../pipelineEngine");
          await matchUploadedDocumentToConditions({
            applicationId,
            documentType: documentType || "other",
            fileName: req.file.originalname,
            uploadedBy: userId,
          });
        } catch (matchErr) {
          console.error("[Documents] Condition matching failed (non-fatal):", matchErr);
        }
      }

      res.status(201).json(document);
    } catch (error) {
      console.error("Document upload error:", error);
      try {
        const { logFriction } = await import("../services/frictionLog");
        logFriction("document_upload_failed", {
          userId: req.user?.id,
          applicationId: typeof req.body?.applicationId === "string" ? req.body.applicationId : undefined,
          detail: error instanceof Error ? error.message.slice(0, 200) : "unknown",
        });
      } catch {}
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const documents = await storage.getDocumentsByUser(userId);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  app.patch("/api/loan-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const application = await storage.getLoanApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Borrower field edits apply to drafts only. Previously this endpoint
      // force-reset ANY application to "draft" — a borrower editing figures
      // mid-underwriting would silently pull the file out of the pipeline
      // (and could rewrite verified financials). Submitted files change
      // through staff channels.
      if (application.status !== "draft") {
        return res.status(409).json({
          error: "This application has been submitted and can no longer be edited directly. Contact your loan team to update it.",
          code: "not_editable",
        });
      }

      // Shared-derived schema: same field rules the funnel enforces client-side,
      // no silent clamps, values normalized (commas stripped, credit band →
      // number) by the schema itself. Present-and-valid fields pass through;
      // absent fields are left untouched — never defaulted to "0".
      const parsed = loanApplicationIntakeUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      }

      const formData = parsed.data;
      // Only real loan_applications columns — the funnel schema also carries
      // UI-only helpers (hasAdditionalIncome) that must not reach the DB.
      const UPDATABLE_COLUMNS = [
        "annualIncome", "monthlyDebts", "creditScore", "employmentType",
        "employmentYears", "propertyType", "purchasePrice", "downPayment",
        "loanPurpose", "isVeteran", "isFirstTimeBuyer", "propertyState",
        "employerName", "propertyAddress", "propertyCity", "propertyZip",
        "incomeSources",
      ] as const;
      const updateData: Record<string, unknown> = {};
      for (const key of UPDATABLE_COLUMNS) {
        const value = (formData as Record<string, unknown>)[key];
        if (value !== undefined) updateData[key] = value;
      }

      const updated = await storage.updateLoanApplication(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Update application error:", error);
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  // Statuses that represent a final credit decision. Only underwriters and admins
  // may set these; other roles must go through the guarded advance-stage endpoint
  // in underwriting.ts which enforces the STAGE_TRANSITION_ROLES policy.
  const PROTECTED_CREDIT_DECISION_STATUSES = new Set<LoanAppStatus>([
    "pre_approved", "clear_to_close", "funded", "denied",
  ]);

  // The canonical vocabulary minus system-only states: "draft" belongs to the
  // borrower funnel, "analyzing"/"expired" are set by automation. HMDA codes
  // and milestones are stamped inside updatePipelineStage — one writer.
  const STAFF_SETTABLE_STATUSES = LOAN_APP_STATUSES.filter(
    (s) => s !== "draft" && s !== "analyzing" && s !== "expired",
  ) as [LoanAppStatus, ...LoanAppStatus[]];

  const staffStatusSchema = z.object({
    status: z.enum(STAFF_SETTABLE_STATUSES),
    notes: z.string().max(2000).optional(),
    // HMDA requires at least 2 denial reasons when an application is denied.
    denialReasons: z.array(z.string().min(1)).optional(),
    // Admin-only: bypass the transition table (side effects still run).
    force: z.boolean().optional(),
  });

  app.patch("/api/loan-applications/:id/status", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;

      const { id } = req.params;
      const parsed = staffStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status", details: parsed.error.errors });
      }

      const application = await storage.getLoanApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { status, notes, denialReasons, force } = parsed.data;

      // HMDA LAR requires at least 2 denial reasons when an application is denied.
      if (status === "denied" && (!denialReasons || denialReasons.length < 2)) {
        return res.status(400).json({
          error: "At least 2 denial reasons are required to deny an application (HMDA LAR)",
        });
      }

      // Enforce that only admin or underwriter can set final credit-decision statuses.
      // All other roles (including assigned deal-team members) must use the
      // underwriting advance-stage endpoint which enforces the full transition policy.
      if (PROTECTED_CREDIT_DECISION_STATUSES.has(status) && user.role !== "admin" && user.role !== "underwriter") {
        return res.status(403).json({ error: "Only underwriters or admins may set approval or denial outcomes" });
      }

      // Admins may update any application; all other roles must be on the deal team.
      if (user.role !== "admin") {
        const teamMembers = await storage.getDealTeamMembers(id);
        const isOnTeam = teamMembers.some(m => m.userId === user.id);
        if (!isOnTeam) {
          return res.status(403).json({ error: "You are not assigned to this application" });
        }
      }

      // Approval outcomes may not be set on self-reported/estimated data — a
      // favorable credit determination requires verified figures. (Denial is not
      // gated: an application can be denied for unverifiable or incomplete info.)
      if (status === "pre_approved" || status === "clear_to_close" || status === "funded") {
        try {
          assertVerifiedForDecisioning(
            application.financialDataProvenance as DataProvenance,
            `setting status to '${status}'`,
          );
        } catch (guardErr) {
          return res.status(422).json({
            error: guardErr instanceof Error ? guardErr.message : "Financial data must be verified",
          });
        }
      }

      const previousStatus = application.status;

      // Single writer: milestones, HMDA LAR codes, task-engine events, state-
      // machine sync, and funded→homeowner graduation all happen inside
      // updatePipelineStage. Invalid transitions come back as 409 with the
      // allowed set so staff UIs can grey out impossible moves.
      try {
        await updatePipelineStage(id, status, {
          denialReasons,
          force: force === true && user.role === "admin",
        });
      } catch (stageErr) {
        if (stageErr instanceof PipelineTransitionError) {
          return res.status(409).json({
            error: stageErr.message,
            code: "invalid_transition",
            fromStatus: stageErr.fromStage,
            toStatus: stageErr.toStage,
            allowedStatuses: stageErr.allowed,
          });
        }
        throw stageErr;
      }

      const updated = await storage.getLoanApplication(id);

      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: `Status Updated to ${status.replace(/_/g, " ").toUpperCase()}`,
        description: notes || `Application status changed from ${previousStatus} to ${status}`,
        performedBy: user.id,
      });

      const borrower = await storage.getUser(application.userId);
      if (borrower) {
        const statusLabel = status.replace(/_/g, " ");
        await storage.createNotification({
          userId: borrower.id,
          type: "status_update",
          title: "Application Status Updated",
          body: `Your application status has been updated to: ${statusLabel}`,
          entityType: "loan_application",
          entityId: id,
          status: "unread",
        });

        if (borrower.email) {
          const borrowerName = borrower.firstName || "Borrower";
          if (status === "pre_approved" || status === "clear_to_close") {
            sendNotificationEmail({
              type: "application_pre_approved",
              recipientEmail: borrower.email,
              data: {
                borrowerName,
                amount: (parseFloat(application.preApprovalAmount || "0") || 0).toLocaleString(),
                applicationId: id,
              },
            });
          } else if (status === "denied") {
            sendNotificationEmail({
              type: "application_denied",
              recipientEmail: borrower.email,
              data: { borrowerName },
            });
          } else {
            sendNotificationEmail({
              type: "status_update",
              recipientEmail: borrower.email,
              data: { borrowerName, statusLabel, applicationId: id },
            });
          }
        }
      }

      logAudit(req, "loan_application.status_changed", "loan_application", id, {
        previousStatus,
        newStatus: status,
        changedBy: user.id,
        ...(updated?.hmdaActionTaken && { hmdaActionTaken: updated.hmdaActionTaken }),
        ...(updated?.hmdaDenialReasons?.length && { hmdaDenialReasons: updated.hmdaDenialReasons }),
      });

      res.json(updated);
    } catch (error) {
      console.error("Staff status update error:", error);
      res.status(500).json({ error: "Failed to update application status" });
    }
  });

  // Mark the borrower's financial figures as verified against documentation /
  // credit. This is the gate that lets an application proceed to approval and
  // pre-approval-letter generation. Restricted to staff who review documents.
  app.post(
    "/api/loan-applications/:id/verify-financials",
    requireRole("admin", "lo", "loa", "processor", "underwriter"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const { id } = req.params;

        const application = await storage.getLoanApplication(id);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        // Non-admin staff must be on the deal team.
        if (user.role !== "admin") {
          const teamMembers = await storage.getDealTeamMembers(id);
          if (!teamMembers.some((m) => m.userId === user.id)) {
            return res.status(403).json({ error: "You are not assigned to this application" });
          }
        }

        // "Verify all" override — sets every dimension and promotes provenance.
        const updated = await storage.updateLoanApplication(id, {
          financialDataProvenance: "verified",
          financialDataVerifiedAt: new Date(),
          financialDataVerifiedBy: user.id,
          incomeVerified: true,
          assetsVerified: true,
          creditVerified: true,
        });

        logAudit(req, "loan_application.financials_verified", "loan_application", id, {
          verifiedBy: user.id,
        });

        // Real-time recalc: verified data upgrades the decision (PRELIMINARY -> VERIFIED).
        import("../services/decisionEngine")
          .then((m) => m.recalculateDecision(id, "financials_verified"))
          .catch(() => {});

        res.json(updated);
      } catch (error) {
        console.error("Verify financials error:", error);
        res.status(500).json({ error: "Failed to verify financials" });
      }
    },
  );

  // Verify a single dimension (income | assets | credit). Rolls up to a fully
  // VERIFIED application once all three are done. Granular verification means
  // staff confirm each source as it's reviewed instead of one all-or-nothing toggle.
  app.post(
    "/api/loan-applications/:id/verify/:dimension",
    requireRole("admin", "lo", "loa", "processor", "underwriter"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const { id, dimension } = req.params;
        if (!["income", "assets", "credit"].includes(dimension)) {
          return res.status(400).json({ error: "dimension must be income, assets, or credit" });
        }

        const application = await storage.getLoanApplication(id);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        if (user.role !== "admin") {
          const teamMembers = await storage.getDealTeamMembers(id);
          if (!teamMembers.some((m) => m.userId === user.id)) {
            return res.status(403).json({ error: "You are not assigned to this application" });
          }
        }

        const { markDimensionVerified } = await import("../services/verification");
        await markDimensionVerified(id, dimension as "income" | "assets" | "credit", user.id);

        logAudit(req, "loan_application.dimension_verified", "loan_application", id, {
          dimension,
          verifiedBy: user.id,
        });

        const updated = await storage.getLoanApplication(id);
        res.json(updated);
      } catch (error) {
        console.error("Verify dimension error:", error);
        res.status(500).json({ error: "Failed to verify dimension" });
      }
    },
  );

  app.get("/api/loan-applications/draft/latest", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const applications = await storage.getLoanApplicationsByUser(userId);
      
      const draft = applications.find(app => app.status === "draft");
      if (draft) {
        return res.json(draft);
      }
      
      res.json(null);
    } catch (error) {
      console.error("Get draft application error:", error);
      res.status(500).json({ error: "Failed to get draft application" });
    }
  });

  app.post("/api/loan-applications/:id/generate-letter", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      if (application.status !== "pre_approved") {
        return res.status(400).json({ error: "Only pre-approved applications can generate letters" });
      }

      // A pre-approval letter represents a creditworthiness determination — it may
      // not be issued from self-reported/estimated figures. Require verified data.
      try {
        assertVerifiedForDecisioning(
          application.financialDataProvenance as DataProvenance,
          "generating a pre-approval letter",
        );
      } catch (guardErr) {
        return res.status(422).json({
          error: guardErr instanceof Error ? guardErr.message : "Financial data must be verified",
        });
      }

      const { generatePreApprovalPDF } = await import("../services/pdfLetterGenerator");

      const letterNumber = `BN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90);

      const purchasePrice = parseFloat(application.purchasePrice || "0");
      const downPayment = parseFloat(application.downPayment || "0");
      const loanAmount = application.preApprovalAmount || String(purchasePrice - downPayment);

      const conditions = [
        "Satisfactory property appraisal",
        "Verification of employment and income",
        "Clear title search and title insurance",
        "Property insurance in effect prior to closing",
        "No material change in financial condition",
      ];

      const disclaimers = [
        "This pre-approval is not a commitment to lend. Final approval is subject to satisfactory appraisal, title search, and verification of all information provided.",
        "This letter is valid only for the borrower named above and is non-transferable. Terms are subject to change based on market conditions.",
        "The pre-approved amount is based on information provided and preliminary underwriting review. The actual loan amount may differ upon full underwriting.",
        "This pre-approval does not guarantee any specific interest rate. Rate lock is available separately.",
        "Equal Housing Lender. All loans are subject to credit approval.",
      ];

      const borrowerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Borrower";

      const annualIncome = parseFloat(application.annualIncome || "0");
      const monthlyDebts = parseFloat(application.monthlyDebts || "0");
      const loanAmountNum = parseFloat(loanAmount) || 0;
      const rate = 0.065;
      const months = 360;
      const monthlyRate = rate / 12;
      const monthlyPayment = loanAmountNum > 0
        ? (loanAmountNum * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : 0;
      let rentalDebtTotal = 0;
      if (Array.isArray(application.incomeSources)) {
        for (const src of application.incomeSources as any[]) {
          if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
            for (const p of src.rentalProperties) {
              rentalDebtTotal += parseFloat(String(p.monthlyDebtPayment || "0").replace(/,/g, "")) || 0;
            }
          }
        }
      }
      const totalMonthlyObligations = monthlyDebts + (monthlyPayment || 0) + rentalDebtTotal;
      const monthlyIncome = annualIncome / 12;
      const dti = monthlyIncome > 0 ? (totalMonthlyObligations / monthlyIncome) * 100 : 0;
      const dpPercent = purchasePrice > 0 ? ((downPayment / purchasePrice) * 100).toFixed(1) : undefined;

      const creditScore = application.creditScore ? parseInt(String(application.creditScore)) : 0;
      let creditRange = "";
      if (creditScore >= 760) creditRange = "760+";
      else if (creditScore >= 720) creditRange = "720-759";
      else if (creditScore >= 680) creditRange = "680-719";
      else if (creditScore >= 640) creditRange = "640-679";
      else if (creditScore > 0) creditRange = `${creditScore}`;

      const incomeSources = Array.isArray(application.incomeSources) ? (application.incomeSources as any[]).map(s => ({
        type: s.type || "other",
        annualAmount: String(s.annualAmount || "0"),
        rentalProperties: Array.isArray(s.rentalProperties) ? s.rentalProperties.map((p: any) => ({
          address: p.address || "",
          monthlyRentalIncome: String(p.monthlyRentalIncome || "0"),
          monthlyDebtPayment: String(p.monthlyDebtPayment || "0"),
        })) : undefined,
      })) : undefined;

      const pdfBuffer = await generatePreApprovalPDF({
        letterNumber,
        borrowerName,
        loanAmount,
        productType: application.isVeteran ? "VA" : "CONV",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        companyContactInfo: COMPANY_CONFIG.contactInfo,
        expirationDate,
        generatedAt: new Date(),
        conditions,
        disclaimers,
        watermarkApplied: true,
        purchasePrice: purchasePrice > 0 ? String(purchasePrice) : undefined,
        downPayment: downPayment > 0 ? String(downPayment) : undefined,
        downPaymentPercent: dpPercent,
        annualIncome: annualIncome > 0 ? String(annualIncome) : undefined,
        monthlyPaymentEstimate: monthlyPayment > 0 ? String(Math.round(monthlyPayment)) : undefined,
        estimatedDti: dti > 0 ? dti.toFixed(1) : undefined,
        creditScoreRange: creditRange || undefined,
        employmentType: application.employmentType || undefined,
        propertyType: application.propertyType || undefined,
        propertyState: application.propertyState || undefined,
        incomeSources: incomeSources && incomeSources.length > 0 ? incomeSources : undefined,
      });

      const storageKey = `letters/${letterNumber}.pdf`;
      let pdfStored = false;
      try {
        const { objectStorageClient } = await import("../integrations/object_storage/objectStorage");
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (privateDir) {
          const fullPath = `${privateDir}/${storageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          await file.save(pdfBuffer, { contentType: "application/pdf" });
          pdfStored = true;
        }
      } catch (storageErr) {
        console.error("[Letter] Object storage upload failed, will regenerate on demand:", storageErr);
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters, disclaimerVersions, underwritingDecisions } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      let snapshotId: string | null = null;
      try {
        const [snapshot] = await database.select().from(underwritingDecisions)
          .where(eq(underwritingDecisions.loanId, id))
          .orderBy(desc(underwritingDecisions.decidedAt))
          .limit(1);
        snapshotId = snapshot?.id || null;
      } catch (snapErr) {
        console.warn("[Letter] Underwriting snapshot lookup failed:", snapErr);
      }

      let disclaimerId: string | null = null;
      try {
        const [disc] = await database.select().from(disclaimerVersions).limit(1);
        disclaimerId = disc?.id || null;
      } catch (discErr) {
        console.warn("[Letter] Disclaimer lookup failed:", discErr);
      }

      if (!disclaimerId) {
        try {
          const [fallbackDisc] = await database.insert(disclaimerVersions).values({
            disclaimerType: "primary",
            version: "1.0",
            text: "This pre-approval is not a commitment to lend. Final approval is subject to a satisfactory appraisal, title search, and verification of all information provided.",
            effectiveFrom: new Date(),
          }).returning();
          disclaimerId = fallbackDisc.id;
        } catch (discErr) {
          console.error("[Letter] Fallback disclaimer creation failed:", discErr);
        }
      }

      let letterId: string | null = null;
      try {
        const insertValues: any = {
          letterNumber,
          borrowerName,
          applicationId: id,
          loanAmount,
          productType: application.isVeteran ? "VA" : "CONV",
          occupancy: "Primary",
          loanPurpose: application.loanPurpose || "Purchase",
          expirationDate,
          companyLegalName: COMPANY_CONFIG.legalName,
          companyNmlsId: COMPANY_CONFIG.nmlsId,
          companyContactInfo: COMPANY_CONFIG.contactInfo,
          loanOfficerId: isStaffRole(user.role) ? user.id : undefined,
          pdfStorageKey: pdfStored ? storageKey : undefined,
          pdfGeneratedAt: new Date(),
        };

        if (snapshotId) {
          insertValues.underwritingSnapshotId = snapshotId;
        }
        if (disclaimerId) {
          insertValues.primaryDisclaimerId = disclaimerId;
          insertValues.brokerRoleDisclaimerId = disclaimerId;
          insertValues.documentRelianceDisclaimerId = disclaimerId;
          insertValues.changeInCircumstanceDisclaimerId = disclaimerId;
          insertValues.systemGeneratedDisclaimerId = disclaimerId;
        }

        const [letter] = await database.insert(preApprovalLetters).values(insertValues).returning();
        letterId = letter?.id || null;
      } catch (dbErr) {
        console.error("[Letter] DB insert failed:", dbErr);
      }

      await storage.createNotification({
        userId: user.id,
        type: "pre_approval_letter_ready",
        title: "Pre-Approval Letter Ready",
        body: `Your pre-approval letter #${letterNumber} is ready for download.`,
        entityType: "pre_approval_letter",
        entityId: letterId || id,
        status: "unread",
      });

      if (user.email) {
        sendNotificationEmail({
          type: "pre_approval_letter_ready",
          recipientEmail: user.email,
          data: {
            borrowerName,
            amount: (parseFloat(loanAmount) || 0).toLocaleString(),
            letterNumber,
          },
        });
      }

      logAudit(req, "pre_approval_letter.generated", "pre_approval_letter", letterId || letterNumber);

      res.json({
        letterNumber,
        letterId,
        loanAmount,
        expirationDate,
        pdfAvailable: true,
        pdfStored,
      });
    } catch (error) {
      console.error("Generate letter error:", error);
      res.status(500).json({ error: "Failed to generate pre-approval letter" });
    }
  });

  app.get("/api/loan-applications/:id/letter-pdf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preApprovalLetters)
        .where(eq(preApprovalLetters.applicationId, id))
        .orderBy(desc(preApprovalLetters.createdAt))
        .limit(1);

      if (letter?.pdfStorageKey) {
        try {
          const { objectStorageClient } = await import("../integrations/object_storage/objectStorage");
          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          const fullPath = `${privateDir}/${letter.pdfStorageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            const [contents] = await file.download();
            logAudit(req, "pre_approval_letter.downloaded", "pre_approval_letter", letter.id);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${letter.letterNumber}.pdf"`);
            return res.send(contents);
          }
        } catch (storageErr) {
          console.error("[Letter] Storage download failed, regenerating:", storageErr);
        }
      }

      const { generatePreApprovalPDF } = await import("../services/pdfLetterGenerator");
      const purchasePrice = parseFloat(application.purchasePrice || "0");
      const downPayment = parseFloat(application.downPayment || "0");
      const loanAmount = application.preApprovalAmount || String(purchasePrice - downPayment);
      const borrowerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Borrower";

      const annualIncome = parseFloat(application.annualIncome || "0");
      const monthlyDebts = parseFloat(application.monthlyDebts || "0");
      const loanAmountNum = parseFloat(loanAmount) || 0;
      const rate = 0.065;
      const months = 360;
      const monthlyRate = rate / 12;
      const monthlyPayment = loanAmountNum > 0
        ? (loanAmountNum * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : 0;
      let dlRentalDebtTotal = 0;
      if (Array.isArray(application.incomeSources)) {
        for (const src of application.incomeSources as any[]) {
          if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
            for (const p of src.rentalProperties) {
              dlRentalDebtTotal += parseFloat(String(p.monthlyDebtPayment || "0").replace(/,/g, "")) || 0;
            }
          }
        }
      }
      const totalMonthlyObligations = monthlyDebts + (monthlyPayment || 0) + dlRentalDebtTotal;
      const monthlyIncome = annualIncome / 12;
      const dti = monthlyIncome > 0 ? (totalMonthlyObligations / monthlyIncome) * 100 : 0;
      const dpPercent = purchasePrice > 0 ? ((downPayment / purchasePrice) * 100).toFixed(1) : undefined;

      const creditScore = application.creditScore ? parseInt(String(application.creditScore)) : 0;
      let creditRange = "";
      if (creditScore >= 760) creditRange = "760+";
      else if (creditScore >= 720) creditRange = "720-759";
      else if (creditScore >= 680) creditRange = "680-719";
      else if (creditScore >= 640) creditRange = "640-679";
      else if (creditScore > 0) creditRange = `${creditScore}`;

      const dlIncomeSources = Array.isArray(application.incomeSources) ? (application.incomeSources as any[]).map(s => ({
        type: s.type || "other",
        annualAmount: String(s.annualAmount || "0"),
        rentalProperties: Array.isArray(s.rentalProperties) ? s.rentalProperties.map((p: any) => ({
          address: p.address || "",
          monthlyRentalIncome: String(p.monthlyRentalIncome || "0"),
          monthlyDebtPayment: String(p.monthlyDebtPayment || "0"),
        })) : undefined,
      })) : undefined;

      const pdfBuffer = await generatePreApprovalPDF({
        letterNumber: letter?.letterNumber || `BN-${Date.now().toString(36).toUpperCase()}`,
        borrowerName,
        loanAmount,
        productType: application.isVeteran ? "VA" : "CONV",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        companyContactInfo: COMPANY_CONFIG.contactInfo,
        expirationDate: letter?.expirationDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        generatedAt: letter?.generatedAt || new Date(),
        conditions: [
          "Satisfactory property appraisal",
          "Verification of employment and income",
          "Clear title search and title insurance",
          "Property insurance in effect prior to closing",
          "No material change in financial condition",
        ],
        disclaimers: [],
        watermarkApplied: true,
        purchasePrice: purchasePrice > 0 ? String(purchasePrice) : undefined,
        downPayment: downPayment > 0 ? String(downPayment) : undefined,
        downPaymentPercent: dpPercent,
        annualIncome: annualIncome > 0 ? String(annualIncome) : undefined,
        monthlyPaymentEstimate: monthlyPayment > 0 ? String(Math.round(monthlyPayment)) : undefined,
        estimatedDti: dti > 0 ? dti.toFixed(1) : undefined,
        creditScoreRange: creditRange || undefined,
        employmentType: application.employmentType || undefined,
        propertyType: application.propertyType || undefined,
        propertyState: application.propertyState || undefined,
        incomeSources: dlIncomeSources && dlIncomeSources.length > 0 ? dlIncomeSources : undefined,
      });

      logAudit(req, "pre_approval_letter.downloaded", "pre_approval_letter", letter?.id || id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pre-approval-${id.substring(0, 8)}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download letter PDF error:", error);
      res.status(500).json({ error: "Failed to download pre-approval letter" });
    }
  });

  app.get("/api/loan-applications/:id/letter-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preApprovalLetters)
        .where(eq(preApprovalLetters.applicationId, id))
        .orderBy(desc(preApprovalLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.json({ hasLetter: false });
      }

      res.json({
        hasLetter: true,
        letterNumber: letter.letterNumber,
        status: letter.status,
        expirationDate: letter.expirationDate,
        generatedAt: letter.generatedAt,
        pdfAvailable: !!(letter.pdfStorageKey || letter.pdfGeneratedAt),
      });
    } catch (error) {
      console.error("Letter status error:", error);
      res.status(500).json({ error: "Failed to check letter status" });
    }
  });

  app.post("/api/loan-applications/:id/generate-prequal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const validStatuses = ["submitted", "analyzing", "pre_approved", "verified", "underwriting", "approved"];
      if (!validStatuses.includes(application.status)) {
        return res.status(400).json({ error: "Application must be submitted before generating a pre-qualification letter" });
      }

      const { generatePreQualificationPDF } = await import("../services/pdfLetterGenerator");
      const crypto = await import("crypto");

      const letterNumber = `PQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 60);

      const borrowerName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user.email?.split("@")[0] || "Borrower");

      const loanAmount = application.preApprovalAmount || application.purchasePrice || "0";
      const downPayment = application.downPayment ? parseFloat(application.downPayment) : 0;
      const purchasePrice = application.purchasePrice ? parseFloat(application.purchasePrice) : 0;
      const estimatedAmount = purchasePrice > 0 ? (purchasePrice - downPayment).toString() : loanAmount.toString();

      let creditScoreRange = "Not provided";
      if (application.creditScore) {
        const cs = application.creditScore;
        if (cs >= 760) creditScoreRange = "760+";
        else if (cs >= 720) creditScoreRange = "720-759";
        else if (cs >= 680) creditScoreRange = "680-719";
        else if (cs >= 640) creditScoreRange = "640-679";
        else creditScoreRange = "Below 640";
      }

      let downPaymentPercent: string | undefined;
      if (downPayment > 0 && purchasePrice > 0) {
        downPaymentPercent = ((downPayment / purchasePrice) * 100).toFixed(1);
      }

      const pdfBuffer = await generatePreQualificationPDF({
        letterNumber,
        borrowerName,
        estimatedAmount,
        productType: application.preferredLoanType || "conventional",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        annualIncome: application.annualIncome?.toString(),
        creditScoreRange,
        employmentType: application.employmentType || undefined,
        estimatedDti: application.dtiRatio?.toString(),
        downPaymentPercent,
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        expirationDate,
        generatedAt: new Date(),
      });

      const { db: database } = await import("../db");
      const { preQualificationLetters } = await import("@shared/schema");

      const storageKey = `prequal-letters/${letterNumber}.pdf`;
      let pdfStorageKey: string | null = null;
      try {
        const { objectStorageClient } = await import("../integrations/object_storage/objectStorage");
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (privateDir) {
          const fullPath = `${privateDir}/${storageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          await file.save(pdfBuffer, { contentType: "application/pdf" });
          pdfStorageKey = storageKey;
        }
      } catch (storageErr) {
        console.warn("[PreQual] Could not store PDF in object storage:", storageErr);
      }

      const [letter] = await database.insert(preQualificationLetters).values({
        letterNumber,
        borrowerName,
        applicationId: id,
        estimatedAmount,
        productType: application.preferredLoanType || "conventional",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        annualIncome: application.annualIncome?.toString(),
        creditScoreRange,
        employmentType: application.employmentType,
        estimatedDti: application.dtiRatio?.toString(),
        downPaymentPercent,
        expirationDate,
        status: "issued",
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        pdfStorageKey,
        pdfGeneratedAt: new Date(),
      }).returning();

      res.json({
        letterNumber: letter.letterNumber,
        expirationDate: letter.expirationDate,
        estimatedAmount: letter.estimatedAmount,
        pdfAvailable: true,
      });
    } catch (error) {
      console.error("Generate prequal letter error:", error);
      res.status(500).json({ error: "Failed to generate pre-qualification letter" });
    }
  });

  app.get("/api/loan-applications/:id/prequal-pdf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { preQualificationLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preQualificationLetters)
        .where(eq(preQualificationLetters.applicationId, id))
        .orderBy(desc(preQualificationLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.status(404).json({ error: "No pre-qualification letter found" });
      }

      if (letter.pdfStorageKey) {
        try {
          const { objectStorageClient } = await import("../integrations/object_storage/objectStorage");
          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          const fullPath = `${privateDir}/${letter.pdfStorageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            const [contents] = await file.download();
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="PreQualification-${letter.letterNumber}.pdf"`);
            return res.send(contents);
          }
        } catch (downloadErr) {
          console.warn("[PreQual] Could not download from storage, regenerating:", downloadErr);
        }
      }

      const { generatePreQualificationPDF } = await import("../services/pdfLetterGenerator");
      const borrowerName = letter.borrowerName;

      const pdfBuffer = await generatePreQualificationPDF({
        letterNumber: letter.letterNumber,
        borrowerName,
        estimatedAmount: letter.estimatedAmount,
        productType: letter.productType,
        occupancy: letter.occupancy,
        loanPurpose: letter.loanPurpose || undefined,
        annualIncome: letter.annualIncome?.toString(),
        creditScoreRange: letter.creditScoreRange || undefined,
        employmentType: letter.employmentType || undefined,
        estimatedDti: letter.estimatedDti?.toString(),
        downPaymentPercent: letter.downPaymentPercent?.toString(),
        companyLegalName: letter.companyLegalName,
        companyNmlsId: letter.companyNmlsId,
        expirationDate: new Date(letter.expirationDate),
        generatedAt: new Date(letter.generatedAt || letter.createdAt!),
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="PreQualification-${letter.letterNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("PreQual PDF error:", error);
      res.status(500).json({ error: "Failed to retrieve pre-qualification letter" });
    }
  });

  app.get("/api/loan-applications/:id/prequal-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { preQualificationLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preQualificationLetters)
        .where(eq(preQualificationLetters.applicationId, id))
        .orderBy(desc(preQualificationLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.json({ hasLetter: false });
      }

      res.json({
        hasLetter: true,
        letterNumber: letter.letterNumber,
        status: letter.status,
        expirationDate: letter.expirationDate,
        estimatedAmount: letter.estimatedAmount,
        generatedAt: letter.generatedAt,
        pdfAvailable: !!(letter.pdfStorageKey || letter.pdfGeneratedAt),
      });
    } catch (error) {
      console.error("PreQual status error:", error);
      res.status(500).json({ error: "Failed to check pre-qualification status" });
    }
  });
}
