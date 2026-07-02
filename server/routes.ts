import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { registerLendingRoutes } from "./routes/lending";
import { registerDocumentRoutes } from "./routes/documents";
import { registerPropertyRoutes } from "./routes/property";
import { registerAgentBrokerRoutes } from "./routes/agent-broker";
import { registerAdminRoutes } from "./routes/admin";
import { registerTaskEngineRoutes } from "./routes/task-engine";
import { registerUnderwritingRoutes } from "./routes/underwriting";
import { registerComplianceRoutes } from "./routes/compliance";
import { registerBorrowerRoutes } from "./routes/borrower";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerStaffInviteRoutes } from "./routes/staff-invites";
import { registerCoachRoutes } from "./routes/coach";
import { registerUnderwritingRulesRoutes } from "./routes/underwriting-rules";
import { registerPolicyOpsRoutes } from "./routes/policy-ops";
import { registerLookupMatrixRoutes } from "./routes/lookup-matrix";
import { registerRateSheetRoutes } from "./routes/rate-sheets";
import { registerIntelligenceRoutes } from "./routes/intelligence";
import { registerOptimizationRoutes } from "./routes/optimizations";
import { registerDataIntelligenceRoutes } from "./routes/data-intelligence";
import { registerListingsRoutes } from "./routes/listings";
import { registerGeocodeRoutes } from "./routes/geocode";
import { registerCalculatorRoutes } from "./routes/calculators";
import { registerAusRoutes } from "./routes/aus";
import { seedDatabase } from "./seed";
import { pool } from "./db";
import { assertEncryptionConfig } from "./services/encryptionService";


export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("[health] Database connectivity check failed:", err);
      res.status(503).json({
        status: "unavailable",
        error: "Database is not reachable",
        timestamp: new Date().toISOString(),
      });
    }
  });

  assertEncryptionConfig();

  await setupAuth(app);
  await seedDatabase();

  registerLendingRoutes(app, storage);
  registerDocumentRoutes(app, storage);
  registerPropertyRoutes(app, storage);
  registerAgentBrokerRoutes(app, storage);
  registerAdminRoutes(app, storage);
  await registerTaskEngineRoutes(app, storage);
  registerUnderwritingRoutes(app, storage);
  registerComplianceRoutes(app, storage);
  registerBorrowerRoutes(app, storage);
  registerNotificationRoutes(app, storage);
  registerStaffInviteRoutes(app, storage);
  registerCoachRoutes(app);
  registerUnderwritingRulesRoutes(app, storage);
  registerPolicyOpsRoutes(app, storage);
  registerLookupMatrixRoutes(app, storage);
  registerRateSheetRoutes(app, storage);
  registerIntelligenceRoutes(app, storage);
  registerOptimizationRoutes(app);
  registerDataIntelligenceRoutes(app);
  registerListingsRoutes(app);
  registerGeocodeRoutes(app);
  registerCalculatorRoutes(app, storage);
  registerAusRoutes(app);

  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
