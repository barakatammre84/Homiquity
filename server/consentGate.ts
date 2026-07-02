import type { RequestHandler } from "express";
import { db } from "./db";
import { consentTemplates } from "@shared/schema";
import { and, eq } from "drizzle-orm";
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
/** Does the application carry an affirmative, unrevoked consent of this type? */
export async function hasBorrowerConsent(
  consentType: string,
  applicationId: string,
): Promise<boolean> {
  const consent = await storage.getConsentByTypeAndApplication(consentType, applicationId);
  return !!consent && consent.consentGiven === true;
}

/**
 * Anti-steering loan-options disclosure (Reg Z §1026.36(e)(3)). Single source
 * of truth for the template content; ensured idempotently at server boot so
 * existing databases (whose consent_templates were seeded before this
 * template existed) receive it without a manual step.
 */
const ANTI_STEERING_TEMPLATE = {
  consentType: "anti_steering",
  version: "1.0",
  title: "Anti-Steering Loan Options Disclosure",
  shortDescription:
    "Confirms you were shown loan options in your interest, including the lowest-rate and lowest-cost alternatives",
  fullText: `ANTI-STEERING LOAN OPTIONS DISCLOSURE

Federal law (Regulation Z, 12 C.F.R. §1026.36(e)) prohibits mortgage brokers from steering you toward a loan because it results in greater compensation to the broker, unless the loan is in your interest.

The loan options presented to you include, for the type of transaction you requested:

1. The loan with the LOWEST INTEREST RATE for which you likely qualify;
2. The loan with the LOWEST TOTAL DOLLAR AMOUNT of discount points, origination points, and origination fees; and
3. The loan with the lowest interest rate that has NO risky features — no negative amortization, no prepayment penalty, no balloon payment in the first 7 years, no demand feature, no shared equity, and no shared appreciation.

Homiquity obtains these options from the wholesale lenders with whom we regularly do business. Our compensation is not based on the interest rate or terms of your loan, other than the loan amount.

By acknowledging below, you confirm that these loan options were presented to you before you selected or locked a loan.`,
  regulatoryReference: "Reg Z §1026.36(e)(3)",
  isActive: true,
  effectiveDate: new Date("2026-07-01T00:00:00Z"),
} as const;

let templatesEnsured: Promise<void> | null = null;

/** Idempotently insert compliance templates this module gates on. Non-fatal. */
export function ensureComplianceTemplates(): Promise<void> {
  if (!templatesEnsured) {
    templatesEnsured = (async () => {
      try {
        const [existing] = await db
          .select({ id: consentTemplates.id })
          .from(consentTemplates)
          .where(
            and(
              eq(consentTemplates.consentType, ANTI_STEERING_TEMPLATE.consentType),
              eq(consentTemplates.isActive, true),
            ),
          )
          .limit(1);
        if (!existing) {
          await db.insert(consentTemplates).values({ ...ANTI_STEERING_TEMPLATE });
          console.log("[consent] Seeded anti-steering disclosure template (v1.0)");
        }
      } catch (err) {
        templatesEnsured = null; // retry on next call
        console.error("[consent] Failed to ensure compliance templates (non-fatal):", err);
      }
    })();
  }
  return templatesEnsured;
}

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
