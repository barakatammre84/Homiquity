import { describe, it, expect } from "vitest";
import { computeCasefileDti } from "../server/services/ausSubmission";

// -----------------------------------------------------------------------------
// F-0818-11 — the DTI submitted to DU omitted the proposed housing payment.
//
// B3-6-02 read with B3-6-03: the qualifying ratio is TOTAL monthly obligations,
// which includes the proposed monthly housing expense. The casefile was sending
// recurring debts alone — the back-end ratio — which understates every purchase file.
//
// A2-2-04 is why this is a warranty problem rather than a cosmetic one: the DU limited
// waiver holds only where the casefile data is "complete, accurate, and not fraudulent",
// and it does not relieve the lender of "the identification and inclusion of a
// borrower's liabilities in the DTI".
// -----------------------------------------------------------------------------

describe("computeCasefileDti (B3-6-02 / B3-6-03)", () => {
  it("includes the proposed housing payment — the defect, reintroduced", () => {
    const income = 6_000;
    const debts = 750;
    const housing = 2_250;

    const dti = computeCasefileDti({
      monthlyIncome: income,
      monthlyDebts: debts,
      proposedHousingPayment: housing,
    });

    // Total ratio: (750 + 2250) / 6000 = 50%.
    expect(dti).toBe(0.5);

    // The old behaviour was debts alone: 750 / 6000 = 12.5%. Pin the gap, because the
    // two land on opposite sides of DU's 50% ceiling — the understated figure sails
    // through a gate the real one is sitting exactly on.
    const backEndOnly = Number((debts / income).toFixed(4));
    expect(backEndOnly).toBe(0.125);
    expect(dti).toBeGreaterThan(backEndOnly);
  });

  it("treats zero other debts as a real value, not a missing one", () => {
    // A borrower with no other obligations still has a DTI from the housing payment.
    // The old guard used a falsy check on monthlyDebts, so this file reported null.
    expect(
      computeCasefileDti({ monthlyIncome: 8_000, monthlyDebts: 0, proposedHousingPayment: 2_000 }),
    ).toBe(0.25);
  });

  it("returns null when the housing payment cannot be computed", () => {
    // Deliberately null rather than partial: an absent ratio is honest and DU asks for
    // it; an understated one buys an Approve/Eligible the file has not earned.
    expect(
      computeCasefileDti({ monthlyIncome: 6_000, monthlyDebts: 750, proposedHousingPayment: null }),
    ).toBeNull();
  });

  it("returns null on missing or nonsensical income", () => {
    for (const monthlyIncome of [null, 0, -100]) {
      expect(
        computeCasefileDti({ monthlyIncome, monthlyDebts: 750, proposedHousingPayment: 2_250 }),
      ).toBeNull();
    }
  });

  it("returns null when debts are unknown, rather than assuming zero", () => {
    expect(
      computeCasefileDti({ monthlyIncome: 6_000, monthlyDebts: null, proposedHousingPayment: 2_250 }),
    ).toBeNull();
  });

  it("does not emit NaN or Infinity into a casefile", () => {
    expect(
      computeCasefileDti({ monthlyIncome: 6_000, monthlyDebts: NaN, proposedHousingPayment: 2_250 }),
    ).toBeNull();
    expect(
      computeCasefileDti({ monthlyIncome: 6_000, monthlyDebts: 750, proposedHousingPayment: Infinity }),
    ).toBeNull();
  });

  it("crosses DU's 50% ceiling only when housing is counted", () => {
    // ausSubmission gates at dti > 0.5. This file is 44.2% back-end, 63.3% total.
    const args = { monthlyIncome: 6_000, monthlyDebts: 2_650, proposedHousingPayment: 1_150 };
    expect(Number((args.monthlyDebts / args.monthlyIncome).toFixed(4))).toBeLessThan(0.5);
    expect(computeCasefileDti(args)!).toBeGreaterThan(0.5);
  });
});
