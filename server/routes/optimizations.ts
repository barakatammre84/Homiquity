import type { Express } from "express";
import { isAuthenticated, requireRole } from "../auth";
import {
  detectStaleApplications,
  sendReEngagementEmails,
  matchAndPriceBorrower,
  getCoachPreFillData,
  wirePlaidToReadiness,
  checkSlaBreaches,
  sendSlaAlerts,
  checkRefinanceOpportunities,
  processPostClosingLifecycle,
  aggregateAnonymizedData,
  calculateAgentCommission,
} from "../services/optimizationEngine";

export function registerOptimizationRoutes(app: Express) {
  app.get("/api/optimizations/pre-fill", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const result = await getCoachPreFillData(userId);
      res.json(result);
    } catch (error) {
      console.error("[OPT-6] Pre-fill error:", error);
      res.status(500).json({ error: "Failed to fetch pre-fill data" });
    }
  });

  app.get("/api/optimizations/match-and-price", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const lockTermDays = req.query.lockTermDays ? parseInt(req.query.lockTermDays as string) : undefined;
      const productTypes = req.query.productTypes ? (req.query.productTypes as string).split(",") : undefined;

      const result = await matchAndPriceBorrower(userId, { lockTermDays, productTypes });
      res.json(result);
    } catch (error) {
      console.error("[OPT-3] Match and price error:", error);
      res.status(500).json({ error: "Failed to match and price" });
    }
  });

  app.post("/api/optimizations/plaid-readiness", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { verificationType, verifiedData } = req.body;

      if (!verificationType || !verifiedData) {
        return res.status(400).json({ error: "Missing verificationType or verifiedData" });
      }

      const result = await wirePlaidToReadiness(userId, verificationType, verifiedData);
      res.json(result);
    } catch (error) {
      console.error("[OPT-4] Plaid readiness error:", error);
      res.status(500).json({ error: "Failed to wire Plaid data to readiness" });
    }
  });

  app.get("/api/optimizations/stale-applications", requireRole("admin"), async (req, res) => {
    try {
      const result = await detectStaleApplications();
      res.json({ staleApplications: result, count: result.length });
    } catch (error) {
      console.error("[OPT-2] Stale applications error:", error);
      res.status(500).json({ error: "Failed to detect stale applications" });
    }
  });

  app.post("/api/optimizations/re-engagement", requireRole("admin"), async (req, res) => {
    try {
      const result = await sendReEngagementEmails();
      res.json(result);
    } catch (error) {
      console.error("[OPT-2] Re-engagement error:", error);
      res.status(500).json({ error: "Failed to send re-engagement emails" });
    }
  });

  app.get("/api/optimizations/sla-breaches", requireRole("admin"), async (req, res) => {
    try {
      const result = await checkSlaBreaches();
      res.json({
        breaches: result,
        totalAtRisk: result.length,
        totalBreached: result.filter(r => r.isBreached).length,
        totalCritical: result.filter(r => r.severity === "critical").length,
      });
    } catch (error) {
      console.error("[OPT-7] SLA breaches error:", error);
      res.status(500).json({ error: "Failed to check SLA breaches" });
    }
  });

  app.post("/api/optimizations/sla-alerts", requireRole("admin"), async (req, res) => {
    try {
      const result = await sendSlaAlerts();
      res.json(result);
    } catch (error) {
      console.error("[OPT-7] SLA alerts error:", error);
      res.status(500).json({ error: "Failed to send SLA alerts" });
    }
  });

  app.get("/api/optimizations/refinance-opportunities", requireRole("admin"), async (req, res) => {
    try {
      const result = await checkRefinanceOpportunities();
      res.json({
        opportunities: result,
        totalOpportunities: result.length,
        strongRecommendations: result.filter(r => r.recommendation === "refinance_strong").length,
        helocEligible: result.filter(r => r.recommendation === "heloc_eligible").length,
      });
    } catch (error) {
      console.error("[OPT-8] Refinance opportunities error:", error);
      res.status(500).json({ error: "Failed to check refinance opportunities" });
    }
  });

  app.post("/api/optimizations/post-closing-lifecycle", requireRole("admin"), async (req, res) => {
    try {
      const result = await processPostClosingLifecycle();
      res.json(result);
    } catch (error) {
      console.error("[OPT-8] Post-closing lifecycle error:", error);
      res.status(500).json({ error: "Failed to process post-closing lifecycle" });
    }
  });

  app.post("/api/optimizations/aggregate-data", requireRole("admin"), async (req, res) => {
    try {
      const result = await aggregateAnonymizedData();
      res.json(result);
    } catch (error) {
      console.error("[OPT-9] Data aggregation error:", error);
      res.status(500).json({ error: "Failed to aggregate anonymized data" });
    }
  });

  app.post("/api/optimizations/calculate-commission/:applicationId", requireRole("admin"), async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { fundedAmount } = req.body;

      if (!fundedAmount || fundedAmount <= 0) {
        return res.status(400).json({ error: "Valid fundedAmount is required" });
      }

      const result = await calculateAgentCommission(applicationId, fundedAmount);
      if (!result) {
        return res.status(404).json({ error: "No eligible referral found for this application" });
      }
      res.json(result);
    } catch (error) {
      console.error("[OPT-10] Commission calculation error:", error);
      res.status(500).json({ error: "Failed to calculate commission" });
    }
  });

  app.get("/api/optimizations/health", isAuthenticated, async (req, res) => {
    res.json({
      status: "operational",
      optimizations: {
        "OPT-1": { name: "Auto-Extraction → Readiness", status: "active", type: "event-driven" },
        "OPT-2": { name: "Stale App Re-engagement", status: "active", type: "scheduled" },
        "OPT-3": { name: "Match + Price Bridge", status: "active", type: "on-demand" },
        "OPT-4": { name: "Plaid → Readiness", status: "active", type: "event-driven" },
        "OPT-5": { name: "State Machine Sync", status: "active", type: "event-driven" },
        "OPT-6": { name: "Coach Pre-Fill", status: "active", type: "on-demand" },
        "OPT-7": { name: "SLA Breach Alerts", status: "active", type: "scheduled" },
        "OPT-8": { name: "Post-Closing Lifecycle", status: "active", type: "scheduled" },
        "OPT-9": { name: "Anonymized Data Pipeline", status: "active", type: "scheduled" },
        "OPT-10": { name: "Agent Commission Economics", status: "active", type: "event-driven" },
      },
    });
  });
}
