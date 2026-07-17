import { describe, expect, it } from "vitest";
import { complianceScorePercent } from "../client/src/pages/staff/staffDashboard/model";

// Staff-dashboard Compliance KPI. The server reports gseReady and
// ulddCompliant as independent counts over the same validated set, so the old
// client formula (gseReady + ulddCompliant) / total double-counted every file
// that was both and could render >100% (2 apps, both fully ready → 200%).
// The KPI now counts distinct compliant applications; these tests pin that.

const app = (gseReady: boolean, ulddCompliant: boolean) => ({ gseReady, ulddCompliant });

describe("complianceScorePercent", () => {
  it("counts a file that is both GSE-ready and ULDD-compliant once (the 200% regression)", () => {
    expect(
      complianceScorePercent({ total: 2, applications: [app(true, true), app(true, true)] }),
    ).toBe(100);
  });

  it("treats either flag as compliant — GSE-ready is not computed as a subset of ULDD-compliant", () => {
    expect(
      complianceScorePercent({
        total: 4,
        applications: [app(true, true), app(true, false), app(false, true), app(false, false)],
      }),
    ).toBe(75);
  });

  it("stays within 0–100 for every flag combination", () => {
    const combos = [app(false, false), app(true, false), app(false, true), app(true, true)];
    for (const a of combos) {
      for (const b of combos) {
        for (const c of combos) {
          const score = complianceScorePercent({ total: 3, applications: [a, b, c] });
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("returns 0 for an empty worklist and while data is still loading", () => {
    expect(complianceScorePercent({ total: 0, applications: [] })).toBe(0);
    expect(complianceScorePercent(undefined)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    expect(
      complianceScorePercent({
        total: 3,
        applications: [app(true, true), app(false, false), app(false, false)],
      }),
    ).toBe(33);
  });
});
