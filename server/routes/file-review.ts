import type { Express, NextFunction, Response } from "express";
import { requireRole } from "../auth";
import { INTERNAL_STAFF_ROLES } from "@shared/roles";
import { DOCUMENT_REVIEW_ROLES } from "@shared/documentStatus";
import { saveFileReviewSchema } from "@shared/fileReview";
import { updateDocumentLineageSchema } from "@shared/documentLineage";
import { routeParam } from "../http/routeParams";
import { FileReviewError, getFileReview, saveFileReview } from "../services/fileReview";
import { DocumentLineageError, updateDocumentLineage } from "../services/documentLineage";
import { postgresErrorCode } from "../services/transactionRetry";
import { logAudit } from "../auditLog";

function reviewError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof FileReviewError || error instanceof DocumentLineageError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const databaseError = error as { constraint?: string; cause?: { constraint?: string } };
  const constraint = databaseError.cause?.constraint ?? databaseError.constraint;
  const code = postgresErrorCode(error);
  if (code === "40001" || code === "40P01" ||
      (code === "23505" && constraint === "file_review_application_version")) {
    res.status(409).json({ error: "The file or its review changed while saving. Refresh to see the current checkpoint." });
    return;
  }
  next(error);
}

export function registerFileReviewRoutes(app: Express) {
  app.get("/api/loan-applications/:id/file-review", requireRole(...INTERNAL_STAFF_ROLES), async (req, res, next) => {
    try {
      res.set("Cache-Control", "private, no-store");
      const id = routeParam(req, "id");
      const result = await getFileReview(id, req.user!);
      await logAudit(req, "file_review.viewed", "loan_application", id);
      res.json(result);
    } catch (error) {
      reviewError(error, res, next);
    }
  });

  app.post("/api/loan-applications/:id/file-review", requireRole(...DOCUMENT_REVIEW_ROLES), async (req, res, next) => {
    try {
      res.set("Cache-Control", "private, no-store");
      const parsed = saveFileReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Confirm your review of the current file before saving." });
        return;
      }
      const result = await saveFileReview(routeParam(req, "id"), req.user!, parsed.data.expectedRevision);
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      reviewError(error, res, next);
    }
  });

  app.patch(
    "/api/loan-applications/:id/documents/:documentId/lineage",
    requireRole(...DOCUMENT_REVIEW_ROLES),
    async (req, res, next) => {
      try {
        res.set("Cache-Control", "private, no-store");
        const parsed = updateDocumentLineageSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: "Choose a subject and use a valid document period." });
          return;
        }
        await updateDocumentLineage(
          routeParam(req, "id"),
          routeParam(req, "documentId"),
          req.user!,
          parsed.data,
        );
        res.json({ updated: true });
      } catch (error) {
        reviewError(error, res, next);
      }
    },
  );
}
