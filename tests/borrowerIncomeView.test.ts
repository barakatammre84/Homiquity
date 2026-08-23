import { describe, expect, it } from "vitest";
import {
  toBorrowerIncomeAvailableView,
  toBorrowerIncomeAnalyzingView,
  parsePersistedPaths,
  BORROWER_INCOME_DISCLAIMER,
  BORROWER_INCOME_BREAKDOWN_UNAVAILABLE,
  INCOME_ANALYSIS_EDUCATION,
  INCOME_SOURCE_LABELS,
} from "@shared/borrowerIncomeView";
import type { IncomePathResult } from "@shared/incomePaths";
import { lintOutboundText } from "@shared/compliance/loCommsLint";

/**
 * Borrower Clarity PR 7 (kb log 2026-08-04 §4): field-absence pins in the
 * borrowerOfferView style. The internal hazards — calculator notes[],
 * unavailableReason gate codes, requiresManualReview triage state, method
 * recommendations — must never reach either state's payload, and the
 * analyzing state must never carry a figure.
 */

const sePath: IncomePathResult = {
  kind: "dti_income",
  pathId: "self_employment",
  role: "component",
  status: "applicable",
  citations: [{ doc: "Fannie Mae Selling Guide", section: "B3-3.5-01" }],
  requiresManualReview: true,
  notes: ["internal: declining trend, most recent year used"],
  monthlyQualifyingIncome: 8412.339,
  appliedToDti: true,
  appliedMonthlyIncome: 8412.339,
  appliedMonthlyObligation: 0,
};

const wagePath: IncomePathResult = {
  kind: "dti_income",
  pathId: "agency_wage",
  role: "component",
  status: "applicable",
  citations: [{ doc: "Fannie Mae Selling Guide", section: "B3-3.1-01" }],
  requiresManualReview: false,
  notes: [],
  monthlyQualifyingIncome: 5000,
  appliedToDti: true,
  appliedMonthlyIncome: 5000,
  appliedMonthlyObligation: 0,
};

const gatedBankPath: IncomePathResult = {
  kind: "dti_income",
  pathId: "bank_statement",
  role: "alternative",
  status: "unavailable",
  citations: [],
  requiresManualReview: true,
  unavailableReason: "PROGRAM_REFERENCE_NOT_IN_REPO",
  notes: ["internal: Angel Oak reference pending"],
  monthlyQualifyingIncome: 0,
  appliedToDti: false,
  appliedMonthlyIncome: 0,
  appliedMonthlyObligation: 0,
};

const dscrPath: IncomePathResult = {
  kind: "coverage_ratio",
  pathId: "dscr",
  role: "alternative",
  status: "applicable",
  citations: [],
  requiresManualReview: true,
  notes: ["internal: portal-gated minimum"],
  coverageRatio: 1.21,
};

const notIndicatedRental: IncomePathResult = {
  kind: "dti_income",
  pathId: "rental",
  role: "component",
  status: "not_indicated",
  citations: [],
  requiresManualReview: false,
  notes: [],
  monthlyQualifyingIncome: 0,
  appliedToDti: false,
  appliedMonthlyIncome: 0,
  appliedMonthlyObligation: 0,
};

/**
 * A rental portfolio whose positive offsets counted and whose losses went to
 * the obligation side. `monthlyQualifyingIncome` is the informational NET; it
 * is NOT what the total counted, which is the whole reason the row shows the
 * contributed amount instead.
 */
const splitRentalPath: IncomePathResult = {
  kind: "dti_income",
  pathId: "rental",
  role: "component",
  status: "applicable",
  citations: [
    { doc: "docs/fannie-mae/rental-income-reference.md", section: "B3-3.8-01" },
  ],
  requiresManualReview: true,
  notes: ["internal: 2 rental properties, per-property treatment"],
  monthlyQualifyingIncome: 500,
  appliedToDti: true,
  appliedMonthlyIncome: 1250,
  appliedMonthlyObligation: 750,
};

describe("toBorrowerIncomeAvailableView", () => {
  const view = toBorrowerIncomeAvailableView({
    createdAt: "2026-08-04T12:00:00.000Z",
    incomeBasis: "urla_line_items",
    primaryMonthlyQualifyingIncome: "13412.34",
    paths: [wagePath, sePath, gatedBankPath, dscrPath, notIndicatedRental],
  });

  it("shows only applicable dti paths, with rounded figures and citations", () => {
    expect(view.available).toBe(true);
    expect(view.paths.map((p) => p.pathId)).toEqual(["agency_wage", "self_employment"]);
    expect(view.paths[1].monthlyIncomeApplied).toBe(8412.34);
    expect(view.paths[1].citations).toEqual([
      { doc: "Fannie Mae Selling Guide", section: "B3-3.5-01" },
    ]);
    expect(view.totalMonthlyQualifyingIncome).toBe(13412.34);
    expect(view.disclaimer).toBe(BORROWER_INCOME_DISCLAIMER);
  });

  it("never emits notes, gate codes, triage state, coverage ratios, or recommendations", () => {
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("internal:");
    expect(serialized).not.toContain("PROGRAM_REFERENCE_NOT_IN_REPO");
    expect(serialized).not.toContain("requiresManualReview");
    expect(serialized).not.toContain("recommend");
    expect(serialized).not.toContain("1.21");
    expect(serialized).not.toContain("coverageRatio");
  });
});

describe("toBorrowerIncomeAnalyzingView", () => {
  it("lists evidence-bearing sources as labels, never figures", () => {
    const view = toBorrowerIncomeAnalyzingView([
      wagePath,
      sePath,
      gatedBankPath,
      notIndicatedRental,
    ]);
    expect(view.available).toBe(false);
    expect(view.state).toBe("analyzing");
    expect(view.sourcesUnderReview).toEqual([
      "Employment income",
      "Business & self-employment income",
      "Bank-statement income",
    ]);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("8412");
    expect(serialized).not.toContain("5000");
    expect(serialized).not.toContain("monthlyQualifyingIncome");
    expect(serialized).not.toContain("internal:");
  });

  it("degrades to an empty source list with no evaluation at all", () => {
    const view = toBorrowerIncomeAnalyzingView(null);
    expect(view.sourcesUnderReview).toEqual([]);
    expect(view.education).toBe(INCOME_ANALYSIS_EDUCATION);
  });
});

describe("parsePersistedPaths", () => {
  it("round-trips a valid payload and nulls an off-contract one", () => {
    expect(parsePersistedPaths([wagePath])).toHaveLength(1);
    expect(parsePersistedPaths({ not: "an array" })).toBeNull();
    expect(parsePersistedPaths(null)).toBeNull();
  });
});


/**
 * The itemisation invariant, at the read model (2026-08-23).
 *
 * The card this feeds is titled "How your qualifying income was calculated" and
 * says "the same math your approval used". Before this, its rows did not sum to
 * its total: the rental row carried the portfolio's NET while the total counted
 * only the positive offsets, and the subject property's unit rent joined the
 * total with no row at all. DESIGN_SYSTEM.md §13 "agreement" — no two elements
 * disagree about the same fact.
 */
describe("the itemisation adds up, or it is not shown", () => {
  const build = (paths: IncomePathResult[], total: string) =>
    toBorrowerIncomeAvailableView({
      createdAt: "2026-08-23T12:00:00.000Z",
      incomeBasis: "urla_line_items",
      primaryMonthlyQualifyingIncome: total,
      paths,
    });

  it("rows sum to the total exactly", () => {
    const view = build([wagePath, splitRentalPath, gatedBankPath, dscrPath], "6250");
    const rowSum = view.paths.reduce((s, p) => s + p.monthlyIncomeApplied, 0);
    expect(view.breakdownAvailable).toBe(true);
    expect(rowSum).toBe(view.totalMonthlyQualifyingIncome);
  });

  it("a rental row shows what counted, not the net it is worth", () => {
    const view = build([wagePath, splitRentalPath], "6250");
    const rental = view.paths.find((p) => p.pathId === "rental")!;
    // the informational net (500) is not a figure the borrower is shown
    expect(rental.monthlyIncomeApplied).toBe(1250);
    expect(JSON.stringify(view)).not.toContain("500,");
  });

  it("names the loss that went to monthly debts instead of hiding it in a net", () => {
    const view = build([wagePath, splitRentalPath], "6250");
    const rental = view.paths.find((p) => p.pathId === "rental")!;
    expect(rental.monthlyObligationApplied).toBe(750);
  });

  it("an alternative METHOD that fed nothing into the total shows no figure", () => {
    // bank-statement is applicable-and-unapplied in the real orchestrator; a
    // figure beside it under this total would be both wrong and steering.
    const applicableAlt: IncomePathResult = {
      ...gatedBankPath,
      status: "applicable",
      monthlyQualifyingIncome: 9000,
      appliedMonthlyIncome: 0,
    };
    const view = build([wagePath, applicableAlt], "5000");
    expect(view.paths.map((p) => p.pathId)).toEqual(["agency_wage"]);
    expect(JSON.stringify(view)).not.toContain("9000");
  });

  it("recovers a legacy wage-and-salary breakdown, because the total vouches for it", () => {
    // Pre-split rows carried no contributed amounts, but the old convention —
    // the whole figure counts iff appliedToDti — was already correct for a file
    // with no rental split and no subject unit rent. Reconstruct, then let the
    // persisted total decide whether the reconstruction is trustworthy.
    const legacy = [wagePath, sePath].map((p) =>
      p.kind === "dti_income"
        ? { ...p, appliedMonthlyIncome: undefined, appliedMonthlyObligation: undefined }
        : p,
    );
    const view = build(legacy, "13412.34");
    expect(view.breakdownAvailable).toBe(true);
    expect(view.paths.map((p) => p.monthlyIncomeApplied)).toEqual([5000, 8412.34]);
  });

  it("says so rather than itemising an evaluation persisted before the split", () => {
    const legacy = [wagePath, splitRentalPath].map((p) =>
      p.kind === "dti_income"
        ? { ...p, appliedMonthlyIncome: undefined, appliedMonthlyObligation: undefined }
        : p,
    );
    // The old convention reconstructs 5,000 + 500 = 5,500 against a persisted
    // 6,250: the rental split is exactly where it was wrong, and the total
    // catches it.
    const view = build(legacy, "6250");
    expect(view.breakdownAvailable).toBe(false);
    expect(view.paths).toEqual([]);
    expect(view.breakdownUnavailable).toBe(BORROWER_INCOME_BREAKDOWN_UNAVAILABLE);
    // the total is still the truth of the file — only the itemisation is absent
    expect(view.totalMonthlyQualifyingIncome).toBe(6250);
  });

  it("refuses a breakdown that would not reconcile, whatever the reason", () => {
    const view = build([wagePath], "9999");
    expect(view.breakdownAvailable).toBe(false);
    expect(view.paths).toEqual([]);
  });
});

describe("borrower copy stays inside the Reg N lexicon (counsel-review items, memo §5)", () => {
  it.each([
    ["disclaimer", BORROWER_INCOME_DISCLAIMER],
    ["education", INCOME_ANALYSIS_EDUCATION],
    ["breakdown-unavailable", BORROWER_INCOME_BREAKDOWN_UNAVAILABLE],
    ...Object.entries(INCOME_SOURCE_LABELS).map(
      ([id, label]) => [`label:${id}`, label] as [string, string],
    ),
  ])("%s has no trigger terms or hard blocks", (_name, copy) => {
    const result = lintOutboundText(copy);
    expect([...result.triggerMatches, ...result.hardBlockMatches]).toHaveLength(0);
  });
});
