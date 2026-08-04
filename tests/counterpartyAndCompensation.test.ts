// Audit findings F-5 (counterparty capacity) and F-6 (revenue representation).
//
// F-5: nothing checked whether we actually have a broker agreement with a
//      lender before transmitting a borrower's file to them.
// F-6: revenue existed nowhere — a funded loan earned an unknown amount and a
//      lender short-paying us was invisible.
import { describe, it, expect } from "vitest";
import {
  approvedLenderCount,
  approvedWholesaleLenders,
  evaluateLenderSubmissionEligibility,
  isApprovedLender,
  WHOLESALE_LENDERS,
  type WholesaleLender,
} from "../shared/wholesaleLenders";
import {
  COMPENSATION_MATCH_TOLERANCE,
  evaluateCompensationVariance,
  summarizeCompensation,
} from "../shared/compensationLedger";

const lender = (over: Partial<WholesaleLender> = {}): WholesaleLender => ({
  id: "test-lender",
  name: "Test Wholesale",
  specialty: "Conventional",
  approvalStatus: "target",
  ausSupport: ["DU"],
  ...over,
});

describe("F-5 — counterparty approval gate", () => {
  it("blocks an unapproved lender in production", () => {
    const result = evaluateLenderSubmissionEligibility(lender(), { isProduction: true });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/no broker agreement/i);
    expect(result.remediation.join(" ")).toMatch(/approvalStatus/);
  });

  it("blocks every approval status short of approved", () => {
    for (const status of ["target", "application_in_progress", "inactive"] as const) {
      const result = evaluateLenderSubmissionEligibility(lender({ approvalStatus: status }), {
        isProduction: true,
      });
      expect(`${status}:${result.allowed}`).toBe(`${status}:false`);
    }
  });

  it("allows an approved lender for real", () => {
    const result = evaluateLenderSubmissionEligibility(lender({ approvalStatus: "approved" }), {
      isProduction: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.simulated).toBe(false);
  });

  it("allows the demo path outside production, but only as a simulation", () => {
    const result = evaluateLenderSubmissionEligibility(lender(), { isProduction: false });
    expect(result.allowed).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.reason).toMatch(/SIMULATED/);
  });

  it("reports the real counterparty capacity — currently zero", () => {
    // This is the finding, asserted rather than described: no wholesale lender
    // has credentialed us, so the platform cannot deliver a loan to anyone.
    // When the first agreement is signed this test changes with the catalog.
    expect(approvedLenderCount()).toBe(approvedWholesaleLenders().length);
    expect(WHOLESALE_LENDERS.every(l => !isApprovedLender(l) || l.approvalStatus === "approved")).toBe(true);
  });
});

describe("F-6 — compensation variance", () => {
  it("is pending when nothing has been remitted", () => {
    const v = evaluateCompensationVariance({ expectedAmount: 8_000, receivedAmount: null });
    expect(v.status).toBe("pending");
    expect(v.variance).toBeNull();
  });

  it("is pending — not a match — when a remittance has nothing to check against", () => {
    const v = evaluateCompensationVariance({ expectedAmount: null, receivedAmount: 8_000 });
    expect(v.status).toBe("pending");
    expect(v.message).toMatch(/no recorded expectation/i);
  });

  it("detects the short-pay the platform could not previously see", () => {
    // 25 bps short on a $400k loan at a 200 bps plan.
    const v = evaluateCompensationVariance({ expectedAmount: 8_000, receivedAmount: 7_000 });
    expect(v.status).toBe("short_paid");
    expect(v.variance).toBe(-1_000);
    expect(v.variancePct).toBe(-12.5);
  });

  it("flags an overpayment too — lenders claw those back", () => {
    const v = evaluateCompensationVariance({ expectedAmount: 8_000, receivedAmount: 8_500 });
    expect(v.status).toBe("over_paid");
    expect(v.variance).toBe(500);
  });

  it("tolerates rounding noise so real discrepancies stay visible", () => {
    const v = evaluateCompensationVariance({ expectedAmount: 8_000, receivedAmount: 8_000 - COMPENSATION_MATCH_TOLERANCE });
    expect(v.status).toBe("as_expected");
    const beyond = evaluateCompensationVariance({ expectedAmount: 8_000, receivedAmount: 7_998 });
    expect(beyond.status).toBe("short_paid");
  });

  it("accepts the string form Drizzle returns for decimal columns", () => {
    const v = evaluateCompensationVariance({ expectedAmount: "8000.00", receivedAmount: "7000.00" });
    expect(v.status).toBe("short_paid");
    expect(v.variance).toBe(-1_000);
  });
});

describe("F-6 — portfolio roll-up", () => {
  const book = [
    { status: "funded", fundedLoanAmount: "400000", compensationExpectedAmount: "8000", compensationReceivedAmount: "8000" },
    { status: "funded", fundedLoanAmount: "300000", compensationExpectedAmount: "6000", compensationReceivedAmount: "5000" },
    { status: "funded", fundedLoanAmount: "250000", compensationExpectedAmount: "5000", compensationReceivedAmount: null },
    { status: "denied" },
    { status: "withdrawn" },
    { status: "in_underwriting" },
    { status: "clear_to_close" },
  ];

  it("separates funded volume from pipeline noise", () => {
    const s = summarizeCompensation(book);
    expect(s.fundedCount).toBe(3);
    expect(s.fundedVolume).toBe(950_000);
    expect(s.inFlightCount).toBe(2);
    expect(s.deadCount).toBe(2);
  });

  it("computes pull-through over RESOLVED files only", () => {
    // 3 funded of 5 resolved — the 2 in-flight are not failures yet.
    expect(summarizeCompensation(book).pullThroughPct).toBe(60);
  });

  it("reports null pull-through rather than a fake zero with no resolved files", () => {
    expect(summarizeCompensation([{ status: "submitted" }]).pullThroughPct).toBeNull();
  });

  it("surfaces revenue actually collected against revenue expected", () => {
    const s = summarizeCompensation(book);
    expect(s.expectedCompensation).toBe(19_000);
    expect(s.receivedCompensation).toBe(13_000);
    expect(s.compensationVariance).toBe(-6_000);
    expect(s.shortPaidCount).toBe(1);
    // The $5,000 loan funded with no remittance is not silently counted as
    // earned — it is revenue we cannot confirm.
    expect(s.awaitingRemittanceCount).toBe(1);
  });

  it("handles an empty book without dividing by zero", () => {
    const s = summarizeCompensation([]);
    expect(s.fundedVolume).toBe(0);
    expect(s.pullThroughPct).toBeNull();
    expect(s.compensationVariance).toBe(0);
  });
});
