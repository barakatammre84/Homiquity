import { describe, it, expect } from "vitest";
import { parseValueEstimate } from "../server/services/valueEstimate";

describe("parseValueEstimate", () => {
  it("returns null for missing or malformed payloads", () => {
    expect(parseValueEstimate(null)).toBeNull();
    expect(parseValueEstimate(undefined)).toBeNull();
    expect(parseValueEstimate({})).toBeNull();
    expect(parseValueEstimate({ current_values: null })).toBeNull();
    expect(parseValueEstimate({ current_values: [] })).toBeNull();
    expect(parseValueEstimate({ current_values: [{ estimate: 0 }] })).toBeNull();
    expect(parseValueEstimate({ current_values: [{ estimate: "450000" }] })).toBeNull();
  });

  it("parses snake_case payloads and prefers the flagged best value", () => {
    const result = parseValueEstimate({
      current_values: [
        {
          source: { type: "recent", name: "CoreLogic®" },
          estimate: 440000,
          estimate_low: 420000,
          estimate_high: 460000,
          date: "2026-06-01",
          isbest_homevalue: false,
        },
        {
          source: { type: "recent", name: "Quantarium" },
          estimate: 452000,
          estimate_low: 430000,
          estimate_high: 470000,
          date: "2026-06-15",
          isbest_homevalue: true,
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBe(452000);
    expect(result!.low).toBe(430000);
    expect(result!.high).toBe(470000);
    expect(result!.source).toBe("Quantarium");
    expect(result!.sources).toHaveLength(2);
  });

  it("parses camelCase payloads", () => {
    const result = parseValueEstimate({
      currentValues: [
        {
          source: { name: "Collateral Analytics" },
          estimate: 385000,
          estimateLow: 370000,
          estimateHigh: 400000,
          date: "2026-05-20",
          isBestHomeValue: true,
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBe(385000);
    expect(result!.low).toBe(370000);
    expect(result!.high).toBe(400000);
    expect(result!.source).toBe("Collateral Analytics");
  });

  it("falls back to the first valid value when nothing is flagged best", () => {
    const result = parseValueEstimate({
      current_values: [
        { estimate: null, source: { name: "Broken" } },
        { estimate: 300000, source: { name: "CoreLogic®" } },
        { estimate: 310000, source: { name: "Quantarium" } },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBe(300000);
    expect(result!.source).toBe("CoreLogic®");
    expect(result!.low).toBeNull();
    expect(result!.high).toBeNull();
    expect(result!.sources).toHaveLength(2);
  });
});
