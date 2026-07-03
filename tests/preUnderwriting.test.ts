import { describe, expect, it } from "vitest";
import {
  buildFlagOutreach,
  computeMonthsOfReserves,
  derivePreUnderwritingFlags,
  estimateMonthlyPITI,
  RESERVES_MONTHS_THRESHOLD,
} from "../server/services/preUnderwriting";

describe("estimateMonthlyPITI", () => {
  it("computes P&I plus tax/insurance on the financed amount", () => {
    // $500k home, $100k down → $400k loan @7%/30yr ≈ $2,661 P&I + $520 T&I
    const piti = estimateMonthlyPITI(500_000, 100_000);
    expect(piti).toBeGreaterThan(3_100);
    expect(piti).toBeLessThan(3_250);
  });

  it("returns 0 when nothing is financed", () => {
    expect(estimateMonthlyPITI(500_000, 500_000)).toBe(0);
    expect(estimateMonthlyPITI(0, 0)).toBe(0);
  });
});

describe("computeMonthsOfReserves", () => {
  it("counts only assets remaining after the down payment", () => {
    const months = computeMonthsOfReserves({
      verifiedAssetsTotal: 110_000,
      purchasePrice: 500_000,
      downPayment: 100_000,
    });
    // ~$10k remaining / ~$3.2k PITI ≈ 3.1 months
    expect(months).not.toBeNull();
    expect(months!).toBeGreaterThan(2.5);
    expect(months!).toBeLessThan(3.5);
  });

  it("goes negative when the down payment exceeds verified assets", () => {
    const months = computeMonthsOfReserves({
      verifiedAssetsTotal: 50_000,
      purchasePrice: 500_000,
      downPayment: 100_000,
    });
    expect(months!).toBeLessThan(0);
  });
});

describe("derivePreUnderwritingFlags", () => {
  const base = {
    annualIncome: "120,000",
    purchasePrice: "500,000",
    downPayment: "100,000",
    employmentType: "employed",
    verifiedAssetsTotal: null as number | null,
  };

  it("raises no flags for a strong W-2 file with ample verified reserves", () => {
    const flags = derivePreUnderwritingFlags({ ...base, verifiedAssetsTotal: 150_000 });
    expect(flags).toEqual([]);
  });

  it("does NOT raise the reserves flag before assets are verified", () => {
    const flags = derivePreUnderwritingFlags({ ...base, verifiedAssetsTotal: null });
    expect(flags.find((f) => f.code === "LOW_RESERVES_WARNING")).toBeUndefined();
  });

  it("raises LOW_RESERVES_WARNING below the threshold, with metrics", () => {
    const flags = derivePreUnderwritingFlags({ ...base, verifiedAssetsTotal: 104_000 });
    const flag = flags.find((f) => f.code === "LOW_RESERVES_WARNING");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("warning");
    expect(flag!.metrics!.monthsOfReserves).toBeLessThan(RESERVES_MONTHS_THRESHOLD);
    expect(flag!.metrics!.verifiedAssets).toBe(104_000);
    expect(flag!.requiredDocs.length).toBeGreaterThan(0);
  });

  it("does not raise the reserves flag at or above the threshold", () => {
    // ~$3.18k PITI × 2 months ≈ $6.4k needed beyond the $100k down payment
    const flags = derivePreUnderwritingFlags({ ...base, verifiedAssetsTotal: 108_000 });
    expect(flags.find((f) => f.code === "LOW_RESERVES_WARNING")).toBeUndefined();
  });

  it("flags self-employed borrowers as COMPLEX_INCOME_CHECK (blocking)", () => {
    const flags = derivePreUnderwritingFlags({ ...base, employmentType: "self_employed" });
    const flag = flags.find((f) => f.code === "COMPLEX_INCOME_CHECK");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("blocking");
    expect(flag!.requiredDocs.map((d) => d.documentType)).toContain("tax_return");
  });

  it("can raise both flags simultaneously and deterministically", () => {
    const input = { ...base, employmentType: "self_employed", verifiedAssetsTotal: 101_000 };
    const flags = derivePreUnderwritingFlags(input);
    expect(flags.map((f) => f.code).sort()).toEqual(["COMPLEX_INCOME_CHECK", "LOW_RESERVES_WARNING"]);
    expect(derivePreUnderwritingFlags(input)).toEqual(flags);
  });
});

describe("buildFlagOutreach", () => {
  it("returns null when there is nothing to say", () => {
    expect(buildFlagOutreach("Amr", [])).toBeNull();
  });

  it("personalizes and names the exact documents for self-employed files", () => {
    const flags = derivePreUnderwritingFlags({
      annualIncome: "90,000",
      purchasePrice: "400,000",
      downPayment: "80,000",
      employmentType: "self_employed",
      verifiedAssetsTotal: null,
    });
    const outreach = buildFlagOutreach("Riley", flags)!;
    expect(outreach.emailText).toContain("Hi Riley");
    expect(outreach.emailText).toContain("last two years of federal tax returns (1040s)");
    expect(outreach.emailText).toContain("profit & loss");
    expect(outreach.smsBody).toMatch(/needs \d+ required document/);
    expect(outreach.subject.length).toBeGreaterThan(0);
  });

  it("frames outreach as a documentation request, never a decision signal (ECOA/UDAAP)", () => {
    const flags = derivePreUnderwritingFlags({
      annualIncome: "90,000",
      purchasePrice: "400,000",
      downPayment: "80,000",
      employmentType: "self_employed",
      verifiedAssetsTotal: null,
    });
    const outreach = buildFlagOutreach("Riley", flags)!;
    // Must carry the explicit not-a-decision disclaimer…
    expect(outreach.emailText).toContain("not a loan decision");
    // …and must not imply an outcome in either direction.
    expect(outreach.emailText).not.toMatch(/good news|congratulations|approved|denied/i);
  });

  it("explains the reserves shortfall in months without alarming language", () => {
    const flags = derivePreUnderwritingFlags({
      annualIncome: "120,000",
      purchasePrice: "500,000",
      downPayment: "100,000",
      employmentType: "employed",
      verifiedAssetsTotal: 103_000,
    });
    const outreach = buildFlagOutreach(null, flags)!;
    expect(outreach.emailText).toContain("Hi there");
    expect(outreach.emailText).toMatch(/months of payment reserves/);
    expect(outreach.emailText).toContain("won't stop your application");
  });

  it("never shows negative months to the borrower", () => {
    const flags = derivePreUnderwritingFlags({
      annualIncome: "120,000",
      purchasePrice: "500,000",
      downPayment: "150,000",
      employmentType: "employed",
      verifiedAssetsTotal: 120_000, // less than the down payment itself
    });
    const outreach = buildFlagOutreach("Sam", flags)!;
    expect(outreach.emailText).toContain("0.0 months");
    expect(outreach.emailText).not.toMatch(/-\d+\.\d+ months/);
  });
});
