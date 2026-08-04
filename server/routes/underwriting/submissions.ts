// Underwriting routes: MISMO validation, submission readiness, wholesale lenders, lender submissions + packages + conditions.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { CONDITION_PRIORITY } from "@shared/schema";
import { z } from "zod";
import * as creditService from "../../services/creditService";
import { updateConditionMetrics } from "../../services/outcomeTracker";
import { routeParams } from "../../http/routeParams";

export function registerSubmissionRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/loan-applications/:id/mismo-validation", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { validateMISMOCompleteness } = await import("../../services/mismoValidation");
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
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        const { evaluateBrokerSubmissionReadiness } = await import("../../services/brokerSubmissionReadiness");
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
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const lenderId = typeof req.body?.lenderId === "string" ? req.body.lenderId : "";
        if (!lenderId) {
          return res.status(400).json({ error: "lenderId is required" });
        }

        const { submitToWholesaleLender, SubmissionBlockedError } = await import("../../services/lenderSubmission");
        try {
          const result = await submitToWholesaleLender(id, lenderId, req.user!.id);
          const { logAudit } = await import("../../auditLog");
          logAudit(req, "broker.lender_submission_created", "loan_application", id, {
            lenderId,
            submissionId: result.submission.id,
            confirmationId: result.submission.confirmationId,
            simulated: result.submission.simulated,
          });
          // Omit the MISMO XML body (carries full SSN/DOB) from the response;
          // fetch it explicitly via the mismo-package route below.
          const { mismoPackageXml, ...submission } = result.submission;
          res.status(201).json(submission);
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
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const submissions = await storage.getLenderSubmissionsByApplication(id);
        // Per-submission lender-condition rollup — one batched query, then
        // group in memory (never query per submission).
        const linkedConditions = await storage.getLoanConditionsBySubmissionIds(submissions.map(s => s.id));
        const statsBySubmission = new Map<string, { total: number; open: number; cleared: number }>();
        for (const c of linkedConditions) {
          if (!c.lenderSubmissionId) continue;
          const stats = statsBySubmission.get(c.lenderSubmissionId) ?? { total: 0, open: 0, cleared: 0 };
          stats.total += 1;
          if (c.status === "outstanding" || c.status === "submitted") stats.open += 1;
          else stats.cleared += 1;
          statsBySubmission.set(c.lenderSubmissionId, stats);
        }
        // Omit the MISMO XML body (carries full SSN/DOB) from the list view;
        // fetch it explicitly via the mismo-package route below.
        res.json(submissions.map(({ mismoPackageXml, ...s }) => ({
          ...s,
          conditionStats: statsBySubmission.get(s.id) ?? { total: 0, open: 0, cleared: 0 },
        })));
      } catch (error) {
        console.error("List lender submissions error:", error);
        res.status(500).json({ error: "Failed to list lender submissions" });
      }
    },
  );

  // Download the exact MISMO 3.4 XML package sent for a given submission —
  // an immutable snapshot, not regenerated from current data. Internal staff
  // only, same rationale as the mismo-export route (full SSN/DOB payload).
  app.get(
    "/api/loan-applications/:id/lender-submissions/:submissionId/mismo-package",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id, submissionId } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const submission = await storage.getLenderSubmission(submissionId);
        if (!submission || submission.applicationId !== id || !submission.mismoPackageXml) {
          return res.status(404).json({ error: "Package not found" });
        }
        res.setHeader("Content-Type", "application/xml");
        res.setHeader("Content-Disposition", `attachment; filename="mismo-package-${submissionId}.xml"`);
        res.send(submission.mismoPackageXml);
      } catch (error) {
        console.error("Lender package download error:", error);
        res.status(500).json({ error: "Failed to fetch lender package" });
      }
    },
  );

  // Log wholesale-lender conditions against a submission — the per-condition
  // leg of the post-submission workflow. No lender feed exists until broker
  // agreements, so staff transcribe conditions from the lender's portal. Rows
  // land in loan_conditions (category "lender_condition") and therefore ride
  // every existing conditions surface (pipeline, clearing UI, borrower
  // outstanding lists, metrics); clearing stays on PATCH /api/conditions/:id.
  const logLenderConditionsSchema = z.object({
    conditions: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(255),
          description: z.string().trim().max(2000).optional(),
          priority: z.enum(CONDITION_PRIORITY).optional(),
        }),
      )
      .min(1)
      .max(50),
  });
  app.post(
    "/api/loan-applications/:id/lender-submissions/:submissionId/conditions",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const parsed = logLenderConditionsSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid conditions payload", details: parsed.error.flatten() });
        }
        const { id, submissionId } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const submission = await storage.getLenderSubmission(submissionId);
        if (!submission || submission.applicationId !== id) {
          return res.status(404).json({ error: "Submission not found" });
        }

        const created = await storage.createLoanConditions(
          parsed.data.conditions.map(c => ({
            applicationId: id,
            category: "lender_condition",
            title: c.title,
            description: c.description,
            priority: c.priority ?? "prior_to_docs",
            status: "outstanding",
            isAutoGenerated: false,
            sourceRule: `lender:${submission.lenderId}`,
            lenderSubmissionId: submissionId,
          })),
        );

        const { WHOLESALE_LENDERS } = await import("@shared/wholesaleLenders");
        const lenderName = WHOLESALE_LENDERS.find(l => l.id === submission.lenderId)?.name ?? submission.lenderId;
        await storage.createDealActivity({
          applicationId: id,
          activityType: "lender_conditions_logged",
          title: "Lender conditions logged",
          description: `${created.length} condition(s) from ${lenderName} logged for clearing.`,
          performedBy: req.user!.id,
          metadata: { submissionId, count: created.length },
        });
        await updateConditionMetrics(id);

        const { logAudit } = await import("../../auditLog");
        logAudit(req, "broker.lender_conditions_logged", "loan_application", id, {
          submissionId,
          count: created.length,
        });

        res.status(201).json({ conditions: created });
      } catch (error) {
        console.error("Log lender conditions error:", error);
        res.status(500).json({ error: "Failed to log lender conditions" });
      }
    },
  );

  // Advance a submission's status as the lender responds (transition-checked).
  app.patch(
    "/api/lender-submissions/:submissionId",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { submissionId } = routeParams(req);
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

        // Funding is where revenue is realized, so the transition to "funded"
        // carries the figures that make it measurable (F-6). The service
        // rejects the transition without them.
        let funding: { fundedLoanAmount: number; compensationReceivedAmount: number } | undefined;
        if (toStatus === "funded") {
          const fundingSchema = z.object({
            fundedLoanAmount: z.number().positive(),
            compensationReceivedAmount: z.number().min(0),
          });
          const parsedFunding = fundingSchema.safeParse(req.body?.funding);
          if (!parsedFunding.success) {
            return res.status(400).json({
              error:
                "Marking a submission funded requires funding.fundedLoanAmount and " +
                "funding.compensationReceivedAmount.",
              details: parsedFunding.error.flatten().fieldErrors,
            });
          }
          funding = parsedFunding.data;
        }

        const { updateSubmissionStatus, SubmissionBlockedError } = await import("../../services/lenderSubmission");
        try {
          const updated = await updateSubmissionStatus(submissionId, toStatus, notes, req.user!.id, funding);

          // Autopilot decision relay: on a terminal lender decision, tell the
          // borrower they're approved / funded (Reg N), or flag the deal team
          // for the ECOA §1002.9 adverse-action notice on a denial. Gated by the
          // kill switch and non-fatal — never break the status update.
          try {
            const { relayLenderDecision } = await import("../../services/autopilot/decisionRelay");
            await relayLenderDecision({ application, toStatus, performedBy: req.user!.id });
          } catch (relayErr) {
            console.warn("[Autopilot] Decision relay failed (non-fatal):", relayErr);
          }

          const { logAudit } = await import("../../auditLog");
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

  // ---------------------------------------------------------------------
  // Broker revenue report (F-6). What did the book actually earn, did the
  // lenders pay what the comp plans say, and how much of the pipeline
  // converts? Admin-only: this is company-level financial data, not a
  // per-file view.
  // ---------------------------------------------------------------------
  app.get("/api/reports/compensation", requireRole("admin"), async (_req, res) => {
    try {
      const submissions = await storage.getAllLenderSubmissions();
      const { summarizeCompensation, evaluateCompensationVariance } = await import(
        "@shared/compensationLedger"
      );
      const { approvedLenderCount, getWholesaleLender } = await import("@shared/wholesaleLenders");

      const summary = summarizeCompensation(submissions);

      // Discrepancies worth a human: funded loans that were short-paid, or
      // funded with no remittance recorded at all.
      const discrepancies = submissions
        .filter(s => s.status === "funded")
        .map(s => ({
          submissionId: s.id,
          applicationId: s.applicationId,
          lender: getWholesaleLender(s.lenderId)?.name ?? s.lenderId,
          fundedAt: s.fundedAt,
          ...evaluateCompensationVariance({
            expectedAmount: s.compensationExpectedAmount,
            receivedAmount: s.compensationReceivedAmount,
          }),
        }))
        .filter(row => row.status === "short_paid" || row.status === "over_paid" || row.status === "pending");

      // Contingent liability (F-8): compensation the lenders can still
      // reclaim if these loans pay off early. For an asset-light broker this
      // is the balance sheet, and it existed nowhere before.
      const { buildClawbackRegister } = await import("@shared/compensationClawback");
      const clawback = buildClawbackRegister(
        submissions.map(s => ({
          submissionId: s.id,
          applicationId: s.applicationId,
          status: s.status,
          lenderId: s.lenderId,
          fundedAt: s.fundedAt,
          compensationReceivedAmount: s.compensationReceivedAmount,
        })),
      );

      res.json({
        ...summary,
        // The binding constraint on all of the above: with no approved
        // counterparty there is no revenue capacity at all (F-5).
        approvedLenderCount: approvedLenderCount(),
        discrepancies,
        clawbackExposure: clawback,
      });
    } catch (error) {
      console.error("Compensation report error:", error);
      res.status(500).json({ error: "Failed to build the compensation report" });
    }
  });

  // Fannie Mae delivery readiness: URLA gating + Loan Delivery / UCD /
  // EarlyCheck edit mirror + Special Feature Code derivation. Internal staff
  // only — this is a delivery-ops view, not a partner/borrower surface.
}
