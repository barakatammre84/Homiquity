import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// The DTI helper and the deterministic engine both resolve policy scalars from
// LookupResolverService, which transitively needs a live Postgres connection.
// Mock the resolver so these edge-case tests are hermetic. Values mirror the
// seeded conventional grid (percent-denominated scalars).
// ---------------------------------------------------------------------------
vi.mock("../server/services/lookupResolver", () => ({
  lookupResolver: {
    getPolicyScalar: async (code: string) => {
      const scalars: Record<string, number> = {
        CONVENTIONAL_DTI_CAP: 43,
        CONVENTIONAL_STRETCH_DTI: 50,
        CONVENTIONAL_LTV_CAP: 97,
        HAIRCUT_STOCK_INVESTMENT: 70,
        HAIRCUT_RETIREMENT: 60,
      };
      return scalars[code];
    },
    resolveMatrixValue: async () => 0,
  },
}));

import { calculateDTI } from "../server/underwriting";
import { ConsolidatedUnderwritingEngine, type UnderwritingInput } from "../server/underwritingEngine";

describe("calculateDTI edge cases", () => {
  it("fails on zero qualifying income (no silent 0% pass)", async () => {
    const result = await calculateDTI(0, 1500, 500);
    expect(result.status).toBe("fail");
  });

  it("fails on negative qualifying income", async () => {
    const result = await calculateDTI(-5000, 1500, 500);
    expect(result.status).toBe("fail");
  });

  it("passes a comfortable ratio", async () => {
    const result = await calculateDTI(10000, 2000, 500);
    expect(result.backEndRatio).toBe(25);
    expect(result.status).toBe("pass");
  });

  it("fails an over-cap ratio", async () => {
    const result = await calculateDTI(3000, 2000, 500);
    expect(result.status).toBe("fail");
  });
});

describe("ConsolidatedUnderwritingEngine value guards", () => {
  const engine = new ConsolidatedUnderwritingEngine();

  const baseInput: UnderwritingInput = {
    isVeteran: false,
    baseMonthlyIncome: 10000,
    bonusMonthlyIncome: 0,
    existingMonthlyDebts: 500,
    originalLoanAmount: 320000,
    contractSalesPrice: 400000,
    appraisalValue: 400000,
    representativeFico: 740,
    proposedPiti: 2000,
    assets: [],
  };

  it("throws when the loan amount is zero (down payment >= price)", async () => {
    await expect(
      engine.evaluate({ ...baseInput, originalLoanAmount: 0 }),
    ).rejects.toThrow(/Loan amount must be greater than zero/i);
  });

  it("throws when the loan amount is negative", async () => {
    await expect(
      engine.evaluate({ ...baseInput, originalLoanAmount: -100 }),
    ).rejects.toThrow(/Loan amount must be greater than zero/i);
  });

  it("still approves a well-qualified conventional file", async () => {
    const result = await engine.evaluate(baseInput);
    expect(result.decision).toBe("APPROVED");
    expect(result.calculatedLtv).toBe(80);
  });
});
