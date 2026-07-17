// Lending routes: Pre-approval + pre-qualification letters: generation, PDF, status.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { insertBorrowerDeclarationsSchema, type User } from "@shared/schema";
import { isStaffRole } from "@shared/roles";
import { z } from "zod";
import crypto from "crypto";
import { logAudit } from "../../auditLog";
import * as creditService from "../../services/creditService";
import { sendNotificationEmail } from "../../services/emailService";
import { COMPANY_CONFIG } from "../../config/company";
import { assertVerifiedForDecisioning, type DataProvenance } from "@shared/dataProvenance";

const declarationsValidationSchema = insertBorrowerDeclarationsSchema.partial().extend({
  applicationId: z.string().optional(),
});

// Intake validation lives in shared/schema/lending.ts (loanApplicationIntakeSchema),
// derived from the same base schema the funnel validates with client-side — the
// server rejects exactly what the client rejects, and "not_sure" credit maps to
// the named CREDIT_SCORE_UNKNOWN_DEFAULT instead of a silent clamp.

// Payment estimates on pre-approval letters use the current advertised
// 30-year fixed rate — a figure on a borrower-facing document must be
// reproducible from live pricing, never a hardcoded constant. Falls back to
// a conservative rate when no advertised rate is synced.
async function currentAdvertised30YrRate(storage: IStorage): Promise<number> {
  try {
    const advertised = await storage.getMortgageRatesByProgram("prog-30yr-fixed");
    const active = advertised.find((r) => r.isActive && parseFloat(r.rate) > 0);
    if (active) return parseFloat(active.rate) / 100;
  } catch (rateErr) {
    console.error("[Letter] Could not load advertised rate, using fallback:", rateErr);
  }
  return 0.07;
}

export function registerLetterRoutes(
  app: Express,
  storage: IStorage,
) {
  app.post("/api/loan-applications/:id/generate-letter", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      if (application.status !== "pre_approved") {
        return res.status(400).json({ error: "Only pre-approved applications can generate letters" });
      }

      // A pre-approval letter represents a creditworthiness determination — it may
      // not be issued from self-reported/estimated figures. Require verified data.
      try {
        assertVerifiedForDecisioning(
          application.financialDataProvenance as DataProvenance,
          "generating a pre-approval letter",
        );
      } catch (guardErr) {
        return res.status(422).json({
          error: guardErr instanceof Error ? guardErr.message : "Financial data must be verified",
        });
      }

      const { generatePreApprovalPDF } = await import("../../services/pdfLetterGenerator");

      const letterNumber = `BN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90);

      const purchasePrice = parseFloat(application.purchasePrice || "0");
      const downPayment = parseFloat(application.downPayment || "0");
      const loanAmount = application.preApprovalAmount || String(purchasePrice - downPayment);

      const conditions = [
        "Satisfactory property appraisal",
        "Verification of employment and income",
        "Clear title search and title insurance",
        "Property insurance in effect prior to closing",
        "No material change in financial condition",
      ];

      const disclaimers = [
        "This pre-approval is not a commitment to lend. Final approval is subject to satisfactory appraisal, title search, and verification of all information provided.",
        "This letter is valid only for the borrower named above and is non-transferable. Terms are subject to change based on market conditions.",
        "The pre-approved amount is based on information provided and preliminary underwriting review. The actual loan amount may differ upon full underwriting.",
        "This pre-approval does not guarantee any specific interest rate. Rate lock is available separately.",
        "Equal Housing Lender. All loans are subject to credit approval.",
      ];

      const borrowerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Borrower";

      const annualIncome = parseFloat(application.annualIncome || "0");
      const monthlyDebts = parseFloat(application.monthlyDebts || "0");
      const loanAmountNum = parseFloat(loanAmount) || 0;
      const rate = await currentAdvertised30YrRate(storage);
      const months = 360;
      const monthlyRate = rate / 12;
      const monthlyPayment = loanAmountNum > 0
        ? (loanAmountNum * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : 0;
      let rentalDebtTotal = 0;
      if (Array.isArray(application.incomeSources)) {
        for (const src of application.incomeSources as any[]) {
          if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
            for (const p of src.rentalProperties) {
              rentalDebtTotal += parseFloat(String(p.monthlyDebtPayment || "0").replace(/,/g, "")) || 0;
            }
          }
        }
      }
      const totalMonthlyObligations = monthlyDebts + (monthlyPayment || 0) + rentalDebtTotal;
      const monthlyIncome = annualIncome / 12;
      const dti = monthlyIncome > 0 ? (totalMonthlyObligations / monthlyIncome) * 100 : 0;
      const dpPercent = purchasePrice > 0 ? ((downPayment / purchasePrice) * 100).toFixed(1) : undefined;

      const creditScore = application.creditScore ? parseInt(String(application.creditScore)) : 0;
      let creditRange = "";
      if (creditScore >= 760) creditRange = "760+";
      else if (creditScore >= 720) creditRange = "720-759";
      else if (creditScore >= 680) creditRange = "680-719";
      else if (creditScore >= 640) creditRange = "640-679";
      else if (creditScore > 0) creditRange = `${creditScore}`;

      const incomeSources = Array.isArray(application.incomeSources) ? (application.incomeSources as any[]).map(s => ({
        type: s.type || "other",
        annualAmount: String(s.annualAmount || "0"),
        rentalProperties: Array.isArray(s.rentalProperties) ? s.rentalProperties.map((p: any) => ({
          address: p.address || "",
          monthlyRentalIncome: String(p.monthlyRentalIncome || "0"),
          monthlyDebtPayment: String(p.monthlyDebtPayment || "0"),
        })) : undefined,
      })) : undefined;

      const pdfBuffer = await generatePreApprovalPDF({
        letterNumber,
        borrowerName,
        loanAmount,
        productType: application.isVeteran ? "VA" : "CONV",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        companyContactInfo: COMPANY_CONFIG.contactInfo,
        expirationDate,
        generatedAt: new Date(),
        conditions,
        disclaimers,
        watermarkApplied: true,
        purchasePrice: purchasePrice > 0 ? String(purchasePrice) : undefined,
        downPayment: downPayment > 0 ? String(downPayment) : undefined,
        downPaymentPercent: dpPercent,
        annualIncome: annualIncome > 0 ? String(annualIncome) : undefined,
        monthlyPaymentEstimate: monthlyPayment > 0 ? String(Math.round(monthlyPayment)) : undefined,
        estimatedDti: dti > 0 ? dti.toFixed(1) : undefined,
        creditScoreRange: creditRange || undefined,
        employmentType: application.employmentType || undefined,
        propertyType: application.propertyType || undefined,
        propertyState: application.propertyState || undefined,
        incomeSources: incomeSources && incomeSources.length > 0 ? incomeSources : undefined,
      });

      const storageKey = `letters/${letterNumber}.pdf`;
      let pdfStored = false;
      try {
        const { objectStorageClient } = await import("../../integrations/object_storage/objectStorage");
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (privateDir) {
          const fullPath = `${privateDir}/${storageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          await file.save(pdfBuffer, { contentType: "application/pdf" });
          pdfStored = true;
        }
      } catch (storageErr) {
        console.error("[Letter] Object storage upload failed, will regenerate on demand:", storageErr);
      }

      const { db: database } = await import("../../db");
      const { preApprovalLetters, disclaimerVersions, underwritingDecisions } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      let snapshotId: string | null = null;
      try {
        const [snapshot] = await database.select().from(underwritingDecisions)
          .where(eq(underwritingDecisions.loanId, id))
          .orderBy(desc(underwritingDecisions.decidedAt))
          .limit(1);
        snapshotId = snapshot?.id || null;
      } catch (snapErr) {
        console.warn("[Letter] Underwriting snapshot lookup failed:", snapErr);
      }

      let disclaimerId: string | null = null;
      try {
        const [disc] = await database.select().from(disclaimerVersions).limit(1);
        disclaimerId = disc?.id || null;
      } catch (discErr) {
        console.warn("[Letter] Disclaimer lookup failed:", discErr);
      }

      if (!disclaimerId) {
        try {
          const [fallbackDisc] = await database.insert(disclaimerVersions).values({
            disclaimerType: "primary",
            version: "1.0",
            text: "This pre-approval is not a commitment to lend. Final approval is subject to a satisfactory appraisal, title search, and verification of all information provided.",
            effectiveFrom: new Date(),
          }).returning();
          disclaimerId = fallbackDisc.id;
        } catch (discErr) {
          console.error("[Letter] Fallback disclaimer creation failed:", discErr);
        }
      }

      let letterId: string | null = null;
      try {
        const insertValues: any = {
          letterNumber,
          borrowerName,
          applicationId: id,
          loanAmount,
          productType: application.isVeteran ? "VA" : "CONV",
          occupancy: "Primary",
          loanPurpose: application.loanPurpose || "Purchase",
          expirationDate,
          companyLegalName: COMPANY_CONFIG.legalName,
          companyNmlsId: COMPANY_CONFIG.nmlsId,
          companyContactInfo: COMPANY_CONFIG.contactInfo,
          loanOfficerId: isStaffRole(user.role) ? user.id : undefined,
          pdfStorageKey: pdfStored ? storageKey : undefined,
          pdfGeneratedAt: new Date(),
        };

        if (snapshotId) {
          insertValues.underwritingSnapshotId = snapshotId;
        }
        if (disclaimerId) {
          insertValues.primaryDisclaimerId = disclaimerId;
          insertValues.brokerRoleDisclaimerId = disclaimerId;
          insertValues.documentRelianceDisclaimerId = disclaimerId;
          insertValues.changeInCircumstanceDisclaimerId = disclaimerId;
          insertValues.systemGeneratedDisclaimerId = disclaimerId;
        }

        const [letter] = await database.insert(preApprovalLetters).values(insertValues).returning();
        letterId = letter?.id || null;
      } catch (dbErr) {
        console.error("[Letter] DB insert failed:", dbErr);
      }

      await storage.createNotification({
        userId: user.id,
        type: "pre_approval_letter_ready",
        title: "Pre-Approval Letter Ready",
        body: `Your pre-approval letter #${letterNumber} is ready for download.`,
        entityType: "pre_approval_letter",
        entityId: letterId || id,
        status: "unread",
      });

      if (user.email) {
        sendNotificationEmail({
          type: "pre_approval_letter_ready",
          recipientEmail: user.email,
          data: {
            borrowerName,
            amount: (parseFloat(loanAmount) || 0).toLocaleString(),
            letterNumber,
          },
        });
      }

      logAudit(req, "pre_approval_letter.generated", "pre_approval_letter", letterId || letterNumber);

      res.json({
        letterNumber,
        letterId,
        loanAmount,
        expirationDate,
        pdfAvailable: true,
        pdfStored,
      });
    } catch (error) {
      console.error("Generate letter error:", error);
      res.status(500).json({ error: "Failed to generate pre-approval letter" });
    }
  });

  app.get("/api/loan-applications/:id/letter-pdf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preApprovalLetters)
        .where(eq(preApprovalLetters.applicationId, id))
        .orderBy(desc(preApprovalLetters.createdAt))
        .limit(1);

      if (letter?.pdfStorageKey) {
        try {
          const { objectStorageClient } = await import("../../integrations/object_storage/objectStorage");
          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          const fullPath = `${privateDir}/${letter.pdfStorageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            const [contents] = await file.download();
            logAudit(req, "pre_approval_letter.downloaded", "pre_approval_letter", letter.id);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${letter.letterNumber}.pdf"`);
            return res.send(contents);
          }
        } catch (storageErr) {
          console.error("[Letter] Storage download failed, regenerating:", storageErr);
        }
      }

      const { generatePreApprovalPDF } = await import("../../services/pdfLetterGenerator");
      const purchasePrice = parseFloat(application.purchasePrice || "0");
      const downPayment = parseFloat(application.downPayment || "0");
      const loanAmount = application.preApprovalAmount || String(purchasePrice - downPayment);
      const borrowerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Borrower";

      const annualIncome = parseFloat(application.annualIncome || "0");
      const monthlyDebts = parseFloat(application.monthlyDebts || "0");
      const loanAmountNum = parseFloat(loanAmount) || 0;
      const rate = await currentAdvertised30YrRate(storage);
      const months = 360;
      const monthlyRate = rate / 12;
      const monthlyPayment = loanAmountNum > 0
        ? (loanAmountNum * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : 0;
      let dlRentalDebtTotal = 0;
      if (Array.isArray(application.incomeSources)) {
        for (const src of application.incomeSources as any[]) {
          if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
            for (const p of src.rentalProperties) {
              dlRentalDebtTotal += parseFloat(String(p.monthlyDebtPayment || "0").replace(/,/g, "")) || 0;
            }
          }
        }
      }
      const totalMonthlyObligations = monthlyDebts + (monthlyPayment || 0) + dlRentalDebtTotal;
      const monthlyIncome = annualIncome / 12;
      const dti = monthlyIncome > 0 ? (totalMonthlyObligations / monthlyIncome) * 100 : 0;
      const dpPercent = purchasePrice > 0 ? ((downPayment / purchasePrice) * 100).toFixed(1) : undefined;

      const creditScore = application.creditScore ? parseInt(String(application.creditScore)) : 0;
      let creditRange = "";
      if (creditScore >= 760) creditRange = "760+";
      else if (creditScore >= 720) creditRange = "720-759";
      else if (creditScore >= 680) creditRange = "680-719";
      else if (creditScore >= 640) creditRange = "640-679";
      else if (creditScore > 0) creditRange = `${creditScore}`;

      const dlIncomeSources = Array.isArray(application.incomeSources) ? (application.incomeSources as any[]).map(s => ({
        type: s.type || "other",
        annualAmount: String(s.annualAmount || "0"),
        rentalProperties: Array.isArray(s.rentalProperties) ? s.rentalProperties.map((p: any) => ({
          address: p.address || "",
          monthlyRentalIncome: String(p.monthlyRentalIncome || "0"),
          monthlyDebtPayment: String(p.monthlyDebtPayment || "0"),
        })) : undefined,
      })) : undefined;

      const pdfBuffer = await generatePreApprovalPDF({
        letterNumber: letter?.letterNumber || `BN-${Date.now().toString(36).toUpperCase()}`,
        borrowerName,
        loanAmount,
        productType: application.isVeteran ? "VA" : "CONV",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        companyContactInfo: COMPANY_CONFIG.contactInfo,
        expirationDate: letter?.expirationDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        generatedAt: letter?.generatedAt || new Date(),
        conditions: [
          "Satisfactory property appraisal",
          "Verification of employment and income",
          "Clear title search and title insurance",
          "Property insurance in effect prior to closing",
          "No material change in financial condition",
        ],
        disclaimers: [],
        watermarkApplied: true,
        purchasePrice: purchasePrice > 0 ? String(purchasePrice) : undefined,
        downPayment: downPayment > 0 ? String(downPayment) : undefined,
        downPaymentPercent: dpPercent,
        annualIncome: annualIncome > 0 ? String(annualIncome) : undefined,
        monthlyPaymentEstimate: monthlyPayment > 0 ? String(Math.round(monthlyPayment)) : undefined,
        estimatedDti: dti > 0 ? dti.toFixed(1) : undefined,
        creditScoreRange: creditRange || undefined,
        employmentType: application.employmentType || undefined,
        propertyType: application.propertyType || undefined,
        propertyState: application.propertyState || undefined,
        incomeSources: dlIncomeSources && dlIncomeSources.length > 0 ? dlIncomeSources : undefined,
      });

      logAudit(req, "pre_approval_letter.downloaded", "pre_approval_letter", letter?.id || id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pre-approval-${id.substring(0, 8)}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download letter PDF error:", error);
      res.status(500).json({ error: "Failed to download pre-approval letter" });
    }
  });

  app.get("/api/loan-applications/:id/letter-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../../db");
      const { preApprovalLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preApprovalLetters)
        .where(eq(preApprovalLetters.applicationId, id))
        .orderBy(desc(preApprovalLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.json({ hasLetter: false });
      }

      res.json({
        hasLetter: true,
        letterNumber: letter.letterNumber,
        status: letter.status,
        expirationDate: letter.expirationDate,
        generatedAt: letter.generatedAt,
        pdfAvailable: !!(letter.pdfStorageKey || letter.pdfGeneratedAt),
      });
    } catch (error) {
      console.error("Letter status error:", error);
      res.status(500).json({ error: "Failed to check letter status" });
    }
  });

  app.post("/api/loan-applications/:id/generate-prequal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const validStatuses = ["submitted", "analyzing", "pre_approved", "verified", "underwriting", "approved"];
      if (!validStatuses.includes(application.status)) {
        return res.status(400).json({ error: "Application must be submitted before generating a pre-qualification letter" });
      }

      const { generatePreQualificationPDF } = await import("../../services/pdfLetterGenerator");
      const crypto = await import("crypto");

      const letterNumber = `PQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 60);

      const borrowerName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user.email?.split("@")[0] || "Borrower");

      const loanAmount = application.preApprovalAmount || application.purchasePrice || "0";
      const downPayment = application.downPayment ? parseFloat(application.downPayment) : 0;
      const purchasePrice = application.purchasePrice ? parseFloat(application.purchasePrice) : 0;
      const estimatedAmount = purchasePrice > 0 ? (purchasePrice - downPayment).toString() : loanAmount.toString();

      let creditScoreRange = "Not provided";
      if (application.creditScore) {
        const cs = application.creditScore;
        if (cs >= 760) creditScoreRange = "760+";
        else if (cs >= 720) creditScoreRange = "720-759";
        else if (cs >= 680) creditScoreRange = "680-719";
        else if (cs >= 640) creditScoreRange = "640-679";
        else creditScoreRange = "Below 640";
      }

      let downPaymentPercent: string | undefined;
      if (downPayment > 0 && purchasePrice > 0) {
        downPaymentPercent = ((downPayment / purchasePrice) * 100).toFixed(1);
      }

      const pdfBuffer = await generatePreQualificationPDF({
        letterNumber,
        borrowerName,
        estimatedAmount,
        productType: application.preferredLoanType || "conventional",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        annualIncome: application.annualIncome?.toString(),
        creditScoreRange,
        employmentType: application.employmentType || undefined,
        estimatedDti: application.dtiRatio?.toString(),
        downPaymentPercent,
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        expirationDate,
        generatedAt: new Date(),
      });

      const { db: database } = await import("../../db");
      const { preQualificationLetters } = await import("@shared/schema");

      const storageKey = `prequal-letters/${letterNumber}.pdf`;
      let pdfStorageKey: string | null = null;
      try {
        const { objectStorageClient } = await import("../../integrations/object_storage/objectStorage");
        const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
        if (privateDir) {
          const fullPath = `${privateDir}/${storageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          await file.save(pdfBuffer, { contentType: "application/pdf" });
          pdfStorageKey = storageKey;
        }
      } catch (storageErr) {
        console.warn("[PreQual] Could not store PDF in object storage:", storageErr);
      }

      const [letter] = await database.insert(preQualificationLetters).values({
        letterNumber,
        borrowerName,
        applicationId: id,
        estimatedAmount,
        productType: application.preferredLoanType || "conventional",
        occupancy: "Primary",
        loanPurpose: application.loanPurpose || "Purchase",
        annualIncome: application.annualIncome?.toString(),
        creditScoreRange,
        employmentType: application.employmentType,
        estimatedDti: application.dtiRatio?.toString(),
        downPaymentPercent,
        expirationDate,
        status: "issued",
        companyLegalName: COMPANY_CONFIG.legalName,
        companyNmlsId: COMPANY_CONFIG.nmlsId,
        pdfStorageKey,
        pdfGeneratedAt: new Date(),
      }).returning();

      res.json({
        letterNumber: letter.letterNumber,
        expirationDate: letter.expirationDate,
        estimatedAmount: letter.estimatedAmount,
        pdfAvailable: true,
      });
    } catch (error) {
      console.error("Generate prequal letter error:", error);
      res.status(500).json({ error: "Failed to generate pre-qualification letter" });
    }
  });

  app.get("/api/loan-applications/:id/prequal-pdf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../../db");
      const { preQualificationLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preQualificationLetters)
        .where(eq(preQualificationLetters.applicationId, id))
        .orderBy(desc(preQualificationLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.status(404).json({ error: "No pre-qualification letter found" });
      }

      if (letter.pdfStorageKey) {
        try {
          const { objectStorageClient } = await import("../../integrations/object_storage/objectStorage");
          const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
          const fullPath = `${privateDir}/${letter.pdfStorageKey}`;
          const parts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = parts[0];
          const objectName = parts.slice(1).join("/");
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            const [contents] = await file.download();
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="PreQualification-${letter.letterNumber}.pdf"`);
            return res.send(contents);
          }
        } catch (downloadErr) {
          console.warn("[PreQual] Could not download from storage, regenerating:", downloadErr);
        }
      }

      const { generatePreQualificationPDF } = await import("../../services/pdfLetterGenerator");
      const borrowerName = letter.borrowerName;

      const pdfBuffer = await generatePreQualificationPDF({
        letterNumber: letter.letterNumber,
        borrowerName,
        estimatedAmount: letter.estimatedAmount,
        productType: letter.productType,
        occupancy: letter.occupancy,
        loanPurpose: letter.loanPurpose || undefined,
        annualIncome: letter.annualIncome?.toString(),
        creditScoreRange: letter.creditScoreRange || undefined,
        employmentType: letter.employmentType || undefined,
        estimatedDti: letter.estimatedDti?.toString(),
        downPaymentPercent: letter.downPaymentPercent?.toString(),
        companyLegalName: letter.companyLegalName,
        companyNmlsId: letter.companyNmlsId,
        expirationDate: new Date(letter.expirationDate),
        generatedAt: new Date(letter.generatedAt || letter.createdAt!),
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="PreQualification-${letter.letterNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("PreQual PDF error:", error);
      res.status(500).json({ error: "Failed to retrieve pre-qualification letter" });
    }
  });

  app.get("/api/loan-applications/:id/prequal-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../../db");
      const { preQualificationLetters } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");

      const [letter] = await database.select().from(preQualificationLetters)
        .where(eq(preQualificationLetters.applicationId, id))
        .orderBy(desc(preQualificationLetters.createdAt))
        .limit(1);

      if (!letter) {
        return res.json({ hasLetter: false });
      }

      res.json({
        hasLetter: true,
        letterNumber: letter.letterNumber,
        status: letter.status,
        expirationDate: letter.expirationDate,
        estimatedAmount: letter.estimatedAmount,
        generatedAt: letter.generatedAt,
        pdfAvailable: !!(letter.pdfStorageKey || letter.pdfGeneratedAt),
      });
    } catch (error) {
      console.error("PreQual status error:", error);
      res.status(500).json({ error: "Failed to check pre-qualification status" });
    }
  });
}
