import { describe, it, expect } from "vitest";
import {
  statusRequiresLoanAmount,
  positiveAmount,
  coherentLoanAmount,
  checkStageRequirements,
  assertStageRequirements,
  AMOUNT_BEARING_STATUSES,
} from "@shared/stageRequirements";

describe("stageRequirements: statusRequiresLoanAmount", () => {
  it("requires an amount for credit-decision statuses", () => {
    for (const status of [
      "pre_approved",
      "approved",
      "underwriting",
      "conditional",
      "conditional_approval",
      "clear_to_close",
      "closing",
      "funded",
    ]) {
      expect(statusRequiresLoanAmount(status)).toBe(true);
    }
  });

  it("does not require an amount for pre-decision or terminal statuses", () => {
    for (const status of ["draft", "submitted", "analyzing", "in_review", "denied", "withdrawn", "expired"]) {
      expect(statusRequiresLoanAmount(status)).toBe(false);
    }
  });

  it("treats null/undefined/empty status as not requiring an amount", () => {
    expect(statusRequiresLoanAmount(null)).toBe(false);
    expect(statusRequiresLoanAmount(undefined)).toBe(false);
    expect(statusRequiresLoanAmount("")).toBe(false);
  });
});

describe("stageRequirements: positiveAmount", () => {
  it("parses positive decimal strings and numbers", () => {
    expect(positiveAmount("160000")).toBe(160000);
    expect(positiveAmount("160000.50")).toBe(160000.5);
    expect(positiveAmount(250000)).toBe(250000);
  });

  it("returns 0 for zero, negative, empty, null, and non-numeric", () => {
    expect(positiveAmount("0")).toBe(0);
    expect(positiveAmount(0)).toBe(0);
    expect(positiveAmount("-5")).toBe(0);
    expect(positiveAmount(-5)).toBe(0);
    expect(positiveAmount("")).toBe(0);
    expect(positiveAmount(null)).toBe(0);
    expect(positiveAmount(undefined)).toBe(0);
    expect(positiveAmount("abc")).toBe(0);
    expect(positiveAmount(NaN)).toBe(0);
  });
});

describe("stageRequirements: coherentLoanAmount", () => {
  it("prefers purchase price when present", () => {
    expect(coherentLoanAmount({ purchasePrice: "300000", preApprovalAmount: "250000" })).toBe(300000);
  });

  it("falls back to pre-approval amount before a property is chosen", () => {
    expect(coherentLoanAmount({ purchasePrice: null, preApprovalAmount: "250000" })).toBe(250000);
    expect(coherentLoanAmount({ purchasePrice: "0", preApprovalAmount: "250000" })).toBe(250000);
  });

  it("is zero when neither is a positive amount", () => {
    expect(coherentLoanAmount({ purchasePrice: null, preApprovalAmount: "0" })).toBe(0);
    expect(coherentLoanAmount({})).toBe(0);
  });
});

describe("stageRequirements: checkStageRequirements", () => {
  it("flags an amount-bearing status with no amount", () => {
    const result = checkStageRequirements({ status: "pre_approved", preApprovalAmount: "0", purchasePrice: null });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("loanAmount");
  });

  it("passes an amount-bearing status that has an amount", () => {
    expect(checkStageRequirements({ status: "pre_approved", preApprovalAmount: "250000" }).ok).toBe(true);
    expect(checkStageRequirements({ status: "funded", purchasePrice: "300000" }).ok).toBe(true);
  });

  it("passes any pre-decision status regardless of amount", () => {
    expect(checkStageRequirements({ status: "submitted", preApprovalAmount: null }).ok).toBe(true);
    expect(checkStageRequirements({ status: "draft" }).ok).toBe(true);
  });
});

describe("stageRequirements: assertStageRequirements", () => {
  it("throws for a $0 pre-approval and names the missing field", () => {
    expect(() =>
      assertStageRequirements({ status: "pre_approved", preApprovalAmount: "0" }, "unit test"),
    ).toThrowError(/pre_approved.*loanAmount/s);
  });

  it("does not throw when the amount is present", () => {
    expect(() =>
      assertStageRequirements({ status: "pre_approved", preApprovalAmount: "250000" }, "unit test"),
    ).not.toThrow();
  });

  it("does not throw for pre-decision statuses", () => {
    expect(() => assertStageRequirements({ status: "analyzing" }, "unit test")).not.toThrow();
  });
});

describe("stageRequirements: AMOUNT_BEARING_STATUSES", () => {
  it("covers both pipeline and staff-enum naming for conditional approval", () => {
    expect(AMOUNT_BEARING_STATUSES.has("conditional")).toBe(true);
    expect(AMOUNT_BEARING_STATUSES.has("conditional_approval")).toBe(true);
  });
});
