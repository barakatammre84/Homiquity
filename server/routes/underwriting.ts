import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { requireConsent } from "../consentGate";
import { isStaffRole, isInternalStaffRole, isLoanAppStatus, LOAN_APP_STATUSES } from "@shared/schema";
import type { User } from "@shared/schema";
import { 
  qualifyIncome, 
  verifyAssets, 
  assessLiabilities, 
  calculateDTI, 
  checkPropertyEligibility 
} from "../underwriting";
import { calculateLLPA, getAreaMedianIncome } from "../pricing";
import { assertVerifiedForDecisioning, type DataProvenance } from "@shared/dataProvenance";
import { assertStageRequirements } from "@shared/stageRequirements";
import { tridHardStopError } from "../services/trid";
import * as creditService from "../services/creditService";

/**
 * Checks whether a staff user is authorized to mutate a specific loan application.
 * Admins always pass. All other staff roles must be active members of the deal team.
 */
async function isAssignedToApplication(
  storage: IStorage,
  applicationId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (userRole === "admin") return true;
  const teamMembers = await storage.getDealTeamMembers(applicationId);
  return teamMembers.some(m => m.userId === userId);
}

/**
 * Roles permitted to execute each stage transition.
 * Transitions not listed here are allowed by any assigned staff member.
 */
const STAGE_TRANSITION_ROLES: Record<string, string[]> = {
  denied: ["admin", "underwriter"],
  approved: ["admin", "underwriter"],
  clear_to_close: ["admin", "underwriter"],
  funded: ["admin", "closer"],
};

export function registerUnderwritingRoutes(
  app: Express,
  storage: IStorage,
) {
  // ========================================================================
  // UNDERWRITING ENGINE API ENDPOINTS
  // ========================================================================

  app.post("/api/loan-applications/:id/calculate-income", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const employment = await storage.getEmploymentHistory(id);
      const otherIncome = await storage.getOtherIncomeSources(id);

      const result = qualifyIncome(employment, otherIncome, {
        annualIncome: application.annualIncome || "0",
        employmentYears: application.employmentYears || 0,
      });

      res.json(result);
    } catch (error) {
      console.error("Calculate income error:", error);
      res.status(500).json({ error: "Failed to calculate income" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-assets", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const assets = await storage.getUrlaAssets(id);
      const downPaymentAndClosing = req.body.downPaymentAndClosing ? 
        parseFloat(req.body.downPaymentAndClosing) : 0;

      const result = await verifyAssets(assets, downPaymentAndClosing);
      res.json(result);
    } catch (error) {
      console.error("Calculate assets error:", error);
      res.status(500).json({ error: "Failed to calculate assets" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-liabilities", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const liabilities = await storage.getUrlaLiabilities(id);
      const result = assessLiabilities(liabilities);
      res.json(result);
    } catch (error) {
      console.error("Calculate liabilities error:", error);
      res.status(500).json({ error: "Failed to calculate liabilities" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-dti", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Presence check (not truthiness): a legitimate 0 housing expense or 0
      // non-housing debt must be accepted, not rejected as "missing".
      const { qualifyingIncome, housingExpense, nonHousingDebts } = req.body;
      if (qualifyingIncome == null || housingExpense == null || nonHousingDebts == null) {
        return res.status(400).json({ error: "qualifyingIncome, housingExpense, and nonHousingDebts are required" });
      }

      const parsedIncome = parseFloat(qualifyingIncome);
      const parsedHousing = parseFloat(housingExpense);
      const parsedDebts = parseFloat(nonHousingDebts);
      if (isNaN(parsedIncome) || isNaN(parsedHousing) || isNaN(parsedDebts)) {
        return res.status(400).json({ error: "qualifyingIncome, housingExpense, and nonHousingDebts must be valid numbers" });
      }
      if (parsedIncome <= 0) {
        return res.status(400).json({ error: "qualifyingIncome must be greater than zero" });
      }
      if (parsedHousing < 0 || parsedDebts < 0) {
        return res.status(400).json({ error: "housingExpense and nonHousingDebts cannot be negative" });
      }

      const result = await calculateDTI(parsedIncome, parsedHousing, parsedDebts);

      res.json(result);
    } catch (error) {
      console.error("Calculate DTI error:", error);
      res.status(500).json({ error: "Failed to calculate DTI" });
    }
  });

  app.post("/api/loan-applications/:id/check-property-eligibility", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const {
        borrowerAssets,
        borrowerIncome,
        borrowerDebts,
        propertyPrice,
        propertyType = "single_family",
        propertyTaxAnnual,
        hoaMonthly = 0,
        homeInsuranceEstimate = 150,
      } = req.body;

      // Presence check (not truthiness): $0 assets or $0 debts are legitimate
      // inputs and must not be rejected as "missing".
      if (borrowerAssets == null || borrowerIncome == null || borrowerDebts == null || propertyPrice == null) {
        return res.status(400).json({ error: "borrowerAssets, borrowerIncome, borrowerDebts, and propertyPrice are required" });
      }

      const pAssets = parseFloat(borrowerAssets);
      const pIncome = parseFloat(borrowerIncome);
      const pDebts = parseFloat(borrowerDebts);
      const pPrice = parseFloat(propertyPrice);
      const pHoa = parseFloat(hoaMonthly);
      const pInsurance = parseFloat(homeInsuranceEstimate);
      if ([pAssets, pIncome, pDebts, pPrice, pHoa, pInsurance].some(isNaN)) {
        return res.status(400).json({ error: "All numeric parameters must be valid numbers" });
      }
      if (pIncome <= 0) {
        return res.status(400).json({ error: "borrowerIncome must be greater than zero" });
      }
      if (pPrice <= 0) {
        return res.status(400).json({ error: "propertyPrice must be greater than zero" });
      }
      if (pAssets < 0 || pDebts < 0) {
        return res.status(400).json({ error: "borrowerAssets and borrowerDebts cannot be negative" });
      }

      const repFico = application.creditScore ?? undefined;
      const result = await checkPropertyEligibility(
        pAssets,
        pIncome,
        pDebts,
        pPrice,
        propertyType,
        propertyTaxAnnual ? parseFloat(propertyTaxAnnual) : undefined,
        pHoa,
        pInsurance,
        undefined,
        repFico
      );

      res.json(result);
    } catch (error) {
      console.error("Check property eligibility error:", error);
      res.status(500).json({ error: "Failed to check property eligibility" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-pricing", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const {
        loanAmount,
        creditScore,
        ltv,
        propertyType = "single_family",
        occupancyType = "primary_residence",
        propertyZip,
      } = req.body;

      if (!loanAmount || !creditScore || !ltv) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      if (isNaN(parseFloat(loanAmount)) || isNaN(parseFloat(creditScore)) || isNaN(parseFloat(ltv))) {
        return res.status(400).json({ error: "loanAmount, creditScore, and ltv must be valid numbers" });
      }

      // Get AMI for FTHB waiver
      let areaMedianIncome = 0;
      if (propertyZip) {
        areaMedianIncome = await getAreaMedianIncome(propertyZip);
      }

      const borrowerIncome = application.annualIncome ? 
        parseFloat(application.annualIncome) / 12 : 0;

      const result = await calculateLLPA(
        parseFloat(loanAmount),
        parseInt(creditScore),
        parseFloat(ltv),
        propertyType as any,
        occupancyType as any,
        application.isFirstTimeBuyer ?? false,
        borrowerIncome,
        areaMedianIncome
      );

      res.json(result);
    } catch (error) {
      console.error("Calculate pricing error:", error);
      res.status(500).json({ error: "Failed to calculate pricing" });
    }
  });

  // Instant deterministic decision (Tinman-style). Read-only preview: composes
  // completeness + pricing + the matrix-driven underwriting engine into a single
  // APPROVED / REJECTED / MANUAL_REVIEW / NEEDS_MORE_INFO result. Staff-only and
  // non-binding — it changes nothing; a binding outcome still goes through the
  // verified-data gate and human review.
  app.get(
    "/api/loan-applications/:id/instant-decision",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const { runInstantDecision } = await import("../services/decisionEngine");
        const decision = await runInstantDecision(id);
        res.json(decision);
      } catch (error) {
        console.error("Instant decision error:", error);
        res.status(500).json({ error: "Failed to compute instant decision" });
      }
    },
  );

  // Decision history — the context-graph trail of how the decision evolved as
  // facts arrived. Staff-only, read-only.
  app.get(
    "/api/loan-applications/:id/decision-history",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const { getDecisionHistory } = await import("../services/decisionEngine");
        res.json(await getDecisionHistory(id));
      } catch (error) {
        console.error("Decision history error:", error);
        res.status(500).json({ error: "Failed to load decision history" });
      }
    },
  );

  // ============================================================================
  // LOAN PIPELINE API ENDPOINTS
  // ============================================================================

  app.get("/api/loan-applications/:id/pipeline", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { checkPipelineProgress, getPipelineSummary } = await import("../pipelineEngine");
      
      const [progress, summary, milestones, conditions] = await Promise.all([
        checkPipelineProgress(id),
        getPipelineSummary(id),
        storage.getLoanMilestones(id),
        storage.getLoanConditionsByApplication(id),
      ]);

      res.json({
        progress,
        summary,
        milestones,
        conditions,
      });
    } catch (error) {
      console.error("Get pipeline status error:", error);
      res.status(500).json({ error: "Failed to get pipeline status" });
    }
  });

  app.get("/api/loan-applications/:id/conditions", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const conditions = await storage.getLoanConditionsByApplication(id);
      
      const grouped = {
        priorToApproval: conditions.filter(c => c.priority === "prior_to_approval"),
        priorToDocs: conditions.filter(c => c.priority === "prior_to_docs"),
        priorToFunding: conditions.filter(c => c.priority === "prior_to_funding"),
      };

      const stats = {
        total: conditions.length,
        outstanding: conditions.filter(c => c.status === "outstanding").length,
        submitted: conditions.filter(c => c.status === "submitted").length,
        cleared: conditions.filter(c => c.status === "cleared").length,
        waived: conditions.filter(c => c.status === "waived").length,
      };

      res.json({ conditions, grouped, stats });
    } catch (error) {
      console.error("Get conditions error:", error);
      res.status(500).json({ error: "Failed to get conditions" });
    }
  });

  app.patch("/api/conditions/:id", requireRole("admin", "lo", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const { id } = req.params;
      const condition = await storage.getLoanCondition(id);
      if (!condition) {
        return res.status(404).json({ error: "Condition not found" });
      }

      // Verify the application exists and is accessible
      const application = await storage.getLoanApplicationWithAccess(
        condition.applicationId,
        req.user!.id,
        req.user!.role,
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      // Verify the caller is on the deal team for this application (admins bypass)
      const assigned = await isAssignedToApplication(
        storage,
        condition.applicationId,
        req.user!.id,
        req.user!.role,
      );
      if (!assigned) {
        return res.status(403).json({ error: "You are not assigned to this loan file" });
      }

      const { status, clearanceNotes } = req.body;
      const callerRole = req.user!.role;

      // Waiving a condition is restricted to underwriters and admins only
      if (status === "waived") {
        if (callerRole !== "admin" && callerRole !== "underwriter") {
          return res.status(403).json({ error: "Only underwriters and admins can waive conditions" });
        }

        const updated = await storage.updateLoanCondition(id, {
          status: "waived",
          clearanceNotes,
          clearedByUserId: req.user!.id,
          clearedAt: new Date(),
        });

        await storage.createDealActivity({
          applicationId: condition.applicationId,
          activityType: "condition_waived",
          title: "Condition Waived",
          description: `"${condition.title}" has been waived.${clearanceNotes ? ` Reason: ${clearanceNotes}` : ""}`,
          performedBy: req.user!.id,
          metadata: { conditionId: id, notes: clearanceNotes },
        });

        return res.json(updated);
      }

      // Clearing a condition is restricted to underwriters, processors, closers, and admins
      if (status === "cleared") {
        if (!["admin", "underwriter", "processor", "closer"].includes(callerRole)) {
          return res.status(403).json({ error: "Only underwriters, processors, closers, and admins can clear conditions" });
        }

        const updated = await storage.clearLoanCondition(id, req.user!.id, clearanceNotes);
        
        await storage.createDealActivity({
          applicationId: condition.applicationId,
          activityType: "condition_cleared",
          title: "Condition Cleared",
          description: `"${condition.title}" has been cleared.`,
          performedBy: req.user!.id,
          metadata: { conditionId: id, notes: clearanceNotes },
        });

        return res.json(updated);
      }

      if (status === "not_applicable") {
        if (!["admin", "underwriter", "processor"].includes(callerRole)) {
          return res.status(403).json({ error: "Only underwriters, processors, and admins can mark conditions as not applicable" });
        }

        const updated = await storage.updateLoanCondition(id, {
          status: "not_applicable",
          clearanceNotes,
          clearedByUserId: req.user!.id,
          clearedAt: new Date(),
        });

        await storage.createDealActivity({
          applicationId: condition.applicationId,
          activityType: "condition_not_applicable",
          title: "Condition Marked N/A",
          description: `"${condition.title}" marked as not applicable.${clearanceNotes ? ` Reason: ${clearanceNotes}` : ""}`,
          performedBy: req.user!.id,
          metadata: { conditionId: id, notes: clearanceNotes },
        });

        return res.json(updated);
      }

      const updated = await storage.updateLoanCondition(id, { status, clearanceNotes });
      res.json(updated);
    } catch (error) {
      console.error("Update condition error:", error);
      res.status(500).json({ error: "Failed to update condition" });
    }
  });

  app.get("/api/loan-applications/:id/milestones", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const milestones = await storage.getLoanMilestones(id);
      res.json(milestones || {});
    } catch (error) {
      console.error("Get milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  app.post("/api/loan-applications/:id/advance-stage", requireRole("admin", "lo", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { newStage, denialReasons } = req.body;
      if (!newStage) {
        return res.status(400).json({ error: "New stage is required" });
      }
      if (!isLoanAppStatus(newStage)) {
        return res.status(400).json({
          error: `Unknown stage '${newStage}'`,
          code: "unknown_status",
          allowedStatuses: LOAN_APP_STATUSES,
        });
      }

      // HMDA LAR requires at least 2 denial reasons when an application is denied.
      if (newStage === "denied" && (!Array.isArray(denialReasons) || denialReasons.length < 2)) {
        return res.status(400).json({
          error: "At least 2 denial reasons are required to deny an application (HMDA LAR)",
        });
      }

      // TRID hard stop (Reg Z §1026.19(e)(1)(iii)): a file with an overdue
      // Loan Estimate may not advance to any non-exit stage.
      const tridBlock = tridHardStopError(application, newStage);
      if (tridBlock) {
        return res.status(422).json({ error: tridBlock });
      }

      // Approval-grade stages may not be reached on self-reported/estimated data.
      // (Denial is not gated — see the status endpoint for the rationale.)
      const APPROVAL_GRADE_STAGES = new Set(["pre_approved", "conditional", "clear_to_close", "funded"]);
      if (APPROVAL_GRADE_STAGES.has(newStage)) {
        try {
          assertVerifiedForDecisioning(
            application.financialDataProvenance as DataProvenance,
            `advancing to '${newStage}'`,
          );
        } catch (guardErr) {
          return res.status(422).json({
            error: guardErr instanceof Error ? guardErr.message : "Financial data must be verified",
          });
        }

        // ...and must carry a coherent loan amount — a decision stage with no
        // pre-approval amount or purchase price is an impossible state (#7).
        try {
          assertStageRequirements(
            {
              status: newStage,
              preApprovalAmount: application.preApprovalAmount,
              purchasePrice: application.purchasePrice,
            },
            `advancing to '${newStage}'`,
          );
        } catch (guardErr) {
          return res.status(422).json({
            error: guardErr instanceof Error ? guardErr.message : "A loan amount is required at this stage",
          });
        }
      }

      // Verify the caller is on the deal team for this application (admins bypass)
      const assigned = await isAssignedToApplication(storage, id, req.user!.id, req.user!.role);
      if (!assigned) {
        return res.status(403).json({ error: "You are not assigned to this loan file" });
      }

      // Enforce role-based stage transition policy for sensitive transitions
      const allowedRolesForStage = STAGE_TRANSITION_ROLES[newStage];
      if (allowedRolesForStage && !allowedRolesForStage.includes(req.user!.role)) {
        return res.status(403).json({
          error: `Only ${allowedRolesForStage.join(" or ")} can move a loan to '${newStage}'`,
        });
      }

      const { updatePipelineStage, checkPipelineProgress, PipelineTransitionError } = await import("../pipelineEngine");

      const progress = await checkPipelineProgress(id);
      if (!progress.readyForNextStage && newStage !== "denied") {
        return res.status(400).json({
          error: "Cannot advance stage",
          code: "stage_blocked",
          blockers: progress.blockers
        });
      }

      // ECOA/Reg B §1002.9 + FCRA §615: a denial via this pipeline path must
      // carry an adverse-action notice, exactly as the status endpoint does.
      // Generate it BEFORE the stage moves — if it can't, the denial is blocked.
      if (newStage === "denied") {
        const aa = await creditService.ensureAdverseActionForDenial({
          applicationId: id,
          userId: application.userId,
          denialReasons,
          creditScoreUsed: application.creditScore,
          generatedBy: req.user!.id,
        });
        if (!aa.ok) {
          return res.status(422).json({ error: aa.error });
        }
        if (aa.created) {
          const { logAudit } = await import("../auditLog");
          logAudit(req, "adverse_action.generated", "loan_application", id, {
            adverseActionId: aa.adverseActionId,
            trigger: "advance_stage_denied",
          });
        }
      }

      try {
        await updatePipelineStage(id, newStage, newStage === "denied" ? { denialReasons } : undefined);
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

      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: `Stage Advanced to ${newStage.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
        description: `Loan advanced to ${newStage} stage.`,
        performedBy: req.user!.id,
      });

      // Audit trail: pipeline/underwriting stage transition (a credit decision).
      const { logAudit } = await import("../auditLog");
      logAudit(req, "underwriting.stage_advanced", "loan_application", id, {
        newStage,
        performedBy: req.user!.id,
        ...(newStage === "denied" && denialReasons ? { denialReasons } : {}),
      });

      const updatedApp = await storage.getLoanApplication(id);
      res.json(updatedApp);
    } catch (error) {
      console.error("Advance stage error:", error);
      res.status(500).json({ error: "Failed to advance stage" });
    }
  });

  app.get("/api/pipeline/queue", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;
      let applications: Awaited<ReturnType<typeof storage.getAllLoanApplications>>;

      if (user.role === "admin") {
        applications = await storage.getAllLoanApplications();
      } else {
        const teamMemberships = await storage.getTeamMembersByUser(user.id);
        applications = teamMemberships
          .map(m => m.application)
          .filter((a): a is NonNullable<typeof a> => a !== null && a !== undefined);
      }

      const activeApps = applications.filter(a => 
        !["draft", "funded", "denied"].includes(a.status || "draft")
      );

      const { getPipelineSummaries } = await import("../pipelineEngine");

      // Batched: fetches milestones, conditions, and borrowers in three
      // inArray queries total rather than 4×N serial round trips.
      const summaries = await getPipelineSummaries(activeApps);

      const queue = summaries
        .sort((a, b) => {
          const priorityOrder = { urgent: 0, high: 1, normal: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return b.daysInPipeline - a.daysInPipeline;
        });

      const byStage: Record<string, typeof queue> = {};
      for (const item of queue) {
        if (!byStage[item.currentStage]) {
          byStage[item.currentStage] = [];
        }
        byStage[item.currentStage].push(item);
      }

      res.json({
        total: queue.length,
        byPriority: {
          urgent: queue.filter(q => q.priority === "urgent").length,
          high: queue.filter(q => q.priority === "high").length,
          normal: queue.filter(q => q.priority === "normal").length,
        },
        byStage,
        queue,
      });
    } catch (error) {
      console.error("Get pipeline queue error:", error);
      res.status(500).json({ error: "Failed to get pipeline queue" });
    }
  });

  // Staff-scoped applications listing for the internal dashboard.
  // Admin sees every application; every other internal-staff role sees only the
  // applications they are an active deal-team member on — mirroring the scoping
  // used by GET /api/pipeline/queue. This is the non-admin equivalent of the
  // admin-only GET /api/admin/applications.
  app.get("/api/staff/applications", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;
      let applications: Awaited<ReturnType<typeof storage.getAllLoanApplications>>;
      if (user.role === "admin") {
        applications = await storage.getAllLoanApplications();
      } else {
        const memberships = await storage.getTeamMembersByUser(user.id);
        const byId = new Map<string, NonNullable<(typeof memberships)[number]["application"]>>();
        for (const m of memberships) {
          if (m.application) byId.set(m.application.id, m.application);
        }
        applications = [...byId.values()];
      }
      res.json(applications);
    } catch (error) {
      console.error("Get staff applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  // Staff-scoped user directory for label resolution (borrower/assignee names) on
  // the internal dashboard. Returns a MINIMAL name-only projection — never
  // credential or full-profile fields. Admin resolves against all users; a
  // non-admin internal-staff member resolves only against the internal-staff team
  // directory plus the borrowers on their own deal-team applications. This is the
  // least-privilege, non-admin equivalent of the admin-only GET /api/admin/users.
  app.get("/api/staff/users", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;
      let directory: User[];
      if (user.role === "admin") {
        directory = await storage.getAllUsers();
      } else {
        const memberships = await storage.getTeamMembersByUser(user.id);
        const borrowerIds = [...new Set(
          memberships.map(m => m.application?.userId).filter((id): id is string => !!id)
        )];
        const [staff, borrowers] = await Promise.all([
          storage.getTeamMembersWithPresence(),
          borrowerIds.length ? storage.getUsersByIds(borrowerIds) : Promise.resolve([] as User[]),
        ]);
        const byId = new Map<string, User>();
        for (const u of staff) byId.set(u.id, u as User);
        for (const u of borrowers) byId.set(u.id, u);
        directory = [...byId.values()];
      }
      res.json(directory.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
      })));
    } catch (error) {
      console.error("Get staff user directory error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/loan-applications/:id/underwriting-snapshots", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const snapshots = await storage.getUnderwritingSnapshotsByApplication(id);
      res.json(snapshots);
    } catch (error) {
      console.error("Get underwriting snapshots error:", error);
      res.status(500).json({ error: "Failed to get underwriting snapshots" });
    }
  });

  app.get("/api/loan-applications/:id/mismo-validation", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { validateMISMOCompleteness } = await import("../services/mismoValidation");
      const validation = await validateMISMOCompleteness(id);
      res.json(validation);
    } catch (error) {
      console.error("MISMO validation error:", error);
      res.status(500).json({ error: "Failed to validate MISMO completeness" });
    }
  });

  // Broker submission workflow: staged gate from intake to wholesale-lender
  // package (intake/TRID → DU → package + anti-steering), with the Fannie Mae
  // delivery edits as an informational lender's-eye pre-flight. This is the
  // operational "can this file go to a lender today" view for LO/processor.
  app.get(
    "/api/loan-applications/:id/submission-readiness",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        const { evaluateBrokerSubmissionReadiness } = await import("../services/brokerSubmissionReadiness");
        const report = await evaluateBrokerSubmissionReadiness(id);
        res.json(report);
      } catch (error) {
        console.error("Submission readiness error:", error);
        res.status(500).json({ error: "Failed to evaluate submission readiness" });
      }
    },
  );

  // Wholesale lender catalog (Target-5 shortlist + approval status).
  app.get(
    "/api/wholesale-lenders",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (_req, res) => {
      const { WHOLESALE_LENDERS } = await import("@shared/wholesaleLenders");
      res.json(WHOLESALE_LENDERS);
    },
  );

  // Submit a packaging-complete file to a wholesale lender. Server-enforced:
  // the broker submission-readiness gate must pass (stages 1–3 blocker-free)
  // and only one active submission per lender is allowed.
  app.post(
    "/api/loan-applications/:id/lender-submissions",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const lenderId = typeof req.body?.lenderId === "string" ? req.body.lenderId : "";
        if (!lenderId) {
          return res.status(400).json({ error: "lenderId is required" });
        }

        const { submitToWholesaleLender, SubmissionBlockedError } = await import("../services/lenderSubmission");
        try {
          const result = await submitToWholesaleLender(id, lenderId, req.user!.id);
          const { logAudit } = await import("../auditLog");
          logAudit(req, "broker.lender_submission_created", "loan_application", id, {
            lenderId,
            submissionId: result.submission.id,
            confirmationId: result.submission.confirmationId,
            simulated: result.submission.simulated,
          });
          res.status(201).json(result.submission);
        } catch (err) {
          if (err instanceof SubmissionBlockedError) {
            return res.status(422).json({ error: err.message, blockers: err.blockers });
          }
          throw err;
        }
      } catch (error) {
        console.error("Lender submission error:", error);
        res.status(500).json({ error: "Failed to submit to lender" });
      }
    },
  );

  app.get(
    "/api/loan-applications/:id/lender-submissions",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        res.json(await storage.getLenderSubmissionsByApplication(id));
      } catch (error) {
        console.error("List lender submissions error:", error);
        res.status(500).json({ error: "Failed to list lender submissions" });
      }
    },
  );

  // Advance a submission's status as the lender responds (transition-checked).
  app.patch(
    "/api/lender-submissions/:submissionId",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { submissionId } = req.params;
        const submission = await storage.getLenderSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }
        const application = await storage.getLoanApplicationWithAccess(
          submission.applicationId, req.user!.id, req.user!.role,
        );
        if (!application) {
          return res.status(403).json({ error: "Access denied" });
        }

        const toStatus = typeof req.body?.status === "string" ? req.body.status : "";
        const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 2000) : undefined;
        const { updateSubmissionStatus, SubmissionBlockedError } = await import("../services/lenderSubmission");
        try {
          const updated = await updateSubmissionStatus(submissionId, toStatus, notes, req.user!.id);
          const { logAudit } = await import("../auditLog");
          logAudit(req, "broker.lender_submission_status", "loan_application", submission.applicationId, {
            submissionId,
            from: submission.status,
            to: toStatus,
          });
          res.json(updated);
        } catch (err) {
          if (err instanceof SubmissionBlockedError) {
            return res.status(422).json({ error: err.message });
          }
          throw err;
        }
      } catch (error) {
        console.error("Update lender submission error:", error);
        res.status(500).json({ error: "Failed to update submission" });
      }
    },
  );

  // Fannie Mae delivery readiness: URLA gating + Loan Delivery / UCD /
  // EarlyCheck edit mirror + Special Feature Code derivation. Internal staff
  // only — this is a delivery-ops view, not a partner/borrower surface.
  app.get(
    "/api/loan-applications/:id/delivery-readiness",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        const { evaluateDeliveryReadiness } = await import("../services/loanDeliveryReadiness");
        const report = await evaluateDeliveryReadiness(id);
        res.json(report);
      } catch (error) {
        console.error("Delivery readiness error:", error);
        res.status(500).json({ error: "Failed to evaluate delivery readiness" });
      }
    },
  );

  // Capture/update the closing-stage delivery data (Regulation Z / QM
  // datapoints, UCD Phase 3 closing-cost containers, SFC attributes) the
  // delivery-readiness edits evaluate. Internal staff only.
  app.put(
    "/api/loan-applications/:id/delivery-data",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        const { insertLoanDeliveryDataSchema } = await import("@shared/schema");
        const parsed = insertLoanDeliveryDataSchema
          .partial()
          .omit({ applicationId: true })
          .safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid delivery data", details: parsed.error.flatten() });
        }

        const saved = await storage.upsertLoanDeliveryData({
          ...parsed.data,
          applicationId: id,
        });

        const { logAudit } = await import("../auditLog");
        logAudit(req, "gse.delivery_data_updated", "loan_application", id, {
          fields: Object.keys(parsed.data),
        });

        res.json(saved);
      } catch (error) {
        console.error("Delivery data update error:", error);
        res.status(500).json({ error: "Failed to save delivery data" });
      }
    },
  );

  app.get("/api/loan-applications/:id/loan-estimate", isAuthenticated, requireConsent("e_disclosure"), async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { generateLoanEstimate, formatLoanEstimateForDisplay } = await import("../services/loanEstimate");
      const le = await generateLoanEstimate(id);

      // TRID delivery record: the borrower retrieving the LE behind their
      // e_disclosure consent constitutes electronic delivery (ESIGN). Stamp
      // leIssuedDate on first borrower retrieval; staff previews don't count.
      if (!application.leIssuedDate && application.userId === req.user!.id) {
        const issuedDate = new Date().toISOString().split("T")[0];
        await storage.updateLoanApplication(id, { leIssuedDate: issuedDate });
        le.tridCompliance.disclosureProvided = true;
        le.tridCompliance.dateProvided = new Date(`${issuedDate}T00:00:00Z`);
        const { logAudit } = await import("../auditLog");
        logAudit(req, "trid.loan_estimate_delivered", "loan_application", id, {
          leIssuedDate: issuedDate,
          leDueDate: le.tridCompliance.leDueDate?.toISOString() ?? null,
          withinThreeBusinessDays: le.tridCompliance.withinThreeBusinessDays,
        });
      }

      const formatted = formatLoanEstimateForDisplay(le);
      res.json(formatted);
    } catch (error) {
      console.error("Loan estimate error:", error);
      res.status(500).json({ error: "Failed to generate loan estimate" });
    }
  });

  app.get("/api/compliance/dashboard", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;

      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Only internal staff can view compliance dashboard" });
      }

      let applications: Awaited<ReturnType<typeof storage.getAllLoanApplications>>;

      if (user.role === "admin") {
        applications = await storage.getAllLoanApplications();
      } else {
        const teamMemberships = await storage.getTeamMembersByUser(user.id);
        applications = teamMemberships
          .map(m => m.application)
          .filter((a): a is NonNullable<typeof a> => a !== null && a !== undefined);
      }

      const activeApps = applications.filter(a => 
        !["draft", "denied"].includes(a.status || "draft")
      );

      const { getApplicationValidationSummary } = await import("../services/mismoValidation");
      
      const validationResults = await Promise.all(
        activeApps.map(async (app) => {
          try {
            const validation = await getApplicationValidationSummary(app.id);
            return {
              ...validation,
              borrowerName: app.propertyAddress ? `Loan - ${app.propertyAddress}` : `Application ${app.id.slice(0, 8)}`,
              status: app.status,
              loanAmount: app.purchasePrice && app.downPayment
                ? Number(app.purchasePrice) - Number(app.downPayment)
                : null,
            };
          } catch {
            return null;
          }
        })
      );

      const validResults = validationResults.filter((r): r is NonNullable<typeof r> => r !== null);

      res.json({
        total: validResults.length,
        gseReady: validResults.filter(r => r.gseReady).length,
        ulddCompliant: validResults.filter(r => r.ulddCompliant).length,
        needsAttention: validResults.filter(r => r.criticalCount > 0).length,
        applications: validResults,
      });
    } catch (error) {
      console.error("Compliance dashboard error:", error);
      res.status(500).json({ error: "Failed to load compliance dashboard" });
    }
  });
}
