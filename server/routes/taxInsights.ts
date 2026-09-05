import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated } from "../auth";
import { extractTaxReturnData } from "../extractionService";
import { recordCoarseExtraction } from "../services/documentConfidence";
import { hasUserConsent } from "../consentGate";
import { saveTaxInsightForDocument } from "../services/taxInsightService";
import { logAudit } from "../auditLog";
import { logFriction } from "../services/frictionLog";
import { publicExtraction } from "./documents";
import type { TaxInsight, User } from "@shared/schema";
import {
  documentProcessingBlockReason,
  getDocumentProcessingBlockReason,
  withDocumentWorkflowLock,
} from "../services/documentLineage";

/**
 * Tax Return Insight — consumer-direct: the borrower processes their OWN
 * uploaded return (owner-only, no staff/admin override) because the
 * tax_document_use consent that gates it is granted by that user for their
 * own data. Output is an educational readiness signal, never a
 * prequalification (Reg N framing enforced client-side and in the consent
 * text).
 */

/** Client-facing projection — derived aggregates only, no lineage ciphertext. */
function publicInsight(insight: TaxInsight) {
  return {
    taxYear: insight.taxYear,
    documentId: insight.documentId,
    wagesW2: insight.wagesW2,
    grossIncome: insight.grossIncome,
    adjustedGrossIncome: insight.adjustedGrossIncome,
    scheduleCNetProfit: insight.scheduleCNetProfit,
    scheduleENetRental: insight.scheduleENetRental,
    rentalPropertyCount: insight.rentalPropertyCount,
    selfEmployed: insight.selfEmployed,
    dscrCandidate: insight.dscrCandidate,
    confidence: insight.confidence,
    createdAt: insight.createdAt,
    updatedAt: insight.updatedAt,
  };
}

export function registerTaxInsightRoutes(app: Express, storage: IStorage) {
  app.post("/api/tax-insights/process", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { documentId, documentYear } = req.body as {
        documentId?: string;
        documentYear?: string;
      };

      if (!documentId || typeof documentId !== "string") {
        return res.status(400).json({ error: "Missing required field: documentId" });
      }
      const year =
        typeof documentYear === "string" && /^\d{4}$/.test(documentYear)
          ? documentYear
          : undefined;

      const document = await storage.getDocument(documentId);
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

      const preflightBlock = await getDocumentProcessingBlockReason(documentId);
      if (preflightBlock) {
        return res.status(409).json({
          error:
            preflightBlock === "replaced"
              ? "This tax return has been replaced. Process the current version instead."
              : "This tax return already has a final human review.",
          code:
            preflightBlock === "replaced"
              ? "DOCUMENT_VERSION_REPLACED"
              : "DOCUMENT_ALREADY_REVIEWED",
        });
      }

      const extractedData = await extractTaxReturnData(document.storagePath, year);

      const persistence = await withDocumentWorkflowLock(
        documentId,
        async (currentDocument, isCurrentVersion) => {
        const blockReason = documentProcessingBlockReason(currentDocument, isCurrentVersion);
        if (blockReason) {
          return { insight: null, blockReason };
        }
        // Same persistence contract as POST /api/documents/:id/extract: coarse
        // confidence recording + lineage columns; AI never sets "verified" (MR-2).
        const { humanReviewRequired } = await recordCoarseExtraction({
          documentId,
          documentType: document.documentType,
          applicationId: document.applicationId,
          confidence: extractedData.confidence,
          extractedFields: extractedData.extractedFields,
          fileSize: document.fileSize ?? undefined,
        });
        await storage.updateDocument(documentId, {
          status: !humanReviewRequired ? "verifying" : "uploaded",
          notes: JSON.stringify({
            extractedAt: new Date().toISOString(),
            extractedFields: extractedData.extractedFields,
            confidence: extractedData.confidence,
            humanReviewRequired,
            warnings: extractedData.warnings,
            modelId: extractedData.modelId,
            promptVersion: extractedData.promptVersion,
            responseHash: extractedData.rawResponseHash,
          }),
          extractionResponseHash: extractedData.rawResponseHash,
          extractionRawEncrypted: extractedData.rawResponseEncrypted,
          extractionRawIv: extractedData.rawResponseIv,
          extractionRawKeyId: extractedData.rawResponseKeyId,
        });

        const persistedInsight = await saveTaxInsightForDocument(user.id, documentId, extractedData);
        logAudit(req, "tax_insight.generated", "tax_insight", persistedInsight.id, {
          documentId,
          taxYear: persistedInsight.taxYear,
          dscrCandidate: persistedInsight.dscrCandidate,
          selfEmployed: persistedInsight.selfEmployed,
          confidence: persistedInsight.confidence,
        });
        return { insight: persistedInsight, blockReason: null };
      });
      if (persistence.blockReason) {
        return res.status(409).json({
          error:
            persistence.blockReason === "replaced"
              ? "This tax return was replaced while extraction was running. The result was discarded."
              : "This tax return was reviewed while extraction was running. The human decision was kept.",
          code:
            persistence.blockReason === "replaced"
              ? "DOCUMENT_VERSION_REPLACED"
              : "DOCUMENT_ALREADY_REVIEWED",
        });
      }
      const insight = persistence.insight!;

      res.json({
        insight: publicInsight(insight),
        extraction: publicExtraction(extractedData),
      });
    } catch (error) {
      console.error("Tax insight processing error:", error);
      res.status(500).json({ error: "Failed to process tax return" });
    }
  });

  app.get("/api/tax-insights/me", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const insights = await storage.getTaxInsightsByUser(user.id);
      res.json({ insights: insights.map(publicInsight) });
    } catch (error) {
      console.error("Tax insight fetch error:", error);
      res.status(500).json({ error: "Failed to load tax insights" });
    }
  });
}
