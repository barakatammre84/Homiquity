// Lending routes: Borrower declarations + document upload/list.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { insertBorrowerDeclarationsSchema, type User } from "@shared/schema";
import { isStaffRole } from "@shared/roles";
import { toDocumentViewForRole, toDocumentViewsForRole } from "@shared/borrowerDocumentView";
import { z } from "zod";
import { allowedUploadTypes } from "../utils";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@shared/uploads";
import { DOCUMENT_STATUS } from "@shared/documentStatus";
import { logAudit } from "../../auditLog";
import * as creditService from "../../services/creditService";
import { routeParams } from "../../http/routeParams";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

// Intake validation lives in shared/schema/lending.ts (loanApplicationIntakeSchema),
// derived from the same base schema the funnel validates with client-side — the
// server rejects exactly what the client rejects, and "not_sure" credit maps to
// the named CREDIT_SCORE_UNKNOWN_DEFAULT instead of a silent clamp.

export function registerDocumentRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/loan-applications/:id/declarations", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
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
      const { id } = routeParams(req);
      
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

  // One ingestion mode, one registration path: the file goes browser → object
  // storage via a presigned URL (/api/uploads/request-url), then this endpoint
  // registers its metadata. The old multipart leg (multer → serverless disk)
  // was removed — files written to Vercel's disk vanish on redeploy (roadmap #1).
  // Every accepted upload becomes a document record — unsolicited files are
  // stamped onto the borrower's latest application instead of being lost.
  const uploadRegistrationSchema = z.object({
    objectPath: z.string().regex(/^\/objects\/[^\s]+$/, "objectPath must be a normalized /objects/ path"),
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES, `File exceeds the ${MAX_UPLOAD_LABEL} limit`),
    mimeType: z.string().refine((m) => allowedUploadTypes.includes(m), "Unsupported file type"),
    documentType: z.string().max(50).optional(),
    applicationId: z.string().optional(),
    description: z.string().max(500).optional(),
  });

  const rejectMultipart = (req: any, res: any, next: any) => {
    if (!req.is("multipart/form-data")) return next();
    return res.status(400).json({
      error:
        "Multipart uploads are not supported. Request a presigned URL from POST /api/uploads/request-url, PUT the file there, then register it here as JSON.",
    });
  };

  app.post("/api/documents/upload", isAuthenticated, rejectMultipart, async (req, res) => {
    try {
      const user = req.user as User;
      const userId = user.id;

      const parsed = uploadRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "No file uploaded",
          details: parsed.error.flatten().fieldErrors,
          acceptedTypes: allowedUploadTypes,
        });
      }
      // Object-level authorization + content verification (P0). The client
      // supplies the storage path, so before we trust it: confirm the object
      // exists, that this user owns it (not someone else's object — IDOR),
      // and that its REAL content-type/size match the allow-list rather than
      // the client-declared MIME (magic-byte parity for the JSON path).
      const { ObjectStorageService } = await import("../../integrations/object_storage/objectStorage");
      const objectStorage = new ObjectStorageService();
      const verification = await objectStorage.verifyAndClaimObject(parsed.data.objectPath, userId);
      if (verification.configured && !verification.ok) {
        return res.status(403).json({ error: verification.reason });
      }
      if (verification.configured && verification.ok) {
        if (verification.contentType && !allowedUploadTypes.includes(verification.contentType)) {
          return res.status(400).json({ error: "Unsupported file type", acceptedTypes: allowedUploadTypes });
        }
        if (verification.size !== undefined && verification.size > MAX_UPLOAD_BYTES) {
          return res.status(400).json({ error: `File exceeds the ${MAX_UPLOAD_LABEL} limit` });
        }
      } else if (process.env.NODE_ENV === "production") {
        // Storage misconfigured in prod: fail CLOSED rather than trust the
        // client's path blindly.
        return res.status(503).json({ error: "Uploads are temporarily unavailable" });
      }

      const fileMeta = {
        fileName: parsed.data.fileName,
        // Prefer storage-verified size/type when available; fall back to the
        // client values in unconfigured dev.
        fileSize:
          verification.configured && verification.ok && verification.size !== undefined
            ? verification.size
            : parsed.data.fileSize,
        mimeType:
          verification.configured && verification.ok && verification.contentType
            ? verification.contentType
            : parsed.data.mimeType,
        storagePath: parsed.data.objectPath,
      };
      const documentType = parsed.data.documentType || "other";
      const requestedApplicationId = parsed.data.applicationId;
      const description = parsed.data.description;

      if (requestedApplicationId) {
        const application = await storage.getLoanApplicationWithAccess(requestedApplicationId, userId, user.role);
        if (!application) {
          return res.status(403).json({ error: "You do not have access to this application" });
        }
      }

      // Never let an unsolicited borrower upload float free of the loan file:
      // default to the borrower's most recent application.
      let applicationId = requestedApplicationId || null;
      if (!applicationId && !isStaffRole(user.role)) {
        const apps = await storage.getLoanApplicationsByUser(userId);
        applicationId = apps[0]?.id ?? null;
      }

      // Soft duplicate detection (same name + size for this borrower). Never
      // blocks — the response carries the hint so the UI can surface it.
      const existingDocs = await storage.getDocumentsByUser(userId);
      const similar = existingDocs.find(
        (d) => d.fileName === fileMeta.fileName && d.fileSize === fileMeta.fileSize,
      );

      const document = await storage.createDocument({
        userId,
        applicationId,
        documentType,
        fileName: fileMeta.fileName,
        fileSize: fileMeta.fileSize,
        mimeType: fileMeta.mimeType,
        storagePath: fileMeta.storagePath,
        status: DOCUMENT_STATUS.UPLOADED,
        notes: description || null,
      });

      logAudit(req, "document.uploaded", "document", document.id, {
        applicationId,
        documentType,
        fileName: fileMeta.fileName,
        duplicateOf: similar?.id ?? null,
      });

      if (applicationId) {
        await storage.createDealActivity({
          applicationId,
          activityType: "document_uploaded",
          title: "Document Uploaded",
          description: `${fileMeta.fileName} has been uploaded.`,
          performedBy: userId,
        });

        // Emit document uploaded event for Task Engine
        const { taskEventEmitter } = await import("../../services/taskEventEmitter");
        await taskEventEmitter.emitDocumentEvent("DOCUMENT_UPLOADED", {
          applicationId,
          documentId: document.id,
          documentType,
          triggeredBy: userId,
        });

        // Zero-touch: move matching outstanding conditions to "submitted"
        // and notify the deal team (clearing stays a human decision).
        try {
          const { matchUploadedDocumentToConditions } = await import("../../pipelineEngine");
          await matchUploadedDocumentToConditions({
            applicationId,
            documentType,
            fileName: fileMeta.fileName,
            uploadedBy: userId,
          });
        } catch (matchErr) {
          console.error("[Documents] Condition matching failed (non-fatal):", matchErr);
        }
      }

      // Autopilot gate: when the agent is active (and this file is in pilot
      // scope), the orchestrator handles perception + package-gap follow-ups +
      // narration; otherwise fall back to today's bare auto-extraction. The
      // global `enabled` check is cached, so an upload pays no extra query when
      // Autopilot is off (the default).
      let autopilotEnabled = false;
      if (applicationId) {
        const { getAutopilotConfig, isAutopilotEnabled } = await import("../../services/autopilot/config");
        if ((await getAutopilotConfig()).enabled) {
          const appForGate = await storage.getLoanApplication(applicationId);
          autopilotEnabled = await isAutopilotEnabled(appForGate?.loanOfficerId);
        }
      }

      // Fire-and-forget extraction for types that need no extra inputs — the
      // record is created either way; extraction enriches it in the background.
      const AUTO_EXTRACT: Record<string, "extractPayStubData" | "extractBankStatementData" | "extractLeaseData"> = {
        pay_stub: "extractPayStubData",
        bank_statement: "extractBankStatementData",
        lease_agreement: "extractLeaseData",
      };
      const extractor = AUTO_EXTRACT[documentType];
      if (autopilotEnabled && applicationId) {
        const { runAutopilotForDocument } = await import("../../services/autopilot/orchestrator");
        void runAutopilotForDocument({
          applicationId,
          documentId: document.id,
          documentType,
          storagePath: document.storagePath,
          fileSize: document.fileSize,
          triggeredBy: userId,
        }).catch((err) =>
          console.warn(`[Autopilot] Document run failed for ${document.id} (non-fatal):`, err?.message || err),
        );
      } else if (extractor) {
        (async () => {
          const svc = await import("../../extractionService");
          const extracted = await svc[extractor](document.storagePath);
          const { recordCoarseExtraction } = await import("../../services/documentConfidence");
          const { humanReviewRequired } = await recordCoarseExtraction({
            documentId: document.id,
            documentType,
            applicationId: applicationId || null,
            confidence: extracted.confidence,
            extractedFields: extracted.extractedFields,
            fileSize: document.fileSize ?? undefined,
          });
          await storage.updateDocument(document.id, {
            // MR-2: AI confidence never auto-verifies. A doc that clears the
            // review threshold is staged "verifying" for a human to confirm via
            // POST /api/documents/:id/verify; the rest stay "uploaded".
            status: !humanReviewRequired ? DOCUMENT_STATUS.VERIFYING : DOCUMENT_STATUS.UPLOADED,
            notes: JSON.stringify({
              extractedAt: new Date().toISOString(),
              extractedFields: extracted.extractedFields,
              confidence: extracted.confidence,
              humanReviewRequired,
              warnings: extracted.warnings,
            }),
          });
        })().catch((err) =>
          console.warn(`[Documents] Auto-extraction failed for ${document.id} (non-fatal):`, err?.message || err),
        );
      }

      res.status(201).json({
        ...toDocumentViewForRole(document, user.role),
        similarDocument: similar
          ? { id: similar.id, fileName: similar.fileName, uploadedAt: similar.createdAt }
          : null,
      });
    } catch (error) {
      console.error("Document upload error:", error);
      try {
        const { logFriction } = await import("../../services/frictionLog");
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
      res.json(toDocumentViewsForRole(documents, (req.user as User).role));
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

}
