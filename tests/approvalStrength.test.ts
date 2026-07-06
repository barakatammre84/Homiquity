import { describe, expect, it } from "vitest";
import {
  assessApprovalStrength,
  debtShareOfIncome,
  PRICE_BAND_MIDPOINTS,
  type ApprovalStrengthInputs,
  type CreditBand,
  type IncomeShape,
  type PriceBand,
} from "../client/src/lib/approvalStrength";

// The Approval Strength tool is a public, client-side, EDUCATIONAL read of
// approval factors — deliberately not the underwriting engine. These tests
// pin two properties: (1) the scoring is deterministic and its factor logic
// matches the documented thresholds, and (2) the copy it can emit never
// contains a priced result or an approval claim (the launch-charter §2
// vocabulary this surface must keep off the pre-F1 public site is enforced
// by gating the route; this guard keeps the post-F1 copy honest too).

const strongProfile: ApprovalStrengthInputs = {
  incomeShape: "w2_2plus",
  annualIncome: 150_000,
  monthlyDebts: 300,
  downPaymentSaved: 90_000,
  creditBand: "760_plus",
  priceBand: "350_500k",
};

const weakProfile: ApprovalStrengthInputs = {
  incomeShape: "self_employed_under2",
  annualIncome: 48_000,
  monthlyDebts: 1_600,
  downPaymentSaved: 3_000,
  creditBand: "below_620",
  priceBand: "200_350k",
};

describe("assessApprovalStrength", () => {
  it("is deterministic: same inputs, same result", () => {
    expect(assessApprovalStrength(strongProfile)).toEqual(assessApprovalStrength(strongProfile));
    expect(assessApprovalStrength(weakProfile)).toEqual(assessApprovalStrength(weakProfile));
  });

  it("always returns exactly the four documented factors, in order", () => {
    const result = assessApprovalStrength(strongProfile);
    expect(result.factors.map((f) => f.id)).toEqual([
      "credit",
      "income_shape",
      "debt_load",
      "down_payment",
    ]);
  });

  it("reads a strong profile as strong, with every factor helping", () => {
    const result = assessApprovalStrength(strongProfile);
    expect(result.band).toBe("strong");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.helping.map((f) => f.id).sort()).toEqual([
      "credit",
      "debt_load",
      "down_payment",
      "income_shape",
    ]);
    expect(result.hurting).toEqual([]);
  });

  it("reads a weak profile as needs_work and names the hurting factors", () => {
    const result = assessApprovalStrength(weakProfile);
    expect(result.band).toBe("needs_work");
    expect(result.score).toBeLessThan(45);
    expect(result.hurting.map((f) => f.id).sort()).toEqual([
      "credit",
      "debt_load",
      "down_payment",
      "income_shape",
    ]);
    expect(result.helping).toEqual([]);
  });

  it("derives its band from the blended score thresholds", () => {
    const cases: ApprovalStrengthInputs[] = [
      strongProfile,
      weakProfile,
      { ...strongProfile, creditBand: "640_679", incomeShape: "self_employed_2plus" },
      { ...weakProfile, creditBand: "720_759", monthlyDebts: 500 },
    ];
    for (const inputs of cases) {
      const { score, band } = assessApprovalStrength(inputs);
      const expected =
        score >= 80 ? "strong" : score >= 62 ? "solid" : score >= 45 ? "mixed" : "needs_work";
      expect(band).toBe(expected);
    }
  });

  it("maps credit bands to statuses at the documented boundaries", () => {
    const statusFor = (creditBand: CreditBand) =>
      assessApprovalStrength({ ...strongProfile, creditBand }).factors.find(
        (f) => f.id === "credit",
      )!.status;
    expect(statusFor("760_plus")).toBe("helping");
    expect(statusFor("720_759")).toBe("helping");
    expect(statusFor("680_719")).toBe("neutral");
    expect(statusFor("640_679")).toBe("neutral");
    expect(statusFor("620_639")).toBe("hurting");
    expect(statusFor("below_620")).toBe("hurting");
  });

  it("treats self-employment under two years as the hurting income shape", () => {
    const statusFor = (incomeShape: IncomeShape) =>
      assessApprovalStrength({ ...strongProfile, incomeShape }).factors.find(
        (f) => f.id === "income_shape",
      )!.status;
    expect(statusFor("w2_2plus")).toBe("helping");
    expect(statusFor("w2_under2")).toBe("neutral");
    expect(statusFor("self_employed_2plus")).toBe("neutral");
    expect(statusFor("self_employed_under2")).toBe("hurting");
  });

  it("grades debt load by share of gross monthly income", () => {
    const statusFor = (annualIncome: number, monthlyDebts: number) =>
      assessApprovalStrength({ ...strongProfile, annualIncome, monthlyDebts }).factors.find(
        (f) => f.id === "debt_load",
      )!.status;
    // $120k/yr = $10k/mo gross.
    expect(statusFor(120_000, 500)).toBe("helping"); // 5%
    expect(statusFor(120_000, 1_500)).toBe("neutral"); // 15%
    expect(statusFor(120_000, 3_000)).toBe("hurting"); // 30%
    expect(statusFor(120_000, 4_500)).toBe("hurting"); // 45%
  });

  it("marks debt load unknown (and excludes it from the blend) when income is zero", () => {
    const result = assessApprovalStrength({ ...strongProfile, annualIncome: 0 });
    const debt = result.factors.find((f) => f.id === "debt_load")!;
    expect(debt.status).toBe("unknown");
    expect(debt.score).toBeNull();
    // Remaining factors are all strong, so the renormalized band stays strong.
    expect(result.band).toBe("strong");
  });

  it("grades down payment against the selected price band midpoint", () => {
    const statusFor = (downPaymentSaved: number, priceBand: PriceBand) =>
      assessApprovalStrength({ ...strongProfile, downPaymentSaved, priceBand }).factors.find(
        (f) => f.id === "down_payment",
      )!.status;
    const mid = PRICE_BAND_MIDPOINTS["350_500k"];
    expect(statusFor(mid * 0.25, "350_500k")).toBe("helping");
    expect(statusFor(mid * 0.12, "350_500k")).toBe("helping");
    expect(statusFor(mid * 0.07, "350_500k")).toBe("neutral");
    expect(statusFor(mid * 0.035, "350_500k")).toBe("neutral");
    expect(statusFor(mid * 0.01, "350_500k")).toBe("hurting");
  });

  it("marks down payment unknown when the shopper hasn't picked a price range", () => {
    const base = assessApprovalStrength({ ...strongProfile, priceBand: "not_sure" });
    const dp = base.factors.find((f) => f.id === "down_payment")!;
    expect(dp.status).toBe("unknown");
    expect(dp.score).toBeNull();
    // With no price context, the savings amount must not move the score.
    const more = assessApprovalStrength({
      ...strongProfile,
      priceBand: "not_sure",
      downPaymentSaved: 500_000,
    });
    expect(more.score).toBe(base.score);
  });

  it("never emits a priced result or an approval claim in any copy", () => {
    // Reg Z trigger terms / approval language must never appear in tool
    // output. Sweep the full input grid so every copy branch is exercised.
    const forbidden = [
      /\bAPR\b/i,
      /\binterest rate\b/i,
      /\bper month\b/i,
      /\/mo\b/i,
      /\$\s?\d/, // any dollar amount = a quoted figure
      /\bmonthly payment\b/i,
      /\byou (?:are|'re|were|will be|would be|can be|could be)\s+(?:pre-?)?approved\b/i,
      /\bpre-?qualified\b/i,
      /\bguaranteed?\b/i,
    ];
    const incomeShapes: IncomeShape[] = [
      "w2_2plus",
      "w2_under2",
      "self_employed_2plus",
      "self_employed_under2",
    ];
    const creditBands: CreditBand[] = [
      "760_plus",
      "720_759",
      "680_719",
      "640_679",
      "620_639",
      "below_620",
    ];
    const priceBands: PriceBand[] = [
      "under_200k",
      "200_350k",
      "350_500k",
      "500_750k",
      "750k_plus",
      "not_sure",
    ];
    const debtLevels = [0, 800, 2_200, 4_000];
    const downPayments = [0, 8_000, 30_000, 120_000];

    for (const incomeShape of incomeShapes) {
      for (const creditBand of creditBands) {
        for (const priceBand of priceBands) {
          for (const monthlyDebts of debtLevels) {
            for (const downPaymentSaved of downPayments) {
              const result = assessApprovalStrength({
                incomeShape,
                creditBand,
                priceBand,
                monthlyDebts,
                downPaymentSaved,
                annualIncome: 90_000,
              });
              const copy = [
                result.bandLabel,
                result.summary,
                ...result.factors.flatMap((f) => [f.label, f.headline, f.detail]),
              ].join("\n");
              for (const pattern of forbidden) {
                expect(copy).not.toMatch(pattern);
              }
            }
          }
        }
      }
    }
  });
});

describe("debtShareOfIncome", () => {
  it("returns the monthly-debt share of gross monthly income", () => {
    expect(debtShareOfIncome(120_000, 1_000)).toBeCloseTo(0.1);
    expect(debtShareOfIncome(60_000, 2_500)).toBeCloseTo(0.5);
  });

  it("returns null when income is zero or negative", () => {
    expect(debtShareOfIncome(0, 500)).toBeNull();
    expect(debtShareOfIncome(-1, 500)).toBeNull();
  });
});
