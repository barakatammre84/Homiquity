import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { taxExtractionRuns, type User } from "@shared/schema";
import { isInternalStaffRole } from "@shared/roles";
import { and, eq, gte } from "drizzle-orm";
import { hasUserConsent } from "../consentGate";
import {
  runTaxDocumentIntelligence,
  getLatestTaxIntelligence,
} from "../services/taxDocumentIntelligence";
import { resolveAndPersistEntities } from "../services/borrowerEntityResolution";
import { buildTaxReconciliation } from "../services/taxReconciliation";
import { logAudit } from "../auditLog";
import { logFriction } from "../services/frictionLog";

/**
 * Tax Document Intelligence routes (UAL P2a — Situation Identification Engine).
 *
 * POST runs are consumer-direct and OWNER-ONLY (no staff/admin override), for
 * the same reason as /api/tax-insights/process: the tax_document_use consent
 * that gates them is granted by the borrower for their own data, and keeping
 * the flow consumer-direct is what keeps IRC §7216 preparer-disclosure rules
 * from attaching. Internal staff may READ completed results (that use is named
 * in the consent text); every staff read is audited.
 *
 * Output is PROVISIONAL extraction — readiness/processing signal, never an
 * underwriting input (MR-2 / L2 I1: a human confirms values before they count).
 */

/** A run in flight recently enough that a second one would double-bill the model. */
const RUN_IN_FLIGHT_WINDOW_MS = 5 * 60 * 1000;

export function registerTaxIntelligenceRoutes(app: Express, storage: IStorage) {
  app.post("/api/documents/:id/tax-intelligence", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.userId !== user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      if (document.documentType !== "tax_return") {
        return res.status(400).json({ error: "Document is not a tax return" });
      }

      if (!(await hasUserConsent("tax_document_use", user.id))) {
        logFriction("consent_gate_blocked", {
          userId: user.id,
          detail: "tax_document_use",
          metadata: { path: req.path },
        });
        return res.status(403).json({
          error: "Please review and accept the tax document authorization first.",
          code: "CONSENT_REQUIRED",
          consentType: "tax_document_use",
        });
      }

      // One run at a time per document: a multi-form run makes many model
      // calls, so a double-click must not double the spend.
      const [inFlight] = await db
        .select({ id: taxExtractionRuns.id })
        .from(taxExtractionRuns)
        .where(
          and(
            eq(taxExtractionRuns.documentId, document.id),
            eq(taxExtractionRuns.status, "running"),
            gte(taxExtractionRuns.startedAt, new Date(Date.now() - RUN_IN_FLIGHT_WINDOW_MS)),
          ),
        )
        .limit(1);
      if (inFlight) {
        return res.status(409).json({
          error: "An extraction is already running for this document.",
          runId: inFlight.id,
        });
      }

      const summary = await runTaxDocumentIntelligence(document);

      if (summary.status === "completed") {
        // Same MR-2 staging contract as the legacy extract routes: clearing the
        // confidence gate stages the document "verifying" for a human; it can
        // never mark itself "verified".
        await storage.updateDocument(document.id, {
          status: !summary.humanReviewRequired ? "verifying" : "uploaded",
          notes: JSON.stringify({
            taxIntelligenceRunId: summary.runId,
            extractedAt: summary.completedAt,
            formCount: summary.formCount,
            pageCount: summary.pageCount,
            overallConfidence: summary.overallConfidence,
            humanReviewRequired: summary.humanReviewRequired,
            simulated: summary.simulated,
            modelId: summary.modelId,
            promptVersion: summary.promptVersion,
          }),
        });
      }

      // P2b: refresh the borrower's resolved business entities from the new
      // extraction (non-fatal — resolution is a derived view, recomputable).
      let entityCount: number | undefined;
      if (summary.status === "completed") {
        try {
          const { entities } = await resolveAndPersistEntities(user.id);
          entityCount = entities.length;
        } catch (resolutionErr) {
          console.warn("[TaxIntelligence] Entity resolution failed (non-fatal):", resolutionErr);
        }
      }

      logAudit(req, "tax_intelligence.run", "document", document.id, {
        runId: summary.runId,
        status: summary.status,
        formCount: summary.formCount,
        overallConfidence: summary.overallConfidence,
        simulated: summary.simulated,
        entityCount,
      });

      res.status(summary.status === "failed" ? 502 : 200).json({ ...summary, entityCount });
    } catch (error) {
      console.error("Tax intelligence run error:", error);
      res.status(500).json({ error: "Failed to process tax document" });
    }
  });

  app.get("/api/documents/:id/tax-intelligence", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      const isOwner = document.userId === user.id;
      const isStaff = isInternalStaffRole(user.role);
      if (!isOwner && !isStaff) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const summary = await getLatestTaxIntelligence(document.id);
      if (!summary) {
        return res.status(404).json({ error: "No extraction has been run for this document" });
      }

      if (!isOwner) {
        // Staff reading a borrower's extracted tax data is a PII-adjacent
        // access — leave a trail.
        logAudit(req, "tax_intelligence.viewed", "document", document.id, {
          runId: summary.runId,
          borrowerId: document.userId,
        });
      }

      res.json(summary);
    } catch (error) {
      console.error("Tax intelligence fetch error:", error);
      res.status(500).json({ error: "Failed to load tax intelligence" });
    }
  });

  /**
   * P2b: the cross-document reconciliation report — resolved business
   * entities + deterministic tie-out checks over the user's latest
   * extractions. Owner reads their own; internal staff may read any
   * borrower's (audited).
   */
  app.get("/api/tax-intelligence/reconciliation", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const requestedUserId =
        typeof req.query.userId === "string" && req.query.userId ? req.query.userId : user.id;
      const isOwner = requestedUserId === user.id;
      if (!isOwner && !isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const report = await buildTaxReconciliation(requestedUserId);

      if (!isOwner) {
        logAudit(req, "tax_intelligence.reconciliation_viewed", "user", requestedUserId, {
          formCount: report.formCount,
          variances: report.summary.variance,
        });
      }

      res.json(report);
    } catch (error) {
      console.error("Tax reconciliation error:", error);
      res.status(500).json({ error: "Failed to build tax reconciliation" });
    }
  });
}
