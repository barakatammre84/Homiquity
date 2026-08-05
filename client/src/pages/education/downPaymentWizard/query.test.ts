import { describe, it, expect } from "vitest";
import { buildDpaEndpoint, isUnlicensedStateSelected } from "./query";
import { clearedFilters, defaultFilters, type WizardFilters } from "./types";

const f = (over: Partial<WizardFilters> = {}): WizardFilters => ({ ...defaultFilters(), ...over });

describe("buildDpaEndpoint", () => {
  it("omits the state parameter for 'all' rather than sending the literal", () => {
    // ?state=all would be matched against the state column and return nothing.
    expect(buildDpaEndpoint(clearedFilters())).toBe("/api/dpa-programs");
  });

  it("sends the default Illinois filter", () => {
    expect(buildDpaEndpoint(defaultFilters())).toBe("/api/dpa-programs?state=IL");
  });

  it("only sends firstTimeBuyer when the answer is 'yes'", () => {
    // "all" and "no" both mean "don't filter" — sending firstTimeBuyer=false
    // would exclude programs open to everyone.
    expect(buildDpaEndpoint(f({ firstTimeBuyer: "yes" }))).toContain("firstTimeBuyer=true");
    expect(buildDpaEndpoint(f({ firstTimeBuyer: "no" }))).not.toContain("firstTimeBuyer");
    expect(buildDpaEndpoint(f({ firstTimeBuyer: "all" }))).not.toContain("firstTimeBuyer");
  });

  it("omits an empty credit score", () => {
    expect(buildDpaEndpoint(f({ minCreditScore: "" }))).not.toContain("minCreditScore");
    expect(buildDpaEndpoint(f({ minCreditScore: "680" }))).toContain("minCreditScore=680");
  });

  it("is stable for equivalent filter states — the endpoint is the cache key", () => {
    expect(buildDpaEndpoint(f({ firstTimeBuyer: "all" }))).toBe(buildDpaEndpoint(f({ firstTimeBuyer: "no" })));
  });
});

describe("isUnlicensedStateSelected", () => {
  it("is false for 'all', which selects no particular state", () => {
    expect(isUnlicensedStateSelected(clearedFilters())).toBe(false);
  });

  it("is false inside the licensed footprint", () => {
    // IL is the default and the directory's actual coverage.
    expect(isUnlicensedStateSelected(defaultFilters())).toBe(false);
  });

  it("is true for a state outside the footprint", () => {
    expect(isUnlicensedStateSelected(f({ state: "WY" }))).toBe(true);
  });
});
