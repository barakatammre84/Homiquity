import { describe, expect, it } from "vitest";
import {
  toBorrowerIncomeAvailableView,
  toBorrowerIncomeAnalyzingView,
  parsePersistedPaths,
  BORROWER_INCOME_DISCLAIMER,
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
    expect(view.paths[1].monthlyQualifyingIncome).toBe(8412.34);
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

describe("borrower copy stays inside the Reg N lexicon (counsel-review items, memo §5)", () => {
  it.each([
    ["disclaimer", BORROWER_INCOME_DISCLAIMER],
    ["education", INCOME_ANALYSIS_EDUCATION],
    ...Object.entries(INCOME_SOURCE_LABELS).map(
      ([id, label]) => [`label:${id}`, label] as [string, string],
    ),
  ])("%s has no trigger terms or hard blocks", (_name, copy) => {
    const result = lintOutboundText(copy);
    expect([...result.triggerMatches, ...result.hardBlockMatches]).toHaveLength(0);
  });
});
