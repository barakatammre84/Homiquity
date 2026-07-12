import { describe, it, expect } from "vitest";
import { computeIncomePaths } from "../server/services/income/orchestrator";
import type { EmploymentHistory, OtherIncomeSource } from "@shared/schema";

/**
 * P3 cutover parity guarantee (UAL P3): the multi-path orchestrator's primary
 * income must EQUAL the legacy decisionEngine.aggregateBorrowerFinancials wage
 * math for every WAGE-ONLY (non self-employed) file — i.e. the change is
 * invisible to wage-earner decisions. Self-employed files legitimately differ
 * (the cutover routes them through the Form 1084 calculator, the intended fix),
 * so they are excluded from this parity set and covered by the orchestrator
 * tests instead.
 *
 * The legacy logic is frozen here verbatim (from the pre-cutover
 * aggregateBorrowerFinancials income block) as the reference oracle. Pure
 * in-process — no HTTP server, no database.
 */

// ---- Frozen copy of the legacy wage aggregation (pre-P3) --------------------
// Uses the SAME robust parser the real decisionEngine used (toNumber): comma/$
// stripping + accounting-format parenthesized negatives. The oracle must mirror
// the actual legacy behavior, not a naive parseFloat.
function toNumber(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim().replace(/[,$\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  const n = parseFloat(s);
  if (isNaN(n)) return NaN;
  return negative ? -n : n;
}
function safe(v: unknown): number {
  const n = toNumber(v);
  return isNaN(n) ? 0 : n;
}
function isPresentNumber(v: unknown): boolean {
  if (v === null || v === undefined || String(v).trim() === "") return false;
  return !isNaN(toNumber(v));
}
function legacyAggregate(
  employment: EmploymentHistory[],
  otherIncome: OtherIncomeSource[],
  annualIncome: number | string | null,
): { base: number; variable: number; total: number; basis: string } {
  let base = 0;
  let variable = 0;
  let sawIncomeLineItem = false;
  for (const e of employment) {
    const itemized = [e.baseIncome, e.overtimeIncome, e.bonusIncome, e.commissionIncome, e.otherIncome];
    if (itemized.some(isPresentNumber)) {
      base += safe(e.baseIncome);
      variable += safe(e.overtimeIncome) + safe(e.bonusIncome) + safe(e.commissionIncome) + safe(e.otherIncome);
      sawIncomeLineItem = true;
    } else if (isPresentNumber(e.totalMonthlyIncome)) {
      base += safe(e.totalMonthlyIncome);
      sawIncomeLineItem = true;
    }
  }
  for (const o of otherIncome) {
    if (isPresentNumber(o.monthlyAmount)) {
      variable += safe(o.monthlyAmount);
      sawIncomeLineItem = true;
    }
  }
  if (!sawIncomeLineItem) {
    base = safe(annualIncome) / 12;
    variable = 0;
  }
  return {
    base,
    variable,
    total: base + variable,
    basis: sawIncomeLineItem ? "urla_line_items" : "application_summary",
  };
}

function emp(over: Partial<EmploymentHistory>): EmploymentHistory {
  return {
    id: "e", applicationId: "a", borrowerSequenceNumber: 1, employmentType: "salaried",
    isSelfEmployed: false, startDate: null, baseIncome: null, overtimeIncome: null,
    bonusIncome: null, commissionIncome: null, otherIncome: null, totalMonthlyIncome: null,
    selfEmploymentIncome: null,
    ...over,
  } as unknown as EmploymentHistory;
}
function other(monthlyAmount: number | string): OtherIncomeSource {
  return { id: "o", applicationId: "a", incomeSource: "other", monthlyAmount } as unknown as OtherIncomeSource;
}

interface Fixture {
  name: string;
  employment: EmploymentHistory[];
  otherIncome: OtherIncomeSource[];
  annualIncome: number | string | null;
}

const WAGE_ONLY_FIXTURES: Fixture[] = [
  { name: "single itemized salaried", employment: [emp({ baseIncome: 6000, overtimeIncome: 250, bonusIncome: 400 })], otherIncome: [], annualIncome: null },
  { name: "rolled-up total only", employment: [emp({ totalMonthlyIncome: 4800 })], otherIncome: [], annualIncome: null },
  { name: "mixed itemized + total across borrowers", employment: [emp({ baseIncome: 5200, commissionIncome: 900 }), emp({ borrowerSequenceNumber: 2, totalMonthlyIncome: 3100 })], otherIncome: [], annualIncome: null },
  { name: "with other-income sources", employment: [emp({ baseIncome: 5000 })], otherIncome: [other(600), other("450.50")], annualIncome: null },
  { name: "string numeric fields", employment: [emp({ baseIncome: "5500", bonusIncome: "300" } as never)], otherIncome: [], annualIncome: null },
  { name: "net-loss itemized (K-1 loss captured as base)", employment: [emp({ baseIncome: -2000 })], otherIncome: [], annualIncome: null },
  { name: "accounting-format negative rolled-up total ('(21,400)')", employment: [emp({ baseIncome: "18500" } as never), emp({ totalMonthlyIncome: "(21,400)" } as never)], otherIncome: [], annualIncome: null },
  { name: "comma/$ formatted itemized", employment: [emp({ baseIncome: "$5,250.75", bonusIncome: "1,000" } as never)], otherIncome: [], annualIncome: null },
  { name: "empty → annual-summary fallback", employment: [], otherIncome: [], annualIncome: 96000 },
  { name: "empty with string annual", employment: [], otherIncome: [], annualIncome: "72000" },
  { name: "only other-income (no employment)", employment: [], otherIncome: [other(2500)], annualIncome: 50000 },
  { name: "zero-income everything", employment: [emp({})], otherIncome: [], annualIncome: null },
];

describe("P3 cutover parity — wage-only files unchanged", () => {
  for (const fx of WAGE_ONLY_FIXTURES) {
    it(`matches legacy aggregation: ${fx.name}`, () => {
      const legacy = legacyAggregate(fx.employment, fx.otherIncome, fx.annualIncome);
      const orch = computeIncomePaths({
        employment: fx.employment,
        otherIncome: fx.otherIncome,
        rentalProperties: [],
        fallbackAnnualIncome: fx.annualIncome,
      });
      // Primary total (the number the engine consumes) must be identical.
      expect(orch.primaryMonthlyQualifyingIncome).toBeCloseTo(legacy.total, 2);
      // And the base/variable split the engine input preserves.
      expect(orch.primaryBreakdown.agencyBase).toBeCloseTo(legacy.base, 2);
      expect(orch.primaryBreakdown.agencyVariable).toBeCloseTo(legacy.variable, 2);
      expect(orch.primaryBreakdown.selfEmployment).toBe(0);
      expect(orch.incomeBasis).toBe(legacy.basis);
    });
  }

  it("engine-input sum (base+bonus) equals the legacy total for every fixture", () => {
    for (const fx of WAGE_ONLY_FIXTURES) {
      const legacy = legacyAggregate(fx.employment, fx.otherIncome, fx.annualIncome);
      const orch = computeIncomePaths({
        employment: fx.employment, otherIncome: fx.otherIncome, rentalProperties: [], fallbackAnnualIncome: fx.annualIncome,
      });
      // decisionEngine feeds base = agencyBase + SE, bonus = agencyVariable.
      const engineBase = orch.primaryBreakdown.agencyBase + orch.primaryBreakdown.selfEmployment;
      const engineBonus = orch.primaryBreakdown.agencyVariable;
      expect(engineBase + engineBonus).toBeCloseTo(legacy.total, 2);
    }
  });
});
