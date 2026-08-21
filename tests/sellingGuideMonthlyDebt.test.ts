/**
 * Fannie Mae Selling Guide B3-6-05, Monthly Debt Obligations (08/05/2026) and
 * B3-6-07, Debts Paid Off At or Prior to Closing (04/05/2023).
 *
 * These pin the DTI debt-summation rules to their published source. The guide is
 * committed at docs/fannie-mae/selling-guide/ — quotes below are verbatim from
 * selling-guide-text.txt so a future edition change shows up as a diff here.
 *
 * Why this file exists: every rule below was previously either absent or written
 * against a liability-type spelling the application can never emit, so the
 * branches never executed and the suite stayed green. Assert on OUTPUT, never on
 * the branch being present.
 */
import { describe, it, expect } from "vitest";
import { assessLiabilities } from "../server/underwriting";
import { adjustLiabilities } from "../server/services/underwritingNuance";
import type { UrlaLiability } from "@shared/schema";

const liability = (over: Partial<UrlaLiability>): UrlaLiability =>
  ({
    id: "l1",
    applicationId: "a1",
    borrowerSequenceNumber: 1,
    liabilityType: "credit_card",
    creditorName: "Test",
    accountNumberEncrypted: null,
    accountNumberIv: null,
    accountNumberKeyId: null,
    accountNumberLast4: null,
    unpaidBalance: "0",
    monthlyPayment: "0",
    toBePaidOff: false,
    createdAt: new Date(),
    ...over,
  }) as UrlaLiability;

describe("B3-6-05 Revolving Charge/Lines of Credit", () => {
  // "If the credit report does not show a required minimum payment amount and
  // there is no supplemental documentation to support a payment of less than 5%,
  // the lender must use 5% of the outstanding balance ... For DU loan casefiles
  // ... the greater of $10 or 5% of the outstanding balance."
  it("imputes 5% of balance when a revolving line reports no minimum payment", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "credit_card", unpaidBalance: "8000", monthlyPayment: "0" }),
    ]);
    expect(r.totalMonthlyPayment).toBe(400); // 5% of 8,000
  });

  it("uses the $10 floor when 5% of the balance is smaller", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "credit_card", unpaidBalance: "100", monthlyPayment: "0" }),
    ]);
    expect(r.totalMonthlyPayment).toBe(10); // greater of $10 and $5
  });

  it("uses the reported minimum payment when the report carries one", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "credit_card", unpaidBalance: "8000", monthlyPayment: "125" }),
    ]);
    expect(r.totalMonthlyPayment).toBe(125);
  });

  // The regression this file was written for: a $12k card with no reported
  // minimum used to contribute $0, understating the DTI and clearing files DU
  // would decline.
  it("does not let a zero-payment revolving line vanish from the DTI", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "credit_card", unpaidBalance: "12000", monthlyPayment: "0" }),
    ]);
    expect(r.totalMonthlyPayment).toBeGreaterThan(0);
  });

  it("applies the same floor to credit-pull tradelines", () => {
    const adj = adjustLiabilities([
      { creditor: "Card", type: "revolving", balance: 8000, monthlyPayment: 0 },
    ]);
    expect(adj.revolvingImputed).toBe(400);
    expect(adj.adjustedMonthlyDebt).toBe(400);
  });
});

describe("B3-6-05 Student Loans", () => {
  // "For deferred loans or loans in forbearance, the lender may calculate a
  // payment equal to 1% of the outstanding student loan balance".
  it("imputes 1% of balance on a deferred student loan", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "student_loan", unpaidBalance: "40000", monthlyPayment: "0" }),
    ]);
    expect(r.totalMonthlyPayment).toBe(400); // 1% of 40,000
  });

  it("does not apply the revolving 5% factor to a student loan", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "student_loan", unpaidBalance: "40000", monthlyPayment: "0" }),
    ]);
    expect(r.totalMonthlyPayment).not.toBe(2000);
  });
});

describe("B3-6-07 Debts Paid Off At or Prior to Closing", () => {
  // "If a revolving account balance is to be paid off at or prior to closing, a
  // monthly payment on the current outstanding balance does not need to be
  // included in the borrower's long-term debt."
  it("excludes a debt flagged to be paid off at closing", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "credit_card", unpaidBalance: "8000", monthlyPayment: "200", toBePaidOff: true }),
    ]);
    expect(r.totalMonthlyPayment).toBe(0);
    expect(r.excludedDebts).toBe(200);
  });

  // toBePaidOff used to be tested only inside an `installment` branch that the
  // liability vocabulary cannot produce, so it never fired for ANY type.
  it("honors the paid-off flag on installment debt, not only revolving", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "installment_loan", unpaidBalance: "9000", monthlyPayment: "310", toBePaidOff: true }),
    ]);
    expect(r.totalMonthlyPayment).toBe(0);
  });

  it("still excludes when the paid-off debt is a zero-payment revolving line", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "credit_card", unpaidBalance: "8000", monthlyPayment: "0", toBePaidOff: true }),
    ]);
    expect(r.totalMonthlyPayment).toBe(0);
  });
});

describe("B3-6-05 branch reachability", () => {
  // The defect class: rules written against type strings the app never emits.
  // These assert the guideline branches fire for the vocabulary the URLA form
  // actually writes (shared/schema/underwritingFinancials.ts LIABILITY_TYPES).
  it("reaches the revolving rule via the vocabulary's own spelling", () => {
    for (const spelling of ["credit_card", "Credit Card", "revolving"]) {
      const r = assessLiabilities([
        liability({ liabilityType: spelling, unpaidBalance: "2000", monthlyPayment: "0" }),
      ]);
      expect(r.totalMonthlyPayment, `spelling: ${spelling}`).toBe(100);
    }
  });

  it("includes installment debt at its reported payment", () => {
    const r = assessLiabilities([
      liability({ liabilityType: "auto_loan", unpaidBalance: "15000", monthlyPayment: "420" }),
    ]);
    expect(r.totalMonthlyPayment).toBe(420);
  });
});
