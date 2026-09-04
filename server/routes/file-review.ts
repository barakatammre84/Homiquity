import type { Express, NextFunction, Response } from "express";
import { requireRole } from "../auth";
import { INTERNAL_STAFF_ROLES } from "@shared/roles";
import { DOCUMENT_REVIEW_ROLES } from "@shared/documentStatus";
import { saveFileReviewSchema } from "@shared/fileReview";
import { routeParam } from "../http/routeParams";
import { FileReviewError, getFileReview, saveFileReview } from "../services/fileReview";
import { logAudit } from "../auditLog";

function reviewError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof FileReviewError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const wrapped = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const databaseError = wrapped?.cause ?? wrapped;
  if (databaseError?.code === "40001" ||
      (databaseError?.code === "23505" && databaseError.constraint === "file_review_application_version")) {
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
}
