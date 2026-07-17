import { describe, expect, it } from "vitest";
import { addBusinessDays, subtractBusinessDays } from "../server/services/businessDays";
import { assessSixPieces, getTridStatus, tridHardStopError } from "../server/services/trid";
import type { LoanApplication, UrlaPersonalInfo } from "@shared/schema";

/**
 * TRID trigger + timing rules (Reg Z §1026.2(a)(3), §1026.19(e)(1)(iii)).
 *
 * The six-pieces assessment and the business-day clock are pure functions —
 * these tests pin the regulatory semantics: what counts as an application,
 * when the LE is due, and when the hard stop fires.
 */

function app(overrides: Partial<LoanApplication>): LoanApplication {
  return {
    annualIncome: "95000",
    incomeSources: null,
    propertyAddress: "123 Main St",
    propertyValue: null,
    purchasePrice: "400000",
    downPayment: "80000",
    preApprovalAmount: null,
    tridTriggeredAt: null,
    leIssuedDate: null,
    ...overrides,
  } as LoanApplication;
}

const withSsn = { ssn: "123-45-6789" } as UrlaPersonalInfo;

describe("Six pieces of information (§1026.2(a)(3))", () => {
  it("is complete with income, SSN, address, value, and derivable loan amount", () => {
    const result = assessSixPieces(app({}), withSsn);
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("names each missing item", () => {
    const result = assessSixPieces(
      app({ annualIncome: null, propertyAddress: null, purchasePrice: null, downPayment: null }),
      undefined,
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("income");
    expect(result.missing).toContain("ssn");
    expect(result.missing).toContain("property_address");
    expect(result.missing).toContain("estimated_property_value");
    expect(result.missing).toContain("loan_amount");
  });

  it("does not trigger without an SSN even when everything else is present", () => {
    const result = assessSixPieces(app({}), undefined);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(["ssn"]);
  });

  it("accepts a pre-approval amount as the loan amount", () => {
    const result = assessSixPieces(
      app({ purchasePrice: null, downPayment: null, propertyValue: "400000", preApprovalAmount: "320000" }),
      withSsn,
    );
    expect(result.complete).toBe(true);
  });
});

describe("Business-day math (weekends + federal holidays)", () => {
  it("skips the observed July 4th holiday", () => {
    // Wed 2026-07-01 + 3 business days: Thu 7/2 (1), Fri 7/3 is the observed
    // Independence Day holiday (7/4 falls on Saturday), weekend skipped,
    // Mon 7/6 (2), Tue 7/7 (3).
    const due = addBusinessDays(new Date("2026-07-01T12:00:00Z"), 3);
    expect(due.toISOString().split("T")[0]).toBe("2026-07-07");
  });

  it("plain week: Monday + 3 business days is Thursday", () => {
    const due = addBusinessDays(new Date("2026-06-08T12:00:00Z"), 3);
    expect(due.toISOString().split("T")[0]).toBe("2026-06-11");
  });

  it("subtracts across a weekend", () => {
    const start = subtractBusinessDays(new Date("2026-06-09T12:00:00Z"), 3);
    expect(start.toISOString().split("T")[0]).toBe("2026-06-04");
  });
});

describe("LE clock and hard stop (§1026.19(e)(1)(iii))", () => {
  const triggeredMonday = app({ tridTriggeredAt: new Date("2026-06-08T15:00:00Z") });

  it("is not overdue before the due date ends", () => {
    const status = getTridStatus(triggeredMonday, new Date("2026-06-11T12:00:00Z"));
    expect(status.leDueDate!.toISOString().split("T")[0]).toBe("2026-06-11");
    expect(status.leOverdue).toBe(false);
  });

  it("is overdue the day after the due date without issuance", () => {
    const status = getTridStatus(triggeredMonday, new Date("2026-06-12T12:00:00Z"));
    expect(status.leOverdue).toBe(true);
  });

  it("issuing the LE clears the overdue state", () => {
    const issued = app({
      tridTriggeredAt: new Date("2026-06-08T15:00:00Z"),
      leIssuedDate: "2026-06-10",
    });
    const status = getTridStatus(issued, new Date("2026-06-20T12:00:00Z"));
    expect(status.leIssued).toBe(true);
    expect(status.leOverdue).toBe(false);
  });

  it("does not run before the six pieces are collected", () => {
    const status = getTridStatus(app({}), new Date("2026-06-12T12:00:00Z"));
    expect(status.triggered).toBe(false);
    expect(status.leOverdue).toBe(false);
  });

  it("hard stop blocks forward movement when the LE is overdue", () => {
    const err = tridHardStopError(triggeredMonday, "underwriting", new Date("2026-06-15T12:00:00Z"));
    expect(err).toMatch(/1026\.19/);
  });

  it("hard stop never blocks exit dispositions", () => {
    // Every non-consummation ending plus the pause — expiring an LE-overdue
    // pre-approval must be possible (the old hand list omitted "expired").
    for (const exit of ["denied", "withdrawn", "expired", "suspended"]) {
      expect(tridHardStopError(triggeredMonday, exit, new Date("2026-06-15T12:00:00Z"))).toBeNull();
    }
  });

  it("hard stop still gates consummation — funded is not an exit", () => {
    for (const advance of ["funded", "closing", "clear_to_close"]) {
      expect(
        tridHardStopError(triggeredMonday, advance, new Date("2026-06-15T12:00:00Z")),
        `${advance} must be blocked while the LE is overdue`,
      ).toMatch(/1026\.19/);
    }
  });

  it("hard stop is silent while the file is within the window", () => {
    expect(tridHardStopError(triggeredMonday, "underwriting", new Date("2026-06-10T12:00:00Z"))).toBeNull();
  });
});
