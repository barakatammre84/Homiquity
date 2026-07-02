import type { RequestHandler } from "express";
import { storage } from "./storage";

/**
 * ESIGN / Reg-Z consent gate.
 *
 * Blocks borrower-facing electronic delivery of a document until the borrower
 * holds an affirmative, unrevoked consent of the given type on the
 * application (borrower_consents — versioned template, IP/UA evidence,
 * SHA-256 content hash).
 *
 * The gate binds only when the requester IS the borrower: staff previewing a
 * document internally is work product, not consumer delivery, so staff and
 * partner requests pass through (their access is enforced separately by the
 * route's own authorization).
 *
 * Mount after isAuthenticated on routes with an :id or :applicationId param:
 *   app.get("/api/loan-applications/:id/loan-estimate",
 *           isAuthenticated, requireConsent("e_disclosure"), handler)
 *
 * Blocked requests get 403 { code: "CONSENT_REQUIRED", consentType } — the
 * client shows the consent card (ConsentGateCard) and retries after
 * acknowledgment.
 */
export function requireConsent(consentType: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const applicationId = (req.params.id ?? req.params.applicationId) as string | undefined;
      if (!applicationId) {
        return res.status(400).json({ error: "Application id required" });
      }

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const userId = (req.user as { id?: string } | undefined)?.id;
      if (!userId || application.userId !== userId) {
        return next();
      }

      const consent = await storage.getConsentByTypeAndApplication(consentType, applicationId);
      // getConsentByTypeAndApplication filters revocation but returns declined
      // rows too — an explicit decline must not satisfy the gate.
      if (!consent || consent.consentGiven !== true) {
        return res.status(403).json({
          error: "Please review and accept the disclosure agreement before viewing this document.",
          code: "CONSENT_REQUIRED",
          consentType,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
