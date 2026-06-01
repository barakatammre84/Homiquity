import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import {
  insertCalculatorResultSchema,
  insertHomeownershipGoalSchema,
  insertCreditActionSchema,
  insertSavingsTransactionSchema,
  insertJourneyMilestoneSchema,
  insertDocumentPackageSchema,
  insertDocumentPackageItemSchema,
  isStaffRole,
  type User,
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { buildBorrowerGraph, getPropertyAffordability } from "../services/borrowerGraph";

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

      const property = await storage.markDealFellThrough(propertyId, reason || "Deal did not proceed");
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

      const property = await storage.updateApplicationProperty(propertyId, updateData);
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
      const { applicationId } = req.params;
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      const urlaData = await storage.getCompleteUrlaData(applicationId);
      res.json({ application, ...urlaData });
    } catch (error) {
      console.error("Get URLA data error:", error);
      res.status(500).json({ error: "Failed to get URLA data" });
    }
  });

  app.post("/api/urla/:applicationId/personal-info", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.upsertUrlaPersonalInfo(data);
      res.json(result);
    } catch (error) {
      console.error("Save personal info error:", error);
      res.status(500).json({ error: "Failed to save personal info" });
    }
  });

  app.post("/api/urla/:applicationId/employment", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createEmploymentHistory(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create employment error:", error);
      res.status(500).json({ error: "Failed to create employment record" });
    }
  });

  app.patch("/api/urla/employment/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.updateEmploymentHistory(id, req.body);
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
      await storage.deleteEmploymentHistory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete employment error:", error);
      res.status(500).json({ error: "Failed to delete employment record" });
    }
  });

  app.post("/api/urla/:applicationId/other-income", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createOtherIncomeSource(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create other income error:", error);
      res.status(500).json({ error: "Failed to create other income source" });
    }
  });

  app.delete("/api/urla/other-income/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOtherIncomeSource(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete other income error:", error);
      res.status(500).json({ error: "Failed to delete other income source" });
    }
  });

  app.post("/api/urla/:applicationId/assets", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createUrlaAsset(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create asset error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  app.patch("/api/urla/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.updateUrlaAsset(id, req.body);
      if (!result) {
        return res.status(404).json({ error: "Asset not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update asset error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  app.delete("/api/urla/assets/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteUrlaAsset(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete asset error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  app.post("/api/urla/:applicationId/liabilities", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.createUrlaLiability(data);
      res.status(201).json(result);
    } catch (error) {
      console.error("Create liability error:", error);
      res.status(500).json({ error: "Failed to create liability" });
    }
  });

  app.patch("/api/urla/liabilities/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.updateUrlaLiability(id, req.body);
      if (!result) {
        return res.status(404).json({ error: "Liability not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Update liability error:", error);
      res.status(500).json({ error: "Failed to update liability" });
    }
  });

  app.delete("/api/urla/liabilities/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteUrlaLiability(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete liability error:", error);
      res.status(500).json({ error: "Failed to delete liability" });
    }
  });

  app.post("/api/urla/:applicationId/property-info", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const data = { ...req.body, applicationId };
      const result = await storage.upsertUrlaPropertyInfo(data);
      res.json(result);
    } catch (error) {
      console.error("Save property info error:", error);
      res.status(500).json({ error: "Failed to save property info" });
    }
  });

  // Bulk save URLA data - only updates sections that are explicitly provided with content
  app.post("/api/urla/:applicationId/save", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { personalInfo, employmentHistory, otherIncomeSources, assets, liabilities, propertyInfo } = req.body;

      // Verify user owns this application
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to modify this application" });
      }

      const results: any = {};

      // Only update personal info if provided with actual content
      if (personalInfo && Object.keys(personalInfo).some(key => personalInfo[key] !== undefined && personalInfo[key] !== "")) {
        results.personalInfo = await storage.upsertUrlaPersonalInfo({ ...personalInfo, applicationId });
      }

      // Only update property info if provided with actual content
      if (propertyInfo && Object.keys(propertyInfo).some(key => propertyInfo[key] !== undefined && propertyInfo[key] !== "")) {
        results.propertyInfo = await storage.upsertUrlaPropertyInfo({ ...propertyInfo, applicationId });
      }

      // Handle employment records - update existing, create new
      if (employmentHistory && Array.isArray(employmentHistory) && employmentHistory.length > 0) {
        results.employmentHistory = [];
        for (const emp of employmentHistory) {
          // Skip empty records
          if (!emp.employerName && !emp.positionTitle && !emp.baseIncome) continue;
          
          if (emp.id) {
            const updated = await storage.updateEmploymentHistory(emp.id, emp);
            if (updated) results.employmentHistory.push(updated);
          } else {
            const created = await storage.createEmploymentHistory({ ...emp, applicationId, employmentType: emp.employmentType || "current" });
            results.employmentHistory.push(created);
          }
        }
      }

      // Handle assets - update existing, create new
      if (assets && Array.isArray(assets) && assets.length > 0) {
        results.assets = [];
        for (const asset of assets) {
          // Skip empty records
          if (!asset.accountType && !asset.financialInstitution) continue;
          
          if (asset.id) {
            const updated = await storage.updateUrlaAsset(asset.id, asset);
            if (updated) results.assets.push(updated);
          } else if (asset.accountType) {
            const created = await storage.createUrlaAsset({ ...asset, applicationId });
            results.assets.push(created);
          }
        }
      }

      // Handle liabilities - update existing, create new
      if (liabilities && Array.isArray(liabilities) && liabilities.length > 0) {
        results.liabilities = [];
        for (const liability of liabilities) {
          // Skip empty records
          if (!liability.liabilityType && !liability.creditorName) continue;
          
          if (liability.id) {
            const updated = await storage.updateUrlaLiability(liability.id, liability);
            if (updated) results.liabilities.push(updated);
          } else if (liability.liabilityType) {
            const created = await storage.createUrlaLiability({ ...liability, applicationId });
            results.liabilities.push(created);
          }
        }
      }

      // Handle other income sources - only create new ones (existing ones are preserved)
      if (otherIncomeSources && Array.isArray(otherIncomeSources) && otherIncomeSources.length > 0) {
        results.otherIncomeSources = [];
        for (const income of otherIncomeSources) {
          // Skip empty or already-saved records
          if (!income.incomeSource || !income.monthlyAmount) continue;
          if (income.id) continue; // Skip existing records, they're already saved
          
          const created = await storage.createOtherIncomeSource({ ...income, applicationId });
          results.otherIncomeSources.push(created);
        }
      }

      res.json(results);
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
      // Validate update data using partial insert schema
      const updateSchema = insertCreditActionSchema.partial();
      const validated = updateSchema.parse(req.body);
      
      const action = await storage.updateCreditAction(req.params.id, validated);
      
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
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can create rate locks" });
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
      const { applicationId } = req.params;
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
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const withinDays = parseInt(req.query.days as string) || 7;
      const locks = await storage.getExpiringRateLocks(withinDays);
      res.json(locks);
    } catch (error) {
      console.error("Get expiring locks error:", error);
      res.status(500).json({ error: "Failed to get expiring locks" });
    }
  });

  // Extend a rate lock
  app.post("/api/rate-locks/:id/extend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can extend rate locks" });
      }

      const { id } = req.params;
      const { additionalDays, extensionFee } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
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
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can cancel rate locks" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
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
      const { type, state } = req.query;
      const templates = await storage.getActiveConsentTemplates(
        type as string | undefined,
        state as string | undefined
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
      const { applicationId } = req.params;
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
      const { applicationId, consentType } = req.params;
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

      const { serviceType } = req.query;
      let providers;
      if (serviceType) {
        providers = await storage.getPartnerProvidersByServiceType(serviceType as string);
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
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Only staff can create partner orders" });
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
      const { applicationId } = req.params;
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
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
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

  // Add team member to application (staff only)
  app.post("/api/applications/:applicationId/team", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

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

      // Check ownership - borrower can only withdraw their own apps, staff can withdraw any
      if (!isStaffRole(user.role) && application.userId !== user.id) {
        return res.status(403).json({ error: "You can only withdraw your own applications" });
      }

      // Check if already withdrawn or in a terminal state
      if (["withdrawn", "closed", "denied"].includes(application.status)) {
        return res.status(400).json({ error: "Application cannot be withdrawn in its current state" });
      }

      // Update application status to withdrawn
      const updatedApp = await storage.updateLoanApplication(applicationId, {
        status: "withdrawn",
      });

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

  // Update team member
  app.patch("/api/deal-team/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

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

  // Remove team member
  app.delete("/api/deal-team/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

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

      // Verify application exists before creating package
      const application = await storage.getLoanApplication(parsed.data.applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
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

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
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

      const application = await storage.getLoanApplication(pkg.applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
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

      // Verify package exists and staff can access
      const existingPkg = await storage.getDocumentPackage(id);
      if (!existingPkg) {
        return res.status(404).json({ error: "Package not found" });
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

      const parsed = addPackageItemValidation.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid item data", details: parsed.error.flatten() });
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

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      if (application.userId !== user.id && !isStaffRole(user.role)) {
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

  // Get all staff users for team display
  app.get("/api/team-members", isAuthenticated, async (req, res) => {
    try {
      const staffUsersWithPresence = await storage.getTeamMembersWithPresence();
      
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

  // Send a message (supports regular text and document requests)
  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { recipientId, message, applicationId, messageType, documentRequestData } = req.body;
      
      if (!recipientId || !message) {
        return res.status(400).json({ error: "recipientId and message are required" });
      }
      
      // Verify recipient exists
      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      
      const newMessage = await storage.sendMessage({
        senderId: userId,
        recipientId,
        message,
        applicationId: applicationId || null,
        messageType: messageType || 'text',
        documentRequestData: documentRequestData || null,
        isRead: false,
      });
      
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
      
      if (!status || !['pending', 'submitted', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Valid status is required" });
      }
      
      const updated = await storage.updateDocumentRequestStatus(messageId, status, documentId);
      
      if (!updated) {
        return res.status(404).json({ error: "Document request not found" });
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
      const { state, firstTimeBuyer, minCreditScore, maxIncome } = req.query;
      const filters: any = {};
      if (state) filters.state = state as string;
      if (firstTimeBuyer === "true") filters.firstTimeBuyer = true;
      if (minCreditScore) filters.minCreditScore = parseInt(minCreditScore as string);
      if (maxIncome) filters.maxIncome = parseFloat(maxIncome as string);

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

      const questions = generateKBAQuestions();

      const session = await storage.createKbaSession({
        userId,
        applicationId: applicationId || null,
        status: "in_progress",
        questionsData: questions.map(q => ({ id: q.id, question: q.question, choices: q.choices, correctIndex: q.correctIndex })),
        totalQuestions: questions.length,
        passingScore: 4,
        attemptNumber: failedCount + 1,
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
          await storage.updateOnboardingProfile(profile.id, {
            identityVerified: true,
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

  // Helper: Generate KBA questions (simulated - in production, these come from credit bureaus)
  function generateKBAQuestions() {
    return [
      {
        id: "q1",
        question: "Which of the following addresses have you been associated with?",
        choices: ["123 Oak Street, Springfield", "456 Maple Avenue, Portland", "789 Pine Road, Denver", "None of the above"],
        correctIndex: 0,
      },
      {
        id: "q2",
        question: "In which of the following counties have you lived?",
        choices: ["Cook County", "King County", "Maricopa County", "None of the above"],
        correctIndex: 1,
      },
      {
        id: "q3",
        question: "Which of the following phone numbers is associated with you?",
        choices: ["(555) 123-4567", "(555) 234-5678", "(555) 345-6789", "None of the above"],
        correctIndex: 0,
      },
      {
        id: "q4",
        question: "Which financial institution have you had an account with?",
        choices: ["First National Bank", "Pacific Credit Union", "Metro Savings", "None of the above"],
        correctIndex: 2,
      },
      {
        id: "q5",
        question: "What type of vehicle have you previously registered?",
        choices: ["Sedan", "SUV", "Truck", "None of the above"],
        correctIndex: 1,
      },
    ];
  }

  // Helper: Simulate KYC/AML screening (progressive status updates)
  async function simulateKycScreening(screeningId: string) {
    try {
      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        ofacStatus: "cleared",
        ofacCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        sanctionsStatus: "cleared",
        sanctionsCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        pepStatus: "cleared",
        pepCheckedAt: new Date(),
      });

      await new Promise(r => setTimeout(r, 2000));
      await storage.updateKycScreening(screeningId, {
        adverseMediaStatus: "cleared",
        adverseMediaCheckedAt: new Date(),
        overallStatus: "cleared",
        riskLevel: "low",
        riskScore: 12,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
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
      const status = req.query.status as string | undefined;
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
      const milestones = await storage.getAcceleratorMilestones(req.params.enrollmentId);
      res.json(milestones);
    } catch (error) {
      console.error("Get accelerator milestones error:", error);
      res.status(500).json({ error: "Failed to get milestones" });
    }
  });

  app.put("/api/accelerator/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.updateAcceleratorMilestone(req.params.id, req.body);
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
      const sessions = await storage.getCoachingSessions(req.params.enrollmentId);
      res.json(sessions);
    } catch (error) {
      console.error("Get coaching sessions error:", error);
      res.status(500).json({ error: "Failed to get coaching sessions" });
    }
  });

  app.post("/api/accelerator/coaching", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.createCoachingSession(req.body);
      res.status(201).json(session);
    } catch (error) {
      console.error("Create coaching session error:", error);
      res.status(500).json({ error: "Failed to create coaching session" });
    }
  });

  app.put("/api/accelerator/coaching/:id", isAuthenticated, async (req, res) => {
    try {
      const session = await storage.updateCoachingSession(req.params.id, req.body);
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
  app.get("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantees = await storage.getAllClosingGuarantees();
      res.json(guarantees);
    } catch (error) {
      console.error("Get all closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  app.get("/api/closing-guarantees/:applicationId", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantees = await storage.getClosingGuarantees(req.params.applicationId);
      res.json(guarantees);
    } catch (error) {
      console.error("Get closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  app.post("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantee = await storage.createClosingGuarantee(req.body);
      res.status(201).json(guarantee);
    } catch (error) {
      console.error("Create closing guarantee error:", error);
      res.status(500).json({ error: "Failed to create closing guarantee" });
    }
  });

  app.put("/api/closing-guarantees/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const guarantee = await storage.updateClosingGuarantee(req.params.id, req.body);
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
      const alerts = await storage.getRefiAlerts(req.params.profileId);
      res.json(alerts);
    } catch (error) {
      console.error("Get refi alerts error:", error);
      res.status(500).json({ error: "Failed to get refi alerts" });
    }
  });

  app.post("/api/homeowner/refi-alerts", isAuthenticated, async (req, res) => {
    try {
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
      const updated = await storage.updateRefiAlert(req.params.id, req.body);
      if (!updated || updated.homeownerProfileId !== profile.id) {
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
      const snapshots = await storage.getEquitySnapshots(req.params.profileId);
      res.json(snapshots);
    } catch (error) {
      console.error("Get equity snapshots error:", error);
      res.status(500).json({ error: "Failed to get equity snapshots" });
    }
  });

  app.post("/api/homeowner/equity", isAuthenticated, async (req, res) => {
    try {
      const snapshot = await storage.createEquitySnapshot(req.body);
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

  app.get("/api/user-activity-summary", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const { userActivities } = await import("@shared/schema");
      const { db } = await import("../db");
      const { eq, sql, and, gte } = await import("drizzle-orm");

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivities = await db
        .select({
          activityType: userActivities.activityType,
          count: sql<number>`count(*)::int`,
          lastSeen: sql<string>`max(${userActivities.createdAt})`,
        })
        .from(userActivities)
        .where(and(
          eq(userActivities.userId, userId),
          gte(userActivities.createdAt, sevenDaysAgo)
        ))
        .groupBy(userActivities.activityType);

      const totalPageViews = recentActivities.find(a => a.activityType === "page_view")?.count || 0;
      const propertySearches = recentActivities.find(a => a.activityType === "property_search")?.count || 0;
      const calculatorUses = recentActivities.find(a => a.activityType === "calculator_use")?.count || 0;
      const coachChats = recentActivities.find(a => a.activityType === "coach_chat")?.count || 0;
      const propertyViews = recentActivities.find(a => a.activityType === "property_view")?.count || 0;

      res.json({
        totalPageViews,
        propertySearches,
        calculatorUses,
        coachChats,
        propertyViews,
        activities: recentActivities,
      });
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
      const price = parseFloat(req.query.price as string);
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
