import { describe, it, expect } from "vitest";
import { formatUsd, monthlyFromAnnual, sumAnnual } from "./dualUnitMath";

// Pins the dual-unit rules (§6): monthly is DERIVED from annual, "—" for
// not-applicable (never $0), sums skip only what is genuinely absent.

describe("dualUnitMath", () => {
  it("derives monthly from annual", () => {
    expect(monthlyFromAnnual(84000)).toBe(7000);
    expect(monthlyFromAnnual(null)).toBeNull();
  });

  it("renders null as an em dash, never $0", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(7083.33)).toBe("$7,083");
  });

  it("sums only applicable rows", () => {
    expect(
      sumAnnual([
        { label: "Base", annual: 84000 },
        { label: "Overtime", annual: null },
        { label: "Bonus", annual: 6000 },
      ]),
    ).toBe(90000);
  });
});
