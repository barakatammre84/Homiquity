// Lending routes: Offers (LLPA + overlays), pricing breakdown, option lock.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { insertBorrowerDeclarationsSchema } from "@shared/schema";
import { isInternalStaffRole, isStaffRole } from "@shared/roles";
import { z } from "zod";
import { logAudit } from "../../auditLog";
import { verifyInternalStaffApplicationAccess } from "../borrower/access";
import { COMPENSATION_MODELS, resolveCompensation } from "@shared/compliance/loCompensation";
import { hasBorrowerConsent } from "../../consentGate";
import * as creditService from "../../services/creditService";
import { isDecisionGrade, type DataProvenance } from "@shared/dataProvenance";
import { computeOffers, type BorrowerPricingProfile } from "../../services/pricingAdapter";
import { toBorrowerOfferViews } from "@shared/borrowerOfferView";
import { routeParam } from "../../http/routeParams";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

// Intake validation lives in shared/schema/lending.ts (loanApplicationIntakeSchema),
// derived from the same base schema the funnel validates with client-side — the
// server rejects exactly what the client rejects, and "not_sure" credit maps to
// the named CREDIT_SCORE_UNKNOWN_DEFAULT instead of a silent clamp.

export function registerPricingRoutes(
  app: Express,
  storage: IStorage,
) {
  // -------------------------------------------------------------------------
  // Loan-originator compensation election (Reg Z 1026.36(d)(2)).
  //
  // Nothing downstream can price a file without this: the fee schedule refuses
  // to build closing costs, the Loan Estimate refuses to generate, and the
  // scenario simulator lists it as a missing item. That is deliberate — the
  // alternative is guessing the model, which is the dual-compensation error
  // itself (a borrower-paid origination fee charged alongside lender-paid
  // compensation).
  //
  // Internal staff only, assignment-scoped, and frozen once the Loan Estimate
  // has issued: changing who pays the originator after disclosure is a
  // changed-circumstance/tolerance event, not a quiet field edit.
  // -------------------------------------------------------------------------
  const compensationSchema = z.object({
    model: z.enum(COMPENSATION_MODELS),
    bps: z.number().int().min(0).max(1000),
  });

  app.patch("/api/loan-applications/:id/compensation", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const id = routeParam(req, "id");

      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can elect the compensation model" });
      }
      const allowed = await verifyInternalStaffApplicationAccess(storage, id, user.id, user.role);
      if (!allowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const parsed = compensationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
      }

      const application = await storage.getLoanApplication(id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { model, bps } = parsed.data;
      const alreadyElected = resolveCompensation(
        application.loCompensationModel,
        application.loCompensationBps,
      );
      const isChange = !!alreadyElected && (alreadyElected.model !== model || alreadyElected.bps !== bps);

      if (isChange && application.leIssuedDate) {
        return res.status(409).json({
          error:
            "The Loan Estimate has already issued for this file. Changing the compensation model now " +
            "requires a documented changed circumstance and a redisclosure — it cannot be edited here.",
          code: "compensation_locked_after_le",
        });
      }

      const updated = await storage.updateLoanApplication(id, {
        loCompensationModel: model,
        loCompensationBps: bps,
      });
      if (!updated) {
        return res.status(404).json({ error: "Application not found" });
      }

      logAudit(req, "loan_application.compensation_elected", "loan_application", id, {
        model,
        bps,
        previousModel: alreadyElected?.model ?? null,
        previousBps: alreadyElected?.bps ?? null,
      });

      res.json({
        loCompensationModel: updated.loCompensationModel,
        loCompensationBps: updated.loCompensationBps,
      });
    } catch (error) {
      console.error("Elect compensation error:", error);
      res.status(500).json({ error: "Failed to record the compensation election" });
    }
  });

  app.get("/api/loan-applications/:id/offers", isAuthenticated, async (req, res) => {
    try {
      const application = await storage.getLoanApplicationWithAccess(
        routeParam(req, "id"),
        req.user!.id,
        req.user!.role,
      );
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const qualifier = isDecisionGrade(application.financialDataProvenance as DataProvenance)
        ? "VERIFIED"
        : "PRELIMINARY";
      const pricedAt = new Date().toISOString();
      const lockTermDays = Math.max(15, Math.min(90, parseInt(String(req.query.lockTerm)) || 30));

      const purchasePrice = parseFloat(String(application.purchasePrice ?? "0"));
      const downPayment = parseFloat(String(application.downPayment ?? "0"));
      const loanAmount = purchasePrice - downPayment;
      const missingItems: string[] = [];
      if (!purchasePrice || purchasePrice <= 0) missingItems.push("Purchase price");
      if (isNaN(downPayment) || loanAmount <= 0) missingItems.push("Down payment below purchase price");
      if (!application.creditScore) missingItems.push("Credit score");

      const base = { qualifier, indicative: qualifier === "PRELIMINARY", pricedAt, lockTermDays };
      if (missingItems.length > 0) {
        return res.json({ ...base, status: "INSUFFICIENT_PROFILE", missingItems, offers: [], lenderCount: 0, inputs: null, assumptions: [] });
      }

      // VA products are only priced for VA-eligible borrowers.
      const productTypes = ["CONVENTIONAL", "FHA", "JUMBO", "ARM", ...(application.isVeteran ? ["VA"] : [])];

      const profile: BorrowerPricingProfile = {
        creditScore: application.creditScore!,
        loanAmount,
        propertyValue: purchasePrice,
        propertyType: (application.propertyType as BorrowerPricingProfile["propertyType"]) || "single_family",
        occupancyType: "primary_residence",
        loanPurpose: (application.loanPurpose as BorrowerPricingProfile["loanPurpose"]) || "purchase",
        isFirstTimeHomeBuyer: application.isFirstTimeBuyer ?? false,
        borrowerIncome: parseFloat(String(application.annualIncome ?? "0")),
        lockTermDays,
        productTypes,
      };

      // Out-of-matrix profiles (e.g. LLPA grid has no band for this LTV) are a
      // pricing gap, not a server error — surface them as unpriceable.
      let offers: Awaited<ReturnType<typeof computeOffers>> = [];
      try {
        offers = await computeOffers(storage, profile);
      } catch (pricingErr) {
        console.warn(`[Offers] Pricing matrices do not cover application ${application.id}:`, pricingErr);
        return res.json({
          ...base,
          status: "UNPRICEABLE_PROFILE",
          missingItems: ["Live pricing is not available for this loan profile yet — your loan team will quote it directly."],
          offers: [],
          lenderCount: 0,
          inputs: null,
          assumptions: [],
        });
      }

      // Borrower transparency doctrine: wholesale-lender identity never
      // reaches a client-role caller. Staff (who work the lender relationships)
      // get the raw ComputedOffer; borrowers get the whitelisted view with
      // neutral "Option A/B/C" labels. Masking lives here, server-side — the
      // client never receives what it must not show.
      const revealLenderIdentity = isStaffRole(req.user!.role);
      const lenderCount = new Set(offers.map((o) => o.lenderId)).size;

      res.json({
        ...base,
        status: offers.length > 0 ? "PRICED" : "NO_ACTIVE_RATE_SHEETS",
        lenderCount,
        inputs: {
          creditScore: profile.creditScore,
          loanAmount,
          ltv: Number(((loanAmount / purchasePrice) * 100).toFixed(1)),
          propertyType: profile.propertyType,
          occupancyType: profile.occupancyType,
          productTypes,
        },
        assumptions: [
          `${lockTermDays}-day rate lock`,
          "Primary residence occupancy",
          qualifier === "PRELIMINARY"
            ? "Pricing is indicative — based on your self-reported profile, not a rate quote or a commitment to lend"
            : "Pricing reflects your verified profile; final terms set at rate lock",
          "Taxes and insurance estimated; exact escrow set at Loan Estimate",
        ],
        missingItems: [],
        offers: revealLenderIdentity ? offers : toBorrowerOfferViews(offers),
      });
    } catch (error) {
      console.error("Market offers error:", error);
      res.status(500).json({ error: "Failed to price offers" });
    }
  });

  // Rate transparency: deterministic decomposition of a quoted rate into its
  // base rate + Fannie-style LLPA components, so the borrower sees exactly
  // why their rate is their rate (points ÷ 4 ≈ rate-equivalent adjustment).
  app.get("/api/loan-options/:id/pricing-breakdown", isAuthenticated, async (req, res) => {
    try {
      const option = await storage.getLoanOption(routeParam(req, "id"));
      if (!option) {
        return res.status(404).json({ error: "Loan option not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(option.applicationId, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { calculateLLPA } = await import("../../pricing");
      const loanAmount = parseFloat(String(option.loanAmount));
      const creditScore = application.creditScore ?? 680;
      const ltv = parseFloat(String(application.ltvRatio ?? "80"));
      const llpa = await calculateLLPA(
        loanAmount,
        creditScore,
        ltv,
        (application.propertyType as "single_family" | "condo" | "townhouse" | "multi_family") || "single_family",
        "primary_residence",
        application.isFirstTimeBuyer ?? false,
        parseFloat(String(application.annualIncome ?? "0")),
        0,
      );

      const quotedRate = parseFloat(String(option.interestRate));
      const rateEquivalent = llpa.totalLLPA / 4;
      res.json({
        optionId: option.id,
        loanType: option.loanType,
        finalRate: quotedRate,
        baseRate: Number((quotedRate - rateEquivalent).toFixed(3)),
        adjustments: {
          creditScoreAndLtv: llpa.baseLLPA,
          propertyType: llpa.propertyTypeAdjustment,
          condo: llpa.condoAdjustment,
          firstTimeBuyerWaiver: llpa.fthbWaiver,
        },
        totalLlpaPoints: llpa.totalLLPA,
        rateEquivalent: Number(rateEquivalent.toFixed(3)),
        llpaFeeAmount: llpa.pricing.lLPAFeeAmount,
        inputs: { creditScore, ltv: Number(ltv.toFixed(1)), loanAmount },
      });
    } catch (error) {
      console.error("Pricing breakdown error:", error);
      res.status(500).json({ error: "Failed to compute pricing breakdown" });
    }
  });

  app.post("/api/loan-options/:id/lock", isAuthenticated, async (req, res) => {
    try {
      const existing = await storage.getLoanOption(routeParam(req, "id"));
      if (!existing) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      const application = await storage.getLoanApplicationWithAccess(existing.applicationId, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Reg Z anti-steering: a borrower may not select/lock an option until
      // they have acknowledged the loan-options disclosure. Staff locking on
      // the borrower's behalf is unaffected (their obligation is procedural).
      if (application.userId === req.user!.id) {
        const acknowledged = await hasBorrowerConsent("anti_steering", application.id);
        if (!acknowledged) {
          const { logFriction } = await import("../../services/frictionLog");
          logFriction("anti_steering_blocked", {
            userId: req.user!.id,
            applicationId: application.id,
          });
          return res.status(403).json({
            error: "Please review the loan options disclosure before locking a rate.",
            code: "CONSENT_REQUIRED",
            consentType: "anti_steering",
          });
        }
      }

      const option = await storage.lockLoanOption(routeParam(req, "id"));
      if (!option) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      await storage.createDealActivity({
        applicationId: option.applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: `Your ${option.interestRate}% rate has been locked for 30 days.`,
        performedBy: req.user!.id,
      });

      res.json(option);
    } catch (error) {
      console.error("Lock rate error:", error);
      res.status(500).json({ error: "Failed to lock rate" });
    }
  });

  // MISMO 3.4 XML Export Route - GSE compliant loan delivery format.
  // Internal staff only: the XML carries the full SSN and DOB for GSE delivery,
  // and submitting to DU/LP is not a partner-facing action, so broker/lender
  // are excluded (GLBA/Reg B data minimization).
}
