import { describe, it, expect, vi } from "vitest";

// checkPropertyEligibility resolves policy scalars from LookupResolverService,
// which needs a live Postgres connection. Mock it so these tests are hermetic.
vi.mock("../server/services/lookupResolver", () => ({
  lookupResolver: {
    getPolicyScalar: async (code: string) => {
      const scalars: Record<string, number> = {
        CONVENTIONAL_LTV_CAP: 97,
        CONVENTIONAL_STRETCH_DTI: 50,
      };
      return scalars[code];
    },
    resolveMatrixValue: async () => 0,
  },
}));

import { checkPropertyEligibility } from "../server/underwriting";

describe("checkPropertyEligibility income guard", () => {
  it("fails closed on zero income without an Infinity DTI", async () => {
    const result = await checkPropertyEligibility(50000, 0, 500, 400000, "single_family", undefined, 0, 150, 80);
    expect(result.canBuyProperty).toBe(false);
    expect(Number.isFinite(result.finalDTI)).toBe(true);
    expect(result.finalDTI).toBe(0);
    expect(result.reasons.join(" ")).toMatch(/income must be greater than zero/i);
  });

  it("fails closed on negative income", async () => {
    const result = await checkPropertyEligibility(50000, -1000, 500, 400000, "single_family", undefined, 0, 150, 80);
    expect(result.canBuyProperty).toBe(false);
    expect(Number.isFinite(result.finalDTI)).toBe(true);
  });

  it("computes a finite DTI for a normal, well-qualified buyer", async () => {
    // maxLtvPercent = 80 keeps LTV at the 80% MI trigger, so no PMI lookup (no
    // representative FICO needed).
    const result = await checkPropertyEligibility(100000, 10000, 500, 400000, "single_family", undefined, 0, 150, 80);
    expect(Number.isFinite(result.finalDTI)).toBe(true);
    expect(result.finalDTI).toBeGreaterThan(0);
    expect(result.ltvRatio).toBe(80);
  });
});
