import { describe, expect, it } from "vitest";
import {
  rentalYieldToEquivalentRate,
  structureToPaymentStream,
  STRUCTURE_TRANSLATION_CITATIONS,
} from "../server/services/structureTranslation";
import { buildMortgagePaymentStream, monthlyPrincipalAndInterest } from "../server/services/apr";

/**
 * Alternative-structure translation math (UAL P7).
 *
 * Anchor identity (research doc §3): a diminishing Musharaka/Ijara with a
 * LEVEL combined payment and rent accruing on the financier's outstanding
 * share is cash-flow-identical to a conventional amortizing loan whose note
 * rate equals the rental yield. The translator must therefore recover the
 * yield exactly — the same "recover the generating rate" anchor as apr.test.ts.
 * Every other case moves off that anchor in a known direction.
 */

describe("structure translation: level_total anchor identity", () => {
  it("musharaka level_total stream equals the conventional amortizing stream at the yield", () => {
    const stream = structureToPaymentStream({
      structure: "musharaka",
      propertyPrice: 500000,
      downPayment: 100000,
      annualRentalYieldPct: 6.0,
      termMonths: 360,
      acquisitionSchedule: "level_total",
    });
    const conventional = buildMortgagePaymentStream({
      loanAmount: 400000,
      noteRatePct: 6.0,
      termMonths: 360,
    });
    expect(stream.payments.length).toBe(360);
    for (let t = 0; t < 360; t += 60) {
      expect(stream.payments[t]).toBeCloseTo(conventional[t], 6);
    }
    expect(stream.payments[359]).toBeCloseTo(conventional[359], 6);
  });

  it("recovers the rental yield exactly as the equivalent note rate", () => {
    const result = rentalYieldToEquivalentRate({
      structure: "ijara",
      propertyPrice: 500000,
      downPayment: 100000,
      annualRentalYieldPct: 6.0,
      termMonths: 360,
      acquisitionSchedule: "level_total",
    });
    expect(result.equivalentNoteRatePct).toBeCloseTo(6.0, 2);
    expect(result.financedAmount).toBe(400000);
    expect(result.monthlyQualifyingPayment).toBeCloseTo(
      monthlyPrincipalAndInterest(400000, 6.0, 360),
      1,
    );
  });

  it("acquisition components fully amortize the financier share", () => {
    const stream = structureToPaymentStream({
      structure: "musharaka",
      propertyPrice: 300000,
      downPayment: 60000,
      annualRentalYieldPct: 5.5,
      termMonths: 180,
      acquisitionSchedule: "level_total",
    });
    const totalAcquired = stream.acquisitionComponents.reduce((a, b) => a + b, 0);
    expect(totalAcquired).toBeCloseTo(240000, 2);
    // Decomposition consistency: A_t + R_t = payment, every month.
    for (let t = 0; t < stream.payments.length; t++) {
      expect(stream.acquisitionComponents[t] + stream.returnComponents[t]).toBeCloseTo(
        stream.payments[t],
        8,
      );
    }
  });
});

describe("structure translation: level_acquisition (declining payment)", () => {
  it("payments decline and the qualifying payment is the first (highest) month", () => {
    const result = rentalYieldToEquivalentRate({
      structure: "musharaka",
      propertyPrice: 500000,
      downPayment: 100000,
      annualRentalYieldPct: 6.0,
      termMonths: 360,
      acquisitionSchedule: "level_acquisition",
    });
    const p = result.paymentStream.payments;
    expect(p[0]).toBeGreaterThan(p[359]);
    expect(result.monthlyQualifyingPayment).toBeCloseTo(Math.round(p[0] * 100) / 100, 2);
    // Rent on the declining outstanding share still recovers the yield as
    // the equivalent rate (the IRR of a declining-balance rent stream at
    // yield y is y — same identity, different amortization shape).
    expect(result.equivalentNoteRatePct).toBeCloseTo(6.0, 2);
  });

  it("first month = level acquisition + full-share rent, last month ≈ acquisition only", () => {
    const stream = structureToPaymentStream({
      structure: "ijara",
      propertyPrice: 240000,
      downPayment: 40000,
      annualRentalYieldPct: 4.8,
      termMonths: 200,
      acquisitionSchedule: "level_acquisition",
    });
    const acquisition = 200000 / 200;
    expect(stream.payments[0]).toBeCloseTo(acquisition + 200000 * (0.048 / 12), 6);
    // Final month's rent accrues on one remaining acquisition slice.
    expect(stream.payments[199]).toBeCloseTo(acquisition + acquisition * (0.048 / 12), 6);
  });
});

describe("structure translation: murabaha (cost-plus)", () => {
  it("zero markup translates to a zero equivalent rate", () => {
    const result = rentalYieldToEquivalentRate({
      structure: "murabaha",
      financedCost: 200000,
      declaredMarkup: 0,
      termMonths: 240,
    });
    expect(result.equivalentNoteRatePct).toBe(0);
    expect(result.monthlyQualifyingPayment).toBeCloseTo(200000 / 240, 2);
  });

  it("recovers the rate that generated the markup (round-trip through apr.ts)", () => {
    // Build the markup from a known 6% conventional installment; the
    // translator must recover ~6% as the equivalent rate.
    const installment = monthlyPrincipalAndInterest(100000, 6.0, 360);
    const declaredMarkup = installment * 360 - 100000;
    const result = rentalYieldToEquivalentRate({
      structure: "murabaha",
      financedCost: 100000,
      declaredMarkup,
      termMonths: 360,
    });
    expect(result.equivalentNoteRatePct).toBeCloseTo(6.0, 2);
  });

  it("markup spreads pro-rata: A_t + R_t = installment each month", () => {
    const stream = structureToPaymentStream({
      structure: "murabaha",
      financedCost: 150000,
      declaredMarkup: 60000,
      termMonths: 300,
    });
    expect(stream.payments[0]).toBeCloseTo(210000 / 300, 8);
    expect(stream.acquisitionComponents[0]).toBeCloseTo(150000 / 300, 8);
    expect(stream.returnComponents[0]).toBeCloseTo(60000 / 300, 8);
  });
});

describe("structure translation: determinism + guards", () => {
  it("same term sheet, same translation (deterministic)", () => {
    const params = {
      structure: "musharaka" as const,
      propertyPrice: 425000,
      downPayment: 85000,
      annualRentalYieldPct: 6.375,
      termMonths: 360,
      acquisitionSchedule: "level_total" as const,
    };
    const a = rentalYieldToEquivalentRate(params);
    const b = rentalYieldToEquivalentRate(params);
    expect(a).toEqual(b);
  });

  it("rejects a down payment at or above the property price", () => {
    expect(() =>
      structureToPaymentStream({
        structure: "ijara",
        propertyPrice: 200000,
        downPayment: 200000,
        annualRentalYieldPct: 5,
        termMonths: 360,
        acquisitionSchedule: "level_total",
      }),
    ).toThrow(/below propertyPrice/);
  });

  it("rejects negative markup and non-positive terms", () => {
    expect(() =>
      structureToPaymentStream({
        structure: "murabaha",
        financedCost: 100000,
        declaredMarkup: -1,
        termMonths: 360,
      }),
    ).toThrow(/declaredMarkup/);
    expect(() =>
      structureToPaymentStream({
        structure: "murabaha",
        financedCost: 100000,
        declaredMarkup: 0,
        termMonths: 0,
      }),
    ).toThrow(/termMonths/);
  });

  it("carries the §3 + Reg Z citations on every result", () => {
    const result = rentalYieldToEquivalentRate({
      structure: "murabaha",
      financedCost: 100000,
      declaredMarkup: 20000,
      termMonths: 120,
    });
    expect(result.citations).toEqual(STRUCTURE_TRANSLATION_CITATIONS);
    expect(result.citations.map((c) => c.doc)).toContain(
      "knowledge-base/research/islamic-finance/UNIVERSAL_ADAPTATION_LAYER.md",
    );
  });
});
