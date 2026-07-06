import { describe, it, expect } from "vitest";
import { validateTaxReturnResponse, extractTaxReturnData } from "../server/extractionService";
import { deriveTaxInsight } from "../server/services/taxInsightService";
import type { ExtractedTaxReturnData } from "../server/extractionService";

/**
 * Unit tests for the tax-return extraction schema (untrusted model output)
 * and the tax-insight derivation (readiness/DSCR signals). Pure in-process —
 * no HTTP server, no database writes.
 */

const geminiResponse = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    documentYear: "2025",
    taxpayerName: "Jordan Sample",
    w2Wages: 68000,
    grossIncome: 115000,
    adjustedGrossIncome: 110000,
    taxableIncome: 95000,
    filingStatus: "single",
    scheduleC: { businessIncome: 50000, businessExpenses: 15000, netProfitLoss: 35000 },
    scheduleE: {
      netRentalIncomeLoss: 12000,
      grossRents: 36000,
      totalDepreciation: 8000,
      mortgageInterest: 9000,
      propertyCount: 2,
    },
    confidence: "high",
    extractedFields: ["w2Wages", "grossIncome", "scheduleE"],
    warnings: [],
    ...overrides,
  });

describe("tax return schema validation (Schedule E + W-2)", () => {
  it("parses a full response including Schedule E and W-2 wages", () => {
    const parsed = validateTaxReturnResponse(geminiResponse());
    expect(parsed).not.toBeNull();
    expect(parsed!.w2Wages).toBe(68000);
    expect(parsed!.scheduleE?.netRentalIncomeLoss).toBe(12000);
    expect(parsed!.scheduleE?.grossRents).toBe(36000);
    expect(parsed!.scheduleE?.propertyCount).toBe(2);
  });

  it("coerces currency-formatted strings to numbers", () => {
    const parsed = validateTaxReturnResponse(
      geminiResponse({ scheduleE: { grossRents: "$36,000.00", netRentalIncomeLoss: "12,000" } }),
    );
    expect(parsed!.scheduleE?.grossRents).toBe(36000);
    expect(parsed!.scheduleE?.netRentalIncomeLoss).toBe(12000);
  });

  it("drops out-of-range values instead of trusting them (prompt-injection posture)", () => {
    const parsed = validateTaxReturnResponse(
      geminiResponse({
        w2Wages: 2_000_000_000_000, // > MAX_MONEY — dropped
        scheduleE: { propertyCount: 999, grossRents: 36000 }, // count > 50 — dropped
      }),
    );
    expect(parsed!.w2Wages).toBeUndefined();
    expect(parsed!.scheduleE?.propertyCount).toBeUndefined();
    expect(parsed!.scheduleE?.grossRents).toBe(36000);
  });

  it("returns null for a structurally unusable payload", () => {
    expect(validateTaxReturnResponse("I am not JSON at all")).toBeNull();
    expect(validateTaxReturnResponse("")).toBeNull();
  });
});

const baseExtraction = (overrides: Partial<ExtractedTaxReturnData> = {}): ExtractedTaxReturnData => ({
  documentYear: "2025",
  confidence: "medium",
  extractedFields: [],
  ...overrides,
});

describe("deriveTaxInsight", () => {
  it("flags a DSCR candidate when Schedule E is present with usable confidence", () => {
    const insight = deriveTaxInsight(
      baseExtraction({
        scheduleE: { netRentalIncomeLoss: 12000, grossRents: 36000, propertyCount: 2 },
        confidence: "high",
      }),
    );
    expect(insight.dscrCandidate).toBe(true);
    expect(insight.scheduleENetRental).toBe("12000.00");
    expect(insight.rentalPropertyCount).toBe(2);
    expect(insight.taxYear).toBe(2025);
  });

  it("does NOT flag DSCR on a low-confidence extraction", () => {
    const insight = deriveTaxInsight(
      baseExtraction({
        scheduleE: { netRentalIncomeLoss: 12000, propertyCount: 2 },
        confidence: "low",
      }),
    );
    expect(insight.dscrCandidate).toBe(false);
    expect(insight.confidence).toBe("low");
  });

  it("flags self-employed from Schedule C without flagging DSCR", () => {
    const insight = deriveTaxInsight(
      baseExtraction({ scheduleC: { netProfitLoss: 35000 }, w2Wages: 68000 }),
    );
    expect(insight.selfEmployed).toBe(true);
    expect(insight.dscrCandidate).toBe(false);
    expect(insight.wagesW2).toBe("68000.00");
    expect(insight.scheduleCNetProfit).toBe("35000.00");
  });

  it("derives no flags and null money fields from an empty extraction", () => {
    const insight = deriveTaxInsight(baseExtraction());
    expect(insight.selfEmployed).toBe(false);
    expect(insight.dscrCandidate).toBe(false);
    expect(insight.wagesW2).toBeNull();
    expect(insight.grossIncome).toBeNull();
    expect(insight.scheduleENetRental).toBeNull();
    expect(insight.rentalPropertyCount).toBeNull();
  });

  it("negative Schedule E (rental loss) still marks the investor signal", () => {
    const insight = deriveTaxInsight(
      baseExtraction({ scheduleE: { netRentalIncomeLoss: -4000, grossRents: 30000, propertyCount: 1 } }),
    );
    expect(insight.dscrCandidate).toBe(true);
    expect(insight.scheduleENetRental).toBe("-4000.00");
  });

  it("falls back to the prior year when documentYear is unparseable", () => {
    const insight = deriveTaxInsight(baseExtraction({ documentYear: "unknown" }));
    expect(insight.taxYear).toBe(new Date().getFullYear() - 1);
  });
});

// Simulation runs only when no Gemini key is configured — with a real key the
// service would attempt a network call, which unit tests must never do.
const hasGeminiKey = !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

describe.skipIf(hasGeminiKey)("simulated extraction (EXTRACTION_SIMULATE)", () => {
  it("is deterministic per file path, internally consistent, and clearly flagged", async () => {
    process.env.EXTRACTION_SIMULATE = "true";
    try {
      const a = await extractTaxReturnData("/objects/sim-test-a.pdf", "2025");
      const b = await extractTaxReturnData("/objects/sim-test-a.pdf", "2025");
      const c = await extractTaxReturnData("/objects/sim-test-c.pdf", "2025");

      expect(a).toEqual(b); // same path → same figures
      expect(a.w2Wages).not.toBe(c.w2Wages); // different path → different seed
      expect(a.warnings?.join(" ")).toContain("Simulated extraction");
      expect(a.scheduleE?.netRentalIncomeLoss).toBeDefined();
      // Internally consistent: the consistency caps must not have fired.
      expect(a.w2Wages! <= a.grossIncome!).toBe(true);
      expect(a.scheduleE!.netRentalIncomeLoss! <= a.scheduleE!.grossRents!).toBe(true);
      expect(a.confidence).toBe("medium");

      // The simulated payload must clear DSCR derivation end-to-end.
      expect(deriveTaxInsight(a).dscrCandidate).toBe(true);
    } finally {
      delete process.env.EXTRACTION_SIMULATE;
    }
  });

  it("returns the empty low-confidence extraction when the flag is off", async () => {
    delete process.env.EXTRACTION_SIMULATE;
    const result = await extractTaxReturnData("/objects/sim-test-a.pdf", "2025");
    expect(result.confidence).toBe("low");
    expect(result.extractedFields).toEqual([]);
  });
});
