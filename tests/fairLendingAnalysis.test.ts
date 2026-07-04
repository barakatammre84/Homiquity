import { describe, it, expect } from "vitest";
import { computeDisparateImpact, type AnalysisRecord } from "../server/services/fairLendingAnalysis";

// Builds n records for one race group with a given approved/rejected split.
function records(group: string, approved: number, rejected: number, manualReview = 0): AnalysisRecord[] {
  const out: AnalysisRecord[] = [];
  for (let i = 0; i < approved; i++) out.push({ outcome: "APPROVED", dimensions: { race: [group] } });
  for (let i = 0; i < rejected; i++) out.push({ outcome: "REJECTED", dimensions: { race: [group] } });
  for (let i = 0; i < manualReview; i++) out.push({ outcome: "MANUAL_REVIEW", dimensions: { race: [group] } });
  return out;
}

describe("computeDisparateImpact (four-fifths rule)", () => {
  it("flags a group whose adverse-impact ratio falls below 0.8", () => {
    // White approval 90/100 = 0.90 (reference); Black 60/100 = 0.60; AIR = 0.667 < 0.8 → flagged.
    const data = [...records("White", 90, 10), ...records("Black or African American", 60, 40)];
    const report = computeDisparateImpact(data, { minSampleSize: 30 });

    const race = report.dimensions.find((d) => d.dimension === "race")!;
    expect(race.referenceGroup).toBe("White");
    const black = race.groups.find((g) => g.group === "Black or African American")!;
    expect(black.selectionRate).toBeCloseTo(0.6, 5);
    expect(black.adverseImpactRatio!).toBeCloseTo(0.667, 2);
    expect(black.flagged).toBe(true);
    expect(report.flaggedCount).toBe(1);
  });

  it("does not flag when ratios are within the four-fifths threshold", () => {
    // White 0.90, Black 0.75 → AIR 0.833 ≥ 0.8 → not flagged.
    const data = [...records("White", 90, 10), ...records("Black or African American", 75, 25)];
    const report = computeDisparateImpact(data, { minSampleSize: 30 });
    const race = report.dimensions.find((d) => d.dimension === "race")!;
    const black = race.groups.find((g) => g.group === "Black or African American")!;
    expect(black.adverseImpactRatio!).toBeGreaterThanOrEqual(0.8);
    expect(black.flagged).toBe(false);
    expect(report.flaggedCount).toBe(0);
  });

  it("marks small groups as insufficientData and never flags them", () => {
    const data = [...records("White", 90, 10), ...records("Asian", 5, 20)]; // Asian n=25 < 30
    const report = computeDisparateImpact(data, { minSampleSize: 30 });
    const race = report.dimensions.find((d) => d.dimension === "race")!;
    const asian = race.groups.find((g) => g.group === "Asian")!;
    expect(asian.insufficientData).toBe(true);
    expect(asian.adverseImpactRatio).toBeNull();
    expect(asian.flagged).toBe(false);
  });

  it("excludes MANUAL_REVIEW from the selection rate but reports the count", () => {
    const data = records("White", 40, 10, 50); // 40 approved, 10 rejected, 50 pending
    const report = computeDisparateImpact(data, { minSampleSize: 10 });
    const white = report.dimensions[0].groups[0];
    expect(white.decided).toBe(50);
    expect(white.manualReview).toBe(50);
    expect(white.selectionRate).toBeCloseTo(0.8, 5); // 40/50
  });
});
