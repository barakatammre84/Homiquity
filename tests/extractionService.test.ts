import { describe, it, expect } from "vitest";
import { checkTaxReturnConsistency } from "../server/extractionService";
import type { ExtractedTaxReturnData } from "../server/extractionService";

/**
 * Unit tests for the tax-return cross-field consistency hardening. This runs in
 * the real Gemini path only (after schema validation), where it caps the model's
 * self-reported confidence when our own arithmetic contradicts it — a garbled or
 * adversarial extraction must not present itself as high-confidence downstream.
 * The schema-validation and simulate paths are covered in taxInsight.test.ts;
 * this file covers the capping the other tests deliberately assert "did not fire".
 * Pure in-process — no HTTP server, no database.
 */

const extraction = (
  overrides: Partial<ExtractedTaxReturnData> = {},
): ExtractedTaxReturnData => ({
  documentYear: "2025",
  confidence: "high",
  extractedFields: [],
  ...overrides,
});

describe("checkTaxReturnConsistency", () => {
  it("caps confidence to medium when taxable income exceeds gross income", () => {
    const data = extraction({ grossIncome: 100_000, taxableIncome: 120_000 });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("medium");
    expect(data.warnings?.some((w) => /taxable income exceeds gross/i.test(w))).toBe(true);
  });

  it("caps when AGI exceeds gross income", () => {
    const data = extraction({ grossIncome: 100_000, adjustedGrossIncome: 110_000 });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("medium");
    expect(data.warnings?.some((w) => /AGI exceeds gross/i.test(w))).toBe(true);
  });

  it("caps when W-2 wages exceed gross income", () => {
    const data = extraction({ grossIncome: 50_000, w2Wages: 60_000 });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("medium");
    expect(data.warnings?.some((w) => /W-2 wages exceed gross/i.test(w))).toBe(true);
  });

  it("caps when Schedule E net rental income exceeds gross rents", () => {
    const data = extraction({
      scheduleE: { netRentalIncomeLoss: 40_000, grossRents: 30_000 },
    });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("medium");
    expect(data.warnings?.some((w) => /Schedule E net rental/i.test(w))).toBe(true);
  });

  it("leaves a self-consistent high-confidence extraction untouched", () => {
    const data = extraction({
      w2Wages: 68_000,
      grossIncome: 115_000,
      adjustedGrossIncome: 110_000,
      taxableIncome: 95_000,
      scheduleE: { netRentalIncomeLoss: 12_000, grossRents: 36_000 },
    });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("high");
    expect(data.warnings).toBeUndefined();
  });

  it("never raises confidence — a low-confidence extraction with a violation stays low", () => {
    const data = extraction({ confidence: "low", grossIncome: 100_000, taxableIncome: 120_000 });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("low");
    expect(data.warnings?.length).toBeGreaterThan(0);
  });

  it("accumulates a warning per violation", () => {
    const data = extraction({
      grossIncome: 100_000,
      taxableIncome: 120_000,
      adjustedGrossIncome: 130_000,
      w2Wages: 140_000,
    });
    checkTaxReturnConsistency(data);
    expect(data.confidence).toBe("medium");
    expect(data.warnings?.length).toBe(3);
  });
});
