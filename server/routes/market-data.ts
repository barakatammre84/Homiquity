import type { Express } from "express";
import { requireRole } from "../auth";
import { storage } from "../storage";
import {
  getCompetitorBenchmark,
  getRiskProfile,
  getUndercutQuote,
} from "../services/competitorRateService";
import { firstQueryValue } from "./queryParams";

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
      const loanType = firstQueryValue(req.query.loanType);
      const loanPurpose = firstQueryValue(req.query.loanPurpose);
      const year = firstQueryValue(req.query.year);
      const benchmark = await getCompetitorBenchmark({
        state: firstQueryValue(req.query.state) || undefined,
        countyFips: firstQueryValue(req.query.countyFips) || undefined,
        loanType: loanType ? parseInt(loanType, 10) : undefined,
        loanPurpose: loanPurpose ? parseInt(loanPurpose, 10) : undefined,
        activityYear: year ? parseInt(year, 10) : undefined,
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
      const creditScore = parseInt(firstQueryValue(req.query.creditScore) ?? "", 10);
      const loanAmount = parseFloat(firstQueryValue(req.query.loanAmount) ?? "");
      const propertyValue = parseFloat(firstQueryValue(req.query.propertyValue) ?? "");
      if (!creditScore || !loanAmount || !propertyValue) {
        return res.status(400).json({ error: "creditScore, loanAmount and propertyValue are required" });
      }
      const quote = await getUndercutQuote(storage, {
        creditScore,
        loanAmount,
        propertyValue,
        loanPurpose: (firstQueryValue(req.query.loanPurpose) as any) || "purchase",
        state: firstQueryValue(req.query.state) || undefined,
        countyFips: firstQueryValue(req.query.countyFips) || undefined,
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
      const creditScore = parseInt(firstQueryValue(req.query.creditScore) ?? "", 10);
      const ltv = parseFloat(firstQueryValue(req.query.ltv) ?? "");
      if (!creditScore || !ltv) {
        return res.status(400).json({ error: "creditScore and ltv are required" });
      }
      const dti = firstQueryValue(req.query.dti);
      const profile = await getRiskProfile({
        creditScore,
        ltv,
        dti: dti ? parseFloat(dti) : undefined,
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
