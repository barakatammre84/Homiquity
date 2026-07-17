import { describe, expect, it } from "vitest";
import {
  computeRefiSavings,
  estimateRemainingBalance,
  monthlyPayment,
  planMissingDocNudges,
  PMI_REMOVAL_LTV_THRESHOLD,
  REFI_ALERT_RATE_DROP,
  type MissingDocCandidate,
} from "../server/services/lifecycleEngine";

describe("monthlyPayment", () => {
  it("computes the standard amortized payment", () => {
    // $400k @ 7% / 30yr ≈ $2,661/mo
    const p = monthlyPayment(400_000, 7);
    expect(p).toBeGreaterThan(2_640);
    expect(p).toBeLessThan(2_680);
  });

  it("handles a zero rate as straight-line", () => {
    expect(monthlyPayment(360_000, 0)).toBeCloseTo(1_000, 5);
  });

  it("returns 0 for a non-positive principal", () => {
    expect(monthlyPayment(0, 7)).toBe(0);
  });
});

describe("estimateRemainingBalance", () => {
  it("starts at the original amount and ends at zero", () => {
    expect(estimateRemainingBalance(400_000, 7, 0)).toBeCloseTo(400_000, 0);
    expect(estimateRemainingBalance(400_000, 7, 360)).toBeCloseTo(0, 0);
  });

  it("amortizes slowly early in the loan (mostly interest)", () => {
    const afterFiveYears = estimateRemainingBalance(400_000, 7, 60);
    // At 7%, ~5 years in you've barely dented principal
    expect(afterFiveYears).toBeGreaterThan(370_000);
    expect(afterFiveYears).toBeLessThan(400_000);
  });

  it("clamps months to the term", () => {
    expect(estimateRemainingBalance(400_000, 7, 999)).toBeCloseTo(0, 0);
  });
});

describe("computeRefiSavings", () => {
  it("produces positive savings when the market rate is lower", () => {
    const s = computeRefiSavings(350_000, 7.5, 6.5);
    expect(s.monthlySavings).toBeGreaterThan(200);
    expect(s.lifetimeSavings).toBeCloseTo(s.monthlySavings * 360, 5);
    expect(s.marketPayment).toBeLessThan(s.currentPayment);
  });

  it("produces negative savings when rates moved against the borrower", () => {
    const s = computeRefiSavings(350_000, 6.0, 7.0);
    expect(s.monthlySavings).toBeLessThan(0);
  });

  it("projects lifetime savings over the REMAINING term, not a fresh 360 months", () => {
    // A loan 10 years in has 240 months left — claiming 360 months of savings
    // would overstate the benefit by 50% (the misleading-refi-claim pattern).
    const s = computeRefiSavings(350_000, 7.5, 6.5, 360, 240);
    expect(s.lifetimeSavings).toBeCloseTo(s.monthlySavings * 240, 5);
    expect(s.lifetimeSavings).toBeLessThan(s.monthlySavings * 360);
  });
});

describe("thresholds", () => {
  it("uses the standard 80% LTV PMI-removal threshold", () => {
    expect(PMI_REMOVAL_LTV_THRESHOLD).toBe(80);
  });

  it("requires at least a quarter-point drop before raising refi alerts", () => {
    expect(REFI_ALERT_RATE_DROP).toBeGreaterThanOrEqual(0.25);
  });
});

describe("planMissingDocNudges", () => {
  const condition = (over: Partial<MissingDocCandidate> = {}): MissingDocCandidate => ({
    conditionId: "cond-1",
    applicationId: "app-1",
    userId: "user-1",
    title: "2025 W-2 Verification",
    requiredDocumentTypes: ["w2"],
    ...over,
  });

  it("nudges an outstanding condition with no matching upload", () => {
    const plans = planMissingDocNudges([condition()], new Map());
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      userId: "user-1",
      applicationId: "app-1",
      conditionIds: ["cond-1"],
      conditionTitles: ["2025 W-2 Verification"],
      documentTypes: ["w2"],
    });
  });

  it("treats an alias upload as satisfying (paystub satisfies pay_stub)", () => {
    const plans = planMissingDocNudges(
      [condition({ requiredDocumentTypes: ["pay_stub"] })],
      new Map([["app-1", ["paystub"]]]),
    );
    expect(plans).toHaveLength(0);
  });

  it("any one of several required types satisfies the condition", () => {
    const plans = planMissingDocNudges(
      [condition({ requiredDocumentTypes: ["tax_return", "pay_stub"] })],
      new Map([["app-1", ["tax_return_1040"]]]),
    );
    expect(plans).toHaveLength(0);
  });

  it("skips conditions without requiredDocumentTypes (staff tasks, not upload asks)", () => {
    expect(planMissingDocNudges([condition({ requiredDocumentTypes: null })], new Map())).toHaveLength(0);
    expect(planMissingDocNudges([condition({ requiredDocumentTypes: [] })], new Map())).toHaveLength(0);
  });

  it("groups multiple conditions on one application into a single plan, deduping types", () => {
    const plans = planMissingDocNudges(
      [
        condition(),
        condition({ conditionId: "cond-2", title: "Bank statements", requiredDocumentTypes: ["bank_statement", "w2"] }),
      ],
      new Map(),
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].conditionIds).toEqual(["cond-1", "cond-2"]);
    expect(plans[0].conditionTitles).toEqual(["2025 W-2 Verification", "Bank statements"]);
    expect(plans[0].documentTypes).toEqual(["w2", "bank_statement"]);
  });

  it("keeps separate applications in separate plans", () => {
    const plans = planMissingDocNudges(
      [condition(), condition({ conditionId: "cond-2", applicationId: "app-2", userId: "user-2" })],
      new Map(),
    );
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.applicationId).sort()).toEqual(["app-1", "app-2"]);
  });

  it("only uploads on the SAME application satisfy a condition", () => {
    const plans = planMissingDocNudges(
      [condition()],
      new Map([["app-2", ["w2"]]]),
    );
    expect(plans).toHaveLength(1);
  });
});
