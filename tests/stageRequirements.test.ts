import { describe, it, expect } from "vitest";
import {
  statusRequiresLoanAmount,
  positiveAmount,
  coherentLoanAmount,
  checkStageRequirements,
  assertStageRequirements,
  AMOUNT_BEARING_STATUSES,
  COMMITTED_STATUSES,
  isCommittedStage,
} from "@shared/stageRequirements";
import { LOAN_APP_STATUSES, LOAN_APP_APPROVED_GRADE_STATUSES } from "@shared/schema";

describe("stageRequirements: statusRequiresLoanAmount", () => {
  it("requires an amount for credit-decision statuses", () => {
    for (const status of [
      "pre_approved",
      "underwriting",
      "conditional",
      "clear_to_close",
      "closing",
      "funded",
    ]) {
      expect(statusRequiresLoanAmount(status)).toBe(true);
    }
  });

  it("does not require an amount for pre-decision or terminal statuses", () => {
    for (const status of ["draft", "submitted", "analyzing", "under_review", "denied", "withdrawn", "expired"]) {
      expect(statusRequiresLoanAmount(status)).toBe(false);
    }
  });

  it("does not match legacy statuses the vocabulary migration erased", () => {
    // "approved" → clear_to_close and "conditional_approval" → conditional
    // (scripts/migrate-status-vocabulary.ts); no row or writer can produce
    // them, so keeping them in the set would only mask a phantom write.
    for (const legacy of ["approved", "conditional_approval", "in_review"]) {
      expect(statusRequiresLoanAmount(legacy)).toBe(false);
      expect(isCommittedStage(legacy)).toBe(false);
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

describe("stageRequirements: reconciliation with the canonical vocabulary", () => {
  // stageRequirements stays import-free on purpose (purity), so these sets are
  // hand-listed there — this suite is what keeps them from drifting away from
  // shared/schema/lendingCore.ts (the old list carried "approved" and
  // "conditional_approval", legacy statuses the migration erased).
  it("every member of both sets is a canonical status", () => {
    const canonical = new Set<string>(LOAN_APP_STATUSES);
    for (const s of AMOUNT_BEARING_STATUSES) {
      expect(canonical.has(s), `AMOUNT_BEARING member "${s}" is not canonical`).toBe(true);
    }
    for (const s of COMMITTED_STATUSES) {
      expect(canonical.has(s), `COMMITTED member "${s}" is not canonical`).toBe(true);
    }
  });

  it("COMMITTED_STATUSES is set-equal to LOAN_APP_APPROVED_GRADE_STATUSES", () => {
    expect([...COMMITTED_STATUSES].sort()).toEqual([...LOAN_APP_APPROVED_GRADE_STATUSES].sort());
  });

  it("AMOUNT_BEARING_STATUSES is the approved grade minus the amount-less processing stages", () => {
    // doc_collection/processing are reachable without an amount via
    // under_review → doc_collection, so they belong in COMMITTED but must not
    // demand an amount.
    const expected = LOAN_APP_APPROVED_GRADE_STATUSES.filter(
      (s) => s !== "doc_collection" && s !== "processing",
    );
    expect([...AMOUNT_BEARING_STATUSES].sort()).toEqual([...expected].sort());
  });
});

describe("stageRequirements: isCommittedStage", () => {
  it("is true from pre-approval onward, including processing sub-stages", () => {
    for (const status of [
      "pre_approved",
      "doc_collection",
      "processing",
      "underwriting",
      "conditional",
      "clear_to_close",
      "closing",
      "funded",
    ]) {
      expect(isCommittedStage(status)).toBe(true);
    }
  });

  it("is false before pre-approval and for terminal/empty statuses", () => {
    for (const status of ["lead", "draft", "submitted", "analyzing", "under_review", "denied", "withdrawn", "expired"]) {
      expect(isCommittedStage(status)).toBe(false);
    }
    expect(isCommittedStage(null)).toBe(false);
    expect(isCommittedStage(undefined)).toBe(false);
  });

  it("is a superset of every amount-bearing status", () => {
    for (const s of AMOUNT_BEARING_STATUSES) {
      expect(COMMITTED_STATUSES.has(s)).toBe(true);
    }
  });
});
