// Audit F-21 — the commission payout had no relationship to the revenue it is
// a share of.
//
// `POST /api/broker/commissions` computed `loanAmount × rate` with `rate <= 0.1`
// as the only check: it never read the compensation on the file, never checked
// the loan funded, and took the loan amount from the application rather than
// from what the lender actually funded. At the seeded 200 bps lender-paid plan
// on a $250,000 loan — $5,000 of revenue — that permitted a $25,000 payable, on
// a file that might still be in processing.
//
// The property these tests defend hardest: a payout can never exceed the
// compensation it is drawn from, and an UNKNOWN revenue basis is a refusal
// rather than an absence of limit.
import { describe, it, expect } from "vitest";
import {
  MAX_COMMISSION_RATE,
  evaluateCommissionPayout,
  fundedSubmissionOf,
  type CommissionPayoutInput,
} from "../shared/commissionPayout";

/** A funded $250k file at the seeded Summit 200 bps plan — $5,000 of revenue. */
const FUNDED: CommissionPayoutInput = {
  applicationStatus: "funded",
  submissionStatus: "funded",
  fundedLoanAmount: "250000.00",
  compensationReceivedAmount: "5000.00",
  compensationExpectedAmount: "5000.00",
  rate: 0.01,
};

describe("F-21 — the payout is bounded by the compensation it shares", () => {
  it("refuses the exact case the audit found: 10% of loan amount on a $250k file", () => {
    // $25,000 against $5,000 of revenue — five times the money the file earned.
    const e = evaluateCommissionPayout({ ...FUNDED, rate: MAX_COMMISSION_RATE });
    expect(e.allowed).toBe(false);
    expect(e.verdict).toBe("exceeds_compensation");
    expect(e.maxAmount).toBe(5_000);
    expect(e.message).toMatch(/25000\.00 payout exceeds \$5000\.00/);
  });

  it("allows a payout inside the compensation", () => {
    const e = evaluateCommissionPayout(FUNDED);
    expect(e.allowed).toBe(true);
    expect(e.verdict).toBe("allowed");
    expect(e.amount).toBe(2_500); // 1% of $250k
    expect(e.revenueBasis).toBe(5_000);
    expect(e.message).toMatch(/50\.0% of \$5000\.00/);
  });

  it("allows a payout exactly at the compensation, and refuses a cent past it", () => {
    // 2% of $250k is $5,000 — precisely the revenue. The boundary is inclusive:
    // paying out everything earned is a business choice, paying out more is an
    // arithmetic error.
    expect(evaluateCommissionPayout({ ...FUNDED, rate: 0.02 }).allowed).toBe(true);
    expect(evaluateCommissionPayout({ ...FUNDED, rate: 0.0201 }).allowed).toBe(false);
  });

  it("reports the highest rate that fits, rounded DOWN", () => {
    const e = evaluateCommissionPayout({ ...FUNDED, rate: MAX_COMMISSION_RATE });
    expect(e.maxRate).toBe(0.02);
    // The suggested rate must itself pass — rounding up would hand back a rate
    // the very next evaluation refuses.
    expect(evaluateCommissionPayout({ ...FUNDED, rate: e.maxRate! }).allowed).toBe(true);
  });

  it("rounds maxRate down on a basis that does not divide evenly", () => {
    const e = evaluateCommissionPayout({
      ...FUNDED,
      fundedLoanAmount: "237500",
      compensationReceivedAmount: "4750",
      rate: MAX_COMMISSION_RATE,
    });
    expect(evaluateCommissionPayout({ ...FUNDED, fundedLoanAmount: "237500", compensationReceivedAmount: "4750", rate: e.maxRate! }).allowed).toBe(true);
  });
});

describe("F-21 — the basis is what the lender funded and paid", () => {
  it("prefers the recorded remittance over the snapshotted expectation", () => {
    // The lender short-paid: expected 5,000, remitted 4,000. The payout must be
    // bounded by what actually arrived, not by what we hoped for.
    const e = evaluateCommissionPayout({
      ...FUNDED,
      compensationExpectedAmount: "5000",
      compensationReceivedAmount: "4000",
      rate: MAX_COMMISSION_RATE,
    });
    expect(e.revenueBasisSource).toBe("received");
    expect(e.maxAmount).toBe(4_000);
  });

  it("falls back to the expectation only while no remittance exists, and says so", () => {
    const e = evaluateCommissionPayout({
      ...FUNDED,
      compensationReceivedAmount: null,
      rate: 0.01,
    });
    expect(e.revenueBasisSource).toBe("expected");
    expect(e.message).toMatch(/no remittance recorded yet/);
  });

  it("refuses when neither figure exists — an unknown is not 'no limit'", () => {
    const e = evaluateCommissionPayout({
      ...FUNDED,
      compensationReceivedAmount: null,
      compensationExpectedAmount: null,
    });
    expect(e.allowed).toBe(false);
    expect(e.verdict).toBe("no_revenue_basis");
    expect(e.maxAmount).toBeNull();
  });

  it("refuses a funded submission with no funded loan amount", () => {
    const e = evaluateCommissionPayout({ ...FUNDED, fundedLoanAmount: null });
    expect(e.verdict).toBe("no_loan_basis");
  });
});

describe("F-21 — a payout belongs to a funded file", () => {
  it("refuses when no submission has funded", () => {
    const e = evaluateCommissionPayout({
      ...FUNDED,
      applicationStatus: "processing",
      submissionStatus: "submitted",
    });
    expect(e.allowed).toBe(false);
    expect(e.verdict).toBe("not_funded");
    expect(e.message).toMatch(/nothing yet to share/);
  });

  it("refuses on a denied file", () => {
    expect(
      evaluateCommissionPayout({
        ...FUNDED,
        applicationStatus: "denied",
        submissionStatus: "denied",
      }).verdict,
    ).toBe("not_funded");
  });

  it("names the application/submission disagreement rather than hiding it", () => {
    // An application marked funded whose submissions are not is a data problem,
    // and reporting it as an ordinary refusal would bury it.
    const e = evaluateCommissionPayout({
      ...FUNDED,
      applicationStatus: "funded",
      submissionStatus: "approved",
    });
    expect(e.verdict).toBe("not_funded");
    expect(e.message).toMatch(/marked funded but no lender submission on it is/);
    expect(e.remediation.join(" ")).toMatch(/Reconcile/);
  });

  it("picks the funded submission out of several", () => {
    const submissions = [
      { status: "denied", id: "a" },
      { status: "funded", id: "b" },
      { status: "submitted", id: "c" },
    ];
    expect(fundedSubmissionOf(submissions)?.id).toBe("b");
    expect(fundedSubmissionOf([{ status: "denied", id: "a" }])).toBeUndefined();
  });
});

describe("F-21 — rate validation is unchanged and still first", () => {
  it("rejects a rate at or below zero, above the ceiling, or not a number", () => {
    for (const rate of [0, -0.01, 0.11, NaN, Infinity]) {
      const e = evaluateCommissionPayout({ ...FUNDED, rate });
      expect(`${rate}:${e.verdict}`).toBe(`${rate}:rate_out_of_range`);
    }
  });

  it("checks the rate before touching the file, so a bad rate never reads as a data problem", () => {
    const e = evaluateCommissionPayout({
      applicationStatus: "draft",
      submissionStatus: undefined,
      fundedLoanAmount: null,
      compensationReceivedAmount: null,
      compensationExpectedAmount: null,
      rate: 5,
    });
    expect(e.verdict).toBe("rate_out_of_range");
  });

  it("is deterministic", () => {
    expect(evaluateCommissionPayout(FUNDED)).toEqual(evaluateCommissionPayout(FUNDED));
  });
});
