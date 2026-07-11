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
import {
  classifyAndPersistSituation,
  getLatestSituationProfile,
} from "../services/situationClassifier";
import { logAudit } from "../auditLog";
import { logFriction } from "../services/frictionLog";

/**
 * Tax Document Intelligence routes (UAL P2a — Situation Identification Engine).
 *
 * POST runs are consumer-direct and OWNER-ONLY (no staff/admin override), for
 * the same reason as /api/tax-insights/process: the tax_document_use consent
 * that gates them is granted by the borrower for their own data, and keeping
 * the flow consumer-direct is what keeps IRC §7216 preparer-disclosure rules
 * from attaching.
 *
 * Staff READS (a use named in the consent text) follow the per-file
 * assignment model, mirroring /api/predictions/staff/:userId: admin has
 * blanket access; every other internal-staff role must be an active
 * deal-team member on an application owned by the target borrower. Bare
 * isInternalStaffRole is reserved for aggregate feeds — never a specific
 * borrower's financial records. Every staff read is audited.
 *
 * Output is PROVISIONAL extraction — readiness/processing signal, never an
 * underwriting input (MR-2 / L2 I1: a human confirms values before they count).
 */

/**
 * Per-file assignment gate for non-owner reads: admin passes; any other
 * internal-staff caller must name an application they are an active
 * deal-team member of, and the target borrower must own that application.
 */
async function staffCanAccessBorrower(
  caller: User,
  borrowerUserId: string,
  applicationId: string | undefined,
  storage: IStorage,
): Promise<{ allowed: boolean; reason?: string }> {
  if (caller.role === "admin") return { allowed: true };
  if (!isInternalStaffRole(caller.role)) return { allowed: false, reason: "Unauthorized" };
  if (!applicationId) {
    return {
      allowed: false,
      reason: "An applicationId is required for non-admin staff access",
    };
  }
  const teamMembers = await storage.getDealTeamMembers(applicationId);
  if (!teamMembers.some((m) => m.userId === caller.id)) {
    return { allowed: false, reason: "Access denied" };
  }
  const application = await storage.getLoanApplication(applicationId);
  if (!application || application.userId !== borrowerUserId) {
    return { allowed: false, reason: "Access denied" };
  }
  return { allowed: true };
}

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

      // P2b/P2c: refresh the borrower's resolved entities and situation
      // profile from the new extraction (non-fatal — both are derived views,
      // recomputable from the persisted extraction).
      let entityCount: number | undefined;
      let situationProfileId: string | undefined;
      if (summary.status === "completed") {
        try {
          const { entities } = await resolveAndPersistEntities(user.id);
          entityCount = entities.length;
        } catch (resolutionErr) {
          console.warn("[TaxIntelligence] Entity resolution failed (non-fatal):", resolutionErr);
        }
        try {
          const situation = await classifyAndPersistSituation(user.id);
          situationProfileId = situation.id;
        } catch (situationErr) {
          console.warn("[TaxIntelligence] Situation classification failed (non-fatal):", situationErr);
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

      res
        .status(summary.status === "failed" ? 502 : 200)
        .json({ ...summary, entityCount, situationProfileId });
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
      if (!isOwner) {
        const access = await staffCanAccessBorrower(
          user,
          document.userId,
          document.applicationId ?? (req.query.applicationId as string | undefined),
          storage,
        );
        if (!access.allowed) {
          return res.status(403).json({ error: access.reason ?? "Unauthorized" });
        }
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
      if (!isOwner) {
        const access = await staffCanAccessBorrower(
          user,
          requestedUserId,
          req.query.applicationId as string | undefined,
          storage,
        );
        if (!access.allowed) {
          return res.status(403).json({ error: access.reason ?? "Unauthorized" });
        }
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

  /**
   * P2c: the SituationProfile — what kind of borrower this is, which income
   * paths the file indicates, and which documents to request. Owner reads
   * their own; internal staff may read any borrower's (audited). Computed
   * fresh if nothing is persisted yet (deterministic either way).
   */
  app.get("/api/tax-intelligence/situation", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const requestedUserId =
        typeof req.query.userId === "string" && req.query.userId ? req.query.userId : user.id;
      const isOwner = requestedUserId === user.id;
      if (!isOwner) {
        const access = await staffCanAccessBorrower(
          user,
          requestedUserId,
          req.query.applicationId as string | undefined,
          storage,
        );
        if (!access.allowed) {
          return res.status(403).json({ error: access.reason ?? "Unauthorized" });
        }
      }

      let row = await getLatestSituationProfile(requestedUserId);
      if (!row) {
        row = await classifyAndPersistSituation(requestedUserId);
      }

      if (!isOwner) {
        logAudit(req, "tax_intelligence.situation_viewed", "user", requestedUserId, {
          situationProfileId: row.id,
        });
      }

      res.json({
        id: row.id,
        userId: row.userId,
        generatedAt: row.generatedAt.toISOString(),
        inputsFingerprint: row.inputsFingerprint,
        profile: row.profile,
      });
    } catch (error) {
      console.error("Situation profile error:", error);
      res.status(500).json({ error: "Failed to load situation profile" });
    }
  });
}
