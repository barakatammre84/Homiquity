import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import {
  extractTaxReturnData,
  extractPayStubData,
  extractBankStatementData,
  extractLeaseData,
} from "../extractionService";
import { recordCoarseExtraction } from "../services/documentConfidence";
import { allowedUploadTypes } from "./utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@shared/uploads";
import { ObjectStorageService, ObjectNotFoundError } from "../integrations/object_storage";
import { type User } from "@shared/schema";
import { logAudit } from "../auditLog";

const objectStorageService = new ObjectStorageService();

// The encrypted raw model response is stored server-side only; never return the
// ciphertext/IV/key to the client. The hash and model/prompt lineage are safe.
function publicExtraction<T extends Record<string, any>>(extractedData: T) {
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
      // Graceful gate until the GCS env vars land (GCS_SERVICE_ACCOUNT_KEY +
      // PRIVATE_OBJECT_DIR, see .env.example): a deliberate 503 JSON envelope
      // that the client surfaces as a maintenance message, instead of a
      // generated URL that could never work.
      if (!objectStorageService.isConfigured()) {
        return res.status(503).json({
          error: "Document uploads are temporarily unavailable. Please try again later.",
          code: "UPLOADS_UNCONFIGURED",
        });
      }

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
      const document = await storage.getDocument(id);

      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== req.user!.id && req.user!.role !== "admin") {
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

        if (status !== "verified" && status !== "rejected") {
          return res.status(400).json({ error: 'status must be "verified" or "rejected"' });
        }
        if (status === "rejected" && (!reason || typeof reason !== "string")) {
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

        // The rejection reason lives in the audit log (below) — the documents
        // table has no dedicated column and `notes` holds extraction lineage.
        const updated = await storage.updateDocument(id, { status });

        logAudit(req, `document.${status}`, "document", id, {
          documentType: document.documentType,
          applicationId: document.applicationId,
          reviewedBy: user.id,
          ...(reason ? { reason } : {}),
        });

        res.json(updated);
      } catch (error) {
        console.error("Document verify error:", error);
        res.status(500).json({ error: "Failed to update document status" });
      }
    }
  );

}
