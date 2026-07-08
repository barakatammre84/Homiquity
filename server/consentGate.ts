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
 * User-scoped variant for consents that exist before any application does
 * (e.g. tax_document_use in the renter incubator). borrower_consents rows
 * with a null applicationId are exactly this case — POST /api/consents
 * already records them.
 */
export async function hasUserConsent(
  consentType: string,
  userId: string,
): Promise<boolean> {
  const consent = await storage.getConsentByTypeAndUser(consentType, userId);
  return !!consent && consent.consentGiven === true;
}

/**
 * Anti-steering loan-options disclosure (Reg Z §1026.36(e)(3)). Single source
 * of truth for the template content; ensured idempotently at server boot so
 * existing databases (whose consent_templates were seeded before this
 * template existed) receive it without a manual step.
 */
// IMPORTANT: This disclosure must only assert options the pricing engine
// actually computes and labels. `computeOffers` in services/pricingAdapter.ts
// currently labels exactly two options — LOWEST_RATE and LOWEST_PAYMENT (lowest
// total cost). It does NOT yet evaluate risk features (no negative-amortization/
// prepayment-penalty/balloon columns exist on rateSheetProducts), so the text
// must NOT claim a third "lowest rate with no risky features" option was shown.
// When those columns + a NO_RISKY_FEATURES label are added, restore the third
// option here and bump the version so the full §1026.36(e)(3) safe harbor applies.
const ANTI_STEERING_TEMPLATE = {
  consentType: "anti_steering",
  version: "1.1",
  title: "Anti-Steering Loan Options Disclosure",
  shortDescription:
    "Confirms you were shown the lowest-rate and lowest-cost loan options in your interest",
  fullText: `ANTI-STEERING LOAN OPTIONS DISCLOSURE

Federal law (Regulation Z, 12 C.F.R. §1026.36(e)) prohibits mortgage brokers from steering you toward a loan because it results in greater compensation to the broker, unless the loan is in your interest.

For the type of transaction you requested, the loan options presented to you include:

1. The loan with the LOWEST INTEREST RATE for which you likely qualify; and
2. The loan with the LOWEST TOTAL DOLLAR AMOUNT of discount points, origination points, and origination fees.

Homiquity obtains these options from the wholesale lenders with whom we regularly do business. Our compensation is not based on the interest rate or terms of your loan, other than the loan amount.

By acknowledging below, you confirm that these loan options were presented to you before you selected or locked a loan.`,
  regulatoryReference: "Reg Z §1026.36(e)",
  isActive: true,
  effectiveDate: new Date("2026-07-03T00:00:00Z"),
} as const;

/**
 * Authorization for using a self-uploaded tax return for readiness insights.
 * The taxpayer uploads their own return (consumer-direct), so IRC §7216
 * preparer-disclosure rules do not attach; this consent is purpose-limitation
 * and UDAAP hygiene, not a §7216 form. The "educational estimate only" line is
 * a hard requirement — the feature must never present as a prequalification
 * (Reg Z advertising / Reg N MAP Rule).
 */
const TAX_DOCUMENT_USE_TEMPLATE = {
  consentType: "tax_document_use",
  version: "1.0",
  title: "Tax Document Use Authorization",
  shortDescription:
    "Lets us read income figures from the tax return you upload to build your readiness snapshot",
  fullText: `TAX DOCUMENT USE AUTHORIZATION

You are choosing to upload your own tax return to Homiquity. By agreeing, you authorize us to read income figures from it (such as W-2 wages, self-employment income, and rental income) and use them only to:

1. Show you an educational home-buying readiness snapshot; and
2. Let our licensed staff review loan programs that may fit your situation, so they can discuss them with you if you ask.

We do not sell your tax information or share it with outside companies for their own marketing. Your document is encrypted and access to it is logged.

You can revoke this authorization at any time, and you can ask us to delete the uploaded document.

THIS PRODUCES AN EDUCATIONAL ESTIMATE ONLY. It is not a prequalification, preapproval, loan offer, or commitment to lend. Any figures used in an actual loan decision are separately verified during a loan application.`,
  regulatoryReference: "GLBA privacy; Reg N (MAP Rule) advertising limits",
  isActive: true,
  effectiveDate: new Date("2026-07-06T00:00:00Z"),
} as const;

/** Templates this module seeds and rolls forward at boot. */
const COMPLIANCE_TEMPLATES = [ANTI_STEERING_TEMPLATE, TAX_DOCUMENT_USE_TEMPLATE] as const;

let templatesEnsured: Promise<void> | null = null;

/** Idempotently insert compliance templates this module gates on. Non-fatal. */
export function ensureComplianceTemplates(): Promise<void> {
  if (!templatesEnsured) {
    templatesEnsured = (async () => {
      try {
        for (const template of COMPLIANCE_TEMPLATES) {
          const [existing] = await db
            .select({ id: consentTemplates.id, version: consentTemplates.version })
            .from(consentTemplates)
            .where(
              and(
                eq(consentTemplates.consentType, template.consentType),
                eq(consentTemplates.isActive, true),
              ),
            )
            .limit(1);
          if (!existing) {
            await db.insert(consentTemplates).values({ ...template });
            console.log(
              `[consent] Seeded ${template.consentType} template (v${template.version})`,
            );
          } else if (existing.version !== template.version) {
            // Roll forward a stale disclosure. Deactivate (never delete) the old
            // template so historical borrower_consents keep their templateId/
            // templateVersion snapshot, then activate the corrected text. This is
            // what makes a text correction (e.g. the anti-steering v1.0 over-claim
            // of a third "no risky features" option) actually reach production,
            // since the seed above is insert-if-missing only.
            await db
              .update(consentTemplates)
              .set({ isActive: false, expirationDate: new Date() })
              .where(
                and(
                  eq(consentTemplates.consentType, template.consentType),
                  eq(consentTemplates.isActive, true),
                ),
              );
            await db.insert(consentTemplates).values({ ...template });
            console.log(
              `[consent] Rolled ${template.consentType} template forward ${existing.version} -> ${template.version}`,
            );
          }
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
        const { logFriction } = await import("./services/frictionLog");
        logFriction("consent_gate_blocked", {
          userId,
          applicationId,
          detail: consentType,
          metadata: { path: req.path },
        });
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
