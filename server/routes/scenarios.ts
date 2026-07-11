import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "../storage";
import { requireRole } from "../auth";
import { logAudit } from "../auditLog";
import { runScenario } from "../services/scenarioSimulator";
import { verifyInternalStaffApplicationAccess } from "./borrower";
import type { User } from "@shared/schema";

/**
 * LO-2 — What-If Scenario Simulator routes (LO Advisor Program).
 *
 * One endpoint: POST /api/scenarios/simulate. Internal staff only, scoped to
 * the caller's deal-team assignment (same gate as the rate-lock desk — no
 * platform-wide access for non-admins). Every evaluated run is persisted to
 * the immutable scenario_runs substrate by the service and audit-logged here.
 *
 * The FICO what-if is hypothetical input — nothing in this path can trigger
 * a credit pull (I6). Responses carry the simulated-rate provenance flag
 * (I10); the client must render it.
 */

const scenarioSchema = z
  .object({
    purchasePrice: z.number().positive().max(50_000_000),
    downPaymentAmount: z.number().min(0).max(50_000_000).optional(),
    downPaymentPercent: z.number().min(0).max(99.99).optional(),
    productTypes: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    occupancyType: z.enum(["primary_residence", "second_home", "investment"]).optional(),
    propertyType: z.enum(["single_family", "condo", "townhouse", "multi_family"]).optional(),
    numberOfUnits: z.number().int().min(2).max(4).optional(),
    ficoWhatIf: z.number().int().min(300).max(850).optional(),
    lockTermDays: z.number().int().min(15).max(90).optional(),
    propertyState: z.string().trim().length(2).optional(),
    propertyValue: z.number().positive().max(100_000_000).optional(),
    annualPropertyTaxes: z.number().min(0).max(1_000_000).optional(),
    annualHomeownersInsurance: z.number().min(0).max(1_000_000).optional(),
    addressContext: z
      .object({
        line: z.string().max(200).optional(),
        city: z.string().max(100).optional(),
        stateCode: z.string().max(2).optional(),
        zipcode: z.string().max(10).optional(),
        propertyId: z.string().max(50).optional(),
        source: z.string().max(50).optional(),
        observedPropertyType: z.string().max(50).optional(),
      })
      .optional(),
  })
  .refine(
    (s) => (s.downPaymentAmount !== undefined) !== (s.downPaymentPercent !== undefined),
    { message: "Provide exactly one of downPaymentAmount or downPaymentPercent" },
  );

const simulateSchema = z.object({
  applicationId: z.string().min(1),
  scenario: scenarioSchema,
});

export function registerScenarioRoutes(app: Express, storage: IStorage) {
  app.post(
    "/api/scenarios/simulate",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const parsed = simulateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
        }
        const user = req.user as User;
        const { applicationId, scenario } = parsed.data;

        const application = await storage.getLoanApplication(applicationId);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }

        // Assignment-scoped, not platform-wide (mirrors the rate-lock desk).
        const allowed = await verifyInternalStaffApplicationAccess(
          storage,
          applicationId,
          user.id,
          user.role,
        );
        if (!allowed) {
          return res.status(403).json({ error: "Access denied to this application" });
        }

        const startedAt = Date.now();
        const { runId, result } = await runScenario(application, user.id, scenario);
        const serverMs = Date.now() - startedAt;

        await logAudit(req, "scenario_simulated", "loan_application", applicationId, {
          runId,
          status: result.status,
          offersEvaluated: result.offers.length,
          simulated: result.simulated,
          serverMs,
        });

        // serverMs is response-only (the charter's <500 ms target is measured
        // here); persisted inputs/outputs stay time-free and deterministic.
        res.json({ runId, serverMs, ...result });
      } catch (error) {
        console.error("Scenario simulate error:", error);
        res.status(500).json({ error: "Failed to run the scenario" });
      }
    },
  );
}
