import { describe, it, expect } from "vitest";
import {
  buildReasonsAndTips,
  calculateQualificationNumbers,
  tierRate,
} from "./propertyQualification";
import type { Property } from "@shared/schema";

const prop = (price: string) => ({ price }) as Property;
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

describe("tierRate", () => {
  it("steps down the rate as credit improves", () => {
    expect(tierRate(760)).toBe(0.0625);
    expect(tierRate(759)).toBe(0.065);
    expect(tierRate(720)).toBe(0.065);
    expect(tierRate(719)).toBe(0.07);
    expect(tierRate(680)).toBe(0.07);
    expect(tierRate(679)).toBe(0.075);
  });

  it("uses the worst tier when no score is known", () => {
    // Not the best tier — an unknown score must not flatter the estimate.
    expect(tierRate(undefined)).toBe(0.075);
    expect(tierRate(0)).toBe(0.075);
  });
});

describe("calculateQualificationNumbers", () => {
  it("returns null when income is unknown", () => {
    // DTI is unknowable without income; 0% would read as comfortably qualified.
    expect(calculateQualificationNumbers(prop("400000"), 500000, 0, 500)).toBeNull();
    expect(calculateQualificationNumbers(prop("400000"), 500000, -1, 500)).toBeNull();
  });

  it("is deterministic", () => {
    const a = calculateQualificationNumbers(prop("400000"), 500000, 10000, 500, 740);
    const b = calculateQualificationNumbers(prop("400000"), 500000, 10000, 500, 740);
    expect(a).toEqual(b);
  });

  it("charges PMI above 80% LTV and drops it at or below", () => {
    const low = calculateQualificationNumbers(prop("400000"), 500000, 10000, 500, 740, 5)!;
    const at20 = calculateQualificationNumbers(prop("400000"), 500000, 10000, 500, 740, 20)!;
    expect(low.ltvRatio).toBe(95);
    expect(low.paymentBreakdown.pmi).toBeGreaterThan(0);
    expect(at20.ltvRatio).toBe(80);
    expect(at20.paymentBreakdown.pmi).toBe(0);
  });

  it("floors insurance at $100/mo for a low-priced home", () => {
    // 0.3%/yr on a $200k home is $50/mo; the floor keeps the estimate honest.
    const cheap = calculateQualificationNumbers(prop("200000"), 500000, 10000, 0, 740)!;
    expect(cheap.paymentBreakdown.insurance).toBe(100);
    const pricey = calculateQualificationNumbers(prop("800000"), 900000, 20000, 0, 740)!;
    expect(pricey.paymentBreakdown.insurance).toBeCloseTo((800000 * 0.003) / 12, 6);
  });

  it("splits the FIRST month, where interest is highest", () => {
    const q = calculateQualificationNumbers(prop("400000"), 500000, 10000, 0, 740, 20)!;
    expect(q.paymentBreakdown.interest).toBeCloseTo(q.loanAmount * (q.annualRate / 12), 6);
    expect(q.paymentBreakdown.interest).toBeGreaterThan(q.paymentBreakdown.principal);
  });

  it("exceeds guidelines when the price is over the pre-approval, whatever the DTI", () => {
    const q = calculateQualificationNumbers(prop("400000"), 300000, 40000, 0, 780, 20)!;
    expect(q.overPreApproval).toBe(true);
    expect(q.dtiWithProperty).toBeLessThan(43);
    expect(q.status).toBe("exceeds_guidelines");
    expect(q.meetsGuidelines).toBe(false);
  });

  it("grades DTI against the 43 and 50 bands", () => {
    const comfortable = calculateQualificationNumbers(prop("300000"), 500000, 20000, 200, 780, 20)!;
    expect(comfortable.dtiWithProperty).toBeLessThanOrEqual(43);
    expect(comfortable.status).toBe("within_guidelines");

    const tight = calculateQualificationNumbers(prop("400000"), 500000, 5000, 1500, 640, 5)!;
    expect(tight.dtiWithProperty).toBeGreaterThan(50);
    expect(tight.status).toBe("exceeds_guidelines");
  });

  it("keeps exceeds_guidelines from being downgraded to requires_review", () => {
    // Over pre-approval AND in the 43-50 band: the price failure must win.
    const q = calculateQualificationNumbers(prop("400000"), 100000, 8000, 500, 700, 5)!; // DTI 47.5%
    expect(q.overPreApproval).toBe(true);
    expect(q.dtiWithProperty).toBeGreaterThan(43);
    expect(q.dtiWithProperty).toBeLessThanOrEqual(50);
    expect(q.status).toBe("exceeds_guidelines");
  });
});

describe("buildReasonsAndTips", () => {
  it("names the pre-approval shortfall first", () => {
    const q = calculateQualificationNumbers(prop("400000"), 300000, 40000, 0, 780, 20)!;
    const { reasons, tips } = buildReasonsAndTips(q, 300000, 20, money, 780);
    expect(reasons[0]).toContain("exceeds your pre-approval");
    expect(tips).toContain("Consider properties within your pre-approval amount");
  });

  it("always reports a DTI line, in every band", () => {
    for (const [income, debts] of [[20000, 200], [6000, 800], [4000, 2000]] as const) {
      const q = calculateQualificationNumbers(prop("400000"), 900000, income, debts, 740, 20)!;
      const { reasons } = buildReasonsAndTips(q, 900000, 20, money, 740);
      expect(reasons.some(r => r.includes("DTI"))).toBe(true);
    }
  });

  it("mentions PMI only when it is actually charged", () => {
    const withPmi = calculateQualificationNumbers(prop("400000"), 900000, 20000, 0, 740, 5)!;
    expect(buildReasonsAndTips(withPmi, 900000, 5, money, 740).tips.join(" ")).toContain("PMI");

    const noPmi = calculateQualificationNumbers(prop("400000"), 900000, 20000, 0, 740, 20)!;
    expect(buildReasonsAndTips(noPmi, 900000, 20, money, 740).tips.join(" ")).not.toContain("PMI");
  });

  it("suggests credit improvement only below 680, and not when the score is unknown", () => {
    const q = calculateQualificationNumbers(prop("400000"), 900000, 20000, 0, 640, 20)!;
    expect(buildReasonsAndTips(q, 900000, 20, money, 640).tips.join(" ")).toContain("credit score");
    expect(buildReasonsAndTips(q, 900000, 20, money, undefined).tips.join(" ")).not.toContain("credit score");
  });
});
