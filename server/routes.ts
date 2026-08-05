import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { registerLendingRoutes } from "./routes/lending";
import { registerDocumentRoutes } from "./routes/documents";
import { registerPropertyRoutes } from "./routes/property";
import { registerAgentBrokerRoutes } from "./routes/agent-broker";
import { registerAdminRoutes } from "./routes/admin";
import { registerPricingPolicyRoutes } from "./routes/admin/pricingPolicy";
import { registerTaskEngineRoutes } from "./routes/task-engine";
import { registerUnderwritingRoutes } from "./routes/underwriting";
import { registerComplianceRoutes } from "./routes/compliance";
import { registerBorrowerRoutes } from "./routes/borrower";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerStaffInviteRoutes } from "./routes/staff-invites";
import { registerCoachRoutes } from "./routes/coach";
import { registerProfileRoutes } from "./routes/profile";
import { registerUnderwritingRulesRoutes } from "./routes/underwriting-rules";
import { registerPolicyOpsRoutes } from "./routes/policy-ops";
import { registerLookupMatrixRoutes } from "./routes/lookup-matrix";
import { registerRateSheetRoutes } from "./routes/rate-sheets";
import { registerCommsRoutes } from "./routes/comms";
import { registerScenarioRoutes } from "./routes/scenarios";
import { registerCockpitRoutes } from "./routes/cockpit";
import { registerIntelligenceRoutes } from "./routes/intelligence";
import { registerDataIntelligenceRoutes } from "./routes/data-intelligence";
import { registerListingsRoutes } from "./routes/listings";
import { registerGeocodeRoutes } from "./routes/geocode";
import { registerCalculatorRoutes } from "./routes/calculators";
import { registerAusRoutes } from "./routes/aus";
import { registerAutopilotRoutes } from "./routes/autopilot";
import { registerJobRoutes } from "./routes/jobs";
import { registerShellRoutes } from "./routes/shell";
import { registerMarketDataRoutes } from "./routes/market-data";
import { registerLeadRoutes } from "./routes/leads";
import { registerTaxInsightRoutes } from "./routes/taxInsights";
import { registerTaxIntelligenceRoutes } from "./routes/taxIntelligence";
import { registerCpaPartnerRoutes } from "./routes/cpaPartners";
import { registerPartnerRoutes } from "./routes/partners";
import { registerWebhookRoutes } from "./routes/webhooks";
import { registerMonitoringRoutes } from "./routes/monitoring";
import { registerSeoRoutes } from "./routes/seo";
import { registerAutopilotAdminRoutes } from "./routes/autopilotAdmin";
import { seedDatabase } from "./seed";
import { pool } from "./db";
import { assertEncryptionConfig, initEncryption } from "./services/encryptionService";


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
  // Unwrap KMS Data Encryption Keys (if configured) and select the active key
  // before any request can encrypt/decrypt PII. Fails closed: a misconfigured
  // KMS setup stops boot rather than silently falling back.
  await initEncryption();

  await setupAuth(app);
  await seedDatabase();

  // Idempotent: inserts compliance disclosure templates (e.g. anti-steering)
  // that post-date the original consent_templates seed. Fire-and-forget so a
  // transient DB hiccup can't block boot; the ensure retries on next call.
  void (await import("./consentGate")).ensureComplianceTemplates();

  registerLendingRoutes(app, storage);
  registerDocumentRoutes(app, storage);
  registerPropertyRoutes(app, storage);
  registerAgentBrokerRoutes(app, storage);
  registerAdminRoutes(app, storage);
  registerPricingPolicyRoutes(app);
  await registerTaskEngineRoutes(app, storage);
  registerUnderwritingRoutes(app, storage);
  registerComplianceRoutes(app, storage);
  registerBorrowerRoutes(app, storage);
  registerNotificationRoutes(app, storage);
  registerStaffInviteRoutes(app, storage);
  registerCoachRoutes(app);
  registerProfileRoutes(app);
  registerUnderwritingRulesRoutes(app, storage);
  registerPolicyOpsRoutes(app, storage);
  registerLookupMatrixRoutes(app, storage);
  registerRateSheetRoutes(app, storage);
  registerCommsRoutes(app);
  registerScenarioRoutes(app, storage);
  registerCockpitRoutes(app, storage);
  registerIntelligenceRoutes(app, storage);
  registerDataIntelligenceRoutes(app);
  registerListingsRoutes(app);
  registerGeocodeRoutes(app);
  registerCalculatorRoutes(app, storage);
  registerAusRoutes(app);
  registerAutopilotRoutes(app);
  registerJobRoutes(app);
  registerShellRoutes(app, storage);
  registerMarketDataRoutes(app);
  registerLeadRoutes(app, storage);
  registerTaxInsightRoutes(app, storage);
  registerTaxIntelligenceRoutes(app, storage);
  registerCpaPartnerRoutes(app, storage);
  registerPartnerRoutes(app, storage);
  registerWebhookRoutes(app, storage);
  registerMonitoringRoutes(app);
  registerSeoRoutes(app);
  registerAutopilotAdminRoutes(app);

  // `*` alone is not a valid path-to-regexp v8 pattern; wildcards must be named.
  app.all("/api/*splat", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
