import express, { type Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import {
  extractTaxReturnData,
  extractPayStubData,
  extractBankStatementData,
  extractLeaseData,
} from "../extractionService";
import { recordCoarseExtraction, markHumanReviewCompleted } from "../services/documentConfidence";
import { allowedUploadTypes, bufferMatchesAllowedSignature } from "./utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@shared/uploads";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  isLocalFallbackEnabled,
  isValidObjectId,
  createLocalUpload,
  writeLocalObject,
  streamLocalObject,
} from "../integrations/object_storage";
import { type User } from "@shared/schema";
import { DOCUMENT_STATUS } from "@shared/documentStatus";
import { logAudit } from "../auditLog";
import { sendNotificationEmail } from "../services/emailService";

const objectStorageService = new ObjectStorageService();

// The encrypted raw model response is stored server-side only; never return the
// ciphertext/IV/key to the client. The hash and model/prompt lineage are safe.
export function publicExtraction<T extends Record<string, any>>(extractedData: T) {
  const { rawResponseEncrypted, rawResponseIv, rawResponseKeyId, ...rest } = extractedData;
  return rest;
}

/**
 * document.fileName is uploader-controlled. Quotes/control chars in a quoted
 * Content-Disposition filename can break out of the quoting or corrupt the
 * header, so strip them before echoing the name back in a download header.
 */
function safeDispositionFilename(fileName: string | null | undefined): string {
  const cleaned = (fileName ?? "download")
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[\x00-\x1f\x7f]/g, "_")
    .trim();
  return cleaned || "download";
}

export function registerDocumentRoutes(
  app: Express,
  storage: IStorage,
) {
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      if (contentType && !allowedUploadTypes.includes(contentType)) {
        return res.status(400).json({ error: "Invalid file type" });
      }
      if (size && size > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ error: `File too large (max ${MAX_UPLOAD_LABEL})` });
      }

      // No GCS bucket configured: in local dev, hand back a local upload target so
      // the same client flow (request-url → PUT → register → download) works without
      // cloud credentials. In PRODUCTION we refuse loudly (503, UPLOADS_UNCONFIGURED)
      // rather than silently storing on ephemeral disk — the exact "uploads vanish on
      // redeploy" bug the GCS path fixes (see .env.example: GCS_SERVICE_ACCOUNT_KEY +
      // PRIVATE_OBJECT_DIR).
      if (!objectStorageService.isConfigured()) {
        if (!isLocalFallbackEnabled()) {
          return res.status(503).json({
            error: "Document uploads are temporarily unavailable. Please try again later.",
            code: "UPLOADS_UNCONFIGURED",
          });
        }
        const { uploadURL, objectPath } = createLocalUpload();
        return res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Local-only upload receiver, the counterpart to createLocalUpload(). Accepts the
  // raw bytes a client would otherwise PUT to a presigned GCS URL and stores them on
  // the local filesystem. Guarded so it can never be a prod write surface: 404s in
  // production and whenever real object storage is configured.
  app.put(
    "/api/uploads/local/:objectId",
    isAuthenticated,
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    (req, res) => {
      if (!isLocalFallbackEnabled()) {
        return res.status(404).json({ error: "Not found" });
      }
      const { objectId } = req.params;
      if (!isValidObjectId(objectId)) {
        return res.status(400).json({ error: "Invalid object id" });
      }
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        return res.status(400).json({ error: "Empty upload" });
      }
      // Same magic-byte guard the disk path enforces, so the local flow rejects
      // spoofed/unsupported content just like production's allowlist + GCS.
      if (!bufferMatchesAllowedSignature(buf)) {
        return res.status(400).json({ error: "Invalid or unsupported file content" });
      }
      try {
        writeLocalObject(objectId, buf);
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("Local object write failed:", err);
        return res.status(500).json({ error: "Failed to store file" });
      }
    },
  );

  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;

      // Resolve the document record that owns this storage path.
      const allDocs = await storage.getDocumentsByStoragePath(req.path);
      const matchedDoc = allDocs[0];

      if (matchedDoc) {
        const isOwner = matchedDoc.userId === user.id;
        if (!isOwner) {
          // Admins retain global access.
          if (user.role !== "admin") {
            // All other roles (including non-admin internal staff) must be active
            // deal-team members on the application the document belongs to.
            if (!matchedDoc.applicationId) {
              return res.status(403).json({ error: "Unauthorized" });
            }
            const app = await storage.getLoanApplicationWithAccess(
              matchedDoc.applicationId, user.id, user.role
            );
            if (!app) {
              return res.status(403).json({ error: "Unauthorized" });
            }
          }
        }
      } else {
        // No document record found for this path — only admins may access.
        if (user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      logAudit(req, "document.download", "document", req.path, { role: user.role });

      // Dev local fallback: when no GCS bucket is configured, stream from the local
      // store (dev only; 404 in prod so a misconfigured deploy is obvious, not lossy).
      if (!objectStorageService.isConfigured()) {
        if (!isLocalFallbackEnabled()) {
          return res.status(404).json({ error: "Object not found" });
        }
        return streamLocalObject(req.path, res);
      }

      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  app.get("/api/documents/:id/download", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const document = await storage.getDocument(req.params.id);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Owners always have access. Admins retain global access. All other roles
      // (including non-admin internal staff) must be active deal-team members on the
      // application the document belongs to.
      const isOwner = document.userId === user.id;
      if (!isOwner && user.role !== "admin") {
        if (document.applicationId) {
          const assignedApp = await storage.getLoanApplicationWithAccess(
            document.applicationId, user.id, user.role
          );
          if (!assignedApp) {
            return res.status(403).json({ error: "Unauthorized" });
          }
        } else {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      if (document.storagePath?.startsWith("/objects/")) {
        // Dev local fallback: stream from the local store when GCS is unconfigured
        // (dev only; 404 in prod).
        if (!objectStorageService.isConfigured()) {
          if (!isLocalFallbackEnabled()) {
            return res.status(404).json({ error: "File not found in storage" });
          }
          res.set("Content-Disposition", `attachment; filename="${safeDispositionFilename(document.fileName)}"`);
          return streamLocalObject(document.storagePath, res);
        }
        const objectFile = await objectStorageService.getObjectEntityFile(document.storagePath);
        // Defense in depth: even though the app-level checks above passed, the
        // object's own ACL is the second gate — so a document record that was
        // somehow pointed at another user's object still cannot be streamed.
        if (objectStorageService.isConfigured()) {
          const allowed = await objectStorageService.canAccessObjectEntity({ userId: user.id, objectFile });
          const isPrivileged = user.role === "admin";
          if (!allowed && !isPrivileged) {
            return res.status(403).json({ error: "Unauthorized" });
          }
        }
        // Force download rather than inline render so borrower-uploaded files
        // (e.g. crafted HTML/SVG/PDF) cannot execute in the browser context.
        res.set("Content-Disposition", `attachment; filename="${safeDispositionFilename(document.fileName)}"`);
        await objectStorageService.downloadObject(objectFile, res);
      } else if (document.storagePath) {
        const fs = await import("fs");
        if (fs.existsSync(document.storagePath)) {
          res.set("Content-Disposition", `attachment; filename="${safeDispositionFilename(document.fileName)}"`);
          res.set("Content-Type", document.mimeType || "application/octet-stream");
          fs.createReadStream(document.storagePath).pipe(res);
        } else {
          return res.status(404).json({ error: "File not found on disk" });
        }
      } else {
        return res.status(404).json({ error: "No storage path for document" });
      }
    } catch (error) {
      console.error("Document download error:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found in storage" });
      }
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  app.post("/api/documents/:id/extract", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Owner and admin as before; deal-team staff may also (re-)run
      // extraction — the same roles and deal-team check as /verify below, so
      // the review workbench can refresh values without an admin. Extraction
      // only stages (MR-2): it can never verify, so widening the trigger does
      // not widen who can bind an outcome.
      let authorized = document.userId === user.id || user.role === "admin";
      if (
        !authorized &&
        ["lo", "loa", "processor", "underwriter"].includes(user.role) &&
        document.applicationId
      ) {
        const assignedApp = await storage.getLoanApplicationWithAccess(
          document.applicationId, user.id, user.role
        );
        authorized = !!assignedApp;
      }
      if (!authorized) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { documentYear } = req.body;
      let extractedData: any;

      switch (document.documentType) {
        case "tax_return":
          extractedData = await extractTaxReturnData(document.storagePath, documentYear);
          break;
        case "pay_stub":
          extractedData = await extractPayStubData(document.storagePath);
          break;
        case "bank_statement":
          extractedData = await extractBankStatementData(document.storagePath);
          break;
        case "lease_agreement":
          extractedData = await extractLeaseData(document.storagePath);
          break;
        default:
          return res.status(400).json({ 
            error: "Document type not supported for extraction",
            supportedTypes: ["tax_return", "pay_stub", "bank_statement", "lease_agreement"]
          });
      }

      const { humanReviewRequired } = await recordCoarseExtraction({
        documentId: id,
        documentType: document.documentType,
        applicationId: document.applicationId,
        confidence: extractedData.confidence,
        extractedFields: extractedData.extractedFields,
        fileSize: document.fileSize ?? undefined,
      });
      await storage.updateDocument(id, {
        // "verified" is reserved for human review (POST /api/documents/:id/verify);
        // AI confidence never auto-verifies (MR-2 — an uploaded doc must not be
        // able to mark itself verified). main's review-gate signal still routes:
        // a doc that clears the type-specific confidence threshold is staged
        // "verifying" for a human to confirm; everything else stays "uploaded".
        status: !humanReviewRequired ? DOCUMENT_STATUS.VERIFYING : DOCUMENT_STATUS.UPLOADED,
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

      if (document.documentType === "tax_return") {
        // Keep the derived tax-insight row in sync when a tax return is
        // extracted through the origination flow too (non-fatal: the insight
        // is a readiness signal, not part of the extraction contract).
        // Consent-gated exactly like POST /api/tax-insights/process: without
        // the borrower's tax_document_use authorization, extraction proceeds
        // but NO insight is derived — the DSCR staff signal and readiness
        // income feed must never exist for an unconsented borrower.
        try {
          const { hasUserConsent } = await import("../consentGate");
          if (await hasUserConsent("tax_document_use", document.userId)) {
            const { saveTaxInsightForDocument } = await import("../services/taxInsightService");
            await saveTaxInsightForDocument(document.userId, id, extractedData);
          }
        } catch (insightErr) {
          console.warn("[TaxInsight] Insight derivation failed (non-fatal):", insightErr);
        }
      }

      if (extractedData.confidence !== "low" && extractedData.extractedFields) {
        try {
          const { wireExtractionToReadiness } = await import("../services/optimizationEngine");
          const readinessResult = await wireExtractionToReadiness(
            document.userId,
            id,
            document.documentType,
            extractedData.extractedFields,
            extractedData.confidence
          );
          console.log(`[OPT-1] Readiness fields updated: ${readinessResult.fieldsUpdated.join(", ") || "none"}`);
        } catch (readinessErr) {
          console.warn("[OPT-1] Readiness wiring failed (non-fatal):", readinessErr);
        }
      }

      if (document.applicationId) {
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
        
        if (extractedData.confidence === "low" || (extractedData.warnings && extractedData.warnings.length > 0)) {
          // The raw extractor warnings can name the OCR vendor or be otherwise
          // technical — keep them in the logs, and give the task a plain,
          // reviewer-facing message.
          if (extractedData.warnings?.length) {
            console.warn(`[Documents] OCR warnings for ${id}:`, extractedData.warnings.join(", "));
          }
          await taskEventEmitter.emitDocumentEvent("DOCUMENT_OCR_ISSUE", {
            applicationId: document.applicationId,
            documentId: id,
            documentType: document.documentType,
            errorMessage: "Some details couldn't be read automatically and need a manual review.",
            triggeredBy: req.user!.id,
          });
        }
      }

      // Extraction reads a PII-bearing document and returns financial values —
      // record who triggered it (the other document actions already log).
      logAudit(req, "document.extract", "document", id, {
        documentType: document.documentType,
        applicationId: document.applicationId,
        confidence: extractedData.confidence,
      });

      res.json({
        documentId: id,
        documentType: document.documentType,
        ...publicExtraction(extractedData),
      });
    } catch (error) {
      console.error("Document extraction error:", error);
      
      const document = await storage.getDocument(req.params.id);
      if (document?.applicationId) {
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
        // The real error is already logged above; the task event carries a
        // plain, reviewer-facing message rather than raw exception text.
        await taskEventEmitter.emitDocumentEvent("DOCUMENT_EXTRACTION_FAILED", {
          applicationId: document.applicationId,
          documentId: req.params.id,
          documentType: document.documentType,
          errorMessage: "We couldn't process this document automatically. Please upload a clear copy, or our team will review it.",
        });
      }
      
      res.status(500).json({ error: "Failed to extract document data" });
    }
  });

  // Human document verification — the ONLY path to status "verified". AI
  // extraction can at most advance a document to "verifying"; a staff member
  // assigned to the deal (or an admin) makes the verify/reject call.
  app.post(
    "/api/documents/:id/verify",
    requireRole("admin", "lo", "loa", "processor", "underwriter"),
    async (req, res) => {
      try {
        const user = req.user as User;
        const { id } = req.params;
        const { status, reason } = req.body as { status?: string; reason?: string };

        if (status !== DOCUMENT_STATUS.VERIFIED && status !== DOCUMENT_STATUS.REJECTED) {
          return res.status(400).json({ error: 'status must be "verified" or "rejected"' });
        }
        const trimmedReason = typeof reason === "string" ? reason.trim() : "";
        if (status === DOCUMENT_STATUS.REJECTED && !trimmedReason) {
          return res.status(400).json({ error: "A reason is required when rejecting a document" });
        }

        const document = await storage.getDocument(id);
        if (!document) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Non-admin staff must be active deal-team members on the application.
        if (user.role !== "admin") {
          if (!document.applicationId) {
            return res.status(403).json({ error: "Unauthorized" });
          }
          const app = await storage.getLoanApplicationWithAccess(
            document.applicationId, user.id, user.role
          );
          if (!app) {
            return res.status(403).json({ error: "Unauthorized" });
          }
        }

        // Persist the full review decision. rejectionReason is borrower-visible
        // (shown on the Documents page); a verify clears any prior reason so a
        // reversed bounce doesn't keep scolding the borrower. `notes` stays
        // reserved for extraction lineage.
        const updated = await storage.updateDocument(id, {
          status,
          rejectionReason: status === DOCUMENT_STATUS.REJECTED ? trimmedReason : null,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
        });

        // Close the MR-6 accuracy loop: a verify/reject IS a completed human
        // review, so stamp the confidence row (no-op when extraction never
        // ran). Non-fatal — the human verdict must stand even if the stamp
        // fails.
        try {
          await markHumanReviewCompleted(id, user.id);
        } catch (stampErr) {
          console.warn(`[Documents] Review stamp failed for ${id} (non-fatal):`, stampErr);
        }

        logAudit(req, `document.${status}`, "document", id, {
          documentType: document.documentType,
          applicationId: document.applicationId,
          reviewedBy: user.id,
          ...(trimmedReason ? { reason: trimmedReason } : {}),
        });

        // A rejection un-satisfies whatever condition this upload had moved to
        // "submitted" — revert it to "outstanding" so the auto-matcher re-arms
        // when the borrower uploads a replacement (non-fatal).
        if (status === DOCUMENT_STATUS.REJECTED && document.applicationId) {
          try {
            const { revertConditionsForRejectedDocument } = await import("../pipelineEngine");
            await revertConditionsForRejectedDocument({
              applicationId: document.applicationId,
              documentType: document.documentType,
              fileName: document.fileName,
              rejectedBy: user.id,
            });
          } catch (revertErr) {
            console.error("[Documents] Condition revert failed (non-fatal):", revertErr);
          }
        }

        // Close the loop with the borrower: in-app notification (carries the
        // reason — it stays behind login) plus a content-free email nudge (the
        // reason is staff-typed free text and never travels over email).
        try {
          const isVerified = status === DOCUMENT_STATUS.VERIFIED;
          const documentLabel = document.documentType.replace(/_/g, " ");
          await storage.createNotification({
            userId: document.userId,
            type: isVerified ? "document_verified" : "document_rejected",
            title: isVerified ? "Document accepted" : "A document needs your attention",
            body: isVerified
              ? `${document.fileName} has been reviewed and accepted.`
              : `${document.fileName} couldn't be accepted: ${trimmedReason} Open Documents to upload a new copy.`,
            entityType: "document",
            entityId: document.id,
            status: "unread",
            metadata: { documentType: document.documentType, applicationId: document.applicationId },
          });
          const borrower = await storage.getUser(document.userId);
          if (borrower?.email) {
            sendNotificationEmail({
              type: isVerified ? "document_verified" : "document_rejected",
              recipientEmail: borrower.email,
              data: { borrowerName: borrower.firstName || "there", documentName: documentLabel },
            });
          }
        } catch (notifyErr) {
          console.error("[Documents] Review notification failed (non-fatal):", notifyErr);
        }

        res.json(updated);
      } catch (error) {
        console.error("Document verify error:", error);
        res.status(500).json({ error: "Failed to update document status" });
      }
    }
  );

}
