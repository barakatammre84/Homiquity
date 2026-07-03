import { describe, expect, it } from "vitest";
import {
  CREDIT_SCORE_UNKNOWN_DEFAULT,
  loanApplicationIntakeSchema,
  loanApplicationIntakeUpdateSchema,
  preApprovalFormSchema,
} from "../shared/schema";

/**
 * Client/server validation unification — the server-side intake schema is
 * derived from the same base the funnel validates with, so the server must
 * reject exactly what the client rejects (no silent clamps fabricating data).
 */

const VALID_INTAKE = {
  annualIncome: "95,000",
  employmentType: "employed",
  employmentYears: "4",
  monthlyDebts: "850",
  creditScore: "720",
  loanPurpose: "purchase",
  propertyType: "single_family",
  purchasePrice: "$450,000",
  downPayment: "45,000",
  isVeteran: false,
  isFirstTimeBuyer: true,
  propertyState: "CA",
  softPullConsentAccepted: true,
};

describe("loanApplicationIntakeSchema (server) mirrors the funnel schema (client)", () => {
  it("accepts the canonical funnel payload and normalizes it", () => {
    const parsed = loanApplicationIntakeSchema.parse(VALID_INTAKE);
    expect(parsed.annualIncome).toBe("95000");
    expect(parsed.purchasePrice).toBe("450000");
    expect(parsed.creditScore).toBe(720);
    expect(parsed.employmentYears).toBe(4);
  });

  it("maps 'not_sure' credit to the named default instead of a hidden clamp", () => {
    const parsed = loanApplicationIntakeSchema.parse({ ...VALID_INTAKE, creditScore: "not_sure" });
    expect(parsed.creditScore).toBe(CREDIT_SCORE_UNKNOWN_DEFAULT);
  });

  it("REJECTS out-of-band credit scores the old server schema silently clamped", () => {
    expect(loanApplicationIntakeSchema.safeParse({ ...VALID_INTAKE, creditScore: "900" }).success).toBe(false);
    expect(loanApplicationIntakeSchema.safeParse({ ...VALID_INTAKE, creditScore: "abc" }).success).toBe(false);
  });

  it("REJECTS missing required fields instead of defaulting them to 0", () => {
    const { annualIncome: _a, ...noIncome } = VALID_INTAKE;
    expect(loanApplicationIntakeSchema.safeParse(noIncome).success).toBe(false);
    const { employmentYears: _e, ...noYears } = VALID_INTAKE;
    expect(loanApplicationIntakeSchema.safeParse(noYears).success).toBe(false);
  });

  it("rejects down payment above purchase price (same rule as client)", () => {
    const bad = { ...VALID_INTAKE, downPayment: "500,000" };
    expect(loanApplicationIntakeSchema.safeParse(bad).success).toBe(false);
    expect(preApprovalFormSchema.safeParse({ ...bad, hasAdditionalIncome: false }).success).toBe(false);
  });

  it("tolerates JSON numbers where forms send strings", () => {
    const parsed = loanApplicationIntakeSchema.parse({
      ...VALID_INTAKE,
      annualIncome: 95000,
      employmentYears: 4,
      creditScore: 720,
      purchasePrice: 450000,
      downPayment: 45000,
      monthlyDebts: 850,
    });
    expect(parsed.annualIncome).toBe("95000");
    expect(parsed.creditScore).toBe(720);
  });

  it("update variant validates present fields and leaves absent ones alone", () => {
    const parsed = loanApplicationIntakeUpdateSchema.parse({ annualIncome: "110,000" });
    expect(parsed.annualIncome).toBe("110000");
    expect(parsed.creditScore).toBeUndefined();
    expect(loanApplicationIntakeUpdateSchema.safeParse({ employmentYears: "999" }).success).toBe(false);
  });
});
