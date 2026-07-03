import type { Express } from "express";
import { requireRole } from "../auth";
import { storage } from "../storage";
import {
  getCompetitorBenchmark,
  getRiskProfile,
  getUndercutQuote,
} from "../services/competitorRateService";

// =============================================================================
// MARKET DATA ROUTES (staff-only)
//
// Read-only views over the free-data moat (public HMDA + Fannie Mae
// performance aggregates). Nothing here mutates pricing: the undercut quote
// is advisory and rate changes go through rate sheets (see
// competitorRateService header for the Reg Z rationale). Staff-only because
// competitor-relative positioning is an internal pricing input, not a
// borrower-facing disclosure.
// =============================================================================

const STAFF = ["admin", "lo", "loa", "processor", "underwriter"] as const;

export function registerMarketDataRoutes(app: Express) {

  // Median competitor rate for a geography (county → state → national fallback).
  app.get("/api/market-data/competitor-benchmark", requireRole(...STAFF), async (req, res) => {
    try {
      const benchmark = await getCompetitorBenchmark({
        state: (req.query.state as string) || undefined,
        countyFips: (req.query.countyFips as string) || undefined,
        loanType: req.query.loanType ? parseInt(req.query.loanType as string, 10) : undefined,
        loanPurpose: req.query.loanPurpose ? parseInt(req.query.loanPurpose as string, 10) : undefined,
        activityYear: req.query.year ? parseInt(req.query.year as string, 10) : undefined,
      });
      if (!benchmark) {
        return res.status(404).json({
          error: "No competitor benchmark available — run the HMDA ingest script (npm run data:hmda).",
        });
      }
      res.json(benchmark);
    } catch (error) {
      console.error("Competitor benchmark error:", error);
      res.status(500).json({ error: "Failed to fetch competitor benchmark" });
    }
  });

  // Our best executable rate vs. the competitor median for a borrower profile.
  app.get("/api/market-data/undercut-quote", requireRole(...STAFF), async (req, res) => {
    try {
      const creditScore = parseInt(req.query.creditScore as string, 10);
      const loanAmount = parseFloat(req.query.loanAmount as string);
      const propertyValue = parseFloat(req.query.propertyValue as string);
      if (!creditScore || !loanAmount || !propertyValue) {
        return res.status(400).json({ error: "creditScore, loanAmount and propertyValue are required" });
      }
      const quote = await getUndercutQuote(storage, {
        creditScore,
        loanAmount,
        propertyValue,
        loanPurpose: (req.query.loanPurpose as any) || "purchase",
        state: (req.query.state as string) || undefined,
        countyFips: (req.query.countyFips as string) || undefined,
      });
      res.json(quote);
    } catch (error) {
      console.error("Undercut quote error:", error);
      res.status(500).json({ error: "Failed to compute undercut quote" });
    }
  });

  // Historical default/prepay rates (Fannie Mae) for a borrower's risk band.
  app.get("/api/market-data/risk-profile", requireRole(...STAFF), async (req, res) => {
    try {
      const creditScore = parseInt(req.query.creditScore as string, 10);
      const ltv = parseFloat(req.query.ltv as string);
      if (!creditScore || !ltv) {
        return res.status(400).json({ error: "creditScore and ltv are required" });
      }
      const profile = await getRiskProfile({
        creditScore,
        ltv,
        dti: req.query.dti ? parseFloat(req.query.dti as string) : undefined,
      });
      if (!profile) {
        return res.status(404).json({
          error: "No performance profile for this band — run the Fannie Mae ingest script (npm run data:fannie).",
        });
      }
      res.json(profile);
    } catch (error) {
      console.error("Risk profile error:", error);
      res.status(500).json({ error: "Failed to fetch risk profile" });
    }
  });
}
