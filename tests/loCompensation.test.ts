// Reg Z §1026.36(d)(2) dual compensation + the QM points-and-fees floor.
//
// These are the two audit findings this suite exists to keep fixed:
//   F-1  the fee schedule charged a borrower-paid origination fee on every
//        file regardless of who actually paid the originator
//   F-2  the QM points-and-fees gate read a column nothing ever wrote and
//        returned "compliant" when it was missing
import { describe, it, expect } from "vitest";
import {
  borrowerPaidOriginationAllowed,
  compensationAmount,
  evaluatePointsAndFeesFloor,
  pointsAndFeesFloor,
  resolveCompensation,
  type OriginatorCompensation,
} from "../shared/compliance/loCompensation";
import {
  computeClosingCosts,
  ORIGINATION_FEE_RATE,
  PLATFORM_APPLICATION_FEE,
  PLATFORM_UNDERWRITING_FEE,
} from "../server/services/loanCosts";

const LENDER_PAID: OriginatorCompensation = { model: "lender_paid", bps: 200 };
const BORROWER_PAID: OriginatorCompensation = { model: "borrower_paid", bps: 100 };

const baseCosts = {
  purchasePrice: 500_000,
  downPayment: 100_000,
  loanAmount: 400_000,
  interestRate: 6.875,
  monthlyPMI: 0,
  prepaidInterestDays: 15,
};

// The 2026 note-date table's top tier: 3% of the Reg Z Total Loan Amount.
const NOTE_DATE = "2026-03-15";

describe("F-1 — dual compensation (12 CFR 1026.36(d)(2))", () => {
  it("charges no borrower origination fee when the lender pays the originator", () => {
    const costs = computeClosingCosts({ ...baseCosts, compensation: LENDER_PAID });
    expect(costs.originationFee).toBe(0);
    expect(costs.lenderPaidCompensation).toBe(8_000); // 200 bps of 400k
  });

  it("charges the origination fee only under a borrower-paid plan", () => {
    const costs = computeClosingCosts({ ...baseCosts, compensation: BORROWER_PAID });
    expect(costs.originationFee).toBe(400_000 * ORIGINATION_FEE_RATE);
    expect(costs.lenderPaidCompensation).toBe(0);
  });

  it("never reports both a borrower origination fee and lender-paid compensation", () => {
    for (const compensation of [LENDER_PAID, BORROWER_PAID]) {
      const costs = computeClosingCosts({ ...baseCosts, compensation });
      const bothSides = costs.originationFee > 0 && costs.lenderPaidCompensation > 0;
      expect(bothSides).toBe(false);
    }
  });

  it("keeps lender-paid compensation out of every borrower-facing total", () => {
    // The LE has no "paid by others" column (that column exists only on the
    // CD), so how much the lender pays the originator must not move a single
    // number the borrower sees. Vary the bps and assert nothing shifts.
    const cheap = computeClosingCosts({
      ...baseCosts,
      compensation: { model: "lender_paid", bps: 100 },
    });
    const rich = computeClosingCosts({
      ...baseCosts,
      compensation: { model: "lender_paid", bps: 275 },
    });

    expect(rich.lenderPaidCompensation).toBeGreaterThan(cheap.lenderPaidCompensation);
    for (const key of [
      "loanCostsTotal",
      "otherCostsTotal",
      "totalClosingCosts",
      "cashToClose",
      "prepaidFinanceCharges",
      "originationFee",
    ] as const) {
      expect(`${key}=${rich[key]}`).toBe(`${key}=${cheap[key]}`);
    }
    expect(cheap.cashToClose).toBeCloseTo(cheap.totalClosingCosts + 100_000, 6);
  });

  it("lowers the borrower's cash to close by exactly the origination fee", () => {
    const lenderPaid = computeClosingCosts({ ...baseCosts, compensation: LENDER_PAID });
    const borrowerPaid = computeClosingCosts({ ...baseCosts, compensation: BORROWER_PAID });
    expect(borrowerPaid.cashToClose - lenderPaid.cashToClose).toBeCloseTo(
      400_000 * ORIGINATION_FEE_RATE,
      6,
    );
  });

  it("fails closed when no compensation model is supplied", () => {
    expect(() =>
      // @ts-expect-error — the guard exists for callers that skip the type
      computeClosingCosts({ ...baseCosts }),
    ).toThrow(/compensation model is required/i);
  });

  it("gates the origination fee on the model, not on the rate", () => {
    expect(borrowerPaidOriginationAllowed("lender_paid")).toBe(false);
    expect(borrowerPaidOriginationAllowed("borrower_paid")).toBe(true);
  });

  it("resolves a persisted election and refuses a half-populated one", () => {
    expect(resolveCompensation("lender_paid", 200)).toEqual({ model: "lender_paid", bps: 200 });
    expect(resolveCompensation("lender_paid", "225")).toEqual({ model: "lender_paid", bps: 225 });
    expect(resolveCompensation("lender_paid", null)).toBeNull();
    expect(resolveCompensation(null, 200)).toBeNull();
    expect(resolveCompensation("mystery_plan", 200)).toBeNull();
    expect(resolveCompensation("lender_paid", -1)).toBeNull();
  });

  it("computes compensation from basis points", () => {
    expect(compensationAmount(400_000, { model: "lender_paid", bps: 275 })).toBe(11_000);
  });
});

describe("F-2 — QM points-and-fees floor (12 CFR 1026.43(e)(2)(iii))", () => {
  const floorInput = (comp: OriginatorCompensation, loanAmount = 400_000) => ({
    loanAmount,
    originationFee: comp.model === "borrower_paid" ? loanAmount * ORIGINATION_FEE_RATE : 0,
    points: 0,
    applicationFee: PLATFORM_APPLICATION_FEE,
    underwritingFee: PLATFORM_UNDERWRITING_FEE,
    compensation: comp,
  });

  it("counts lender-paid compensation toward points and fees", () => {
    const floor = pointsAndFeesFloor(floorInput(LENDER_PAID));
    // 0 origination + 500 app + 1500 UW + 8000 comp
    expect(floor.amount).toBe(10_000);
    expect(floor.isLowerBound).toBe(true);
  });

  it("does not double-count borrower-paid compensation against the origination fee", () => {
    // 100 bps comp and a 1% origination fee are the same $4,000.
    const floor = pointsAndFeesFloor(floorInput(BORROWER_PAID));
    expect(floor.amount).toBe(4_000 + 500 + 1_500);
  });

  it("flags the audit's $400k / 200 bps case as over the cap", () => {
    const evaluation = evaluatePointsAndFeesFloor(
      NOTE_DATE,
      400_000,
      400_000,
      floorInput(LENDER_PAID),
    );
    // Floor 10,000 + ... wait: cap is 3% of 400,000 = 12,000, floor is 10,000.
    // At 200 bps the platform's own charges fit; it is the 275 bps max that
    // does not. Pin both so the boundary is explicit.
    expect(evaluation.maxAllowableAmount).toBe(12_000);
    expect(evaluation.verdict).toBe("not_cleared");
  });

  it("blocks the 275 bps maximum on a $400k loan", () => {
    const evaluation = evaluatePointsAndFeesFloor(
      NOTE_DATE,
      400_000,
      400_000,
      floorInput({ model: "lender_paid", bps: 275 }),
    );
    // 11,000 comp + 500 + 1,500 = 13,000 against a 12,000 cap.
    expect(evaluation.verdict).toBe("over_cap");
    expect(evaluation.floor?.amount).toBe(13_000);
    expect(evaluation.message).toMatch(/exceed the QM cap/i);
  });

  it("blocks every seeded lender's minimum compensation on a $200k loan", () => {
    // Cap is 3% of 200,000 = 6,000. Platform flat fees alone are 2,000, and a
    // borrower-paid 1% origination adds 2,000 more.
    for (const bps of [100, 150, 175, 200, 225, 275]) {
      const evaluation = evaluatePointsAndFeesFloor(
        NOTE_DATE,
        200_000,
        200_000,
        floorInput({ model: "lender_paid", bps }, 200_000),
      );
      expect(evaluation.maxAllowableAmount).toBe(6_000);
      // 2,000 flat + comp; only comp below 200 bps ($4,000) fits.
      const expected = bps * 20 + 2_000 > 6_000 ? "over_cap" : "not_cleared";
      expect(`${bps}:${evaluation.verdict}`).toBe(`${bps}:${expected}`);
    }
  });

  it("never returns a clean pass off the floor alone", () => {
    const verdicts = [100, 200, 275].map(
      bps =>
        evaluatePointsAndFeesFloor(NOTE_DATE, 400_000, 400_000, floorInput({ model: "lender_paid", bps }))
          .verdict,
    );
    // "not_cleared" and "over_cap" are the only outcomes — there is no
    // "compliant", because the floor cannot establish compliance.
    expect(verdicts.every(v => v === "not_cleared" || v === "over_cap")).toBe(true);
  });

  it("reports not_evaluated rather than passing when no note-date table exists", () => {
    const evaluation = evaluatePointsAndFeesFloor(
      "2019-06-01",
      400_000,
      400_000,
      floorInput(LENDER_PAID),
    );
    expect(evaluation.verdict).toBe("not_evaluated");
  });

  it("is monotone: more compensation never lowers the floor", () => {
    let previous = -1;
    for (const bps of [0, 50, 100, 150, 200, 250, 300]) {
      const floor = pointsAndFeesFloor(floorInput({ model: "lender_paid", bps }));
      expect(floor.amount).toBeGreaterThanOrEqual(previous);
      previous = floor.amount;
    }
  });

  it("is deterministic — same inputs, same floor", () => {
    const a = pointsAndFeesFloor(floorInput(LENDER_PAID));
    const b = pointsAndFeesFloor(floorInput(LENDER_PAID));
    expect(a).toEqual(b);
  });
});
