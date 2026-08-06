import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBusinessDays, subtractBusinessDays } from "../server/services/businessDays";
import type { LoanApplication, UrlaPersonalInfo, UrlaPropertyInfo } from "@shared/schema";

// In-memory double for evaluateTridTrigger's storage calls — evaluateTridTrigger
// (unlike the pure functions above) is I/O-bearing, so it needs a real exercise
// against a mocked storage, not just a source-grep (that grep-only gap is what
// let intake-01 ship: the /save route never called this function, and nothing
// caught it).
const h = vi.hoisted(() => ({
  application: null as (LoanApplication & { id: string }) | null,
  personalInfo: undefined as UrlaPersonalInfo | undefined,
  activities: [] as any[],
  notifications: [] as any[],
}));

vi.mock("../server/storage", () => ({
  storage: {
    getLoanApplication: async (_id: string) => h.application,
    getUrlaPersonalInfo: async (_id: string) => h.personalInfo,
    getUrlaPropertyInfo: async (_id: string) => undefined,
    updateLoanApplication: async (_id: string, patch: any) => {
      h.application = { ...(h.application as any), ...patch };
      return h.application;
    },
    createDealActivity: async (data: any) => {
      h.activities.push(data);
      return data;
    },
    createNotification: async (data: any) => {
      h.notifications.push(data);
      return data;
    },
  },
}));

import { assessSixPieces, getTridStatus, tridHardStopError, evaluateTridTrigger } from "../server/services/trid";

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

  // 2026-08-05 pre-flight blind spot: an address or value supplied only on
  // the URLA property record must count — under-counting starts the LE clock
  // late (the violation direction), over-counting is merely conservative.
  it("counts an address that exists only on the URLA property record", () => {
    const result = assessSixPieces(
      app({ propertyAddress: null }),
      withSsn,
      { propertyStreet: "456 Ordering Probe Ave" } as UrlaPropertyInfo,
    );
    expect(result.complete).toBe(true);
  });

  it("counts an estimated value that exists only on the URLA property record", () => {
    const result = assessSixPieces(
      app({ propertyValue: null, purchasePrice: null, downPayment: null, preApprovalAmount: "320000" }),
      withSsn,
      { propertyValue: "410000" } as UrlaPropertyInfo,
    );
    expect(result.complete).toBe(true);
  });

  it("still reports the address missing when neither source has one", () => {
    const result = assessSixPieces(
      app({ propertyAddress: null }),
      withSsn,
      { propertyStreet: null } as UrlaPropertyInfo,
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(["property_address"]);
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

describe("evaluateTridTrigger — the I/O-bearing function that actually sets tridTriggeredAt", () => {
  beforeEach(() => {
    h.application = null;
    h.personalInfo = undefined;
    h.activities = [];
    h.notifications = [];
  });

  it("does not write when a piece is still missing", async () => {
    h.application = { ...app({}), id: "app-1" } as any;
    h.personalInfo = undefined; // no SSN yet

    const result = await evaluateTridTrigger("app-1");

    expect(result.triggered).toBe(false);
    expect(result.justTriggered).toBe(false);
    expect(result.missing).toContain("ssn");
    expect(h.application!.tridTriggeredAt).toBeNull();
    expect(h.activities).toHaveLength(0);
    expect(h.notifications).toHaveLength(0);
  });

  it("sets tridTriggeredAt, logs a compliance activity, and notifies the assigned LO on first completion", async () => {
    h.application = { ...app({}), id: "app-2", loanOfficerId: "lo-1" } as any;
    h.personalInfo = withSsn;

    const result = await evaluateTridTrigger("app-2");

    expect(result.triggered).toBe(true);
    expect(result.justTriggered).toBe(true);
    expect(result.tridTriggeredAt).not.toBeNull();
    expect(h.application!.tridTriggeredAt).not.toBeNull();
    expect(h.activities).toHaveLength(1);
    expect(h.activities[0].activityType).toBe("compliance_event");
    expect(h.notifications).toHaveLength(1);
    expect(h.notifications[0].userId).toBe("lo-1");
  });

  it("is idempotent — a second call is a no-op that reports the original trigger time", async () => {
    h.application = { ...app({}), id: "app-3" } as any;
    h.personalInfo = withSsn;

    const first = await evaluateTridTrigger("app-3");
    expect(first.justTriggered).toBe(true);
    expect(h.activities).toHaveLength(1);

    const second = await evaluateTridTrigger("app-3");
    expect(second.triggered).toBe(true);
    expect(second.justTriggered).toBe(false);
    expect(second.tridTriggeredAt).toEqual(first.tridTriggeredAt);
    // No duplicate activity/notification on the repeat call.
    expect(h.activities).toHaveLength(1);
    expect(h.notifications).toHaveLength(0);
  });

  it("regression guard for intake-01: reproduces the URLA /save write order — application already has income/address/value/amount, SSN arrives via getUrlaPersonalInfo the same way the /save handler's personalInfo write feeds it", async () => {
    // This mirrors the real shape: application intake creates the file with
    // the first five pieces already known, and the SSN is supplied later
    // through urla.ts's writeBorrowerSections -> storage.upsertUrlaPersonalInfo,
    // which is exactly what getUrlaPersonalInfo reads back here.
    h.application = {
      ...app({}),
      id: "app-4",
      loanOfficerId: "lo-2",
      tridTriggeredAt: null,
    } as any;
    h.personalInfo = undefined;

    const beforeSsn = await evaluateTridTrigger("app-4");
    expect(beforeSsn.triggered).toBe(false);

    // The primary borrower's personal-info write lands...
    h.personalInfo = withSsn;
    // ...and urla.ts now calls evaluateTridTrigger right after that write.
    const afterSsn = await evaluateTridTrigger("app-4");

    expect(afterSsn.triggered).toBe(true);
    expect(afterSsn.justTriggered).toBe(true);
    expect(h.application!.tridTriggeredAt).not.toBeNull();
  });
});
