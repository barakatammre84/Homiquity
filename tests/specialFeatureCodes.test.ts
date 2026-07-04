import { describe, it, expect } from "vitest";
import {
  SPECIAL_FEATURE_CODES,
  getSpecialFeatureCode,
  deriveSpecialFeatureCodes,
  validateSfcSet,
  MAX_SFCS_PER_LOAN,
} from "../shared/fannieMae/specialFeatureCodes";

// Catalog + rules transcribed from docs/fannie-mae/"Special Feature Codes
// updated 05-06-26.pdf".

const codes = (input: Parameters<typeof deriveSpecialFeatureCodes>[0]) =>
  deriveSpecialFeatureCodes(input).map(d => d.code);

describe("SFC catalog", () => {
  it("contains the published codes with no duplicates", () => {
    const all = SPECIAL_FEATURE_CODES.map(s => s.code);
    expect(new Set(all).size).toBe(all.length);
    // Spot-check codes and attributes against the document.
    expect(getSpecialFeatureCode("127")?.name).toContain("Desktop Underwriter");
    expect(getSpecialFeatureCode("127")?.autoDerived).toBe(true);
    expect(getSpecialFeatureCode("001")?.deliveryType).toBe("Negotiated");
    expect(getSpecialFeatureCode("036")?.execution).toBe("WholeLoan");
    expect(getSpecialFeatureCode("839")?.suspended).toBe(true);
    expect(getSpecialFeatureCode("918")?.name).toBe("Cryptocurrency Reserves");
  });
});

describe("deriveSpecialFeatureCodes", () => {
  it("derives nothing from an empty input (never guesses)", () => {
    expect(codes({})).toEqual([]);
  });

  it("derives refinance codes 003/007", () => {
    expect(codes({ refinanceCashOutType: "cash_out" })).toEqual(["003"]);
    expect(codes({ refinanceCashOutType: "limited_cash_out" })).toEqual(["007"]);
  });

  it("derives DU code 127", () => {
    expect(codes({ underwrittenThroughDu: true })).toEqual(["127"]);
  });

  it("classifies buydowns: 009 moderate, 014 significant", () => {
    // ≤2% difference and ≤2-year period → moderate.
    expect(codes({ buydownRateDifferencePercent: 2, buydownPeriodYears: 2 })).toEqual(["009"]);
    // >2% difference → significant regardless of period.
    expect(codes({ buydownRateDifferencePercent: 3, buydownPeriodYears: 1 })).toEqual(["014"]);
    // >2-year period → significant regardless of difference.
    expect(codes({ buydownRateDifferencePercent: 1, buydownPeriodYears: 3 })).toEqual(["014"]);
    expect(codes({ buydownRateDifferencePercent: 0, buydownPeriodYears: 0 })).toEqual([]);
  });

  it("derives flood codes 170/175/180 only when both facts are known", () => {
    expect(codes({ inSpecialFloodHazardArea: true, floodInsuranceInPlace: true })).toEqual(["170"]);
    expect(codes({ inSpecialFloodHazardArea: false, floodInsuranceInPlace: true })).toEqual(["175"]);
    expect(codes({ inSpecialFloodHazardArea: false, floodInsuranceInPlace: false })).toEqual(["180"]);
    // SFHA without coverage is an eligibility problem, not an SFC.
    expect(codes({ inSpecialFloodHazardArea: true, floodInsuranceInPlace: false })).toEqual([]);
    // Unknown insurance status derives nothing.
    expect(codes({ inSpecialFloodHazardArea: true })).toEqual([]);
  });

  it("stacks manufactured-home codes per the document", () => {
    expect(codes({ manufacturedHome: true })).toEqual(["235"]);
    expect(codes({ singleWidthManufacturedHome: true })).toEqual(["235", "791"]);
    // MH Advantage single-width carries 235 + 791 + 859.
    expect(codes({ mhAdvantage: true, singleWidthManufacturedHome: true })).toEqual(["235", "791", "859"]);
  });

  it("derives 808 only when the amount exceeds the conforming limit", () => {
    expect(codes({ originalLoanAmount: 850_000, conformingLoanLimit: 806_500 })).toEqual(["808"]);
    expect(codes({ originalLoanAmount: 806_500, conformingLoanLimit: 806_500 })).toEqual([]);
    expect(codes({ originalLoanAmount: 850_000 })).toEqual([]); // limit unknown
  });

  it("student loan cash-out implies the cash-out refinance code", () => {
    expect(codes({ studentLoanCashOut: true })).toEqual(["003", "841"]);
  });

  it("derives TPO channel codes", () => {
    expect(codes({ originationChannel: "correspondent" })).toEqual(["211"]);
    expect(codes({ originationChannel: "broker" })).toEqual(["212"]);
    expect(codes({ originationChannel: "retail" })).toEqual([]);
  });

  it("shared-appreciation Community Seconds carries 118 + 176", () => {
    expect(codes({ sharedAppreciationCommunitySeconds: true })).toEqual(["118", "176"]);
  });
});

describe("validateSfcSet", () => {
  it("accepts a clean set", () => {
    const r = validateSfcSet(["127", "900"]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects more than ten codes", () => {
    const eleven = ["003", "009", "013", "054", "076", "118", "127", "155", "162", "168", "173"];
    expect(eleven.length).toBe(MAX_SFCS_PER_LOAN + 1);
    const r = validateSfcSet(eleven);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("at most 10"))).toBe(true);
  });

  it("rejects codes not on the published list", () => {
    const r = validateSfcSet(["999"]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toContain("999");
  });

  it("enforces conjunction rules", () => {
    expect(validateSfcSet(["177"]).valid).toBe(false); // needs 630
    expect(validateSfcSet(["177", "630"]).valid).toBe(true);
    expect(validateSfcSet(["818"]).valid).toBe(false); // needs 900
    expect(validateSfcSet(["818", "900"]).valid).toBe(true);
    expect(validateSfcSet(["773"]).valid).toBe(false); // needs 375
    expect(validateSfcSet(["773", "375"]).valid).toBe(true);
    expect(validateSfcSet(["416"]).valid).toBe(false); // needs 007
    expect(validateSfcSet(["416", "007"]).valid).toBe(true);
    expect(validateSfcSet(["220"]).valid).toBe(false); // needs 118
    expect(validateSfcSet(["220", "118"]).valid).toBe(true);
  });

  it("enforces any-of conjunctions (304 with 003 or 007)", () => {
    expect(validateSfcSet(["304"]).valid).toBe(false);
    expect(validateSfcSet(["304", "003"]).valid).toBe(true);
    expect(validateSfcSet(["304", "007"]).valid).toBe(true);
  });

  it("treats 003 and 007 as mutually exclusive", () => {
    const r = validateSfcSet(["003", "007"]);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("mutually exclusive"))).toBe(true);
  });

  it("warns on negotiated and suspended codes without failing", () => {
    const negotiated = validateSfcSet(["001"]);
    expect(negotiated.valid).toBe(true);
    expect(negotiated.warnings.some(w => w.includes("negotiated contract"))).toBe(true);

    const suspended = validateSfcSet(["839", "007"]);
    expect(suspended.valid).toBe(true);
    expect(suspended.warnings.some(w => w.includes("suspended"))).toBe(true);
  });
});
