// F-0808-03 / F-0809-02 / F-0811-03 — revenue was modeled as lender
// compensation only, so the platform's own ~$2,000/file was income nowhere and
// a BORROWER-PAID file reported a negative margin.
// F-0811-05 / F-0809-03 — the comp ledger was blind to the compensation model,
// so every borrower-paid file read as a lender short-pay.
import { describe, it, expect } from "vitest";
import {
  platformFeeRevenue,
  expectedLenderRemittance,
  recognizeRevenue,
  PLATFORM_REVENUE_FEE_IDS,
} from "../shared/revenueRecognition";
import { evaluateCompensationVariance, summarizeCompensation } from "../shared/compensationLedger";

const fee = (id: string, amount: number) =>
  ({ id, label: id, amount, bucket: "zero" }) as const;

// A borrower-paid $400k file: the compensation IS the origination fee (F-1).
const BORROWER_PAID_FEES = [
  fee("origination_fee", 4000),
  fee("application_fee", 500),
  fee("underwriting_fee", 1500),
  fee("appraisal", 650),
  fee("credit_report", 75),
];
// A lender-paid file: Section A carries no origination fee.
const LENDER_PAID_FEES = [
  fee("origination_fee", 0),
  fee("application_fee", 500),
  fee("underwriting_fee", 1500),
  fee("appraisal", 650),
];

describe("platform-fee revenue is ours, and only ours", () => {
  it("counts Section A and excludes third-party pass-throughs", () => {
    // Appraisal and credit report are the borrower's money moving to a vendor.
    // Counting them would restate vendor spend as income.
    expect(platformFeeRevenue(BORROWER_PAID_FEES)).toBe(6000);
    expect(platformFeeRevenue(LENDER_PAID_FEES)).toBe(2000);
  });

  it("names the revenue lines explicitly so the set cannot drift", () => {
    expect([...PLATFORM_REVENUE_FEE_IDS].sort()).toEqual(
      ["application_fee", "origination_fee", "points", "underwriting_fee"],
    );
  });

  it("treats an absent disclosure as zero fees, and flags it as unknown", () => {
    expect(platformFeeRevenue(null)).toBe(0);
    const r = recognizeRevenue({ status: "funded", compensationReceivedAt: new Date(), disclosedFees: null });
    expect(r.platformFeesUnknown).toBe(true);
  });
});

describe("the remittance advice is the recognition trigger", () => {
  it("recognizes nothing before it arrives, and reports the pipeline", () => {
    const r = recognizeRevenue({
      status: "funded", compensationModel: "lender_paid",
      compensationReceivedAmount: 8000, compensationReceivedAt: null,
      disclosedFees: LENDER_PAID_FEES, simulated: false,
    });
    expect(r.recognized).toBe(false);
    expect(r.total).toBe(0);
    // Real revenue, not yet earned — visible without being counted.
    expect(r.unrecognizedPlatformFees).toBe(2000);
  });

  it("recognizes both channels once it does", () => {
    const r = recognizeRevenue({
      status: "funded", compensationModel: "lender_paid",
      compensationReceivedAmount: 8000, compensationReceivedAt: new Date(),
      disclosedFees: LENDER_PAID_FEES, simulated: false,
    });
    expect(r.platformFees).toBe(2000);
    expect(r.lenderCompensation).toBe(8000);
    expect(r.total).toBe(10_000);
  });

  it("recognizes nothing on a simulated funding, on either channel", () => {
    const r = recognizeRevenue({
      status: "funded", compensationReceivedAmount: 8000,
      compensationReceivedAt: new Date(), disclosedFees: LENDER_PAID_FEES, simulated: true,
    });
    expect(r.recognized).toBe(false);
    expect(r.total).toBe(0);
    expect(r.unrecognizedPlatformFees).toBe(0);
  });
});

describe("a borrower-paid file earns, and is not a short-pay", () => {
  it("reports revenue where it previously reported none", () => {
    const r = recognizeRevenue({
      status: "funded", compensationModel: "borrower_paid",
      compensationReceivedAmount: 0, compensationReceivedAt: new Date(),
      disclosedFees: BORROWER_PAID_FEES, simulated: false,
    });
    // The compensation is inside Section A, counted exactly once.
    expect(r.total).toBe(6000);
    expect(r.lenderCompensation).toBe(0);
  });

  it("expects ZERO lender remittance under a borrower-paid election", () => {
    expect(expectedLenderRemittance({ compensationModel: "borrower_paid", compensationExpectedAmount: 5000 })).toBe(0);
    expect(expectedLenderRemittance({ compensationModel: "lender_paid", compensationExpectedAmount: 8000 })).toBe(8000);
  });

  it("stops reading every borrower-paid file as a lender short-pay", () => {
    const v = evaluateCompensationVariance({
      expectedAmount: 5000, receivedAmount: 0, compensationModel: "borrower_paid",
    });
    expect(v.status).toBe("as_expected");
  });

  it("still catches a REAL lender short-pay", () => {
    const v = evaluateCompensationVariance({
      expectedAmount: 8000, receivedAmount: 6000, compensationModel: "lender_paid",
    });
    expect(v.status).toBe("short_paid");
    expect(v.variance).toBe(-2000);
  });

  it("carries the model through the portfolio roll-up", () => {
    const s = summarizeCompensation([
      { status: "funded", simulated: false, compensationModel: "borrower_paid",
        fundedLoanAmount: 400_000, compensationExpectedAmount: 5000, compensationReceivedAmount: 0 },
    ]);
    expect(s.shortPaidCount).toBe(0);
  });
});
