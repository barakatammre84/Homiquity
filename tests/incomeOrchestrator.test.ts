import { describe, it, expect } from "vitest";
import {
  computeIncomePaths,
  incomeInputsFingerprint,
  incomeEvaluationFingerprint,
  type IncomePathsCoreInput,
} from "../server/services/income/orchestrator";
import { computeAgencyWageIncome } from "../server/services/income/paths/agencyWage";
import { computeSelfEmploymentPath } from "../server/services/income/paths/selfEmployment";
import { computeRentalPath } from "../server/services/income/paths/rental";
import { incomePathsSchema } from "../shared/incomePaths";
import type { EmploymentHistory, OtherIncomeSource, SelfEmploymentWorksheet } from "@shared/schema";

/**
 * Unit tests for the multi-path income orchestrator (UAL P3): the pure path
 * modules, the ranking/primary-income core, and the reproducibility
 * fingerprints. Pure in-process — no HTTP server, no database.
 *
 * The CUTOVER PARITY guarantee — that wage-only decisions are unchanged by the
 * orchestrator — is proven in incomeCutoverParity.test.ts against a frozen
 * copy of the legacy aggregation logic.
 */

// Minimal EmploymentHistory factory (only the fields the paths read).
function emp(over: Partial<EmploymentHistory>): EmploymentHistory {
  return {
    id: "e", applicationId: "a", borrowerSequenceNumber: 1, employerName: null,
    employmentType: "salaried", isSelfEmployed: false, startDate: null, endDate: null,
    baseIncome: null, overtimeIncome: null, bonusIncome: null, commissionIncome: null,
    otherIncome: null, totalMonthlyIncome: null, selfEmploymentIncome: null,
    ...over,
  } as unknown as EmploymentHistory;
}
function other(monthlyAmount: number | string, incomeSource = "rental"): OtherIncomeSource {
  return { id: "o", applicationId: "a", incomeSource, monthlyAmount } as unknown as OtherIncomeSource;
}

const scheduleCWorksheet = (net: number, prior: number): SelfEmploymentWorksheet =>
  ({
    businessStructure: "sole_proprietorship",
    scheduleC: {
      currentYear: { year: 2025, netProfitOrLoss: net, depreciation: 3000, depletion: 0, amortizationOrCasualtyLoss: 0, businessUseOfHome: 1200, mealsExclusion: 0, nonRecurringIncome: 0 },
      priorYear: { year: 2024, netProfitOrLoss: prior, depreciation: 2800, depletion: 0, amortizationOrCasualtyLoss: 0, businessUseOfHome: 1000, mealsExclusion: 0, nonRecurringIncome: 0 },
    },
  }) as unknown as SelfEmploymentWorksheet;

describe("agency wage path", () => {
  it("uses itemized fields when present (base vs variable split)", () => {
    const r = computeAgencyWageIncome({
      employment: [emp({ baseIncome: 5000, overtimeIncome: 500, bonusIncome: 300 })],
      otherIncome: [],
    });
    expect(r.baseMonthlyIncome).toBe(5000);
    expect(r.variableMonthlyIncome).toBe(800);
    expect(r.path.monthlyQualifyingIncome).toBe(5800);
    expect(r.path.status).toBe("applicable");
  });

  it("falls back to rolled-up total when no itemized field is present", () => {
    const r = computeAgencyWageIncome({ employment: [emp({ totalMonthlyIncome: 4200 })], otherIncome: [] });
    expect(r.baseMonthlyIncome).toBe(4200);
    expect(r.variableMonthlyIncome).toBe(0);
  });

  it("skips self-employed records (they belong to the SE path)", () => {
    const r = computeAgencyWageIncome({
      employment: [emp({ isSelfEmployed: true, totalMonthlyIncome: 9000 })],
      otherIncome: [],
    });
    expect(r.path.monthlyQualifyingIncome).toBe(0);
    expect(r.usedLineItems).toBe(false);
  });

  it("preserves a net-loss itemized total (no > 0 guard deleting losses)", () => {
    const r = computeAgencyWageIncome({ employment: [emp({ baseIncome: -1500 })], otherIncome: [] });
    expect(r.baseMonthlyIncome).toBe(-1500);
    expect(r.usedLineItems).toBe(true);
  });

  it("falls back to the application-summary annual income only when nothing else exists", () => {
    const r = computeAgencyWageIncome({ employment: [], otherIncome: [], fallbackAnnualIncome: 96000 });
    expect(r.baseMonthlyIncome).toBe(8000);
    expect(r.usedLineItems).toBe(false);
  });
});

describe("self-employment path", () => {
  it("routes SE jobs through the Form 1084 calculator and aggregates", () => {
    const r = computeSelfEmploymentPath([
      emp({ isSelfEmployed: true, selfEmploymentIncome: scheduleCWorksheet(60000, 54000) }),
    ]);
    expect(r.path.status).toBe("applicable");
    expect(r.path.monthlyQualifyingIncome).toBeGreaterThan(0);
    expect(r.path.citations[0].section).toMatch(/1084/);
  });

  it("contributes $0 and flags review for an SE job with no worksheet", () => {
    const r = computeSelfEmploymentPath([emp({ isSelfEmployed: true })]);
    expect(r.path.monthlyQualifyingIncome).toBe(0);
    expect(r.path.requiresManualReview).toBe(true);
    expect(r.path.notes.some((n) => /no completed income worksheet/i.test(n))).toBe(true);
  });
});

describe("rental path", () => {
  it("computes the net offset but does NOT apply it to DTI (advisory)", () => {
    const r = computeRentalPath([
      { address: "1 Main", monthlyRentalIncome: 2000, monthlyDebtPayment: 1200 } as never,
    ]);
    expect(r.status).toBe("applicable");
    expect(r.appliedToDti).toBe(false);
    // 75% of 2000 = 1500, net of 1200 PITIA = 300
    expect(r.monthlyQualifyingIncome).toBe(300);
  });
});

describe("orchestrator core", () => {
  const input: IncomePathsCoreInput = {
    employment: [
      emp({ baseIncome: 6000, bonusIncome: 500 }),
      emp({ isSelfEmployed: true, selfEmploymentIncome: scheduleCWorksheet(48000, 45000) }),
    ],
    otherIncome: [other(400)],
    rentalProperties: [{ address: "2 Oak", monthlyRentalIncome: 1800, monthlyDebtPayment: 1000 } as never],
  };

  it("stacks agency + SE into the primary DTI income; rental stays advisory", () => {
    const r = computeIncomePaths(input);
    const agency = r.primaryBreakdown.agencyBase + r.primaryBreakdown.agencyVariable;
    expect(agency).toBe(6900); // 6000 base + (500 bonus + 400 other)
    expect(r.primaryBreakdown.selfEmployment).toBeGreaterThan(0);
    expect(r.primaryMonthlyQualifyingIncome).toBe(agency + r.primaryBreakdown.selfEmployment);
    // rental offset present but not summed in
    expect(r.primaryBreakdown.rental).toBe(0);
    expect(r.paths.find((p) => p.pathId === "rental")!.status).toBe("applicable");
  });

  it("gates DSCR and bank-statement paths (P4) — surfaced, no figure", () => {
    const r = computeIncomePaths(input);
    const dscr = r.paths.find((p) => p.pathId === "dscr")!;
    const bank = r.paths.find((p) => p.pathId === "bank_statement")!;
    expect(dscr.status).toBe("unavailable");
    expect(dscr.unavailableReason).toBe("PROGRAM_REFERENCE_NOT_IN_REPO");
    expect(bank.status).toBe("unavailable");
    // No alternative is enabled, so no recommendation overrides full-doc.
    expect(r.recommendedPathId).toBeNull();
  });

  it("emits a schema-valid path set", () => {
    const r = computeIncomePaths(input);
    expect(() => incomePathsSchema.parse(r.paths)).not.toThrow();
  });

  it("is deterministic: same inputs → same fingerprints", () => {
    const a = computeIncomePaths(input);
    const b = computeIncomePaths(input);
    expect(incomeEvaluationFingerprint(a)).toBe(incomeEvaluationFingerprint(b));
    expect(incomeInputsFingerprint(input)).toBe(incomeInputsFingerprint(input));
    expect(incomeInputsFingerprint(input)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the inputs fingerprint when an income figure changes", () => {
    const base = incomeInputsFingerprint(input);
    const mutated: IncomePathsCoreInput = {
      ...input,
      employment: [emp({ baseIncome: 6001 }), input.employment[1]],
    };
    expect(incomeInputsFingerprint(mutated)).not.toBe(base);
  });

  it("reports application_summary basis only on the annual-income fallback", () => {
    expect(computeIncomePaths({ employment: [], otherIncome: [], rentalProperties: [], fallbackAnnualIncome: 60000 }).incomeBasis).toBe("application_summary");
    expect(computeIncomePaths(input).incomeBasis).toBe("urla_line_items");
  });
});
