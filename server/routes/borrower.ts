import type { Express } from "express";
import { InvalidSsnError, type IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { logAudit } from "../auditLog";
import { lintOutboundText, REG_Z_ADVERTISING_DISCLOSURE_BLOCK } from "@shared/compliance/loCommsLint";
import {
  insertCalculatorResultSchema,
  insertHomeownershipGoalSchema,
  insertCreditActionSchema,
  insertSavingsTransactionSchema,
  insertJourneyMilestoneSchema,
  insertDocumentPackageSchema,
  insertDocumentPackageItemSchema,
  insertUrlaPersonalInfoSchema,
  selfEmploymentWorksheetSchema,
  isStaffRole,
  isInternalStaffRole,
  LOAN_APP_TERMINAL_STATUSES,
  type User,
} from "@shared/schema";
import { updatePipelineStage } from "../pipelineEngine";
import crypto from "crypto";
import { z } from "zod";
import { buildBorrowerGraph, getPropertyAffordability } from "../services/borrowerGraph";
import { pickTableFields, sanitizePersonalInfoBody, URLA_TABLES } from "./urlaValidation";
import { stripEncryptedFields } from "../services/piiVault";
import { sendNotificationEmail } from "../services/emailService";
import { evaluateTridTrigger } from "../services/trid";
import { firstQueryValue } from "./queryParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).
export async function verifyInternalStaffApplicationAccess(
  storage: IStorage,
  applicationId: string,
  userId: string,
  userRole: string,
): Promise<boolean> {
  if (userRole === "admin") return true;

  const application = await storage.getLoanApplication(applicationId);
  if (!application) return false;

  if (userRole === "lo" || userRole === "loa") {
    return application.loanOfficerId === userId;
  }

  if (userRole === "processor" || userRole === "underwriter" || userRole === "closer") {
    const teamMembers = await storage.getDealTeamMembers(applicationId);
    return teamMembers.some(m => m.userId === userId);
  }

  return false;
}

// Mask a URLA personal-info record for external partners: SSN reduced to its
// last 4 digits (e.g. "123-45-6789" -> "•••-••-6789") and DOB dropped entirely.
// Preserves the input type so it maps cleanly over the allPersonalInfo[]
// co-borrower array; callers guard the optional single personalInfo field.
function maskUrlaPersonalInfo<
  T extends { ssn?: string | null; dateOfBirth?: string | null },
>(pi: T): T {
  const digits = (pi.ssn ?? "").replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : "";
  return {
    ...pi,
    ssn: last4 ? `•••-••-${last4}` : null,
    dateOfBirth: null,
  } as T;
}

export function registerBorrowerRoutes(
  app: Express,
  storage: IStorage,
) {
  // Calculator Results endpoints
  app.post("/api/calculator-results", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      const validationResult = insertCalculatorResultSchema.safeParse({
        ...req.body,
        userId: user.id,
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.errors 
        });
      }
      
      const calculatorResult = await storage.createCalculatorResult(validationResult.data);
      
      res.status(201).json(calculatorResult);
    } catch (error) {
      console.error("Create calculator result error:", error);
      res.status(500).json({ error: "Failed to save calculator results" });
    }
  });

  app.get("/api/calculator-results", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const results = await storage.getCalculatorResultsByUser(user.id);
      res.json(results);
    } catch (error) {
      console.error("Get calculator results error:", error);
      res.status(500).json({ error: "Failed to get calculator results" });
    }
  });

  app.get("/api/calculator-results/:type", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { type } = req.params;
      const result = await storage.getLatestCalculatorResult(user.id, type);
      
      if (!result) {
        return res.status(404).json({ error: "No results found" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Get calculator result error:", error);
      res.status(500).json({ error: "Failed to get calculator result" });
    }
  });

  app.post("/api/calculator-profiles", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        annualIncome: z.number().optional(),
        monthlyDebts: z.number().optional(),
        creditScore: z.number().optional(),
        downPaymentSaved: z.number().optional(),
        debts: z.array(z.object({
          type: z.string(),
          name: z.string(),
          monthlyPayment: z.number(),
        })).optional(),
        calculatorInputs: z.record(z.unknown()).optional(),
        calculatorResults: z.record(z.unknown()).optional(),
        maxHomePrice: z.number().optional(),
        zipCode: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
      }

      const { email, ...rest } = parsed.data;
      const profile = await storage.upsertCalculatorProfile(email, rest as Record<string, unknown>);
      res.json({ id: profile.id, email: profile.email, saved: true });
    } catch (error) {
      console.error("Upsert calculator profile error:", error);
      res.status(500).json({ error: "Failed to save profile" });
    }
  });

  app.get("/api/calculator-profiles/check/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const profile = await storage.getCalculatorProfileByEmail(email);
      if (!profile) {
        return res.status(404).json({ exists: false });
      }
      res.json({
        exists: true,
        maxHomePrice: profile.maxHomePrice,
        updatedAt: profile.updatedAt,
      });
    } catch (error) {
      console.error("Check calculator profile error:", error);
      res.status(500).json({ error: "Failed to check profile" });
    }
  });

  // Application Properties Routes - multi-property support
  app.get("/api/loan-applications/:id/properties", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const properties = await storage.getApplicationProperties(id);
      res.json(properties);
    } catch (error) {
      console.error("Get application properties error:", error);
      res.status(500).json({ error: "Failed to get properties" });
    }
  });

  app.get("/api/loan-applications/:id/current-property", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const property = await storage.getCurrentProperty(id);
      res.json(property || null);
    } catch (error) {
      console.error("Get current property error:", error);
      res.status(500).json({ error: "Failed to get current property" });
    }
  });

  app.post("/api/loan-applications/:id/properties", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const propertyData = {
        applicationId: id,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zipCode: req.body.zipCode,
        propertyType: req.body.propertyType,
        purchasePrice: req.body.purchasePrice?.toString().replace(/[,$]/g, "") || "0",
        downPayment: req.body.downPayment?.toString().replace(/[,$]/g, "") || "0",
        isCurrentProperty: true,
        status: "active" as const,
        offerAmount: req.body.offerAmount?.toString().replace(/[,$]/g, ""),
        offerDate: req.body.offerDate ? new Date(req.body.offerDate) : undefined,
        offerStatus: req.body.offerStatus,
      };

      const property = await storage.createApplicationProperty(propertyData);

      // Also update the main application with the new property details
      await storage.updateLoanApplication(id, {
        propertyAddress: property.address,
        propertyCity: property.city || undefined,
        propertyState: property.state || undefined,
        propertyZip: property.zipCode || undefined,
        propertyType: property.propertyType || undefined,
        purchasePrice: property.purchasePrice,
        downPayment: property.downPayment || undefined,
      });

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "New Property Added",
        description: `Property at ${property.address} has been added to the application.`,
        performedBy: req.user!.id,
      });

      res.status(201).json(property);
    } catch (error) {
      console.error("Create application property error:", error);
      res.status(500).json({ error: "Failed to add property" });
    }
  });

  app.post("/api/loan-applications/:id/properties/:propertyId/switch", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const property = await storage.switchToProperty(id, propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Update the main application with the switched property details
      await storage.updateLoanApplication(id, {
        propertyAddress: property.address,
        propertyCity: property.city || undefined,
        propertyState: property.state || undefined,
        propertyZip: property.zipCode || undefined,
        propertyType: property.propertyType || undefined,
        purchasePrice: property.purchasePrice,
        downPayment: property.downPayment || undefined,
      });

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "Property Switched",
        description: `Application property changed to ${property.address}.`,
        performedBy: req.user!.id,
      });

      res.json(property);
    } catch (error) {
      console.error("Switch property error:", error);
      res.status(500).json({ error: "Failed to switch property" });
    }
  });

  app.post("/api/loan-applications/:id/properties/:propertyId/deal-fell-through", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const { reason } = req.body;
      
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const property = await storage.markDealFellThrough(id, propertyId, reason || "Deal did not proceed");
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Log the activity
      await storage.createDealActivity({
        applicationId: id,
        activityType: "status_change",
        title: "Deal Fell Through",
        description: `The deal for ${property.address} did not proceed. Reason: ${reason || "Not specified"}`,
        performedBy: req.user!.id,
      });

      res.json(property);
    } catch (error) {
      console.error("Mark deal fell through error:", error);
      res.status(500).json({ error: "Failed to update property status" });
    }
  });

  app.patch("/api/loan-applications/:id/properties/:propertyId", isAuthenticated, async (req, res) => {
    try {
      const { id, propertyId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const updateData: any = {};
      if (req.body.address !== undefined) updateData.address = req.body.address;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.state !== undefined) updateData.state = req.body.state;
      if (req.body.zipCode !== undefined) updateData.zipCode = req.body.zipCode;
      if (req.body.propertyType !== undefined) updateData.propertyType = req.body.propertyType;
      if (req.body.purchasePrice !== undefined) updateData.purchasePrice = req.body.purchasePrice?.toString().replace(/[,$]/g, "");
      if (req.body.downPayment !== undefined) updateData.downPayment = req.body.downPayment?.toString().replace(/[,$]/g, "");
      if (req.body.offerAmount !== undefined) updateData.offerAmount = req.body.offerAmount?.toString().replace(/[,$]/g, "");
      if (req.body.offerStatus !== undefined) updateData.offerStatus = req.body.offerStatus;
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const property = await storage.updateApplicationProperty(id, propertyId, updateData);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // If this is the current property, also update the main application
      if (property.isCurrentProperty) {
        await storage.updateLoanApplication(id, {
          propertyAddress: property.address,
          propertyCity: property.city || undefined,
          propertyState: property.state || undefined,
          propertyZip: property.zipCode || undefined,
          propertyType: property.propertyType || undefined,
          purchasePrice: property.purchasePrice,
          downPayment: property.downPayment || undefined,
        });
      }

      res.json(property);
    } catch (error) {
      console.error("Update application property error:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  // URLA Data Routes
  app.get("/api/urla/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const urlaData = await storage.getCompleteUrlaData(applicationId);
      // Redact raw PII for external partners (broker/lender). They may be
      // deal-team members but must not see full SSN/DOB — matching the
      // redaction discipline already applied on the credit/verification routes
      // in compliance.ts. The borrower (a client role) and internal staff are
      // unaffected and see the full record.
      if (isStaffRole(user.role) && !isInternalStaffRole(user.role)) {
        if (urlaData.personalInfo) {
          urlaData.personalInfo = maskUrlaPersonalInfo(urlaData.personalInfo);
        }
        urlaData.allPersonalInfo = (urlaData.allPersonalInfo ?? []).map(maskUrlaPersonalInfo);
      }
      // Ciphertext/IV/key columns never leave the server — clients get last4 only.
      res.json({
        application,
        ...urlaData,
        personalInfo: urlaData.personalInfo ? stripEncryptedFields(urlaData.personalInfo) : urlaData.personalInfo,
        allPersonalInfo: urlaData.allPersonalInfo.map(stripEncryptedFields),
        assets: urlaData.assets.map(stripEncryptedFields),
        liabilities: urlaData.liabilities.map(stripEncryptedFields),
      });
    } catch (error) {
      console.error("Get URLA data error:", error);
      res.status(500).json({ error: "Failed to get URLA data" });
    }
  });

  app.post("/api/urla/:applicationId/personal-info", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Whitelist to table columns (mass-assignment defense) and pass the raw
      // `ssn` through to storage, where ssnVault validates + encrypts it
      // (InvalidSsnError → 400 below). stripEncryptedFields keeps ciphertext
      // out of the response.
      const sanitized = sanitizePersonalInfoBody(req.body);
      if (!sanitized.ok) {
        return res.status(400).json({ error: sanitized.error });
      }
      const data = { ...sanitized.data, applicationId };
      const result = await storage.upsertUrlaPersonalInfo(data as any);

      // TRID §1026.2(a)(3): the SSN often arrives here as the 6th piece of
      // application information — evaluate the Loan Estimate trigger.
      try {
        const trid = await evaluateTridTrigger(applicationId);
        if (trid.justTriggered) {
          logAudit(req, "trid.application_triggered", "loan_application", applicationId, {
            leDueDate: trid.leDueDate?.toISOString(),
          });
        }
      } catch (tridErr) {
        console.error("[TRID] Trigger evaluation failed (non-fatal):", tridErr);
      }

      res.json(stripEncryptedFields(result));
    } catch (error) {
      if (error instanceof InvalidSsnError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Save personal info error:", error);
      res.status(500).json({ error: "Failed to save personal info" });
    }
  });

  /**
   * Audited full-SSN reveal. Everything else in the API returns the masked
   * form; this endpoint exists for the narrow staff workflows that genuinely
   * need the full value (credit pulls, GSE casefile fixes). Owner borrowers
   * may read their own. Every call writes an audit entry.
   */
  app.get("/api/urla/:applicationId/ssn", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const seq = Math.max(parseInt(String(req.query.borrowerSequenceNumber ?? "1"), 10) || 1, 1);

      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const isOwner = application.userId === user.id;
      const allowedStaff = ["admin", "underwriter", "processor"];
      if (!isOwner && !allowedStaff.includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const ssn = await storage.getDecryptedUrlaSsn(applicationId, seq);
      if (!ssn) {
        return res.status(404).json({ error: "No SSN on file" });
      }

      await logAudit(req, "urla.ssn_reveal", "loan_application", applicationId, {
        borrowerSequenceNumber: seq,
        role: user.role,
      });
      res.json({ ssn });
    } catch (error) {
      console.error("SSN reveal error:", error);
      res.status(500).json({ error: "Failed to retrieve SSN" });
    }
  });

  app.post("/api/urla/:applicationId/employment", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = { ...pickTableFields(URLA_TABLES.employment, req.body), applicationId };
      const result = await storage.createEmploymentHistory(data as any);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create employment error:", error);
      res.status(500).json({ error: "Failed to create employment record" });
    }
  });

  app.patch("/api/urla/employment/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getEmploymentHistoryById(id);
      if (!record) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Whitelist to table columns; applicationId is always stripped (immutable).
      const safeBody = pickTableFields(URLA_TABLES.employment, req.body);
      const result = await storage.updateEmploymentHistory(id, safeBody as any);
      if (!result) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update employment error:", error);
      res.status(500).json({ error: "Failed to update employment record" });
    }
  });

  app.delete("/api/urla/employment/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getEmploymentHistoryById(id);
      if (!record) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteEmploymentHistory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete employment error:", error);
      res.status(500).json({ error: "Failed to delete employment record" });
    }
  });

  // Self-employment income worksheet (Form 1084 / B3-3.5 & B3-3.6). This is a
  // structured JSON object, so it does NOT go through the generic employment
  // save (pickTableFields drops JSON by design) — it has its own Zod-validated
  // write path. Providing a worksheet marks the record self-employed.
  app.put("/api/urla/employment/:id/self-employment", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getEmploymentHistoryById(id);
      if (!record) {
        return res.status(404).json({ error: "Employment record not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const parsed = selfEmploymentWorksheetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid self-employment worksheet",
          details: parsed.error.flatten(),
        });
      }
      const result = await storage.updateEmploymentHistory(id, {
        selfEmploymentIncome: parsed.data,
        isSelfEmployed: true,
      } as any);
      if (!result) {
        return res.status(404).json({ error: "Employment record not found" });
      }

      // P5 accuracy loop: a saved worksheet changes qualifying income — rerun
      // the decision (and its income-path evaluation). A confirmed smart-fill
      // draft is distinguishable in the snapshot trail by its trigger.
      const { recalculateDecision } = await import("../services/decisionEngine");
      void recalculateDecision(
        record.applicationId,
        parsed.data.confirmedByBorrowerAt ? "worksheet_confirmed" : "income_updated",
      );

      res.json(result);
    } catch (error) {
      console.error("Save self-employment worksheet error:", error);
      res.status(500).json({ error: "Failed to save self-employment worksheet" });
    }
  });

  app.post("/api/urla/:applicationId/other-income", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = { ...pickTableFields(URLA_TABLES.otherIncome, req.body), applicationId };
      const result = await storage.createOtherIncomeSource(data as any);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create other income error:", error);
      res.status(500).json({ error: "Failed to create other income source" });
    }
  });

  app.delete("/api/urla/other-income/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getOtherIncomeSourceById(id);
      if (!record) {
        return res.status(404).json({ error: "Income source not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteOtherIncomeSource(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete other income error:", error);
      res.status(500).json({ error: "Failed to delete other income source" });
    }
  });

  app.post("/api/urla/:applicationId/assets", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = { ...pickTableFields(URLA_TABLES.asset, req.body, ["accountNumber"]), applicationId };
      const result = await storage.createUrlaAsset(data as any);
      res.status(201).json(stripEncryptedFields(result));
    } catch (error) {
      console.error("Create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  app.patch("/api/urla/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getUrlaAssetById(id);
      if (!record) {
        return res.status(404).json({ error: "Asset not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Whitelist to table columns; applicationId is always stripped (immutable).
      const safeBody = pickTableFields(URLA_TABLES.asset, req.body, ["accountNumber"]);
      const result = await storage.updateUrlaAsset(id, safeBody as any);
      if (!result) {
        return res.status(404).json({ error: "Asset not found" });
      }
      res.json(stripEncryptedFields(result));
    } catch (error) {
      console.error("Update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  app.delete("/api/urla/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getUrlaAssetById(id);
      if (!record) {
        return res.status(404).json({ error: "Asset not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteUrlaAsset(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  app.post("/api/urla/:applicationId/liabilities", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = { ...pickTableFields(URLA_TABLES.liability, req.body, ["accountNumber"]), applicationId };
      const result = await storage.createUrlaLiability(data as any);
      res.status(201).json(stripEncryptedFields(result));
    } catch (error) {
      console.error("Create liability error:", error);
      res.status(500).json({ error: "Failed to create liability" });
    }
  });

  app.patch("/api/urla/liabilities/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getUrlaLiabilityById(id);
      if (!record) {
        return res.status(404).json({ error: "Liability not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Whitelist to table columns; applicationId is always stripped (immutable).
      const safeBody = pickTableFields(URLA_TABLES.liability, req.body, ["accountNumber"]);
      const result = await storage.updateUrlaLiability(id, safeBody as any);
      if (!result) {
        return res.status(404).json({ error: "Liability not found" });
      }
      res.json(stripEncryptedFields(result));
    } catch (error) {
      console.error("Update liability error:", error);
      res.status(500).json({ error: "Failed to update liability" });
    }
  });

  app.delete("/api/urla/liabilities/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      const record = await storage.getUrlaLiabilityById(id);
      if (!record) {
        return res.status(404).json({ error: "Liability not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(record.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteUrlaLiability(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete liability error:", error);
      res.status(500).json({ error: "Failed to delete liability" });
    }
  });

  app.post("/api/urla/:applicationId/property-info", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const data = { ...pickTableFields(URLA_TABLES.propertyInfo, req.body), applicationId };
      const result = await storage.upsertUrlaPropertyInfo(data as any);
      res.json(result);
    } catch (error) {
      console.error("Save property info error:", error);
      res.status(500).json({ error: "Failed to save property info" });
    }
  });

  // Bulk save URLA data - only updates sections that are explicitly provided with content
  app.post("/api/urla/:applicationId/save", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const { personalInfo, employmentHistory, otherIncomeSources, assets, liabilities, propertyInfo, declarations, demographics, coApplicants } = req.body;

      // Verify the requesting user owns (or has staff access to) this application
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const hasContent = (obj: any) =>
        obj && typeof obj === "object" &&
        Object.keys(obj).some(key => obj[key] !== undefined && obj[key] !== "" && obj[key] !== null);

      const demographicsHasContent = (d: any) =>
        d && typeof d === "object" && (
          d.ethnicityHispanicLatino || d.ethnicityNotHispanicLatino || d.ethnicityNotProvided ||
          d.raceAmericanIndian || d.raceAsian || d.raceBlack || d.raceNativeHawaiian || d.raceWhite || d.raceNotProvided ||
          d.sexFemale || d.sexMale || d.sexNotProvided ||
          d.ageNotProvided || (d.age !== null && d.age !== undefined && d.age !== "")
        );

      const collectionMethod = isStaffRole(user.role) ? "loan_officer" : "borrower";

      // Writes one borrower's URLA sections, scoped to a borrowerSequenceNumber.
      // Bodies are whitelisted to their table's columns (pickTableFields) before
      // any write. Returns ok=false with an http status when a referenced child
      // record fails the ownership check or a field fails format validation.
      const writeBorrowerSections = async (opts: {
        seq: number;
        isPrimary: boolean;
        personalInfo?: any;
        employmentHistory?: any[];
        assets?: any[];
        liabilities?: any[];
        declarations?: any;
        demographics?: any;
      }): Promise<{ ok: boolean; status?: number; error?: string; results: any }> => {
        const { seq, isPrimary } = opts;
        const results: any = {};

        if (hasContent(opts.personalInfo)) {
          const sanitized = sanitizePersonalInfoBody(opts.personalInfo);
          if (!sanitized.ok) {
            return { ok: false, status: 400, error: sanitized.error, results };
          }
          results.personalInfo = await storage.upsertUrlaPersonalInfo({
            ...sanitized.data,
            applicationId,
            borrowerSequenceNumber: seq,
            isPrimaryBorrower: isPrimary,
          } as any);
        }

        if (Array.isArray(opts.employmentHistory) && opts.employmentHistory.length > 0) {
          results.employmentHistory = [];
          for (const emp of opts.employmentHistory) {
            if (!emp.employerName && !emp.positionTitle && !emp.baseIncome) continue;
            const cleanEmp = pickTableFields(URLA_TABLES.employment, emp);
            // The self-employment worksheet is a structured JSON object, so
            // pickTableFields drops it (URLA tables are scalar-only by design).
            // Validate it explicitly here and merge it back in. `null` clears it.
            if (emp.selfEmploymentIncome === null) {
              (cleanEmp as any).selfEmploymentIncome = null;
            } else if (emp.selfEmploymentIncome !== undefined) {
              const wk = selfEmploymentWorksheetSchema.safeParse(emp.selfEmploymentIncome);
              if (!wk.success) {
                return { ok: false, status: 400, error: "Invalid self-employment worksheet", results };
              }
              (cleanEmp as any).selfEmploymentIncome = wk.data;
            }
            if (emp.id) {
              const existing = await storage.getEmploymentHistoryById(emp.id);
              if (!existing || existing.applicationId !== applicationId) return { ok: false, results };
              const updated = await storage.updateEmploymentHistory(emp.id, { ...cleanEmp, borrowerSequenceNumber: seq } as any);
              if (updated) results.employmentHistory.push(updated);
            } else {
              const created = await storage.createEmploymentHistory({
                ...cleanEmp,
                applicationId,
                borrowerSequenceNumber: seq,
                employmentType: cleanEmp.employmentType || "current",
              } as any);
              results.employmentHistory.push(created);
            }
          }
        }

        if (Array.isArray(opts.assets) && opts.assets.length > 0) {
          results.assets = [];
          for (const asset of opts.assets) {
            if (!asset.accountType && !asset.financialInstitution) continue;
            const cleanAsset = pickTableFields(URLA_TABLES.asset, asset, ["accountNumber"]);
            if (asset.id) {
              const existing = await storage.getUrlaAssetById(asset.id);
              if (!existing || existing.applicationId !== applicationId) return { ok: false, results };
              const updated = await storage.updateUrlaAsset(asset.id, { ...cleanAsset, borrowerSequenceNumber: seq } as any);
              if (updated) results.assets.push(updated);
            } else if (asset.accountType) {
              const created = await storage.createUrlaAsset({ ...cleanAsset, applicationId, borrowerSequenceNumber: seq } as any);
              results.assets.push(created);
            }
          }
        }

        if (Array.isArray(opts.liabilities) && opts.liabilities.length > 0) {
          results.liabilities = [];
          for (const liability of opts.liabilities) {
            if (!liability.liabilityType && !liability.creditorName) continue;
            const cleanLiability = pickTableFields(URLA_TABLES.liability, liability, ["accountNumber"]);
            if (liability.id) {
              const existing = await storage.getUrlaLiabilityById(liability.id);
              if (!existing || existing.applicationId !== applicationId) return { ok: false, results };
              const updated = await storage.updateUrlaLiability(liability.id, { ...cleanLiability, borrowerSequenceNumber: seq } as any);
              if (updated) results.liabilities.push(updated);
            } else if (liability.liabilityType) {
              const created = await storage.createUrlaLiability({ ...cleanLiability, applicationId, borrowerSequenceNumber: seq } as any);
              results.liabilities.push(created);
            }
          }
        }

        if (hasContent(opts.declarations)) {
          results.declarations = await storage.upsertBorrowerDeclarations({
            ...pickTableFields(URLA_TABLES.declarations, opts.declarations),
            applicationId,
            borrowerSequenceNumber: seq,
          } as any);
        }

        if (demographicsHasContent(opts.demographics)) {
          results.demographics = await storage.upsertHmdaDemographics({
            ...pickTableFields(URLA_TABLES.demographics, opts.demographics),
            applicationId,
            borrowerId: application.userId,
            borrowerSequenceNumber: seq,
            collectionMethod,
          } as any);
        }

        return { ok: true, results };
      };

      // Primary borrower (sequence 1)
      const primary = await writeBorrowerSections({
        seq: 1,
        isPrimary: true,
        personalInfo,
        employmentHistory,
        assets,
        liabilities,
        declarations,
        demographics,
      });
      if (!primary.ok) {
        return res.status(primary.status ?? 403).json({ error: primary.error ?? "Access denied" });
      }
      const results: any = { ...primary.results };

      // Property info (shared subject property)
      if (hasContent(propertyInfo)) {
        results.propertyInfo = await storage.upsertUrlaPropertyInfo({
          ...pickTableFields(URLA_TABLES.propertyInfo, propertyInfo),
          applicationId,
        } as any);
      }

      // Other income sources (primary only) - only create new ones
      if (otherIncomeSources && Array.isArray(otherIncomeSources) && otherIncomeSources.length > 0) {
        results.otherIncomeSources = [];
        for (const income of otherIncomeSources) {
          if (!income.incomeSource || !income.monthlyAmount) continue;
          if (income.id) continue;
          const created = await storage.createOtherIncomeSource({
            ...pickTableFields(URLA_TABLES.otherIncome, income),
            applicationId,
          } as any);
          results.otherIncomeSources.push(created);
        }
      }

      // Co-applicants (sequence 2, 3, ...)
      if (Array.isArray(coApplicants) && coApplicants.length > 0) {
        results.coApplicants = [];
        for (let i = 0; i < coApplicants.length; i++) {
          const co = coApplicants[i] || {};
          const coResult = await writeBorrowerSections({
            seq: i + 2,
            isPrimary: false,
            personalInfo: co.personalInfo,
            employmentHistory: co.employmentHistory,
            assets: co.assets,
            liabilities: co.liabilities,
            declarations: co.declarations,
            demographics: co.demographics,
          });
          if (!coResult.ok) {
            return res.status(coResult.status ?? 403).json({ error: coResult.error ?? "Access denied" });
          }
          results.coApplicants.push(coResult.results);
        }
      }

      // Ciphertext/IV/key columns never leave the server.
      const sanitizeBorrowerResults = (r: any) => ({
        ...r,
        ...(r.personalInfo ? { personalInfo: stripEncryptedFields(r.personalInfo) } : {}),
        ...(Array.isArray(r.assets) ? { assets: r.assets.map(stripEncryptedFields) } : {}),
        ...(Array.isArray(r.liabilities) ? { liabilities: r.liabilities.map(stripEncryptedFields) } : {}),
      });
      const safeResults = sanitizeBorrowerResults(results);
      if (Array.isArray(safeResults.coApplicants)) {
        safeResults.coApplicants = safeResults.coApplicants.map(sanitizeBorrowerResults);
      }

      res.json(safeResults);
    } catch (error) {
      console.error("Save URLA data error:", error);
      res.status(500).json({ error: "Failed to save URLA data" });
    }
  });



  // ===== ASPIRING OWNER JOURNEY API =====

  // Get or create homeownership goal for the current user
  app.get("/api/homeownership-goal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.json({ goal: null });
      }

      const [creditActions, savingsTransactions, milestones] = await Promise.all([
        storage.getCreditActions(goal.id),
        storage.getSavingsTransactions(goal.id),
        storage.getJourneyMilestones(goal.id),
      ]);

      res.json({
        goal,
        creditActions,
        savingsTransactions,
        milestones,
      });
    } catch (error) {
      console.error("Get homeownership goal error:", error);
      res.status(500).json({ error: "Failed to get homeownership goal" });
    }
  });

  // Create homeownership goal
  app.post("/api/homeownership-goal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Check if goal already exists
      const existing = await storage.getHomeownershipGoal(user.id);
      if (existing) {
        return res.status(400).json({ error: "Homeownership goal already exists" });
      }

      const validated = insertHomeownershipGoalSchema.parse({
        ...req.body,
        userId: user.id,
      });

      const goal = await storage.createHomeownershipGoal(validated);

      // Create initial milestone for starting the journey
      await storage.createJourneyMilestone({
        goalId: goal.id,
        milestoneType: "journey_started",
        title: "Journey Started",
        description: "You've taken the first step toward homeownership!",
        celebrationMessage: "Welcome to your homeownership journey! We're excited to help you achieve your dream.",
        pointsAwarded: 10,
      });

      res.status(201).json({ goal });
    } catch (error) {
      console.error("Create homeownership goal error:", error);
      res.status(500).json({ error: "Failed to create homeownership goal" });
    }
  });

  // Update homeownership goal
  app.patch("/api/homeownership-goal", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Validate update data using partial insert schema
      const updateSchema = insertHomeownershipGoalSchema.partial();
      const validated = updateSchema.parse(req.body);
      
      const goal = await storage.updateHomeownershipGoal(user.id, validated);
      
      if (!goal) {
        return res.status(404).json({ error: "Homeownership goal not found" });
      }

      res.json({ goal });
    } catch (error) {
      console.error("Update homeownership goal error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update homeownership goal" });
    }
  });

  // Get gap analysis (calculated from goal data)
  app.get("/api/homeownership-goal/gap-analysis", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.json({ hasGoal: false });
      }

      // Calculate gap analysis
      const currentCredit = goal.currentCreditScore || 0;
      const targetCredit = goal.targetCreditScore || 640;
      const creditGap = Math.max(0, targetCredit - currentCredit);

      const currentSavings = parseFloat(goal.currentSavingsBalance?.toString() || "0");
      const targetDownPayment = parseFloat(goal.targetDownPayment?.toString() || "0");
      const savingsGap = Math.max(0, targetDownPayment - currentSavings);

      const monthlyIncome = parseFloat(goal.monthlyIncome?.toString() || "0");
      const monthlyDebts = parseFloat(goal.monthlyDebts?.toString() || "0");
      const currentDTI = monthlyIncome > 0 ? (monthlyDebts / monthlyIncome) * 100 : 0;
      
      // Calculate maximum housing payment at 43% DTI guideline
      const maxDTI = 43;
      const availableForPayment = monthlyIncome * (maxDTI / 100) - monthlyDebts;
      
      // Estimate time to reach goals
      const monthlySavingsRate = parseFloat(goal.currentMonthlySavings?.toString() || "0");
      const monthsToSavingsGoal = monthlySavingsRate > 0 
        ? Math.ceil(savingsGap / monthlySavingsRate) 
        : null;

      // Calculate journey progress percentage
      const creditProgress = targetCredit > 0 ? Math.min(100, (currentCredit / targetCredit) * 100) : 0;
      const savingsProgress = targetDownPayment > 0 ? Math.min(100, (currentSavings / targetDownPayment) * 100) : 0;
      const overallProgress = (creditProgress + savingsProgress) / 2;

      res.json({
        hasGoal: true,
        analysis: {
          credit: {
            current: currentCredit,
            target: targetCredit,
            gap: creditGap,
            progress: creditProgress,
            status: creditGap === 0 ? "ready" : creditGap <= 20 ? "close" : "working",
          },
          savings: {
            current: currentSavings,
            target: targetDownPayment,
            gap: savingsGap,
            progress: savingsProgress,
            monthlyRate: monthlySavingsRate,
            monthsToGoal: monthsToSavingsGoal,
            status: savingsGap === 0 ? "ready" : savingsProgress >= 75 ? "close" : "working",
          },
          dti: {
            current: currentDTI,
            maxAllowed: maxDTI,
            availableForPayment,
            status: currentDTI <= maxDTI ? "within_guideline" : "above_guideline",
          },
          overall: {
            progress: overallProgress,
            phase: goal.currentPhase,
            journeyDay: goal.journeyDay,
            goalsComplete: creditGap === 0 && savingsGap === 0 && currentDTI <= maxDTI,
          },
        },
      });
    } catch (error) {
      console.error("Get gap analysis error:", error);
      res.status(500).json({ error: "Failed to calculate gap analysis" });
    }
  });

  // Add credit action
  app.post("/api/homeownership-goal/credit-actions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.status(404).json({ error: "Homeownership goal not found" });
      }

      const validated = insertCreditActionSchema.parse({
        ...req.body,
        goalId: goal.id,
      });

      const action = await storage.createCreditAction(validated);
      res.status(201).json({ action });
    } catch (error) {
      console.error("Create credit action error:", error);
      res.status(500).json({ error: "Failed to create credit action" });
    }
  });

  // Update credit action
  app.patch("/api/credit-actions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      // Verify the credit action belongs to the current user's homeownership goal
      const goal = await storage.getHomeownershipGoal(user.id);
      if (!goal) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getCreditActionById(req.params.id);
      if (!existing || existing.goalId !== goal.id) {
        return res.status(404).json({ error: "Credit action not found" });
      }

      // Validate update data using partial insert schema; strip goalId to prevent reassignment
      const updateSchema = insertCreditActionSchema.partial();
      const { goalId: _strip, ...bodyWithoutOwner } = req.body;
      const validated = updateSchema.parse(bodyWithoutOwner);
      
      const action = await storage.updateCreditAction(req.params.id, validated, goal.id);
      
      if (!action) {
        return res.status(404).json({ error: "Credit action not found" });
      }

      res.json({ action });
    } catch (error) {
      console.error("Update credit action error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update credit action" });
    }
  });

  // Add savings transaction
  app.post("/api/homeownership-goal/savings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.status(404).json({ error: "Homeownership goal not found" });
      }

      const currentBalance = parseFloat(goal.currentSavingsBalance?.toString() || "0");
      const amount = parseFloat(req.body.amount);
      const newBalance = currentBalance + amount;

      const validated = insertSavingsTransactionSchema.parse({
        goalId: goal.id,
        transactionType: req.body.transactionType || "manual_deposit",
        amount: req.body.amount,
        description: req.body.description,
        runningBalance: newBalance.toString(),
      });

      const transaction = await storage.createSavingsTransaction(validated);

      // Update the goal's current savings balance
      await storage.updateHomeownershipGoal(user.id, {
        currentSavingsBalance: newBalance.toString(),
        savingsProgress: newBalance.toString(),
      });

      // Check for savings milestones
      const milestoneThresholds = [
        { amount: 500, type: "savings_500", title: "First $500 Saved!" },
        { amount: 1000, type: "savings_1000", title: "$1,000 Milestone!" },
        { amount: 2500, type: "savings_2500", title: "$2,500 Saved!" },
        { amount: 5000, type: "savings_5000", title: "$5,000 Milestone!" },
        { amount: 10000, type: "savings_10000", title: "$10,000 Saved!" },
      ];

      for (const milestone of milestoneThresholds) {
        if (newBalance >= milestone.amount && currentBalance < milestone.amount) {
          await storage.createJourneyMilestone({
            goalId: goal.id,
            milestoneType: milestone.type,
            title: milestone.title,
            description: `You've saved $${milestone.amount.toLocaleString()} toward your home!`,
            celebrationMessage: "Great progress! Every dollar brings you closer to homeownership.",
            pointsAwarded: milestone.amount / 100,
          });
        }
      }

      res.status(201).json({ transaction, newBalance });
    } catch (error) {
      console.error("Create savings transaction error:", error);
      res.status(500).json({ error: "Failed to create savings transaction" });
    }
  });

  // Get credit improvement recommendations
  app.get("/api/homeownership-goal/credit-recommendations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const goal = await storage.getHomeownershipGoal(user.id);
      
      if (!goal) {
        return res.json({ recommendations: [] });
      }

      const currentScore = goal.currentCreditScore || 0;
      const recommendations = [];

      // Generate personalized recommendations based on credit score
      if (currentScore < 580) {
        recommendations.push({
          priority: "high",
          actionType: "pay_down_card",
          title: "Pay Down Credit Cards",
          description: "Reduce your credit utilization to under 30%. This is the fastest way to boost your score.",
          estimatedPointsGain: 15,
          timeframe: "1-2 months",
        });
        recommendations.push({
          priority: "high",
          actionType: "dispute_error",
          title: "Dispute Credit Errors",
          description: "Review your credit report for errors. Removing incorrect negative items can quickly improve your score.",
          estimatedPointsGain: 20,
          timeframe: "30-45 days",
        });
      }

      if (currentScore >= 580 && currentScore < 620) {
        recommendations.push({
          priority: "medium",
          actionType: "on_time_payment",
          title: "Set Up Auto-Pay",
          description: "Never miss a payment. Set up automatic payments for all your bills.",
          estimatedPointsGain: 10,
          timeframe: "3-6 months",
        });
        recommendations.push({
          priority: "medium",
          actionType: "authorized_user",
          title: "Become an Authorized User",
          description: "Ask a family member with good credit to add you as an authorized user on their oldest card.",
          estimatedPointsGain: 15,
          timeframe: "1-2 months",
        });
      }

      if (currentScore >= 620 && currentScore < 680) {
        recommendations.push({
          priority: "low",
          actionType: "credit_mix",
          title: "Diversify Credit Types",
          description: "A mix of credit types (cards, installment loans) can help your score.",
          estimatedPointsGain: 8,
          timeframe: "3-6 months",
        });
      }

      // Always recommend
      recommendations.push({
        priority: "medium",
        actionType: "utilization",
        title: "Keep Utilization Low",
        description: "Try to use less than 10% of your available credit for the best scores.",
        estimatedPointsGain: 10,
        timeframe: "Ongoing",
      });

      res.json({ recommendations, currentScore, targetScore: goal.targetCreditScore });
    } catch (error) {
      console.error("Get credit recommendations error:", error);
      res.status(500).json({ error: "Failed to get credit recommendations" });
    }
  });

  // ===== RATE LOCK SYSTEM =====

  // Create a rate lock
  app.post("/api/rate-locks", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can create rate locks" });
      }

      const schema = z.object({
        applicationId: z.string(),
        loanOptionId: z.string(),
        lockPeriodDays: z.number().min(15).max(90).default(30),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const { applicationId, loanOptionId, lockPeriodDays, notes } = result.data;

      // Verify caller is assigned to this application (assignment-scoped; not platform-wide)
      const rateLockAllowed = await verifyInternalStaffApplicationAccess(storage, applicationId, user.id, user.role);
      if (!rateLockAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      // Check if there's already an active lock
      const existingLock = await storage.getActiveRateLock(applicationId);
      if (existingLock) {
        return res.status(400).json({ error: "Application already has an active rate lock" });
      }

      // Get the loan option details
      const options = await storage.getLoanOptionsByApplication(applicationId);
      const loanOption = options.find(o => o.id === loanOptionId);
      if (!loanOption) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      const lockedAt = new Date();
      const expiresAt = new Date(lockedAt.getTime() + lockPeriodDays * 24 * 60 * 60 * 1000);

      const rateLock = await storage.createRateLock({
        applicationId,
        loanOptionId,
        interestRate: loanOption.interestRate,
        points: loanOption.points,
        loanAmount: loanOption.loanAmount,
        loanType: loanOption.loanType,
        loanTerm: loanOption.loanTerm,
        lockPeriodDays,
        lockedAt,
        expiresAt,
        status: "active",
        lockedBy: user.id,
        notes,
      });

      // Also update the loan option
      await storage.lockLoanOption(loanOptionId);

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: `Rate locked at ${loanOption.interestRate}% for ${lockPeriodDays} days`,
        metadata: { rateLockId: rateLock.id },
        performedBy: user.id,
      });

      res.status(201).json(rateLock);
    } catch (error) {
      console.error("Create rate lock error:", error);
      res.status(500).json({ error: "Failed to create rate lock" });
    }
  });

  // Get rate locks for an application
  app.get("/api/rate-locks/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const locks = await storage.getRateLocksByApplication(applicationId);
      res.json(locks);
    } catch (error) {
      console.error("Get rate locks error:", error);
      res.status(500).json({ error: "Failed to get rate locks" });
    }
  });

  // Get expiring rate locks (for alerts)
  app.get("/api/rate-locks/expiring", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only" });
      }

      const withinDays = parseInt(firstQueryValue(req.query.days) ?? "") || 7;
      const locks = await storage.getExpiringRateLocks(withinDays);

      // Assignment-scoped, mirroring GET /api/pipeline/queue: an admin sees
      // every expiring lock; every other internal-staff role sees only locks
      // on files they are an active deal-team member of.
      if (user.role === "admin") {
        return res.json(locks);
      }
      const memberships = await storage.getTeamMembersByUser(user.id);
      const allowedAppIds = new Set(
        memberships.map((m) => m.application?.id).filter((id): id is string => Boolean(id)),
      );
      res.json(locks.filter((lock) => allowedAppIds.has(lock.applicationId)));
    } catch (error) {
      console.error("Get expiring locks error:", error);
      res.status(500).json({ error: "Failed to get expiring locks" });
    }
  });

  // Extend a rate lock
  app.post("/api/rate-locks/:id/extend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can extend rate locks" });
      }

      const { id } = req.params;
      const { additionalDays, extensionFee } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }

      // Verify caller is assigned to this application (assignment-scoped)
      const extendAllowed = await verifyInternalStaffApplicationAccess(storage, lock.applicationId, user.id, user.role);
      if (!extendAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      if (lock.status !== "active") {
        return res.status(400).json({ error: "Can only extend active rate locks" });
      }

      const currentExpiry = new Date(lock.expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + (additionalDays || 15) * 24 * 60 * 60 * 1000);

      const updated = await storage.updateRateLock(id, {
        expiresAt: newExpiry,
        extensionCount: (lock.extensionCount || 0) + 1,
        originalExpiresAt: lock.originalExpiresAt || lock.expiresAt,
        extensionFee: extensionFee?.toString(),
        status: "extended",
      });

      // Log activity
      await storage.createDealActivity({
        applicationId: lock.applicationId,
        activityType: "rate_lock_extended",
        title: "Rate Lock Extended",
        description: `Rate lock extended by ${additionalDays || 15} days`,
        performedBy: user.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Extend rate lock error:", error);
      res.status(500).json({ error: "Failed to extend rate lock" });
    }
  });

  // Cancel a rate lock
  app.post("/api/rate-locks/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can cancel rate locks" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }

      // Verify caller is assigned to this application (assignment-scoped)
      const cancelAllowed = await verifyInternalStaffApplicationAccess(storage, lock.applicationId, user.id, user.role);
      if (!cancelAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const updated = await storage.updateRateLock(id, {
        status: "cancelled",
        cancelledBy: user.id,
        cancelledAt: new Date(),
        cancelReason: reason,
      });

      res.json(updated);
    } catch (error) {
      console.error("Cancel rate lock error:", error);
      res.status(500).json({ error: "Failed to cancel rate lock" });
    }
  });

  // ===== ECONSENT SYSTEM =====

  // Get consent templates
  app.get("/api/consent-templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getActiveConsentTemplates(
        firstQueryValue(req.query.type),
        firstQueryValue(req.query.state)
      );
      res.json(templates);
    } catch (error) {
      console.error("Get consent templates error:", error);
      res.status(500).json({ error: "Failed to get consent templates" });
    }
  });

  // Create consent template (admin only)
  app.post("/api/consent-templates", requireRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        consentType: z.string(),
        version: z.string(),
        state: z.string().optional(),
        title: z.string(),
        shortDescription: z.string().optional(),
        fullText: z.string(),
        regulatoryReference: z.string().optional(),
        requiredForLoanTypes: z.array(z.string()).optional(),
        effectiveDate: z.string().transform(s => new Date(s)),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const template = await storage.createConsentTemplate({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(template);
    } catch (error) {
      console.error("Create consent template error:", error);
      res.status(500).json({ error: "Failed to create consent template" });
    }
  });

  // Record borrower consent
  app.post("/api/consents", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      const schema = z.object({
        applicationId: z.string().optional(),
        templateId: z.string().optional(),
        consentType: z.string(),
        templateVersion: z.string().optional(),
        consentGiven: z.boolean(),
        consentMethod: z.enum(["click", "signature", "verbal", "paper"]),
        signatureData: z.string().optional(),
        signatureType: z.enum(["drawn", "typed", "none"]).optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // If an applicationId is provided, verify the requesting user is the actual borrower
      // who owns that application. Staff must not be allowed to forge consent records on
      // behalf of a borrower — consent is a borrower-only action.
      if (result.data.applicationId) {
        const application = await storage.getLoanApplication(result.data.applicationId);
        if (!application || application.userId !== user.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Generate content hash for tamper evidence
      const contentHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(result.data) + new Date().toISOString())
        .digest("hex");

      const consent = await storage.createBorrowerConsent({
        userId: user.id,
        ...result.data,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
        contentHash,
        consentedAt: new Date(),
      });

      // Log activity if application-related
      if (result.data.applicationId) {
        await storage.createDealActivity({
          applicationId: result.data.applicationId,
          activityType: "consent_given",
          title: `Consent: ${result.data.consentType}`,
          description: `Borrower provided ${result.data.consentType} consent`,
          performedBy: user.id,
        });
      }

      res.status(201).json(consent);
    } catch (error) {
      console.error("Record consent error:", error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // Revoke a consent the borrower granted for their own data. Only consent
  // types the borrower may self-revoke go through here: credit consent has a
  // dedicated staff-gated workflow (/api/credit/consent/:consentId/revoke)
  // because revoking it mid-application disrupts a regulated flow, and
  // e-disclosure withdrawal needs a paper-delivery fallback before it can be
  // honored. tax_document_use promises revocation in its template text.
  const SELF_REVOCABLE_CONSENT_TYPES = new Set(["tax_document_use"]);

  app.post("/api/consents/:consentType/revoke", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { consentType } = req.params;

      if (!SELF_REVOCABLE_CONSENT_TYPES.has(consentType)) {
        return res.status(400).json({ error: "This consent type cannot be revoked from here" });
      }

      const revoked = await storage.revokeConsentsByTypeAndUser(
        consentType,
        user.id,
        "borrower_requested",
      );
      if (revoked.length === 0) {
        return res.status(404).json({ error: "No active consent to revoke" });
      }

      // Revocation must stop downstream use of already-derived data, not just
      // future derivations: purge the derived tax_insights rows so the staff
      // DSCR feed (getRecentDscrCandidates) and the borrower graph stop
      // reading them. The encrypted extraction lineage stays on the source
      // document (extraction_raw_* columns) for audit purposes.
      let taxInsightsDeleted = 0;
      if (consentType === "tax_document_use") {
        taxInsightsDeleted = await storage.deleteTaxInsightsByUser(user.id);
      }

      await logAudit(req, "consent.revoked", "borrower_consent", revoked[0].id, {
        consentType,
        consentsRevoked: revoked.length,
        taxInsightsDeleted,
      });

      res.json({ revoked: revoked.length, taxInsightsDeleted });
    } catch (error) {
      console.error("Revoke consent error:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  // Get consents for current user
  app.get("/api/consents/me", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const consents = await storage.getBorrowerConsentsByUser(user.id);
      res.json(consents);
    } catch (error) {
      console.error("Get user consents error:", error);
      res.status(500).json({ error: "Failed to get consents" });
    }
  });

  // Get consents for an application
  app.get("/api/consents/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const consents = await storage.getBorrowerConsentsByApplication(applicationId);
      res.json(consents);
    } catch (error) {
      console.error("Get application consents error:", error);
      res.status(500).json({ error: "Failed to get consents" });
    }
  });

  // Check if specific consent exists for application
  app.get("/api/consents/check/:applicationId/:consentType", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId, consentType } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const consent = await storage.getConsentByTypeAndApplication(consentType, applicationId);
      res.json({ hasConsent: !!consent, consent });
    } catch (error) {
      console.error("Check consent error:", error);
      res.status(500).json({ error: "Failed to check consent" });
    }
  });

  // ===== PARTNER API INTEGRATIONS =====

  // Get all partner providers
  app.get("/api/partner-providers", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const serviceType = firstQueryValue(req.query.serviceType);
      let providers;
      if (serviceType) {
        providers = await storage.getPartnerProvidersByServiceType(serviceType);
      } else {
        providers = await storage.getAllPartnerProviders();
      }
      res.json(providers);
    } catch (error) {
      console.error("Get partner providers error:", error);
      res.status(500).json({ error: "Failed to get providers" });
    }
  });

  // Create partner provider (admin only)
  app.post("/api/partner-providers", requireRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        name: z.string(),
        code: z.string(),
        serviceType: z.string(),
        apiBaseUrl: z.string().optional(),
        apiVersion: z.string().optional(),
        baseFee: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        expectedTurnaroundHours: z.number().optional(),
        isTestMode: z.boolean().default(true),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const provider = await storage.createPartnerProvider({
        ...result.data,
        isActive: true,
      });

      res.status(201).json(provider);
    } catch (error) {
      console.error("Create partner provider error:", error);
      res.status(500).json({ error: "Failed to create provider" });
    }
  });

  // Create partner order (credit, title, appraisal, etc.)
  app.post("/api/partner-orders", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can create partner orders" });
      }

      const schema = z.object({
        applicationId: z.string(),
        providerId: z.string(),
        serviceType: z.string(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify caller is assigned to this application (assignment-scoped)
      const partnerOrderAllowed = await verifyInternalStaffApplicationAccess(storage, result.data.applicationId, user.id, user.role);
      if (!partnerOrderAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const provider = await storage.getPartnerProvider(result.data.providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const order = await storage.createPartnerOrder({
        ...result.data,
        status: "pending",
        orderedBy: user.id,
        orderedAt: new Date(),
        fee: provider.baseFee,
      });

      // Log activity
      await storage.createDealActivity({
        applicationId: result.data.applicationId,
        activityType: "partner_order_created",
        title: `${result.data.serviceType} Order Created`,
        description: `Order placed with ${provider.name}`,
        metadata: { orderId: order.id, providerId: provider.id },
        performedBy: user.id,
      });

      res.status(201).json(order);
    } catch (error) {
      console.error("Create partner order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get partner orders for an application
  app.get("/api/partner-orders/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const orders = await storage.getPartnerOrdersByApplication(applicationId);
      res.json(orders);
    } catch (error) {
      console.error("Get partner orders error:", error);
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  // Update partner order status (webhook simulation / manual update)
  app.patch("/api/partner-orders/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only" });
      }

      const { id } = req.params;
      const schema = z.object({
        status: z.enum(["pending", "submitted", "in_progress", "completed", "failed", "cancelled"]).optional(),
        resultSummary: z.record(z.any()).optional(),
        creditScoreExperian: z.number().optional(),
        creditScoreEquifax: z.number().optional(),
        creditScoreTransUnion: z.number().optional(),
        appraisedValue: z.string().optional(),
        titleStatus: z.string().optional(),
        completedAt: z.string().transform(s => new Date(s)).optional(),
        errorMessage: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify the order exists and caller is assigned to its application (assignment-scoped)
      const existingOrder = await storage.getPartnerOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      const partnerOrderUpdateAllowed = await verifyInternalStaffApplicationAccess(storage, existingOrder.applicationId, user.id, user.role);
      if (!partnerOrderUpdateAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const updated = await storage.updatePartnerOrder(id, result.data as any);
      if (!updated) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update partner order error:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // ===== DEAL TEAM MEMBERS =====

  // Get team members for an application
  app.get("/api/applications/:applicationId/team", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;

      // Verify access to application
      const app = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const team = await storage.getDealTeamMembers(applicationId);
      res.json(team);
    } catch (error) {
      console.error("Get deal team error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

  // Add team member to application (admin only).
  // Deal-team membership is the authorization boundary for partner file access,
  // so only admins may expand it to prevent silent self-grant escalations.
  app.post("/api/applications/:applicationId/team", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;

      const { applicationId } = req.params;
      const schema = z.object({
        userId: z.string().optional(),
        teamRole: z.string().min(1),
        externalName: z.string().optional(),
        externalEmail: z.string().email().optional(),
        externalPhone: z.string().optional(),
        externalCompany: z.string().optional(),
        isPrimary: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify application exists
      const app = await storage.getLoanApplication(applicationId);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const member = await storage.createDealTeamMember({
        ...result.data,
        applicationId,
        assignedBy: user.id,
        assignedAt: new Date(),
      });

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "team_updated",
        title: "Team member added",
        description: `${result.data.externalName || 'Team member'} added as ${result.data.teamRole.replace(/_/g, ' ')}`,
        performedBy: user.id,
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Add team member error:", error);
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  // Withdraw/cancel loan application (borrower can withdraw their own apps)
  app.post("/api/loan-applications/:applicationId/withdraw", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;

      const schema = z.object({
        reason: z.string().min(1),
        details: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Get the application
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Borrowers may withdraw their own application.
      // Internal staff may withdraw a file they are assigned to.
      // External partner roles (broker/lender) must not be able to place another
      // borrower's application into a terminal state.
      if (application.userId !== user.id) {
        if (!isInternalStaffRole(user.role)) {
          return res.status(403).json({ error: "You can only withdraw your own applications" });
        }
        // Non-admin internal staff must be on the deal team.
        if (user.role !== "admin") {
          const teamMembers = await storage.getDealTeamMembers(applicationId);
          const isMember = teamMembers.some(m => m.userId === user.id);
          if (!isMember) {
            return res.status(403).json({ error: "You are not assigned to this application" });
          }
        }
      }

      // Check if already withdrawn or in a terminal state
      if ((LOAN_APP_TERMINAL_STATUSES as readonly string[]).includes(application.status)) {
        return res.status(400).json({ error: "Application cannot be withdrawn in its current state" });
      }

      // Single writer: stamps the HMDA Reg C action-taken code 4 (previously
      // missed on borrower-initiated withdrawals), emits task-engine events,
      // and keeps the borrower state machine in sync.
      await updatePipelineStage(applicationId, "withdrawn");
      const updatedApp = await storage.getLoanApplication(applicationId);

      // Log the withdrawal activity
      await storage.createDealActivity({
        applicationId,
        activityType: "application_withdrawn",
        title: "Application Withdrawn",
        description: `Application withdrawn by ${user.role === "borrower" ? "borrower" : "staff"}. Reason: ${result.data.reason}${result.data.details ? `. Details: ${result.data.details}` : ""}`,
        performedBy: user.id,
        metadata: {
          reason: result.data.reason,
          details: result.data.details || "",
          withdrawnAt: new Date().toISOString(),
        },
      });

      res.json({ success: true, application: updatedApp });
    } catch (error) {
      console.error("Withdraw application error:", error);
      res.status(500).json({ error: "Failed to withdraw application" });
    }
  });

  // Update team member (admin only).
  // Restricting to admin prevents non-admin staff from modifying team membership,
  // which is the authorization boundary for partner file access.
  app.patch("/api/deal-team/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;

      const { id } = req.params;
      const schema = z.object({
        teamRole: z.string().optional(),
        externalName: z.string().optional(),
        externalEmail: z.string().email().optional(),
        externalPhone: z.string().optional(),
        externalCompany: z.string().optional(),
        isPrimary: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const existingMember = await storage.getDealTeamMember(id);
      if (!existingMember) {
        return res.status(404).json({ error: "Team member not found" });
      }

      const updated = await storage.updateDealTeamMember(id, result.data);
      if (!updated) {
        return res.status(404).json({ error: "Team member not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update team member error:", error);
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  // Remove team member (admin only).
  // Restricting to admin prevents removal of legitimate team members and
  // protects the assignment model that authorizes partner file access.
  app.delete("/api/deal-team/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;

      const { id } = req.params;
      
      const member = await storage.getDealTeamMember(id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      await storage.removeDealTeamMember(id);

      // Log activity
      await storage.createDealActivity({
        applicationId: member.applicationId,
        activityType: "team_updated",
        title: "Team member removed",
        description: `Team member removed from ${member.teamRole.replace(/_/g, ' ')} role`,
        performedBy: user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // Assign (or clear) the loan officer on an application (admin only).
  // The loanOfficerId is what grants LO/LOA object-level access to the file
  // (see access checks in borrower.ts / task-engine.ts / agent-broker.ts), so
  // restricting mutation to admin keeps that authorization boundary tight.
  app.patch("/api/loan-applications/:applicationId/loan-officer", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;

      const schema = z.object({
        loanOfficerId: z.string().min(1).nullable(),
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // When assigning (non-null), the target must be an internal loan-officer user.
      if (result.data.loanOfficerId) {
        const target = await storage.getUser(result.data.loanOfficerId);
        if (!target || (target.role !== "lo" && target.role !== "loa")) {
          return res.status(400).json({ error: "Assigned user must be a loan officer (lo or loa)" });
        }
      }

      const updated = await storage.updateLoanApplication(applicationId, {
        loanOfficerId: result.data.loanOfficerId,
      });

      await storage.createDealActivity({
        applicationId,
        activityType: "team_updated",
        title: result.data.loanOfficerId ? "Loan officer assigned" : "Loan officer unassigned",
        description: result.data.loanOfficerId
          ? "A loan officer was assigned to this file."
          : "The loan officer was removed from this file.",
        performedBy: user.id,
      });

      res.json({ success: true, application: updated });
    } catch (error) {
      console.error("Assign loan officer error:", error);
      res.status(500).json({ error: "Failed to assign loan officer" });
    }
  });

  // Get all applications where user is a team member (for staff)
  app.get("/api/my-team-assignments", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const assignments = await storage.getTeamMembersByUser(user.id);
      res.json(assignments);
    } catch (error) {
      console.error("Get team assignments error:", error);
      res.status(500).json({ error: "Failed to get assignments" });
    }
  });

  // Get available staff for team assignment
  app.get("/api/available-staff", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const allUsers = await storage.getAllUsers();
      const staffMembers = allUsers.filter(u => isStaffRole(u.role));
      
      // Return minimal info for privacy
      const staff = staffMembers.map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        role: s.role,
      }));

      res.json(staff);
    } catch (error) {
      console.error("Get available staff error:", error);
      res.status(500).json({ error: "Failed to get staff" });
    }
  });

  // ============================================================================
  // DOCUMENT PACKAGES - Lender-Ready Document Organization
  // ============================================================================

  // Validation schemas for document packages - using drizzle-zod schemas from shared/schema.ts
  const createPackageValidation = insertDocumentPackageSchema.omit({ createdByUserId: true });
  const updatePackageValidation = insertDocumentPackageSchema.partial().omit({ 
    createdByUserId: true, 
    applicationId: true 
  });
  const addPackageItemValidation = insertDocumentPackageItemSchema.omit({ packageId: true });
  const updatePackageItemValidation = insertDocumentPackageItemSchema.partial().omit({ 
    packageId: true, 
    documentId: true 
  });

  // Create document package
  app.post("/api/document-packages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const parsed = createPackageValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid package data", details: parsed.error.flatten() });
      }

      // Verify the caller has authorized access to this loan file
      const application = await storage.getLoanApplicationWithAccess(parsed.data.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const packageData = {
        ...parsed.data,
        createdByUserId: user.id,
      };

      const pkg = await storage.createDocumentPackage(packageData);

      await storage.createDealActivity({
        applicationId: pkg.applicationId,
        activityType: "note",
        title: "Document Package Created",
        description: `Created package: ${pkg.name}`,
        performedBy: user.id,
      });

      res.status(201).json(pkg);
    } catch (error) {
      console.error("Create document package error:", error);
      res.status(500).json({ error: "Failed to create document package" });
    }
  });

  // Get document packages for application
  app.get("/api/applications/:applicationId/document-packages", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const user = req.user as User;

      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const packages = await storage.getDocumentPackagesByApplication(applicationId);
      res.json(packages);
    } catch (error) {
      console.error("Get document packages error:", error);
      res.status(500).json({ error: "Failed to get document packages" });
    }
  });

  // Get single document package with items
  app.get("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;

      const pkg = await storage.getDocumentPackage(id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const items = await storage.getDocumentPackageItems(id);
      res.json({ ...pkg, items });
    } catch (error) {
      console.error("Get document package error:", error);
      res.status(500).json({ error: "Failed to get document package" });
    }
  });

  // Update document package
  app.patch("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists
      const existingPkg = await storage.getDocumentPackage(id);
      if (!existingPkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Verify the caller has authorized access to the parent loan file
      const application = await storage.getLoanApplicationWithAccess(existingPkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = updatePackageValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
      }

      // Handle status transitions and set timestamps
      const updateData: any = { ...parsed.data };
      if (parsed.data.status === "sent" && existingPkg.status !== "sent") {
        updateData.sentAt = new Date();
      }
      if (parsed.data.status === "acknowledged" && existingPkg.status !== "acknowledged") {
        updateData.acknowledgedAt = new Date();
      }

      const pkg = await storage.updateDocumentPackage(id, updateData);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      res.json(pkg);
    } catch (error) {
      console.error("Update document package error:", error);
      res.status(500).json({ error: "Failed to update document package" });
    }
  });

  // Delete document package
  app.delete("/api/document-packages/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists before deleting
      const pkg = await storage.getDocumentPackage(id);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Verify the caller has authorized access to the parent loan file
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDocumentPackage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete document package error:", error);
      res.status(500).json({ error: "Failed to delete document package" });
    }
  });

  // Add document to package
  app.post("/api/document-packages/:packageId/items", isAuthenticated, async (req, res) => {
    try {
      const { packageId } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Verify package exists
      const pkg = await storage.getDocumentPackage(packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }

      // Verify the caller has authorized access to the parent loan file
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = addPackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid item data", details: parsed.error.flatten() });
      }

      // Verify that the referenced document belongs to the same loan file as the package.
      // Without this check a staff member who has access to two loan files can inject
      // a document from file B into a package that belongs to file A.
      const referencedDoc = await storage.getDocument(parsed.data.documentId);
      if (!referencedDoc) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (referencedDoc.applicationId !== pkg.applicationId) {
        return res.status(403).json({ error: "Document does not belong to this loan file" });
      }

      const item = await storage.addDocumentToPackage({
        ...parsed.data,
        packageId,
      });

      res.status(201).json(item);
    } catch (error) {
      console.error("Add document to package error:", error);
      res.status(500).json({ error: "Failed to add document to package" });
    }
  });

  // Update package item
  app.patch("/api/document-package-items/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Resolve item → package → application to enforce file-level access
      const existingItem = await storage.getDocumentPackageItem(id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      const pkg = await storage.getDocumentPackage(existingItem.packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const parsed = updatePackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
      }

      const item = await storage.updateDocumentPackageItem(id, parsed.data);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Update package item error:", error);
      res.status(500).json({ error: "Failed to update package item" });
    }
  });

  // Remove document from package
  app.delete("/api/document-package-items/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      // Resolve item → package → application to enforce file-level access
      const existingItem = await storage.getDocumentPackageItem(id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      const pkg = await storage.getDocumentPackage(existingItem.packageId);
      if (!pkg) {
        return res.status(404).json({ error: "Package not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(pkg.applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.removeDocumentFromPackage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove document from package error:", error);
      res.status(500).json({ error: "Failed to remove document from package" });
    }
  });

  // Get documents for application (for package builder)
  app.get("/api/applications/:applicationId/documents", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const user = req.user as User;

      // Use getLoanApplicationWithAccess so broker/lender are checked against deal-team
      // membership rather than being granted blanket staff access.
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }

      const docs = await storage.getDocumentsByApplication(applicationId);
      res.json(docs);
    } catch (error) {
      console.error("Get application documents error:", error);
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  // ============================================
  // Team Messaging API Routes
  // ============================================

  // Team members for the Messages view. A borrower sees only THEIR assigned
  // loan team (deal-team members + assigned LOs), not the whole staff
  // directory; staff keep the full list for internal coordination. Borrowers
  // with no team assigned yet fall back to all staff so they can still reach
  // someone (see storage.getTeamMembersForBorrower).
  app.get("/api/team-members", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const staffUsersWithPresence = isStaffRole(user.role)
        ? await storage.getTeamMembersWithPresence()
        : await storage.getTeamMembersForBorrower(user.id);

      // Transform to include display info and presence
      const teamMembers = staffUsersWithPresence.map(user => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Team Member',
        role: user.role,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        initials: getInitials(user),
        presenceStatus: user.presenceStatus,
      }));
      
      res.json(teamMembers);
    } catch (error) {
      console.error("Get team members error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });
  
  // Update presence (heartbeat endpoint)
  app.post("/api/presence/heartbeat", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      await storage.updateUserPresence(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Presence update error:", error);
      res.status(500).json({ error: "Failed to update presence" });
    }
  });

  // Get all conversations for current user
  app.get("/api/messages/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const conversations = await storage.getConversations(userId);
      
      const partnerIds = [...new Set(conversations.map(c => c.partnerId).filter(Boolean))];
      const partners = await storage.getUsersByIds(partnerIds);
      const partnerMap = new Map(partners.map(p => [p.id, p]));

      const enrichedConversations = conversations.map((conv) => {
        const partner = partnerMap.get(conv.partnerId) || null;
        return {
          ...conv,
          partner: partner ? {
            id: partner.id,
            name: `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.email || 'User',
            role: partner.role,
            email: partner.email,
            profileImageUrl: partner.profileImageUrl,
            initials: getInitials(partner),
          } : null,
        };
      });
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Get messages with a specific user
  app.get("/api/messages/:otherUserId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;
      
      const messages = await storage.getMessages(userId, otherUserId);
      
      // Mark messages as read
      await storage.markMessagesAsRead(userId, otherUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Send a message (supports regular text and document requests).
  // Borrower communications are loan-file records: every send is validated,
  // scoped to borrower↔staff pairs, stamped with the loan application, audit
  // logged, and the recipient is actually notified (in-app + email).
  const sendMessageSchema = z.object({
    recipientId: z.string().min(1),
    message: z.string().trim().min(1).max(2000),
    applicationId: z.string().optional(),
    messageType: z.enum(["text", "document_request"]).default("text"),
    // Set by the composer when the LO consciously sends past a Tier-2 (Reg N
    // §1014.3) compliance warning; the override is audit-logged (LO-5).
    acknowledgeComplianceWarning: z.boolean().optional(),
    documentRequestData: z
      .object({
        documentType: z.string().min(1).max(100),
        documentName: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        status: z.literal("pending").default("pending"),
      })
      .optional(),
  });

  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;

      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid message", details: parsed.error.flatten().fieldErrors });
      }
      const { recipientId, message, messageType, documentRequestData } = parsed.data;

      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      // Scoping: messaging exists between a borrower and their loan team.
      // Borrower↔borrower (or any pair with no staff member) is not a thing.
      const senderIsStaff = isStaffRole(user.role);
      const recipientIsStaff = isStaffRole(recipient.role || "");
      if (!senderIsStaff && !recipientIsStaff) {
        return res.status(403).json({ error: "Messages can only be exchanged with your loan team" });
      }

      // A borrower may only message staff on their OWN team (deal-team + LOs).
      // Mirrors the scoped team-members list, so they can't reach an arbitrary
      // staff member by user id. If they have no team yet, the team list falls
      // back to all staff, and so does this check — no dead end.
      if (!senderIsStaff && recipientIsStaff) {
        const onTeam = await storage.isStaffOnBorrowerTeam(user.id, recipientId);
        if (!onTeam) {
          return res.status(403).json({ error: "You can only message members of your assigned loan team" });
        }
      }

      // Document requests are a staff→borrower workflow.
      if (messageType === "document_request") {
        if (!senderIsStaff) {
          return res.status(403).json({ error: "Only your loan team can send document requests" });
        }
        if (!documentRequestData) {
          return res.status(400).json({ error: "documentRequestData is required for document requests" });
        }
      }

      // Stamp the message onto the borrower's loan file so the conversation is
      // part of the (retained, examinable) loan record. If the caller supplied
      // an applicationId, verify it belongs to the borrower side of the pair;
      // otherwise derive the borrower's most recent application.
      const borrowerParty = senderIsStaff ? recipient : user;
      let applicationId: string | null = null;
      if (parsed.data.applicationId) {
        const application = await storage.getLoanApplication(parsed.data.applicationId);
        if (!application || application.userId !== borrowerParty.id) {
          return res.status(403).json({ error: "Application does not belong to this conversation" });
        }
        applicationId = application.id;
      } else {
        const apps = await storage.getLoanApplicationsByUser(borrowerParty.id);
        applicationId = apps[0]?.id ?? null; // newest first; null pre-application
      }

      // LO-5 comms compliance lint on STAFF → borrower outbound free text.
      // Tier 1 (Reg Z §1026.24 trigger terms) is a hard block routed to the
      // disclosed channels (Loan Estimate / Advisor Report); Tier 2 (Reg N
      // §1014.3 promise phrases) warns and needs an explicit, logged override
      // to send. Borrower → staff inbound and structured document requests are
      // not advertising and are not linted. Enforcement is server-side, so the
      // block holds even if the composer is bypassed.
      if (senderIsStaff && messageType === "text") {
        const lint = lintOutboundText(message);
        if (lint.blocked) {
          logAudit(req, "comms_lint.blocked", "loan_application", applicationId ?? undefined, {
            recipientId,
            categories: lint.triggerMatches.map((m) => m.category),
            citations: lint.triggerMatches.map((m) => m.citation),
          });
          return res.status(422).json({
            error: "This message states specific loan terms that require federal disclosures. Send the figures via the borrower's Loan Estimate or Advisor Report instead.",
            complianceBlock: true,
            lint,
            disclosureBlock: REG_Z_ADVERTISING_DISCLOSURE_BLOCK,
          });
        }
        if (lint.requiresOverride && !parsed.data.acknowledgeComplianceWarning) {
          logAudit(req, "comms_lint.warned", "loan_application", applicationId ?? undefined, {
            recipientId,
            categories: lint.promiseMatches.map((m) => m.category),
          });
          return res.status(422).json({
            error: "This message may contain a prohibited representation. Review the suggested rewrite, or send anyway to record an override.",
            complianceWarning: true,
            lint,
          });
        }
        if (lint.requiresOverride && parsed.data.acknowledgeComplianceWarning) {
          logAudit(req, "comms_lint.override", "loan_application", applicationId ?? undefined, {
            recipientId,
            categories: lint.promiseMatches.map((m) => m.category),
            citations: lint.promiseMatches.map((m) => m.citation),
          });
        }
      }

      const newMessage = await storage.sendMessage({
        senderId: user.id,
        recipientId,
        message,
        applicationId,
        messageType,
        documentRequestData: documentRequestData || null,
        isRead: false,
      });

      logAudit(req, "message.sent", "team_message", newMessage.id, {
        recipientId,
        applicationId,
        messageType,
      });

      // Notify the recipient — the UI promises this, so the backend delivers it.
      // The email intentionally carries no message content (PII stays behind login).
      const senderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Your loan team";
      try {
        const isDocRequest = messageType === "document_request";
        await storage.createNotification({
          userId: recipientId,
          type: isDocRequest ? "document_request" : "message_received",
          title: isDocRequest ? "Document requested" : `New message from ${senderName}`,
          body: isDocRequest
            ? `${senderName} requested: ${documentRequestData!.documentName}. Upload it from your Documents page.`
            : "You have a new secure message. Open Messages to read and reply.",
          entityType: "team_message",
          entityId: newMessage.id,
          status: "unread",
        });
        if (recipient.email) {
          if (isDocRequest) {
            sendNotificationEmail({
              type: "document_requested",
              recipientEmail: recipient.email,
              data: { borrowerName: recipient.firstName || "there", documentName: documentRequestData!.documentName },
            });
          } else {
            sendNotificationEmail({
              type: "message_received",
              recipientEmail: recipient.email,
              data: { recipientName: recipient.firstName || "there", senderName },
            });
          }
        }
      } catch (notifyErr) {
        // Delivery of the message itself must not fail on notification errors.
        console.error("[Messages] Failed to notify recipient (non-fatal):", notifyErr);
      }

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  
  // Update document request status (when borrower uploads or staff approves)
  app.patch("/api/messages/:messageId/document-request", isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { status, documentId } = req.body;
      const user = req.user as User;

      if (!status || !['pending', 'submitted', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Valid status is required" });
      }

      // Fetch the message so we can enforce participant and role-based transition checks
      // before mutating anything.
      const message = await storage.getMessageById(messageId);
      if (!message || message.messageType !== 'document_request') {
        return res.status(404).json({ error: "Document request not found" });
      }

      const isSender = message.senderId === user.id;
      const isRecipient = message.recipientId === user.id;

      // Caller must be a participant in the conversation.
      if (!isSender && !isRecipient) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify access to the associated loan file when one is present.
      if (message.applicationId) {
        const application = await storage.getLoanApplicationWithAccess(message.applicationId, user.id, user.role);
        if (!application) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Enforce which side of the conversation may perform each transition:
      //   submitted  → only the recipient (borrower) may mark a request as submitted
      //   approved / rejected / pending (reset) → only the sender (staff who made the request)
      if (status === 'submitted') {
        if (!isRecipient) {
          return res.status(403).json({ error: "Only the document recipient may mark a request as submitted" });
        }
      } else {
        // approved, rejected, pending — only the original requesting staff member
        if (!isSender || !isStaffRole(user.role)) {
          return res.status(403).json({ error: "Only the requesting staff member may approve, reject, or reset a document request" });
        }
      }

      // State-machine guard (prevents lost updates when borrower + staff act
      // concurrently, e.g. borrower re-submits while staff approves). Only the
      // listed prior states may transition to the target; the update below is
      // conditional on the current state, so a stale writer gets a 409.
      const LEGAL_FROM: Record<string, string[]> = {
        submitted: ["pending", "rejected"],       // borrower (re)uploads
        approved: ["submitted"],                   // staff clears a submitted doc
        rejected: ["submitted"],                   // staff bounces a submitted doc
        pending: ["submitted", "approved", "rejected"], // staff resets
      };
      const currentStatus = (message.documentRequestData as { status?: string } | null)?.status ?? "pending";
      if (currentStatus === status) {
        return res.json(message); // idempotent no-op
      }
      if (!LEGAL_FROM[status]?.includes(currentStatus)) {
        return res.status(409).json({
          error: `Cannot move a "${currentStatus}" request to "${status}".`,
          currentStatus,
        });
      }

      const updated = await storage.updateDocumentRequestStatus(messageId, status, documentId, LEGAL_FROM[status]);

      if (!updated) {
        // 0 rows matched the expected prior state — another writer beat us.
        const fresh = await storage.getMessageById(messageId);
        return res.status(409).json({
          error: "This request was just updated by someone else. Refresh to see the latest status.",
          currentStatus: (fresh?.documentRequestData as { status?: string } | null)?.status ?? null,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update document request error:", error);
      res.status(500).json({ error: "Failed to update document request" });
    }
  });
  
  // Get pending document requests for current user
  app.get("/api/messages/document-requests/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const pendingRequests = await storage.getPendingDocumentRequests(userId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Get pending document requests error:", error);
      res.status(500).json({ error: "Failed to get pending document requests" });
    }
  });

  // Get unread message count
  app.get("/api/messages/unread/count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const count = await storage.getUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // Helper function to get initials from user
  function getInitials(user: User): string {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'TM';
  }

  // ================================
  // DPA Programs API Routes
  // ================================

  // Get DPA programs with optional filters
  app.get("/api/dpa-programs", async (req, res) => {
    try {
      const state = firstQueryValue(req.query.state);
      const firstTimeBuyer = firstQueryValue(req.query.firstTimeBuyer);
      const minCreditScore = firstQueryValue(req.query.minCreditScore);
      const maxIncome = firstQueryValue(req.query.maxIncome);
      const filters: any = {};
      if (state) filters.state = state;
      if (firstTimeBuyer === "true") filters.firstTimeBuyer = true;
      if (minCreditScore) filters.minCreditScore = parseInt(minCreditScore);
      if (maxIncome) filters.maxIncome = parseFloat(maxIncome);

      const programs = await storage.getDpaPrograms(Object.keys(filters).length > 0 ? filters : undefined);

      let filtered = programs;
      if (filters.firstTimeBuyer === true) {
        // Show all programs (both first-time-only and general) since first-time buyers qualify for both
      } else if (filters.firstTimeBuyer === false) {
        filtered = programs.filter(p => !p.firstTimeBuyerOnly);
      }
      if (filters.minCreditScore) {
        filtered = filtered.filter(p => !p.minCreditScore || p.minCreditScore <= filters.minCreditScore);
      }
      if (filters.maxIncome) {
        filtered = filtered.filter(p => !p.maxIncome || parseFloat(p.maxIncome) >= filters.maxIncome);
      }

      res.json(filtered);
    } catch (error) {
      console.error("Get DPA programs error:", error);
      res.status(500).json({ error: "Failed to get DPA programs" });
    }
  });

  // Get specific DPA program
  app.get("/api/dpa-programs/:id", async (req, res) => {
    try {
      const program = await storage.getDpaProgram(req.params.id);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      console.error("Get DPA program error:", error);
      res.status(500).json({ error: "Failed to get program" });
    }
  });

  // ================================
  // Digital Onboarding API Routes
  // ================================

  function detectBorrowerType(app: any): string {
    if (!app) return "standard";
    if (app.employmentType === "self_employed") return "self_employed";
    if (app.isFirstTimeBuyer) return "first_time_buyer";
    const nonQmIndicators = [
      app.loanType && !["conventional", "fha", "va", "usda"].includes(app.loanType),
      app.creditScore && app.creditScore < 620,
      app.incomeDocType === "bank_statement" || app.incomeDocType === "asset_based",
    ];
    if (nonQmIndicators.some(Boolean)) return "non_qm";
    return "standard";
  }

  // Get onboarding status - aggregates identity, KYC, profile data
  app.get("/api/onboarding/status", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;

      const [profile, kbaSessions, kycScreenings, verificationRecords, applications] = await Promise.all([
        storage.getOnboardingProfileByUser(userId),
        storage.getKbaSessionsByUser(userId),
        storage.getKycScreeningsByUser(userId),
        storage.getVerificationsByUser(userId),
        storage.getLoanApplicationsByUser(userId),
      ]);

      const latestKba = kbaSessions[0];
      const latestKyc = kycScreenings[0];
      const latestApp = applications[0];

      const borrowerType = detectBorrowerType(latestApp);

      res.json({
        profile: profile || null,
        kba: latestKba ? { id: latestKba.id, status: latestKba.status, score: latestKba.score, attemptNumber: latestKba.attemptNumber, maxAttempts: latestKba.maxAttempts } : null,
        kyc: latestKyc || null,
        verifications: verificationRecords,
        borrowerType,
        applicationId: latestApp?.id || null,
        applicationStatus: latestApp?.status || null,
      });
    } catch (error) {
      console.error("Get onboarding status error:", error);
      res.status(500).json({ error: "Failed to get onboarding status" });
    }
  });

  // Create or get onboarding profile
  app.post("/api/onboarding/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      let profile = await storage.getOnboardingProfileByUser(userId);

      if (!profile) {
        const applications = await storage.getLoanApplicationsByUser(userId);
        const latestApp = applications[0];

        const borrowerType = detectBorrowerType(latestApp);

        profile = await storage.createOnboardingProfile({
          userId,
          applicationId: latestApp?.id || null,
          borrowerType,
          journeyStatus: "not_started",
          currentStep: "identity_verification",
        });
      }

      res.json(profile);
    } catch (error) {
      console.error("Create onboarding profile error:", error);
      res.status(500).json({ error: "Failed to create onboarding profile" });
    }
  });

  // Update onboarding profile
  app.patch("/api/onboarding/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getOnboardingProfile(req.params.id);
      if (!profile || profile.userId !== req.user!.id) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const allowedFields = [
        "journeyStatus", "currentStep", "completedSteps", "progressPercent",
        "identityVerified", "kycCleared", "documentsComplete",
        "personalInfoComplete",
      ];
      const safeUpdate: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          safeUpdate[key] = req.body[key];
        }
      }

      const updated = await storage.updateOnboardingProfile(req.params.id, safeUpdate);
      res.json(updated);
    } catch (error) {
      console.error("Update onboarding profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // KBA - Start a new session
  app.post("/api/onboarding/kba/start", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.body;

      const existingSessions = await storage.getKbaSessionsByUser(userId);
      const passedSession = existingSessions.find(s => s.status === "passed");
      if (passedSession) {
        return res.json({ session: passedSession, alreadyPassed: true });
      }

      const failedCount = existingSessions.filter(s => s.status === "failed").length;
      if (failedCount >= 3) {
        return res.status(403).json({ error: "Maximum KBA attempts exceeded. Please contact support." });
      }

      const attemptNumber = failedCount + 1;
      const questions = generateKBAQuestions(userId, attemptNumber);

      const session = await storage.createKbaSession({
        userId,
        applicationId: applicationId || null,
        status: "in_progress",
        questionsData: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices, correctIndex: q.correctIndex })),
        totalQuestions: questions.length,
        passingScore: 4,
        attemptNumber,
        maxAttempts: 3,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      res.json({
        session: {
          id: session.id,
          status: session.status,
          attemptNumber: session.attemptNumber,
          maxAttempts: session.maxAttempts,
          questions: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices })),
        },
      });
    } catch (error) {
      console.error("Start KBA session error:", error);
      res.status(500).json({ error: "Failed to start KBA session" });
    }
  });

  // KBA - Submit answers
  app.post("/api/onboarding/kba/:id/submit", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.getKbaSession(req.params.id);
      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "in_progress") {
        return res.status(400).json({ error: "Session is no longer active" });
      }

      if (session.expiresAt && new Date() > session.expiresAt) {
        await storage.updateKbaSession(session.id, { status: "expired" });
        return res.status(400).json({ error: "Session has expired" });
      }

      const { answers } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Answers array is required" });
      }

      const questionsData = session.questionsData as any[];

      let correctCount = 0;
      const gradedAnswers = answers.map((answer: { questionId: string; selectedIndex: number }) => {
        const storedQuestion = questionsData.find((q: any) => q.id === answer.questionId);
        const correct = storedQuestion ? answer.selectedIndex === storedQuestion.correctIndex : false;
        if (correct) correctCount++;
        return { questionId: answer.questionId, selectedIndex: answer.selectedIndex, correct };
      });

      const passed = correctCount >= (session.passingScore || 4);
      const status = passed ? "passed" : "failed";

      await storage.updateKbaSession(session.id, {
        status,
        answersData: gradedAnswers,
        score: correctCount,
        completedAt: new Date(),
      });

      if (passed) {
        const profile = await storage.getOnboardingProfileByUser(req.user!.id);
        if (profile) {
          const completedSteps = [...(profile.completedSteps || [])];
          if (!completedSteps.includes("kba_verification")) {
            completedSteps.push("kba_verification");
          }
          // NOTE: identityVerified is intentionally NOT set to true here.
          // This KBA flow is simulated and the questions are not derived from
          // real borrower credit-bureau records; granting identity-verified status
          // from a simulated challenge would create false compliance evidence.
          // identityVerified must only be set to true by a real KBA provider
          // integration (e.g. LexisNexis, Experian KIQ) once wired in.
          await storage.updateOnboardingProfile(profile.id, {
            completedSteps,
            progressPercent: Math.min(100, (profile.progressPercent || 0) + 20),
          });
        }
      }

      res.json({
        status,
        score: correctCount,
        totalQuestions: questionsData.length,
        passed,
        // Surface the pending-provider note so the frontend can inform the user.
        identityVerificationPending: passed,
        remainingAttempts: passed ? 0 : Math.max(0, (session.maxAttempts || 3) - (session.attemptNumber || 1)),
      });
    } catch (error) {
      console.error("Submit KBA answers error:", error);
      res.status(500).json({ error: "Failed to submit answers" });
    }
  });

  // KYC/AML - Trigger screening
  app.post("/api/onboarding/kyc/screen", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { applicationId } = req.body;

      const existing = await storage.getKycScreeningsByUser(userId);
      const recentCleared = existing.find(s => s.overallStatus === "cleared" && s.expiresAt && new Date(s.expiresAt) > new Date());
      if (recentCleared) {
        return res.json({ screening: recentCleared, alreadyCleared: true });
      }

      const screening = await storage.createKycScreening({
        userId,
        applicationId: applicationId || null,
        overallStatus: "in_progress",
      });

      simulateKycScreening(screening.id);

      res.json({ screening, message: "KYC/AML screening initiated" });
    } catch (error) {
      console.error("KYC screening error:", error);
      res.status(500).json({ error: "Failed to initiate screening" });
    }
  });

  // KYC/AML - Get screening status
  app.get("/api/onboarding/kyc/status", isAuthenticated, async (req, res) => {
    try {
      const screenings = await storage.getKycScreeningsByUser(req.user!.id);
      res.json({ screening: screenings[0] || null });
    } catch (error) {
      console.error("Get KYC status error:", error);
      res.status(500).json({ error: "Failed to get screening status" });
    }
  });

  // Onboarding Feedback
  app.post("/api/onboarding/feedback", isAuthenticated, async (req, res) => {
    try {
      const feedbackSchema = z.object({
        step: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        feedbackType: z.enum(["general", "difficulty", "suggestion", "praise"]).optional(),
      });

      const validated = feedbackSchema.parse(req.body);
      const feedback = await storage.createOnboardingFeedback({
        userId: req.user!.id,
        ...validated,
      });

      res.json(feedback);
    } catch (error) {
      console.error("Submit feedback error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Helper: Generate KBA questions for a specific user session.
  //
  // NOTE: In production this must be replaced by a real KBA provider (e.g. LexisNexis,
  // Experian KIQ) that issues user-specific questions derived from the borrower's actual
  // credit-bureau records. The simulation below is intentionally non-functional as a
  // security check: it uses a crypto-derived, per-user-per-attempt seed so that
  // (a) each user is shown a unique subset of questions from a large pool, and
  // (b) the correct answer index is randomised per user and cannot be memorised from
  //     one account and applied to another.
  //
  // The "correct" answers in the simulation do not correspond to real borrower data —
  // identityVerified will therefore remain unset by this flow until a real provider
  // is wired in and this helper is replaced.
  function generateKBAQuestions(userId: string, attemptNumber: number): Array<{
    id: string;
    question: string;
    choices: string[];
    correctIndex: number;
  }> {
    // Large question pool — far more than will be shown in any single session.
    const questionPool = [
      { id: "addr1", question: "Which of the following addresses have you been associated with?", choices: ["123 Oak Street, Springfield", "456 Maple Ave, Portland", "789 Pine Rd, Denver", "None of the above"] },
      { id: "addr2", question: "Which address below matches a previous residence?", choices: ["22 Birch Lane, Austin", "47 Elm Court, Phoenix", "91 Cedar Blvd, Miami", "None of the above"] },
      { id: "addr3", question: "Which ZIP code have you lived in?", choices: ["60614", "97201", "85001", "None of the above"] },
      { id: "cnty1", question: "In which of the following counties have you lived?", choices: ["Cook County", "King County", "Maricopa County", "None of the above"] },
      { id: "cnty2", question: "Which county is associated with a past address of yours?", choices: ["Travis County", "Multnomah County", "Miami-Dade County", "None of the above"] },
      { id: "phone1", question: "Which of the following phone numbers is associated with you?", choices: ["(555) 123-4567", "(555) 234-5678", "(555) 345-6789", "None of the above"] },
      { id: "phone2", question: "Which area code appears on a phone number linked to you?", choices: ["312", "503", "602", "None of the above"] },
      { id: "bank1", question: "Which financial institution have you had an account with?", choices: ["First National Bank", "Pacific Credit Union", "Metro Savings", "None of the above"] },
      { id: "bank2", question: "Which of the following lenders have you done business with?", choices: ["Lakeside Mortgage", "Summit Lending", "Valley Home Loans", "None of the above"] },
      { id: "auto1", question: "What type of vehicle have you previously registered?", choices: ["Sedan", "SUV", "Truck", "None of the above"] },
      { id: "auto2", question: "Which vehicle make is associated with a past registration of yours?", choices: ["Toyota", "Ford", "Honda", "None of the above"] },
      { id: "emp1", question: "Which employer name appears in your work history?", choices: ["Acme Corp", "Globex Industries", "Initech Solutions", "None of the above"] },
      { id: "emp2", question: "In which industry have you been employed?", choices: ["Healthcare", "Technology", "Construction", "None of the above"] },
      { id: "edu1", question: "Which institution have you attended?", choices: ["State University", "City Community College", "Regional Technical Institute", "None of the above"] },
      { id: "rel1", question: "Which of the following is a relative's name associated with your records?", choices: ["James Mitchell", "Linda Torres", "Robert Chen", "None of the above"] },
    ];

    // Derive a deterministic but user-unique numeric seed from userId + attemptNumber
    // using a one-way hash so it cannot be predicted without the userId.
    const seedInput = `${userId}:kba:${attemptNumber}`;
    const hashHex = crypto.createHash("sha256").update(seedInput).digest("hex");
    // Convert first 8 hex chars to a 32-bit integer seed.
    const seed = parseInt(hashHex.slice(0, 8), 16);

    // Seeded pseudo-random number generator (mulberry32).
    let s = seed;
    function rand(): number {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Seeded Fisher-Yates shuffle to pick 5 questions unique to this user/attempt.
    const pool = [...questionPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = pool.slice(0, 5);

    // For each selected question, assign a correct index using the seeded RNG and
    // then shuffle the choices so the index position also varies per user.
    return selected.map((q, qi) => {
      // Choose a correct index deterministically for this user/question slot.
      const correctPos = Math.floor(rand() * q.choices.length);
      const tagged = q.choices.map((text, i) => ({ text, isCorrect: i === correctPos }));
      // Shuffle choices with the seeded RNG so position cannot be predicted externally.
      for (let i = tagged.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
      }
      const newCorrectIndex = tagged.findIndex(c => c.isCorrect);
      return {
        id: `${q.id}_${qi}`,
        question: q.question,
        choices: tagged.map(c => c.text),
        correctIndex: newCorrectIndex,
      };
    });
  }

  // Helper: Initiate KYC/AML screening checks.
  // Each check transitions to "pending_review" once it has been submitted to the
  // (simulated) screening provider. The overall screening remains in "pending_review"
  // until a staff member reviews the results and manually marks it cleared or failed.
  // This prevents any automated path from producing a falsely-cleared compliance record.
  async function simulateKycScreening(screeningId: string) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        ofacStatus: "pending_review",
        ofacCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        sanctionsStatus: "pending_review",
        sanctionsCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        pepStatus: "pending_review",
        pepCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      // Mark all checks as submitted and awaiting staff review.
      // overallStatus stays "pending_review" — a staff member must review and
      // explicitly clear this record via the admin compliance workflow.
      await storage.updateKycScreening(screeningId, {
        adverseMediaStatus: "pending_review",
        adverseMediaCheckedAt: new Date(),
        overallStatus: "pending_review",
        screeningNotes: "Screening checks submitted. Awaiting compliance staff review before clearance.",
      });
    } catch (error) {
      console.error("KYC simulation error:", error);
      try {
        await storage.updateKycScreening(screeningId, { overallStatus: "failed" });
      } catch (updateErr) {
        console.error("[KYC] Failed to update screening status to failed:", updateErr);
      }
    }
  }

  // =============================================
  // Deal Rescue Escalation Routes
  // =============================================
  app.get("/api/deal-rescue", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const status = firstQueryValue(req.query.status);
      const escalations = await storage.getDealRescueEscalations({
        status,
        reportedByUserId: req.user!.id,
      });
      res.json(escalations);
    } catch (error) {
      console.error("Get deal rescue escalations error:", error);
      res.status(500).json({ error: "Failed to get escalations" });
    }
  });

  app.post("/api/deal-rescue", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const urgency = req.body.urgency || "medium";
      const slaHours: Record<string, number> = {
        critical: 2,
        high: 4,
        medium: 8,
        low: 24,
      };
      const hours = slaHours[urgency] || 8;
      const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

      const escalation = await storage.createDealRescueEscalation({
        ...req.body,
        reportedByUserId: req.user!.id,
        slaDeadline,
      });
      res.status(201).json(escalation);
    } catch (error) {
      console.error("Create deal rescue escalation error:", error);
      res.status(500).json({ error: "Failed to create escalation" });
    }
  });

  app.put("/api/deal-rescue/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      // Object-level authorization: external partners (broker/lender) may only
      // update escalations they reported; internal staff work the whole queue.
      const existing = await storage.getDealRescueEscalation(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      if (!isInternalStaffRole(req.user!.role) && existing.reportedByUserId !== req.user!.id) {
        return res.status(403).json({ error: "You may only update escalations you reported" });
      }
      const escalation = await storage.updateDealRescueEscalation(req.params.id, req.body);
      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }
      res.json(escalation);
    } catch (error) {
      console.error("Update deal rescue escalation error:", error);
      res.status(500).json({ error: "Failed to update escalation" });
    }
  });

  // =============================================
  // Strategy Sessions Routes
  // =============================================
  app.get("/api/strategy-sessions", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const sessions = await storage.getStrategySessions(req.user!.id);
      res.json(sessions);
    } catch (error) {
      console.error("Get strategy sessions error:", error);
      res.status(500).json({ error: "Failed to get strategy sessions" });
    }
  });

  app.post("/api/strategy-sessions", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const session = await storage.createStrategySession({
        ...req.body,
        agentUserId: req.user!.id,
      });
      res.status(201).json(session);
    } catch (error) {
      console.error("Create strategy session error:", error);
      res.status(500).json({ error: "Failed to create strategy session" });
    }
  });

  app.put("/api/strategy-sessions/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      // Object-level authorization: sessions belong to the agent who booked
      // them (agentUserId); internal staff may manage any session.
      const existing = await storage.getStrategySession(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Strategy session not found" });
      }
      if (!isInternalStaffRole(req.user!.role) && existing.agentUserId !== req.user!.id) {
        return res.status(403).json({ error: "You may only update your own strategy sessions" });
      }
      const session = await storage.updateStrategySession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Strategy session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update strategy session error:", error);
      res.status(500).json({ error: "Failed to update strategy session" });
    }
  });

  // =============================================
  // Accelerator Routes
  // =============================================
  app.get("/api/accelerator/enrollment", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.getAcceleratorEnrollment(req.user!.id);
      res.json(enrollment || null);
    } catch (error) {
      console.error("Get accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to get enrollment" });
    }
  });

  app.post("/api/accelerator/enrollment", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.createAcceleratorEnrollment({
        ...req.body,
        userId: req.user!.id,
      });

      const defaultPhases = [
        {
          phase: 1,
          phaseName: "Financial Assessment",
          milestones: ["Review credit report", "Calculate current DTI", "Set budget"],
        },
        {
          phase: 2,
          phaseName: "Credit Optimization",
          milestones: ["Dispute errors on credit report", "Pay down high-utilization cards", "Avoid new credit inquiries"],
        },
        {
          phase: 3,
          phaseName: "Savings Plan",
          milestones: ["Open dedicated savings account", "Set up automatic transfers", "Reach 25% of down payment goal"],
        },
        {
          phase: 4,
          phaseName: "Debt Reduction",
          milestones: ["Create debt payoff plan", "Reduce DTI below 43%", "Close unnecessary accounts"],
        },
        {
          phase: 5,
          phaseName: "Pre-Approval Ready",
          milestones: ["Gather income documents", "Complete pre-approval application", "Get pre-approved"],
        },
        {
          phase: 6,
          phaseName: "Home Shopping",
          milestones: ["Connect with real estate agent", "Attend open houses", "Make an offer"],
        },
      ];

      for (const phaseData of defaultPhases) {
        for (const title of phaseData.milestones) {
          await storage.createAcceleratorMilestone({
            enrollmentId: enrollment.id,
            phase: phaseData.phase,
            title,
            category: phaseData.phaseName,
          });
        }
      }

      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Create accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.put("/api/accelerator/enrollment/:id", isAuthenticated, async (req, res) => {
    try {
      const enrollment = await storage.getAcceleratorEnrollment(req.user!.id);
      if (!enrollment || enrollment.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateAcceleratorEnrollment(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update accelerator enrollment error:", error);
      res.status(500).json({ error: "Failed to update enrollment" });
    }
  });

  app.get("/api/accelerator/milestones/:enrollmentId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== req.params.enrollmentId) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      const milestones = await storage.getAcceleratorMilestones(req.params.enrollmentId);
      res.json(milestones);
    } catch (error) {
      console.error("Get accelerator milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  app.put("/api/accelerator/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getAcceleratorMilestoneById(req.params.id);
      if (!existing || existing.enrollmentId !== enrollment.id) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      // Strip enrollmentId from body to prevent ownership-link reassignment
      const { enrollmentId: _stripM, ...milestoneBody } = req.body;
      const milestone = await storage.updateAcceleratorMilestone(req.params.id, milestoneBody, enrollment.id);
      if (!milestone) {
        return res.status(404).json({ error: "Milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Update accelerator milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  app.get("/api/accelerator/coaching/:enrollmentId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== req.params.enrollmentId) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      const sessions = await storage.getCoachingSessions(req.params.enrollmentId);
      res.json(sessions);
    } catch (error) {
      console.error("Get coaching sessions error:", error);
      res.status(500).json({ error: "Failed to get coaching sessions" });
    }
  });

  app.post("/api/accelerator/coaching", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment || enrollment.id !== req.body.enrollmentId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const session = await storage.createCoachingSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      console.error("Create coaching session error:", error);
      res.status(500).json({ error: "Failed to create coaching session" });
    }
  });

  app.put("/api/accelerator/coaching/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = await storage.getAcceleratorEnrollment(user.id);
      if (!enrollment) {
        return res.status(403).json({ error: "Access denied" });
      }
      const existing = await storage.getCoachingSessionById(req.params.id);
      if (!existing || existing.enrollmentId !== enrollment.id) {
        return res.status(404).json({ error: "Coaching session not found" });
      }
      // Strip enrollmentId from body to prevent ownership-link reassignment
      const { enrollmentId: _stripC, ...sessionBody } = req.body;
      const session = await storage.updateCoachingSession(req.params.id, sessionBody, enrollment.id);
      if (!session) {
        return res.status(404).json({ error: "Coaching session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Update coaching session error:", error);
      res.status(500).json({ error: "Failed to update coaching session" });
    }
  });

  // =============================================
  // Closing Guarantee Routes
  // =============================================

  // List all guarantees: admin only — this returns every record system-wide so it
  // cannot be meaningfully scoped without enumerating the caller's assigned files.
  app.get("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const guarantees = await storage.getAllClosingGuarantees();
      res.json(guarantees);
    } catch (error) {
      console.error("Get all closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  // Per-application guarantees: verify the caller is an assigned deal-team member
  // (or admin) for that specific loan file before returning records.
  app.get("/api/closing-guarantees/:applicationId", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const application = await storage.getLoanApplicationWithAccess(
        req.params.applicationId,
        req.user!.id,
        req.user!.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this loan file" });
      }
      const guarantees = await storage.getClosingGuarantees(req.params.applicationId);
      res.json(guarantees);
    } catch (error) {
      console.error("Get closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  // Create guarantee: verify the caller has access to the target application.
  app.post("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const { applicationId } = req.body;
      if (!applicationId) {
        return res.status(400).json({ error: "applicationId is required" });
      }
      const application = await storage.getLoanApplicationWithAccess(
        applicationId,
        req.user!.id,
        req.user!.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this loan file" });
      }
      const guarantee = await storage.createClosingGuarantee(req.body);
      res.status(201).json(guarantee);
    } catch (error) {
      console.error("Create closing guarantee error:", error);
      res.status(500).json({ error: "Failed to create closing guarantee" });
    }
  });

  // Update guarantee: look up the existing record to find its applicationId, then
  // verify the caller has deal-team access before allowing the mutation.
  app.put("/api/closing-guarantees/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const existing = await storage.getClosingGuarantee(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Closing guarantee not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(
        existing.applicationId,
        req.user!.id,
        req.user!.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this loan file" });
      }
      // Strip immutable ownership and identity fields from the update payload so
      // callers cannot reassign the record to a different application or forge
      // timestamps by including them in req.body.
      const { id: _id, applicationId: _appId, createdAt: _ca, updatedAt: _ua, ...safeUpdate } = req.body;
      const guarantee = await storage.updateClosingGuarantee(req.params.id, safeUpdate);
      if (!guarantee) {
        return res.status(404).json({ error: "Closing guarantee not found" });
      }
      res.json(guarantee);
    } catch (error) {
      console.error("Update closing guarantee error:", error);
      res.status(500).json({ error: "Failed to update closing guarantee" });
    }
  });

  // =============================================
  // Homeowner Value Routes
  // =============================================
  app.get("/api/homeowner/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      console.error("Get homeowner profile error:", error);
      res.status(500).json({ error: "Failed to get homeowner profile" });
    }
  });

  app.post("/api/homeowner/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.createHomeownerProfile({
        ...req.body,
        userId: req.user!.id,
      });
      res.status(201).json(profile);
    } catch (error) {
      console.error("Create homeowner profile error:", error);
      res.status(500).json({ error: "Failed to create homeowner profile" });
    }
  });

  app.put("/api/homeowner/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== req.params.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateHomeownerProfile(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Homeowner profile not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update homeowner profile error:", error);
      res.status(500).json({ error: "Failed to update homeowner profile" });
    }
  });

  app.get("/api/homeowner/refi-alerts/:profileId", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== req.params.profileId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const alerts = await storage.getRefiAlerts(req.params.profileId);
      res.json(alerts);
    } catch (error) {
      console.error("Get refi alerts error:", error);
      res.status(500).json({ error: "Failed to get refi alerts" });
    }
  });

  app.post("/api/homeowner/refi-alerts", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== req.body.homeownerProfileId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const alert = await storage.createRefiAlert(req.body);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Create refi alert error:", error);
      res.status(500).json({ error: "Failed to create refi alert" });
    }
  });

  app.put("/api/homeowner/refi-alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Fetch the alert BEFORE writing to verify ownership
      const existing = await storage.getRefiAlertById(req.params.id);
      if (!existing || existing.homeownerProfileId !== profile.id) {
        return res.status(404).json({ error: "Refi alert not found" });
      }
      // Strip homeownerProfileId from body to prevent ownership-link reassignment
      const { homeownerProfileId: _stripR, ...alertBody } = req.body;
      const updated = await storage.updateRefiAlert(req.params.id, alertBody, profile.id);
      if (!updated) {
        return res.status(404).json({ error: "Refi alert not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update refi alert error:", error);
      res.status(500).json({ error: "Failed to update refi alert" });
    }
  });

  app.get("/api/homeowner/equity/:profileId", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== req.params.profileId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const snapshots = await storage.getEquitySnapshots(profile.id);
      res.json(snapshots);
    } catch (error) {
      console.error("Get equity snapshots error:", error);
      res.status(500).json({ error: "Failed to get equity snapshots" });
    }
  });

  app.post("/api/homeowner/equity", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Override any caller-supplied homeownerProfileId with the authenticated user's own profile
      const snapshot = await storage.createEquitySnapshot({ ...req.body, homeownerProfileId: profile.id });
      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Create equity snapshot error:", error);
      res.status(500).json({ error: "Failed to create equity snapshot" });
    }
  });

  // =============================================
  // Scenario Calculator Route
  // =============================================
  app.post("/api/scenario-calculator", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        purchasePrice: z.number().positive(),
        downPaymentPercent: z.number().min(0).max(100),
        creditScore: z.number().min(300).max(850),
        loanProgram: z.enum(["conventional", "fha", "va", "usda"]),
        interestRate: z.number().optional(),
        propertyTax: z.number().optional(),
        insurance: z.number().optional(),
        annualIncome: z.number().optional(),
      });

      const validated = schema.parse(req.body);

      const defaultRates: Record<string, number> = {
        conventional: 6.875,
        fha: 6.5,
        va: 6.25,
        usda: 6.375,
      };

      const purchasePrice = validated.purchasePrice;
      const downPayment = purchasePrice * (validated.downPaymentPercent / 100);
      let loanAmount = purchasePrice - downPayment;
      const ltv = (loanAmount / purchasePrice) * 100;
      const rate = validated.interestRate ?? defaultRates[validated.loanProgram];

      if (validated.loanProgram === "fha") {
        loanAmount = loanAmount * 1.0175;
      }

      const monthlyRate = rate / 12 / 100;
      const numPayments = 360;
      const factor = Math.pow(1 + monthlyRate, numPayments);
      const monthlyPrincipalInterest = loanAmount * (monthlyRate * factor) / (factor - 1);

      let monthlyPmi = 0;
      if (validated.loanProgram === "conventional" && ltv > 80) {
        monthlyPmi = (loanAmount * 0.005) / 12;
      } else if (validated.loanProgram === "fha") {
        monthlyPmi = (loanAmount * 0.0085) / 12;
      }

      const monthlyPropertyTax = validated.propertyTax ?? (purchasePrice * 0.011) / 12;
      const monthlyInsurance = validated.insurance ?? (purchasePrice * 0.0035) / 12;
      const totalMonthlyPayment = monthlyPrincipalInterest + monthlyPmi + monthlyPropertyTax + monthlyInsurance;

      let dti: number | null = null;
      if (validated.annualIncome) {
        const monthlyIncome = validated.annualIncome / 12;
        dti = (totalMonthlyPayment / monthlyIncome) * 100;
      }

      res.json({
        purchasePrice,
        downPayment,
        downPaymentPercent: validated.downPaymentPercent,
        loanAmount: Math.round(loanAmount * 100) / 100,
        interestRate: rate,
        loanProgram: validated.loanProgram,
        ltv: Math.round(ltv * 100) / 100,
        monthlyPrincipalInterest: Math.round(monthlyPrincipalInterest * 100) / 100,
        monthlyPmi: Math.round(monthlyPmi * 100) / 100,
        monthlyPropertyTax: Math.round(monthlyPropertyTax * 100) / 100,
        monthlyInsurance: Math.round(monthlyInsurance * 100) / 100,
        totalMonthlyPayment: Math.round(totalMonthlyPayment * 100) / 100,
        dti: dti !== null ? Math.round(dti * 100) / 100 : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Scenario calculator error:", error);
      res.status(500).json({ error: "Failed to calculate scenario" });
    }
  });

  const trackSchema = z.object({
    activityType: z.string().min(1).max(64).regex(/^[a-z_]+$/),
    page: z.string().max(256).optional(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    sessionId: z.string().max(64).optional(),
  });

  app.post("/api/track", async (req, res) => {
    try {
      const parsed = trackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid tracking data" });
      }
      const { activityType, page, metadata, sessionId } = parsed.data;
      const userId = req.user ? (req.user as User).id : null;
      const { userActivities } = await import("@shared/schema");
      const { db } = await import("../db");
      await db.insert(userActivities).values({
        userId,
        sessionId: sessionId || null,
        activityType,
        page: page || null,
        metadata: metadata ? metadata : null,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Activity tracking error:", error);
      res.json({ ok: true });
    }
  });

  const emailCaptureSchema = z.object({
    email: z.string().email().max(255),
    source: z.string().max(100).optional(),
    website: z.string().optional(),
  });

  app.post("/api/email-capture", async (req, res) => {
    try {
      const parsed = emailCaptureSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      if (parsed.data.website) {
        return res.json({ ok: true });
      }
      const { emailCaptures } = await import("@shared/schema");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const existing = await db
        .select({ id: emailCaptures.id })
        .from(emailCaptures)
        .where(eq(emailCaptures.email, parsed.data.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(emailCaptures).values({
          email: parsed.data.email,
          source: parsed.data.source || "website",
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Email capture error:", error);
      res.json({ ok: true });
    }
  });

  // Pre-launch partner / center-of-influence waitlist. B2B interest capture for
  // loan officers, lenders, CPAs, and real-estate agents — the referral network
  // we'll service consumers through. Not a consumer mortgage lead: no TCPA/
  // TrustedForm path, no rate/approval handling. Public + honeypot-guarded;
  // rate-limited in app.ts alongside /api/email-capture.
  const partnerWaitlistSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(255),
    email: z.string().email().max(255),
    company: z.string().trim().max(255).optional(),
    partnerType: z.enum(["loan_officer", "lender", "cpa", "real_estate_agent", "other"]),
    message: z.string().trim().max(2000).optional(),
    website: z.string().optional(), // honeypot
  });

  app.post("/api/partner-waitlist", async (req, res) => {
    try {
      const parsed = partnerWaitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Please check the form and try again." });
      }
      if (parsed.data.website) {
        return res.json({ ok: true }); // silently drop bots
      }
      const { partnerWaitlist } = await import("@shared/schema");
      const { db } = await import("../db");
      const { eq } = await import("drizzle-orm");

      const existing = await db
        .select({ id: partnerWaitlist.id })
        .from(partnerWaitlist)
        .where(eq(partnerWaitlist.email, parsed.data.email))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(partnerWaitlist).values({
          name: parsed.data.name,
          email: parsed.data.email,
          company: parsed.data.company || null,
          partnerType: parsed.data.partnerType,
          message: parsed.data.message || null,
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("Partner waitlist error:", error);
      res.json({ ok: true });
    }
  });

  app.get("/api/user-activity-summary", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { getUserActivitySummary } = await import("../services/activitySummary");
      res.json(await getUserActivitySummary(userId));
    } catch (error) {
      console.error("Activity summary error:", error);
      res.status(500).json({ error: "Failed to load activity summary" });
    }
  });

  app.get("/api/borrower-graph", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const graph = await buildBorrowerGraph(user.id);
      res.json(graph);
    } catch (error) {
      console.error("Borrower graph error:", error);
      res.status(500).json({ error: "Failed to build borrower profile" });
    }
  });

  app.get("/api/borrower-graph/affordability", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const price = parseFloat(firstQueryValue(req.query.price) ?? "");
      if (!price || isNaN(price) || price <= 0) {
        return res.status(400).json({ error: "Valid price parameter required" });
      }
      const result = await getPropertyAffordability(user.id, price);
      res.json(result);
    } catch (error) {
      console.error("Affordability check error:", error);
      res.status(500).json({ error: "Failed to check affordability" });
    }
  });
}
