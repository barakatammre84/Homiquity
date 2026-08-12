// Audit finding F-4 — TRID good-faith fee tolerance (Reg Z 1026.19(e)(3)).
// Before this, fee-tolerance math did not exist and no baseline of the issued
// Loan Estimate was persisted, so an increase was undetectable by construction.
import { describe, it, expect } from "vitest";
import {
  buildDisclosureSnapshot,
  bucketTotal,
  evaluateTolerance,
  type DisclosureSnapshot,
} from "../shared/compliance/feeTolerance";

/** The platform fee schedule on a $400k loan / $500k purchase. */
function snapshot(overrides: Partial<Parameters<typeof buildDisclosureSnapshot>[0]> = {}): DisclosureSnapshot {
  return buildDisclosureSnapshot({
    loanAmount: 400_000,
    interestRate: 6.875,
    originationCharges: { originationFee: 4_000, points: 0, applicationFee: 500, underwritingFee: 1_500 },
    servicesYouCannotShopFor: { appraisal: 650, creditReport: 75, floodDetermination: 25, taxService: 100 },
    servicesYouCanShopFor: { titleInsurance: 2_000, titleSearch: 350, surveyFee: 450, pestInspection: 150 },
    taxesAndGovernmentFees: { recordingFees: 150, transferTaxes: 500 },
    prepaids: { homeownersInsurance: 1_200, mortgageInsurance: 0, prepaidInterest: 1_130, propertyTaxes: 1_000 },
    initialEscrow: { homeownersInsurance: 300, mortgageInsurance: 0, propertyTaxes: 1_500 },
    otherItems: { ownersTitleInsurance: 1_500 },
    ...overrides,
  });
}

describe("F-4 — tolerance bucket classification", () => {
  it("puts originator charges and non-shoppable services in zero tolerance", () => {
    const s = snapshot();
    // Section A (4,000 + 500 + 1,500) + Section B (650+75+25+100)
    // + Section C (2,000+350+450+150) + transfer taxes (500)
    expect(bucketTotal(s, "zero")).toBe(6_000 + 850 + 2_950 + 500);
  });

  it("puts recording fees — and only those — in the ten-percent tier", () => {
    expect(bucketTotal(snapshot(), "ten_percent")).toBe(150);
  });

  it("puts prepaids and escrows outside any numeric tolerance", () => {
    const s = snapshot();
    expect(bucketTotal(s, "none")).toBe(1_200 + 0 + 1_130 + 1_000 + 300 + 0 + 1_500 + 1_500);
  });

  it("classifies the audit's $6,850 zero-tolerance core (Sections A + B)", () => {
    const s = snapshot();
    const coreIds = [
      "origination_fee", "points", "application_fee", "underwriting_fee",
      "appraisal", "credit_report", "flood_determination", "tax_service",
    ];
    const core = s.fees.filter(f => coreIds.includes(f.id)).reduce((sum, f) => sum + f.amount, 0);
    expect(core).toBe(6_850);
    expect(s.fees.filter(f => coreIds.includes(f.id)).every(f => f.bucket === "zero")).toBe(true);
  });
});

describe("F-4 — tolerance evaluation", () => {
  it("passes when nothing changed", () => {
    const result = evaluateTolerance(snapshot(), snapshot(), { hasChangeOfCircumstance: false });
    expect(result.verdict).toBe("within_tolerance");
    expect(result.cureAmount).toBe(0);
    expect(result.increases).toEqual([]);
  });

  it("passes when charges go DOWN — a decrease is never a cure", () => {
    const cheaper = snapshot({
      servicesYouCannotShopFor: { appraisal: 400, creditReport: 75, floodDetermination: 25, taxService: 100 },
    });
    const result = evaluateTolerance(snapshot(), cheaper, { hasChangeOfCircumstance: false });
    expect(result.verdict).toBe("within_tolerance");
    expect(result.cureAmount).toBe(0);
  });

  it("makes any zero-tolerance increase a cure when no CoC is on file", () => {
    // The audit's example: a complex appraisal comes in at $1,200, not $650.
    const revised = snapshot({
      servicesYouCannotShopFor: { appraisal: 1_200, creditReport: 75, floodDetermination: 25, taxService: 100 },
    });
    const result = evaluateTolerance(snapshot(), revised, { hasChangeOfCircumstance: false });
    expect(result.verdict).toBe("cure_required");
    expect(result.zeroToleranceIncrease).toBe(550);
    expect(result.cureAmount).toBe(550);
    expect(result.message).toMatch(/60 days/);
  });

  it("treats the same increase as justified when a CoC is on file", () => {
    const revised = snapshot({
      servicesYouCannotShopFor: { appraisal: 1_200, creditReport: 75, floodDetermination: 25, taxService: 100 },
    });
    const result = evaluateTolerance(snapshot(), revised, { hasChangeOfCircumstance: true });
    expect(result.verdict).toBe("increase_justified");
    // The gross increase is still reported; cureAmount is what is actually
    // OWED, and an authorized increase owes nothing (audit FA-21).
    expect(result.zeroToleranceIncrease).toBe(550);
    expect(result.cureAmount).toBe(0);
    expect(result.message).toMatch(/3 business days/);
  });

  it("allows a ten-percent tier rise up to the cumulative allowance", () => {
    // Recording fees 150 → 165 is exactly +10%.
    const atLimit = snapshot({ taxesAndGovernmentFees: { recordingFees: 165, transferTaxes: 500 } });
    expect(evaluateTolerance(snapshot(), atLimit, { hasChangeOfCircumstance: false }).verdict).toBe("within_tolerance");

    const overLimit = snapshot({ taxesAndGovernmentFees: { recordingFees: 166, transferTaxes: 500 } });
    const result = evaluateTolerance(snapshot(), overLimit, { hasChangeOfCircumstance: false });
    expect(result.verdict).toBe("cure_required");
    expect(result.tenPercent.allowed).toBe(165);
    expect(result.cureAmount).toBe(1);
  });

  it("lets prepaids move freely — no numeric tolerance", () => {
    const revised = snapshot({
      prepaids: { homeownersInsurance: 2_400, mortgageInsurance: 0, prepaidInterest: 1_800, propertyTaxes: 1_000 },
    });
    const result = evaluateTolerance(snapshot(), revised, { hasChangeOfCircumstance: false });
    expect(result.verdict).toBe("within_tolerance");
    expect(result.increases.length).toBeGreaterThan(0); // recorded, just not cured
    expect(result.cureAmount).toBe(0);
  });

  it("counts a charge that appears for the first time as a full increase", () => {
    const baseline = snapshot({ servicesYouCanShopFor: { titleInsurance: 2_000, titleSearch: 350, surveyFee: 0, pestInspection: 150 } });
    const revised = snapshot(); // surveyFee 450 appears
    const result = evaluateTolerance(baseline, revised, { hasChangeOfCircumstance: false });
    expect(result.verdict).toBe("cure_required");
    expect(result.increases.find(i => i.id === "survey_fee")?.increase).toBe(450);
  });

  it("sums zero-tolerance and ten-percent excess into one cure figure", () => {
    const revised = snapshot({
      originationCharges: { originationFee: 4_500, points: 0, applicationFee: 500, underwritingFee: 1_500 },
      taxesAndGovernmentFees: { recordingFees: 200, transferTaxes: 500 },
    });
    const result = evaluateTolerance(snapshot(), revised, { hasChangeOfCircumstance: false });
    expect(result.zeroToleranceIncrease).toBe(500);
    expect(result.tenPercent.excess).toBe(35); // 200 - 165
    expect(result.cureAmount).toBe(535);
  });

  it("is deterministic", () => {
    const a = evaluateTolerance(snapshot(), snapshot({ otherItems: { ownersTitleInsurance: 1_800 } }), { hasChangeOfCircumstance: false });
    const b = evaluateTolerance(snapshot(), snapshot({ otherItems: { ownersTitleInsurance: 1_800 } }), { hasChangeOfCircumstance: false });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Audit FA-21 — a change of circumstance authorizes only the charges it
// actually affects, and never the platform's own fixed fees.
// ---------------------------------------------------------------------------
describe("FA-21 — scoped change-of-circumstance authorization", () => {
  /** The platform re-priced itself: underwriting fee 1,500 → 1,800. */
  const platformRepriced = () =>
    snapshot({
      originationCharges: { originationFee: 4_000, points: 0, applicationFee: 500, underwritingFee: 1_800 },
    });

  it("never lets ANY circumstance authorize a platform fixed-fee increase", () => {
    // Unscoped CoC — the historical "authorizes everything" case.
    const unscoped = evaluateTolerance(snapshot(), platformRepriced(), {
      hasChangeOfCircumstance: true,
    });
    expect(unscoped.verdict).toBe("cure_required");
    expect(unscoped.cureAmount).toBe(300);

    // Even naming the fee explicitly must not authorize it: only a platform
    // re-price can move this line, and that is not a §1026.19(e)(3)(iv) reason.
    const named = evaluateTolerance(snapshot(), platformRepriced(), {
      hasChangeOfCircumstance: true,
      affectedChargeIds: ["underwriting_fee"],
    });
    expect(named.verdict).toBe("cure_required");
    expect(named.cureAmount).toBe(300);
  });

  it("does not let an unrelated circumstance launder an unrelated increase", () => {
    // A rate-lock CoC scoped to points must not justify an appraisal overrun.
    const revised = snapshot({
      servicesYouCannotShopFor: { appraisal: 1_200, creditReport: 75, floodDetermination: 25, taxService: 100 },
    });
    const result = evaluateTolerance(snapshot(), revised, {
      hasChangeOfCircumstance: true,
      affectedChargeIds: ["points"],
    });
    expect(result.verdict).toBe("cure_required");
    expect(result.cureAmount).toBe(550);
    expect(result.message).toMatch(/does not reach/);
  });

  it("authorizes a charge the circumstance genuinely reaches", () => {
    const revised = snapshot({
      servicesYouCannotShopFor: { appraisal: 1_200, creditReport: 75, floodDetermination: 25, taxService: 100 },
    });
    const result = evaluateTolerance(snapshot(), revised, {
      hasChangeOfCircumstance: true,
      affectedChargeIds: ["appraisal"],
    });
    expect(result.verdict).toBe("increase_justified");
    expect(result.cureAmount).toBe(0);
  });

  it("cures the unauthorized remainder when coverage is partial", () => {
    // Appraisal is covered; the platform's underwriting fee never is.
    const revised = snapshot({
      originationCharges: { originationFee: 4_000, points: 0, applicationFee: 500, underwritingFee: 1_800 },
      servicesYouCannotShopFor: { appraisal: 1_200, creditReport: 75, floodDetermination: 25, taxService: 100 },
    });
    const result = evaluateTolerance(snapshot(), revised, {
      hasChangeOfCircumstance: true,
      affectedChargeIds: ["appraisal"],
    });
    expect(result.verdict).toBe("cure_required");
    expect(result.zeroToleranceIncrease).toBe(850); // gross: 550 + 300
    expect(result.cureAmount).toBe(300); // only the platform fee is owed
  });
});
