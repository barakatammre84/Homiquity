import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { DSCR_PROGRAM, computeDscrRatio, computeDscrForProperties, computeDscrPath } from "../server/services/income/paths/dscr";
import {
  BANK_STATEMENT_PROGRAM,
  BANK_STATEMENT_DEFAULT_EXPENSE_FACTOR,
  BANK_STATEMENT_HIGH_EXPENSE_FACTOR,
  computeBankStatementIncome,
  computeBankStatementPath,
} from "../server/services/income/paths/bankStatement";

/**
 * UAL P4 — the mechanical form of "no citation, no implementation" for non-QM
 * program math:
 *  1. every ENABLED program's citation files must exist in the repo;
 *  2. the load-bearing figures in code must appear verbatim in the reference
 *     docs (so a doc edit that drops a figure breaks the build, not just the
 *     audit trail);
 *  3. the calculators implement exactly the transcribed methods — including
 *     what they must NOT do (no DSCR pass/fail without an in-repo threshold;
 *     no below-default expense factor without the third-party statement).
 * Pure in-process — no HTTP server, no database.
 */

const ROOT = path.resolve(__dirname, "..");
const readDoc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("program gate: citation files exist for every enabled program", () => {
  for (const [name, program] of [
    ["DSCR", DSCR_PROGRAM],
    ["Bank Statement", BANK_STATEMENT_PROGRAM],
  ] as const) {
    it(`${name}: enabled ⇒ citation files present`, () => {
      if (!program.enabled) return; // gate closed — nothing to assert
      expect(program.citationFiles.length).toBeGreaterThan(0);
      for (const rel of program.citationFiles) {
        expect(fs.existsSync(path.join(ROOT, rel)), `${rel} missing`).toBe(true);
      }
    });
  }
});

describe("program gate: code constants are anchored in the transcribed docs", () => {
  it("bank-statement expense factors (50% default, 70% high-expense) appear verbatim", () => {
    const doc = readDoc("docs/lender-programs/angel-oak/bank-statement-program-reference.md");
    expect(doc).toMatch(/default expense factor of 50%/);
    expect(doc).toMatch(/70% expense factor/);
    expect(doc).toMatch(/12 or 24 months/);
    expect(BANK_STATEMENT_DEFAULT_EXPENSE_FACTOR).toBe(0.5);
    expect(BANK_STATEMENT_HIGH_EXPENSE_FACTOR).toBe(0.7);
  });

  it("DSCR formula (Rent Divided PITIA) appears verbatim, and no threshold constant exists", () => {
    const doc = readDoc("docs/lender-programs/angel-oak/dscr-program-reference.md");
    // Tolerate a markdown blockquote line-wrap ("> ") inside the quoted formula.
    expect(doc).toMatch(/Rent Divided[\s>]*PITIA = DSCR/);
    expect(doc).toMatch(/NOT PUBLIC/);
    // The qualifying minimum is portal-gated: the module must not export or
    // embed a numeric DSCR threshold.
    const src = fs.readFileSync(path.join(ROOT, "server/services/income/paths/dscr.ts"), "utf8");
    expect(src).not.toMatch(/MIN(IMUM)?_DSCR|DSCR_(MIN|THRESHOLD|FLOOR)/i);
  });
});

describe("computeDscrRatio (Rent ÷ PITIA)", () => {
  it("computes the cited formula on matching monthly periods", () => {
    expect(computeDscrRatio(2500, 2000)).toBe(1.25);
    expect(computeDscrRatio(1800, 2000)).toBe(0.9);
  });

  it("returns null (undefined ratio) rather than coercing a zero/invalid PITIA", () => {
    expect(computeDscrRatio(2500, 0)).toBeNull();
    expect(computeDscrRatio(2500, -100)).toBeNull();
    expect(computeDscrRatio(NaN, 2000)).toBeNull();
  });
});

describe("computeDscrPath", () => {
  const props = [
    { address: "1 Main St", monthlyRentalIncome: 2500, monthlyDebtPayment: 2000 },
    { address: "2 Oak Ave", monthlyRentalIncome: "1,800", monthlyDebtPayment: "2,000" },
  ] as never[];

  it("reports per-property and aggregate ratios, always with manual review", () => {
    const r = computeDscrPath(props);
    expect(r.status).toBe("applicable");
    // Aggregate: (2500+1800) / (2000+2000) = 1.075
    expect(r.coverageRatio).toBe(1.075);
    expect(r.requiresManualReview).toBe(true);
    expect(r.notes.some((n) => /portal-gated/.test(n))).toBe(true);
    expect(r.citations[0].doc).toMatch(/dscr-program-reference/);
  });

  it("parses accounting-format figures via the shared financial parser", () => {
    const { perProperty } = computeDscrForProperties(props);
    expect(perProperty[1].monthlyRent).toBe(1800);
    expect(perProperty[1].ratio).toBe(0.9);
  });

  it("is not_indicated with no rentals", () => {
    expect(computeDscrPath([]).status).toBe("not_indicated");
    expect(computeDscrPath([]).coverageRatio).toBeNull();
  });

  it("reports an undefined per-property ratio when PITIA is missing", () => {
    const r = computeDscrPath([{ address: "3 Elm", monthlyRentalIncome: 2000 }] as never[]);
    expect(r.coverageRatio).toBeNull();
    expect(r.notes.some((n) => /undefined/.test(n))).toBe(true);
  });
});

describe("computeBankStatementIncome (deposits × (1 − expense factor))", () => {
  it("applies the 50% default over 12 months", () => {
    const r = computeBankStatementIncome({ months: 12, totalEligibleDeposits: 240_000 });
    // 240000/12 = 20000/mo × (1 − 0.5) = 10000
    expect(r.monthlyQualifyingIncome).toBe(10_000);
    expect(r.appliedExpenseFactor).toBe(0.5);
    expect(r.requiresManualReview).toBe(true); // AE deposit-eligibility rules not in-repo
  });

  it("applies the 70% high-expense-industry factor over 24 months", () => {
    const r = computeBankStatementIncome({
      months: 24,
      totalEligibleDeposits: 480_000,
      expenseFactor: BANK_STATEMENT_HIGH_EXPENSE_FACTOR,
    });
    // 480000/24 = 20000/mo × (1 − 0.7) = 6000
    expect(r.monthlyQualifyingIncome).toBe(6_000);
    expect(r.appliedExpenseFactor).toBe(0.7);
  });

  it("refuses a below-default factor without the third-party statement (conservative)", () => {
    const r = computeBankStatementIncome({
      months: 12,
      totalEligibleDeposits: 120_000,
      expenseFactor: 0.3,
    });
    expect(r.appliedExpenseFactor).toBe(0.5);
    expect(r.notes.some((n) => /third-party CPA/.test(n))).toBe(true);
  });

  it("honors a below-default factor WITH the third-party statement", () => {
    const r = computeBankStatementIncome({
      months: 12,
      totalEligibleDeposits: 120_000,
      expenseFactor: 0.3,
      hasThirdPartyExpenseStatement: true,
    });
    expect(r.appliedExpenseFactor).toBe(0.3);
    expect(r.monthlyQualifyingIncome).toBe(7_000); // 10000 × 0.7
  });

  it("rejects a non-program statement period — 12 or 24 only", () => {
    const r = computeBankStatementIncome({ months: 18 as never, totalEligibleDeposits: 180_000 });
    expect(r.monthlyQualifyingIncome).toBe(0);
    expect(r.notes[0]).toMatch(/12 or 24 months/);
  });
});

describe("computeBankStatementPath", () => {
  it("without captured analysis: program available, figure absent, capture gap named", () => {
    const r = computeBankStatementPath(true);
    expect(r.status).toBe("not_indicated");
    expect(r.monthlyQualifyingIncome).toBe(0);
    expect(r.notes[0]).toMatch(/no bank-statement deposit analysis has been captured/);
    expect(r.citations.length).toBeGreaterThan(0);
  });

  it("with analysis: applicable, computed as an alternative METHOD (never summed into full-doc)", () => {
    const r = computeBankStatementPath(true, { months: 12, totalEligibleDeposits: 240_000 });
    expect(r.status).toBe("applicable");
    expect(r.monthlyQualifyingIncome).toBe(10_000);
    expect(r.appliedToDti).toBe(false);
    expect(r.requiresManualReview).toBe(true);
  });
});
