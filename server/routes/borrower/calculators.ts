// Borrower routes: Calculator results + calculator profiles (lead capture).
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { insertCalculatorResultSchema, type User } from "@shared/schema";
import { z } from "zod";
import { routeParams } from "../../http/routeParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerCalculatorRoutes(
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
          details: validationResult.error.issues 
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
      const { type } = routeParams(req);
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
        calculatorInputs: z.record(z.string(), z.unknown()).optional(),
        calculatorResults: z.record(z.string(), z.unknown()).optional(),
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
      const { email } = routeParams(req);
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

}
