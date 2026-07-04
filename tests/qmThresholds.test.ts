import { describe, it, expect } from "vitest";
import {
  resolveQmThresholds,
  evaluateCoveredPointsAndFees,
  evaluateExemptPointsAndFees,
  evaluateCoveredAprSpread,
  evaluateExemptAprSpread,
} from "../shared/fannieMae/qmThresholds";

// ---------------------------------------------------------------------------
// Values under test are transcribed from docs/fannie-mae/"Loan Delivery
// Qualified Mortgage (QM) Edits Job Aid 2026 Update.pdf" (2026 main table,
// 2025/2024 appendix). These tests pin the tables so a future edit that
// nudges a dollar threshold fails loudly.
// ---------------------------------------------------------------------------

describe("resolveQmThresholds", () => {
  it("selects the table by note-date year", () => {
    expect(resolveQmThresholds("2026-06-15")?.noteYear).toBe(2026);
    expect(resolveQmThresholds("2025-01-01")?.noteYear).toBe(2025);
    expect(resolveQmThresholds("2024-12-31")?.noteYear).toBe(2024);
  });

  it("returns null for years not covered by the job aid", () => {
    expect(resolveQmThresholds("2023-06-15")).toBeNull();
    expect(resolveQmThresholds("2030-01-01")).toBeNull();
    expect(resolveQmThresholds("not-a-date")).toBeNull();
  });
});

describe("evaluateCoveredPointsAndFees (edits C87/C88)", () => {
  it("applies the 3% tier at and above $137,958 (2026)", () => {
    // Cap is computed on the Reg Z total loan amount, tier on original amount.
    const r = evaluateCoveredPointsAndFees("2026-03-01", 400_000, 395_000, 11_850);
    expect(r.evaluated).toBe(true);
    expect(r.compliant).toBe(true);
    expect(r.maxAllowableAmount).toBe(11_850); // 3% of 395,000

    const over = evaluateCoveredPointsAndFees("2026-03-01", 400_000, 395_000, 11_850.01);
    expect(over.compliant).toBe(false);
  });

  it("applies the $4,139 flat tier between $82,775 and $137,958 (2026)", () => {
    const r = evaluateCoveredPointsAndFees("2026-03-01", 100_000, 99_000, 4_139);
    expect(r.compliant).toBe(true);
    expect(r.maxAllowableAmount).toBe(4_139);
    expect(evaluateCoveredPointsAndFees("2026-03-01", 100_000, 99_000, 4_140).compliant).toBe(false);
  });

  it("tier boundaries are lower-inclusive (2026)", () => {
    // Exactly $137,958 falls in the 3% tier ("greater than or equal to"),
    // so the cap is 3% of the Reg Z total loan amount: $4,138.74.
    const atBoundary = evaluateCoveredPointsAndFees("2026-03-01", 137_958, 137_958, 4_200);
    expect(atBoundary.compliant).toBe(false);
    expect(atBoundary.maxAllowableAmount).toBe(4_138.74);
    expect(evaluateCoveredPointsAndFees("2026-03-01", 137_958, 137_958, 4_138.74).compliant).toBe(true);

    // Just below the boundary the $4,139 flat cap applies.
    const below = evaluateCoveredPointsAndFees("2026-03-01", 137_957.99, 137_957.99, 4_139);
    expect(below.compliant).toBe(true);
    expect(below.maxAllowableAmount).toBe(4_139);
  });

  it("applies the 8% and 5% small-loan tiers (2026)", () => {
    expect(evaluateCoveredPointsAndFees("2026-03-01", 15_000, 15_000, 1_200).compliant).toBe(true); // 8% = 1,200
    expect(evaluateCoveredPointsAndFees("2026-03-01", 15_000, 15_000, 1_200.01).compliant).toBe(false);
    expect(evaluateCoveredPointsAndFees("2026-03-01", 20_000, 20_000, 1_380).compliant).toBe(true); // flat $1,380
    expect(evaluateCoveredPointsAndFees("2026-03-01", 20_000, 20_000, 1_381).compliant).toBe(false);
    expect(evaluateCoveredPointsAndFees("2026-03-01", 50_000, 50_000, 2_500).compliant).toBe(true); // 5% = 2,500
    expect(evaluateCoveredPointsAndFees("2026-03-01", 50_000, 50_000, 2_501).compliant).toBe(false);
  });

  it("uses the 2025 and 2024 appendix tables for earlier note dates", () => {
    // 2025: $4,045 flat tier runs $80,905–$134,841.
    const r2025 = evaluateCoveredPointsAndFees("2025-06-01", 100_000, 100_000, 4_045);
    expect(r2025.compliant).toBe(true);
    expect(r2025.maxAllowableAmount).toBe(4_045);
    // 2024: $3,914 flat tier runs $78,277–$130,461.
    const r2024 = evaluateCoveredPointsAndFees("2024-06-01", 100_000, 100_000, 3_914);
    expect(r2024.compliant).toBe(true);
    expect(r2024.maxAllowableAmount).toBe(3_914);
    expect(evaluateCoveredPointsAndFees("2024-06-01", 100_000, 100_000, 3_915).compliant).toBe(false);
  });

  it("declines to evaluate note years with no table", () => {
    const r = evaluateCoveredPointsAndFees("2023-06-01", 200_000, 200_000, 5_000);
    expect(r.evaluated).toBe(false);
    expect(r.reason).toContain("manual review");
  });
});

describe("evaluateExemptPointsAndFees (edit C47)", () => {
  it("caps exempt loans at a flat 5% of the Reg Z total loan amount", () => {
    expect(evaluateExemptPointsAndFees(200_000, 10_000).compliant).toBe(true);
    expect(evaluateExemptPointsAndFees(200_000, 10_000.01).compliant).toBe(false);
  });
});

describe("evaluateCoveredAprSpread (edits C85/C86/C90/C91/C94/C95)", () => {
  it("allows up to 2.25% at/above $137,958 and fails above it (2026)", () => {
    const ok = evaluateCoveredAprSpread("2026-03-01", 400_000, 8.65, 6.4, false);
    expect(ok.compliant).toBe(true);
    expect(ok.maxAllowableSpreadPercent).toBe(2.25);
    const bad = evaluateCoveredAprSpread("2026-03-01", 400_000, 8.66, 6.4, false);
    expect(bad.compliant).toBe(false);
    expect(bad.spreadPercent).toBeCloseTo(2.26, 4);
  });

  it("applies the 3.5% middle tier and 6.5% small-loan tier (2026)", () => {
    expect(evaluateCoveredAprSpread("2026-03-01", 100_000, 9.9, 6.4, false).compliant).toBe(true); // 3.5
    expect(evaluateCoveredAprSpread("2026-03-01", 100_000, 9.91, 6.4, false).compliant).toBe(false);
    expect(evaluateCoveredAprSpread("2026-03-01", 50_000, 12.9, 6.4, false).compliant).toBe(true); // 6.5
    expect(evaluateCoveredAprSpread("2026-03-01", 50_000, 12.91, 6.4, false).compliant).toBe(false);
  });

  it("uses the manufactured-home table: 6.5% up to $137,958 inclusive (2026)", () => {
    const mh = evaluateCoveredAprSpread("2026-03-01", 137_958, 12.9, 6.4, true);
    expect(mh.compliant).toBe(true);
    expect(mh.maxAllowableSpreadPercent).toBe(6.5);
    const mhLarge = evaluateCoveredAprSpread("2026-03-01", 200_000, 8.7, 6.4, true);
    expect(mhLarge.compliant).toBe(false); // 2.30 > 2.25
    expect(mhLarge.maxAllowableSpreadPercent).toBe(2.25);
  });
});

describe("evaluateExemptAprSpread (edits C52/C92/C96/C99)", () => {
  it("fails when the APR exceeds the APOR by 6.5% or more (inclusive)", () => {
    expect(evaluateExemptAprSpread(12.89, 6.4).compliant).toBe(true);
    expect(evaluateExemptAprSpread(12.9, 6.4).compliant).toBe(false); // exactly 6.5
    expect(evaluateExemptAprSpread(13.0, 6.4).compliant).toBe(false);
  });
});
