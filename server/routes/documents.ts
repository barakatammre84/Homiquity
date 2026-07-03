import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import {
  extractTaxReturnData,
  extractPayStubData,
  extractBankStatementData,
  extractLeaseData,
} from "../extractionService";
import { upload, allowedUploadTypes, verifyFileSignature } from "./utils";
import { ObjectStorageService, ObjectNotFoundError } from "../integrations/object_storage";
import { type User } from "@shared/schema";
import { logAudit } from "../auditLog";
import { sendNotificationEmail } from "../services/emailService";

const objectStorageService = new ObjectStorageService();

/** Zero-touch: route an uploaded document at its outstanding conditions (non-fatal). */
async function matchConditionsForUpload(
  applicationId: string | null | undefined,
  documentType: string,
  fileName: string,
  uploadedBy: string,
): Promise<void> {
  if (!applicationId) return;
  try {
    const { matchUploadedDocumentToConditions } = await import("../pipelineEngine");
    await matchUploadedDocumentToConditions({ applicationId, documentType, fileName, uploadedBy });
  } catch (err) {
    console.error("[Documents] Condition matching failed (non-fatal):", err);
  }
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

      if (size && size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large (max 10MB)" });
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
        // Force download rather than inline render so borrower-uploaded files
        // (e.g. crafted HTML/SVG/PDF) cannot execute in the browser context.
        res.set("Content-Disposition", `attachment; filename="${document.fileName}"`);
        await objectStorageService.downloadObject(objectFile, res);
      } else if (document.storagePath) {
        const fs = await import("fs");
        if (fs.existsSync(document.storagePath)) {
          res.set("Content-Disposition", `attachment; filename="${document.fileName}"`);
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

      await storage.updateDocument(id, {
        // "verified" is reserved for human review (POST /api/documents/:id/verify).
        // The model's self-reported confidence only advances a doc to "verifying" —
        // an uploaded document must never be able to mark itself verified.
        status: extractedData.confidence === "high" ? "verifying" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
          modelId: extractedData.modelId,
          promptVersion: extractedData.promptVersion,
        }),
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
          await taskEventEmitter.emitDocumentEvent("DOCUMENT_OCR_ISSUE", {
            applicationId: document.applicationId,
            documentId: id,
            documentType: document.documentType,
            errorMessage: extractedData.warnings?.join(", ") || "Low confidence extraction",
            triggeredBy: req.user!.id,
          });
        }
      }

      res.json({
        documentId: id,
        documentType: document.documentType,
        ...extractedData,
      });
    } catch (error) {
      console.error("Document extraction error:", error);
      
      const document = await storage.getDocument(req.params.id);
      if (document?.applicationId) {
        const { taskEventEmitter } = await import("../services/taskEventEmitter");
        await taskEventEmitter.emitDocumentEvent("DOCUMENT_EXTRACTION_FAILED", {
          applicationId: document.applicationId,
          documentId: req.params.id,
          documentType: document.documentType,
          errorMessage: error instanceof Error ? error.message : "Unknown extraction error",
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

  app.post("/api/documents/extract-tax-return", isAuthenticated, upload.single("file"), verifyFileSignature, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { documentYear, applicationId } = req.body;
      const userId = req.user!.id;

      if (applicationId) {
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, req.user!.role);
        if (!application) {
          return res.status(403).json({ error: "Access denied to the specified application" });
        }
      }

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: "tax_return",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      const extractedData = await extractTaxReturnData(req.file.path, documentYear);

      await storage.updateDocument(document.id, {
        // "verified" is reserved for human review (POST /api/documents/:id/verify).
        // The model's self-reported confidence only advances a doc to "verifying" —
        // an uploaded document must never be able to mark itself verified.
        status: extractedData.confidence === "high" ? "verifying" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
          modelId: extractedData.modelId,
          promptVersion: extractedData.promptVersion,
        }),
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Tax Return Extracted",
          description: `Tax return for ${documentYear || extractedData.documentYear} extracted with ${extractedData.confidence} confidence.`,
          performedBy: userId,
          metadata: { documentId: document.id, extractedData },
        });
        await matchConditionsForUpload(applicationId, "tax_return", req.file.originalname, userId);
      }

      res.status(201).json({
        document,
        extraction: {
          documentType: "tax_return",
          ...extractedData,
        },
      });
    } catch (error) {
      console.error("Tax return extraction error:", error);
      res.status(500).json({ error: "Failed to extract tax return" });
    }
  });

  app.post("/api/documents/extract-paystub", isAuthenticated, upload.single("file"), verifyFileSignature, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { applicationId } = req.body;
      const userId = req.user!.id;

      if (applicationId) {
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, req.user!.role);
        if (!application) {
          return res.status(403).json({ error: "Access denied to the specified application" });
        }
      }

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: "pay_stub",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      const extractedData = await extractPayStubData(req.file.path);

      await storage.updateDocument(document.id, {
        // "verified" is reserved for human review (POST /api/documents/:id/verify).
        // The model's self-reported confidence only advances a doc to "verifying" —
        // an uploaded document must never be able to mark itself verified.
        status: extractedData.confidence === "high" ? "verifying" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
          modelId: extractedData.modelId,
          promptVersion: extractedData.promptVersion,
        }),
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Pay Stub Extracted",
          description: `Pay stub extracted with ${extractedData.confidence} confidence. Gross pay: ${extractedData.grossPay ? '$' + extractedData.grossPay.toLocaleString() : 'not extracted'}`,
          performedBy: userId,
          metadata: { documentId: document.id, extractedData },
        });
        await matchConditionsForUpload(applicationId, "pay_stub", req.file.originalname, userId);
      }

      res.status(201).json({
        document,
        extraction: {
          documentType: "pay_stub",
          ...extractedData,
        },
      });
    } catch (error) {
      console.error("Pay stub extraction error:", error);
      res.status(500).json({ error: "Failed to extract pay stub" });
    }
  });

  app.post("/api/documents/extract-bank-statement", isAuthenticated, upload.single("file"), verifyFileSignature, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { applicationId } = req.body;
      const userId = req.user!.id;

      if (applicationId) {
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, req.user!.role);
        if (!application) {
          return res.status(403).json({ error: "Access denied to the specified application" });
        }
      }

      const document = await storage.createDocument({
        userId,
        applicationId: applicationId || null,
        documentType: "bank_statement",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        storagePath: req.file.path,
        status: "uploaded",
      });

      const extractedData = await extractBankStatementData(req.file.path);

      await storage.updateDocument(document.id, {
        // "verified" is reserved for human review (POST /api/documents/:id/verify).
        // The model's self-reported confidence only advances a doc to "verifying" —
        // an uploaded document must never be able to mark itself verified.
        status: extractedData.confidence === "high" ? "verifying" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: extractedData.extractedFields,
          confidence: extractedData.confidence,
          warnings: extractedData.warnings,
          modelId: extractedData.modelId,
          promptVersion: extractedData.promptVersion,
        }),
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Bank Statement Extracted",
          description: `Bank statement extracted with ${extractedData.confidence} confidence. Closing balance: ${extractedData.closingBalance ? '$' + extractedData.closingBalance.toLocaleString() : 'not extracted'}`,
          performedBy: userId,
          metadata: { documentId: document.id, extractedData },
        });
        await matchConditionsForUpload(applicationId, "bank_statement", req.file.originalname, userId);
      }

      res.status(201).json({
        document,
        extraction: {
          documentType: "bank_statement",
          ...extractedData,
        },
      });
    } catch (error) {
      console.error("Bank statement extraction error:", error);
      res.status(500).json({ error: "Failed to extract bank statement" });
    }
  });
}
