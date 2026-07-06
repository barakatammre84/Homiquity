import type { Express } from "express";
import type { IStorage } from "../storage";
import { calculateLLPA } from "../pricing";
import { getPMIRateCard } from "../propertyAnalyzer";
import { extractLeaseData } from "../extractionService";
import { upload, verifyFileSignature } from "./utils";
import { prelaunchGate } from "../services/prelaunchGate";

// Fallback 30-year fixed base rate used only when no live/maintained rate is
// available (e.g. database empty or unreachable). The preferred source is the
// platform's live 30-year fixed rate (program "prog-30yr-fixed"), so the public
// calculators stay consistent with the displayed "Today's Rates".
const FALLBACK_BASE_RATE = 6.5;

// Program id for the 30-year fixed rate, which anchors the public calculators.
const BASE_RATE_PROGRAM_ID = "prog-30yr-fixed";

// Resolve the base 30-year fixed rate from live/maintained data, falling back
// to a sensible default if no live rate can be sourced.
async function resolveBaseRate(
  storage: IStorage,
): Promise<{ baseRate: number; source: "live" | "fallback" }> {
  try {
    const rates = await storage.getMortgageRatesForLocation(undefined, undefined);
    const thirtyYearFixed = rates.find((r) => r.programId === BASE_RATE_PROGRAM_ID);
    const parsed = thirtyYearFixed ? parseFloat(thirtyYearFixed.rate) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return { baseRate: parsed, source: "live" };
    }
  } catch (err) {
    console.error("Failed to resolve live base rate, using fallback:", err);
  }
  return { baseRate: FALLBACK_BASE_RATE, source: "fallback" };
}

// Representative loan amount used only to drive LLPA lookups (LLPA rate impact
// is independent of loan size; this is just required by calculateLLPA).
const REFERENCE_LOAN_AMOUNT = 300000;

interface CreditTier {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  representativeScore: number;
  minDownPaymentPct: number;
}

const CREDIT_TIERS: CreditTier[] = [
  { id: "exceptional", label: "Exceptional", minScore: 780, maxScore: 850, representativeScore: 790, minDownPaymentPct: 0.03 },
  { id: "excellent", label: "Excellent", minScore: 740, maxScore: 779, representativeScore: 760, minDownPaymentPct: 0.03 },
  { id: "good", label: "Good", minScore: 700, maxScore: 739, representativeScore: 720, minDownPaymentPct: 0.05 },
  { id: "fair", label: "Fair", minScore: 680, maxScore: 699, representativeScore: 690, minDownPaymentPct: 0.05 },
  { id: "needs_work", label: "Needs Work", minScore: 640, maxScore: 679, representativeScore: 660, minDownPaymentPct: 0.10 },
  { id: "building", label: "Building Credit", minScore: 580, maxScore: 639, representativeScore: 620, minDownPaymentPct: 0.10 },
];

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function registerCalculatorRoutes(app: Express, storage: IStorage) {
  // ============================================================
  // PUBLIC CREDIT TIER PRICING (no auth)
  // Returns rate / PMI / minimum down payment assumptions per credit
  // band so client-side calculators can run consistent math without
  // exposing the staff-only pricing engine.
  // ============================================================
  app.get("/api/calculators/credit-tiers", prelaunchGate, async (_req, res) => {
    try {
      const { baseRate, source } = await resolveBaseRate(storage);

      const tiers = await Promise.all(CREDIT_TIERS.map(async (tier) => {
        const ltvAtMinDown = round((1 - tier.minDownPaymentPct) * 100, 2);
        const llpa = await calculateLLPA(
          REFERENCE_LOAN_AMOUNT,
          tier.representativeScore,
          ltvAtMinDown,
        );
        const interestRate = round(baseRate + llpa.totalLLPA / 100, 3);
        const pmi = await getPMIRateCard(tier.representativeScore, ltvAtMinDown);

        return {
          id: tier.id,
          label: tier.label,
          minScore: tier.minScore,
          maxScore: tier.maxScore,
          representativeScore: tier.representativeScore,
          minDownPaymentPct: tier.minDownPaymentPct,
          interestRate,
          pmiAnnualRate: tier.minDownPaymentPct < 0.2 ? pmi.annualRate : 0,
        };
      }));

      res.json({ baseRate: round(baseRate, 3), baseRateSource: source, tiers });
    } catch (err) {
      console.error("Error building credit tiers:", err);
      res.status(500).json({ error: "Failed to build credit tiers" });
    }
  });

  // ============================================================
  // PUBLIC LEASE EXTRACTION (no auth)
  // Best-effort extraction of monthly rent from an uploaded lease for
  // the Rent-to-Own Readiness tool. The file lives only in request memory
  // (multer memoryStorage) — nothing touches disk or object storage, and
  // nothing is persisted for anonymous users.
  // ============================================================
  app.post("/api/calculators/extract-lease", upload.single("file"), verifyFileSignature, async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const extracted = await extractLeaseData(req.file.buffer, req.file.mimetype);

      res.json({
        monthlyRent: extracted.monthlyRent ?? null,
        confidence: extracted.confidence,
        extractedFields: extracted.extractedFields ?? [],
        warnings: extracted.warnings ?? [],
      });
    } catch (err) {
      console.error("Lease extraction (public) error:", err);
      res.status(500).json({ error: "Failed to extract lease" });
    }
  });
}
