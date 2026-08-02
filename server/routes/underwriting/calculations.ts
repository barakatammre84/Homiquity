// Underwriting routes: Deterministic engine calls: income/assets/liabilities/DTI, property eligibility, pricing.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { qualifyIncome, verifyAssets, assessLiabilities, calculateDTI, checkPropertyEligibility } from "../../underwriting";
import { calculateLLPA, getAreaMedianIncome } from "../../pricing";
import * as creditService from "../../services/creditService";
import { routeParams } from "../../http/routeParams";

export function registerCalculationRoutes(
  app: Express,
  storage: IStorage,
) {
  // ========================================================================
  // UNDERWRITING ENGINE API ENDPOINTS
  // ========================================================================

  app.post("/api/loan-applications/:id/calculate-income", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const employment = await storage.getEmploymentHistory(id);
      const otherIncome = await storage.getOtherIncomeSources(id);

      const result = qualifyIncome(employment, otherIncome, {
        annualIncome: application.annualIncome || "0",
        employmentYears: application.employmentYears || 0,
      });

      res.json(result);
    } catch (error) {
      console.error("Calculate income error:", error);
      res.status(500).json({ error: "Failed to calculate income" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-assets", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const assets = await storage.getUrlaAssets(id);
      const downPaymentAndClosing = req.body.downPaymentAndClosing ? 
        parseFloat(req.body.downPaymentAndClosing) : 0;

      const result = await verifyAssets(assets, downPaymentAndClosing);
      res.json(result);
    } catch (error) {
      console.error("Calculate assets error:", error);
      res.status(500).json({ error: "Failed to calculate assets" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-liabilities", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const liabilities = await storage.getUrlaLiabilities(id);
      const result = assessLiabilities(liabilities);
      res.json(result);
    } catch (error) {
      console.error("Calculate liabilities error:", error);
      res.status(500).json({ error: "Failed to calculate liabilities" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-dti", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Presence check (not truthiness): a legitimate 0 housing expense or 0
      // non-housing debt must be accepted, not rejected as "missing".
      const { qualifyingIncome, housingExpense, nonHousingDebts } = req.body;
      if (qualifyingIncome == null || housingExpense == null || nonHousingDebts == null) {
        return res.status(400).json({ error: "qualifyingIncome, housingExpense, and nonHousingDebts are required" });
      }

      const parsedIncome = parseFloat(qualifyingIncome);
      const parsedHousing = parseFloat(housingExpense);
      const parsedDebts = parseFloat(nonHousingDebts);
      if (isNaN(parsedIncome) || isNaN(parsedHousing) || isNaN(parsedDebts)) {
        return res.status(400).json({ error: "qualifyingIncome, housingExpense, and nonHousingDebts must be valid numbers" });
      }
      if (parsedIncome <= 0) {
        return res.status(400).json({ error: "qualifyingIncome must be greater than zero" });
      }
      if (parsedHousing < 0 || parsedDebts < 0) {
        return res.status(400).json({ error: "housingExpense and nonHousingDebts cannot be negative" });
      }

      const result = await calculateDTI(parsedIncome, parsedHousing, parsedDebts);

      res.json(result);
    } catch (error) {
      console.error("Calculate DTI error:", error);
      res.status(500).json({ error: "Failed to calculate DTI" });
    }
  });

  app.post("/api/loan-applications/:id/check-property-eligibility", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const {
        borrowerAssets,
        borrowerIncome,
        borrowerDebts,
        propertyPrice,
        propertyType = "single_family",
        propertyTaxAnnual,
        hoaMonthly = 0,
        homeInsuranceEstimate = 150,
      } = req.body;

      // Presence check (not truthiness): $0 assets or $0 debts are legitimate
      // inputs and must not be rejected as "missing".
      if (borrowerAssets == null || borrowerIncome == null || borrowerDebts == null || propertyPrice == null) {
        return res.status(400).json({ error: "borrowerAssets, borrowerIncome, borrowerDebts, and propertyPrice are required" });
      }

      const pAssets = parseFloat(borrowerAssets);
      const pIncome = parseFloat(borrowerIncome);
      const pDebts = parseFloat(borrowerDebts);
      const pPrice = parseFloat(propertyPrice);
      const pHoa = parseFloat(hoaMonthly);
      const pInsurance = parseFloat(homeInsuranceEstimate);
      if ([pAssets, pIncome, pDebts, pPrice, pHoa, pInsurance].some(isNaN)) {
        return res.status(400).json({ error: "All numeric parameters must be valid numbers" });
      }
      if (pIncome <= 0) {
        return res.status(400).json({ error: "borrowerIncome must be greater than zero" });
      }
      if (pPrice <= 0) {
        return res.status(400).json({ error: "propertyPrice must be greater than zero" });
      }
      if (pAssets < 0 || pDebts < 0) {
        return res.status(400).json({ error: "borrowerAssets and borrowerDebts cannot be negative" });
      }

      const repFico = application.creditScore ?? undefined;
      const result = await checkPropertyEligibility(
        pAssets,
        pIncome,
        pDebts,
        pPrice,
        propertyType,
        propertyTaxAnnual ? parseFloat(propertyTaxAnnual) : undefined,
        pHoa,
        pInsurance,
        undefined,
        repFico
      );

      res.json(result);
    } catch (error) {
      console.error("Check property eligibility error:", error);
      res.status(500).json({ error: "Failed to check property eligibility" });
    }
  });

  app.post("/api/loan-applications/:id/calculate-pricing", isAuthenticated, async (req, res) => {
    try {
      const { id } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const {
        loanAmount,
        creditScore,
        ltv,
        propertyType = "single_family",
        occupancyType = "primary_residence",
        propertyZip,
      } = req.body;

      if (!loanAmount || !creditScore || !ltv) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      if (isNaN(parseFloat(loanAmount)) || isNaN(parseFloat(creditScore)) || isNaN(parseFloat(ltv))) {
        return res.status(400).json({ error: "loanAmount, creditScore, and ltv must be valid numbers" });
      }

      // Get AMI for FTHB waiver
      let areaMedianIncome = 0;
      if (propertyZip) {
        areaMedianIncome = await getAreaMedianIncome(propertyZip);
      }

      const borrowerIncome = application.annualIncome ? 
        parseFloat(application.annualIncome) / 12 : 0;

      const result = await calculateLLPA(
        parseFloat(loanAmount),
        parseInt(creditScore),
        parseFloat(ltv),
        propertyType as any,
        occupancyType as any,
        application.isFirstTimeBuyer ?? false,
        borrowerIncome,
        areaMedianIncome
      );

      res.json(result);
    } catch (error) {
      console.error("Calculate pricing error:", error);
      res.status(500).json({ error: "Failed to calculate pricing" });
    }
  });

  // Instant deterministic decision (Tinman-style). Read-only preview: composes
  // completeness + pricing + the matrix-driven underwriting engine into a single
  // APPROVED / REJECTED / MANUAL_REVIEW / NEEDS_MORE_INFO result. Staff-only and
  // non-binding — it changes nothing; a binding outcome still goes through the
  // verified-data gate and human review.
}
