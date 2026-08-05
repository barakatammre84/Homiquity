// Underwriting routes: Delivery readiness/data, Loan Estimate (ESIGN e_disclosure gate + TRID delivery persistence), change of circumstances.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { requireConsent } from "../../consentGate";
import { z } from "zod";
import { COC_REASON_TYPES } from "@shared/compliance/changeOfCircumstance";
import type { DisclosureSnapshot } from "@shared/compliance/feeTolerance";
import { applyDisclosedFees } from "../../services/leDisclosureBaseline";
import { isInternalStaffRole } from "@shared/roles";
import * as creditService from "../../services/creditService";
import { routeParams } from "../../http/routeParams";

export function registerDeliveryRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get(
    "/api/loan-applications/:id/delivery-readiness",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        const { evaluateDeliveryReadiness } = await import("../../services/loanDeliveryReadiness");
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
        const { id } = routeParams(req);
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

        const { logAudit } = await import("../../auditLog");
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
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { generateLoanEstimate, formatLoanEstimateForDisplay } = await import("../../services/loanEstimate");
      const le = await generateLoanEstimate(id);

      // TRID delivery record: the borrower retrieving the LE behind their
      // e_disclosure consent constitutes electronic delivery (ESIGN). Stamp
      // leIssuedDate on first borrower retrieval; staff previews don't count.
      if (!application.leIssuedDate && application.userId === req.user!.id) {
        const issuedDate = new Date().toISOString().split("T")[0];
        await storage.updateLoanApplication(id, { leIssuedDate: issuedDate });
        le.tridCompliance.disclosureProvided = true;
        le.tridCompliance.dateProvided = new Date(`${issuedDate}T00:00:00Z`);
        const { logAudit } = await import("../../auditLog");
        logAudit(req, "trid.loan_estimate_delivered", "loan_application", id, {
          leIssuedDate: issuedDate,
          leDueDate: le.tridCompliance.leDueDate?.toISOString() ?? null,
          withinThreeBusinessDays: le.tridCompliance.withinThreeBusinessDays,
        });
      }

      // TRID good-faith tolerance (Reg Z §1026.19(e)(3)). The LE above is
      // computed from live file data; what the BORROWER is entitled to see is
      // the disclosure that was issued, until a changed circumstance resets
      // it. reconcileDisclosure persists version 1 on first delivery and,
      // thereafter, either rediscloses under an open CoC or holds the baseline
      // and records the delta as a cure. Staff previews never touch it.
      //
      // ORDER IS LOAD-BEARING: reconcileDisclosure asks storage for the OPEN
      // changes of circumstance, and markRevisedLeDelivered (below) closes them
      // by setting status to "redisclosed". Stamping first — as this route did
      // originally — meant reconcile always saw an empty list, so
      // `increase_justified` was unreachable and every CoC-backed increase was
      // booked as a cure forever. It also stamped "revised LE delivered" on the
      // same request that served the borrower the OLD baseline figures, which
      // asserts a §1026.19(e)(4)(i) delivery that did not happen. Reconcile
      // first, then stamp only what was actually redisclosed.
      const isBorrower = application.userId === req.user!.id;
      if (isBorrower) {
        const { reconcileDisclosure } = await import("../../services/leDisclosureBaseline");
        const decision = await reconcileDisclosure(id, le);

        if (decision.action === "blocked_no_coc" || decision.action === "redisclosed") {
          const { logAudit } = await import("../../auditLog");
          logAudit(req, "trid.tolerance_evaluated", "loan_application", id, {
            action: decision.action,
            verdict: decision.evaluation?.verdict ?? null,
            cureAmount: decision.evaluation?.cureAmount ?? null,
            zeroToleranceIncrease: decision.evaluation?.zeroToleranceIncrease ?? null,
            cocId: decision.cocId,
            disclosureVersion: decision.disclosure.version,
          });
        }

        // Hold the issued figures. Regenerating a higher LE without a changed
        // circumstance is not a redisclosure — it is the violation, hidden.
        // Returns before the stamp below: nothing was redisclosed here, so
        // recording a revised-LE delivery would falsify the record.
        if (decision.action === "blocked_no_coc") {
          const formattedBaseline = formatLoanEstimateForDisplay(
            applyDisclosedFees(le, decision.disclosure.snapshot as DisclosureSnapshot),
          );
          return res.json(formattedBaseline);
        }

        // Revised-LE delivery (Reg Z §1026.19(e)(4)): the borrower is being
        // served figures that reflect the current file, so any open change of
        // circumstance has now been redisclosed to them — same ESIGN
        // electronic-delivery rationale as the leIssuedDate stamp above.
        const { markRevisedLeDelivered } = await import("../../services/changeOfCircumstance");
        const stamped = await markRevisedLeDelivered(id);
        if (stamped.length > 0) {
          const { logAudit } = await import("../../auditLog");
          logAudit(req, "trid.revised_le_delivered", "loan_application", id, {
            cocIds: stamped.map(c => c.id),
            reconcileAction: decision.action,
          });
        }
      }

      const formatted = formatLoanEstimateForDisplay(le);
      res.json(formatted);
    } catch (error) {
      // The §1026.36(d)(2) compensation election is an expected prerequisite,
      // not a server fault — both pre-flight verifiers hit this as a raw 500
      // with the real reason visible only in the server log.
      if (error instanceof Error && /compensation model and rate are required/i.test(error.message)) {
        return res.status(409).json({
          error:
            "Your Loan Estimate is being prepared — a required pricing setup step by our team is still pending.",
          code: "COMPENSATION_ELECTION_PENDING",
        });
      }
      console.error("Loan estimate error:", error);
      res.status(500).json({ error: "Failed to generate loan estimate" });
    }
  });

  // Staff-only tolerance posture: what would this file owe in cures if it
  // closed on today's numbers? Read-only — never creates or resets a baseline.
  app.get("/api/loan-applications/:id/le-tolerance", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      if (!isInternalStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Internal staff only" });
      }
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { generateLoanEstimate } = await import("../../services/loanEstimate");
      const { getToleranceReview } = await import("../../services/leDisclosureBaseline");
      const le = await generateLoanEstimate(id);
      res.json(await getToleranceReview(id, le));
    } catch (error) {
      console.error("LE tolerance review error:", error);
      res.status(500).json({ error: "Failed to evaluate fee tolerance" });
    }
  });

  // --- TRID change of circumstance (Reg Z §1026.19(e)(3)(iv) / (e)(4)(i)) ---
  // Staff record the changed circumstance; the 3-business-day revised-LE
  // clock starts from when the establishing information was received. An
  // open record past its due date blocks wholesale submission (readiness
  // stage 1). Fee-tolerance impact stays manual review (counsel item §6).
  const recordCocSchema = z.object({
    reasonType: z.enum(COC_REASON_TYPES),
    description: z.string().trim().min(1).max(2000),
    /** ISO date/datetime when the establishing information was received; defaults to now; never in the future. */
    informationReceivedAt: z.coerce.date().optional(),
  });

  app.get(
    "/api/loan-applications/:id/change-of-circumstances",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const rows = await storage.getChangeOfCircumstancesByApplication(id);
        res.json(rows);
      } catch (error) {
        console.error("List change-of-circumstances error:", error);
        res.status(500).json({ error: "Failed to list changes of circumstance" });
      }
    },
  );

  app.post(
    "/api/loan-applications/:id/change-of-circumstances",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const parsed = recordCocSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid change-of-circumstance payload", details: parsed.error.flatten() });
        }
        const now = new Date();
        const informationReceivedAt = parsed.data.informationReceivedAt ?? now;
        if (informationReceivedAt.getTime() > now.getTime()) {
          return res.status(400).json({ error: "informationReceivedAt cannot be in the future" });
        }

        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        const { recordChangeOfCircumstance } = await import("../../services/changeOfCircumstance");
        const coc = await recordChangeOfCircumstance(
          id,
          { reasonType: parsed.data.reasonType, description: parsed.data.description, informationReceivedAt },
          req.user!.id,
        );

        const { logAudit } = await import("../../auditLog");
        logAudit(req, "trid.change_of_circumstance_recorded", "loan_application", id, {
          cocId: coc.id,
          reasonType: coc.reasonType,
          revisedLeDueDate: coc.revisedLeDueDate,
        });

        res.status(201).json(coc);
      } catch (error) {
        console.error("Record change-of-circumstance error:", error);
        res.status(500).json({ error: "Failed to record change of circumstance" });
      }
    },
  );

  app.post(
    "/api/change-of-circumstances/:cocId/void",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const voidSchema = z.object({ reason: z.string().trim().min(1).max(500) });
        const parsed = voidSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "A void reason is required", details: parsed.error.flatten() });
        }
        const { cocId } = routeParams(req);
        const coc = await storage.getChangeOfCircumstance(cocId);
        if (!coc) {
          return res.status(404).json({ error: "Change of circumstance not found" });
        }
        const application = await storage.getLoanApplicationWithAccess(coc.applicationId, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(403).json({ error: "Access denied to this application" });
        }
        const { voidChangeOfCircumstance } = await import("../../services/changeOfCircumstance");
        const updated = await voidChangeOfCircumstance(cocId, parsed.data.reason, req.user!.id);
        if (!updated) {
          return res.status(409).json({ error: "Only open changes of circumstance can be voided" });
        }
        const { logAudit } = await import("../../auditLog");
        logAudit(req, "trid.change_of_circumstance_voided", "loan_application", coc.applicationId, {
          cocId,
          reason: parsed.data.reason,
        });
        res.json(updated);
      } catch (error) {
        console.error("Void change-of-circumstance error:", error);
        res.status(500).json({ error: "Failed to void change of circumstance" });
      }
    },
  );

}
