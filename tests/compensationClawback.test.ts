// Audit finding F-8 — early-payoff (EPO) compensation clawback exposure.
//
// Every wholesale broker agreement lets the lender reclaim its compensation if
// the loan pays off inside a stated window. Nothing in the platform
// represented that: for an asset-light broker it is the largest contingent
// liability on the balance sheet, and it was invisible.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_EPO_CLAWBACK_DAYS,
  buildClawbackRegister,
  clawbackWindowFor,
  evaluateClawbackExposure,
  isWithinClawbackWindow,
} from "../shared/compensationClawback";

const NOW = new Date("2026-08-04T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

describe("F-8 — clawback window resolution", () => {
  it("falls back to the platform assumption when no agreement carries a term", () => {
    // No lender has an executed agreement yet, so every window is assumed.
    const window = clawbackWindowFor(undefined);
    expect(window.days).toBe(DEFAULT_EPO_CLAWBACK_DAYS);
    expect(window.source).toBe("assumed");
  });

  it("falls back for an unknown lender id rather than throwing", () => {
    expect(clawbackWindowFor(null).source).toBe("assumed");
    expect(clawbackWindowFor(90)).toEqual({ days: 90, source: "contracted" });
  });
});

describe("F-8 — per-loan exposure", () => {
  it("has no exposure before funding — nothing has been paid yet", () => {
    const e = evaluateClawbackExposure(
      { lenderId: "uwm", fundedAt: null, compensationReceivedAmount: 8_000 },
      NOW,
    );
    expect(e.atRisk).toBe(false);
    expect(e.amountAtRisk).toBe(0);
  });

  it("puts the full commission at risk inside the window", () => {
    const e = evaluateClawbackExposure(
      { lenderId: "uwm", fundedAt: daysAgo(30), compensationReceivedAmount: 8_000 },
      NOW,
    );
    expect(e.atRisk).toBe(true);
    expect(e.amountAtRisk).toBe(8_000);
    expect(e.daysRemaining).toBe(DEFAULT_EPO_CLAWBACK_DAYS - 30);
    expect(e.window.source).toBe("assumed");
  });

  it("releases the exposure once the window closes", () => {
    const e = evaluateClawbackExposure(
      { lenderId: "uwm", fundedAt: daysAgo(DEFAULT_EPO_CLAWBACK_DAYS + 1), compensationReceivedAmount: 8_000 },
      NOW,
    );
    expect(e.atRisk).toBe(false);
    expect(e.amountAtRisk).toBe(0);
    expect(e.message).toMatch(/earned/);
  });

  it("is still at risk — but indeterminate — with no remittance recorded", () => {
    const e = evaluateClawbackExposure(
      { lenderId: "uwm", fundedAt: daysAgo(30), compensationReceivedAmount: null },
      NOW,
    );
    expect(e.atRisk).toBe(true);
    expect(e.indeterminate).toBe(true);
    // An unknown must not be summed into a reserve as if it were zero without
    // being counted somewhere — that is what indeterminateCount is for.
    expect(e.amountAtRisk).toBe(0);
  });

  it("accepts the string forms Drizzle returns", () => {
    const e = evaluateClawbackExposure(
      { lenderId: "uwm", fundedAt: daysAgo(10).toISOString(), compensationReceivedAmount: "9500.50" },
      NOW,
    );
    expect(e.amountAtRisk).toBe(9_500.5);
  });
});

describe("F-8 — the refi self-harm guard", () => {
  it("reports a recently funded loan as inside its window", () => {
    // This is the interaction the audit flagged: lifecycleEngine raises a refi
    // alert at 25bps of improvement. Pointed at our own six-week-old loan it
    // solicits the payoff that costs us the entire commission.
    expect(isWithinClawbackWindow({ lenderId: "uwm", fundedAt: daysAgo(42) }, NOW)).toBe(true);
  });

  it("clears a seasoned loan for refi solicitation", () => {
    expect(isWithinClawbackWindow({ lenderId: "uwm", fundedAt: daysAgo(400) }, NOW)).toBe(false);
  });

  it("does not depend on knowing the amount", () => {
    // The guard must work before any remittance is recorded.
    expect(isWithinClawbackWindow({ lenderId: "uwm", fundedAt: daysAgo(1) }, NOW)).toBe(true);
  });
});

describe("F-8 — the exposure register", () => {
  const book = [
    { submissionId: "s1", status: "funded", lenderId: "uwm", fundedAt: daysAgo(10), compensationReceivedAmount: "8000" },
    { submissionId: "s2", status: "funded", lenderId: "uwm", fundedAt: daysAgo(60), compensationReceivedAmount: "11000" },
    { submissionId: "s3", status: "funded", lenderId: "uwm", fundedAt: daysAgo(400), compensationReceivedAmount: "9000" },
    { submissionId: "s4", status: "funded", lenderId: "uwm", fundedAt: daysAgo(5), compensationReceivedAmount: null },
    { submissionId: "s5", status: "in_underwriting", lenderId: "uwm", fundedAt: null, compensationReceivedAmount: null },
  ];

  it("counts only funded loans still inside their window", () => {
    const r = buildClawbackRegister(book, NOW);
    expect(r.atRiskCount).toBe(3); // s1, s2, s4 — not the seasoned s3 or unfunded s5
  });

  it("totals the reclaimable dollars — the reserve figure", () => {
    expect(buildClawbackRegister(book, NOW).totalAtRisk).toBe(19_000);
  });

  it("counts loans whose exposure cannot be quantified", () => {
    expect(buildClawbackRegister(book, NOW).indeterminateCount).toBe(1);
  });

  it("flags that the register rests on an assumed window, not a contract", () => {
    // No signed agreement carries a term yet, so no reserve figure derived
    // from this may be treated as contractual.
    expect(buildClawbackRegister(book, NOW).usesAssumedWindow).toBe(true);
  });

  it("reports the soonest window expiry", () => {
    const r = buildClawbackRegister(book, NOW);
    // s2 funded 60 days ago expires first.
    const expected = new Date(daysAgo(60).getTime() + DEFAULT_EPO_CLAWBACK_DAYS * 24 * 3600 * 1000);
    expect(r.nextExpiry?.toISOString()).toBe(expected.toISOString());
  });

  it("handles an empty book", () => {
    const r = buildClawbackRegister([], NOW);
    expect(r.atRiskCount).toBe(0);
    expect(r.totalAtRisk).toBe(0);
    expect(r.nextExpiry).toBeNull();
    expect(r.usesAssumedWindow).toBe(false);
  });
});
