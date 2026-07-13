import { describe, it, expect } from "vitest";
import {
  assembleIncomePackage,
  type IncomePackageInputs,
} from "../server/services/incomeAnalysisPackage";
import { deriveSubmissionStages, type StageDerivationInputs } from "../server/services/brokerSubmissionReadiness";
import { incomeAnalysisPackageSchema } from "../shared/incomePackage";
import type { IncomePathResult } from "../shared/incomePaths";
import type { IncomePathEvaluation, Document, EmploymentHistory, SituationProfileRow } from "@shared/schema";

/**
 * UAL P6 — the income analysis package on lender submissions, and the
 * broker-submission-readiness gate. Pure in-process — no HTTP server, no DB.
 */

const paths: IncomePathResult[] = [
  { pathId: "agency_wage", kind: "dti_income", role: "component", status: "applicable", monthlyQualifyingIncome: 6000, appliedToDti: true, citations: [{ doc: "docs/fannie-mae (Selling Guide)", section: "B3-3.1" }], requiresManualReview: false, notes: [] },
  { pathId: "self_employment", kind: "dti_income", role: "component", status: "applicable", monthlyQualifyingIncome: 4000, appliedToDti: true, citations: [{ doc: "docs/fannie-mae/self-employment-income-reference.md", section: "B3-3.5 / B3-3.6" }], requiresManualReview: false, notes: ["1084 cash-flow analysis"] },
  { pathId: "rental", kind: "dti_income", role: "component", status: "not_indicated", monthlyQualifyingIncome: 0, appliedToDti: false, citations: [{ doc: "docs/fannie-mae (Selling Guide)", section: "B3-3.1-08" }], requiresManualReview: false, notes: [] },
  { pathId: "bank_statement", kind: "dti_income", role: "alternative", status: "applicable", monthlyQualifyingIncome: 12000, appliedToDti: false, citations: [{ doc: "docs/lender-programs/angel-oak/bank-statement-program-reference.md", section: "expense factor" }], requiresManualReview: true, notes: ["50% expense factor"] },
  { pathId: "dscr", kind: "coverage_ratio", role: "alternative", status: "applicable", coverageRatio: 1.25, citations: [{ doc: "docs/lender-programs/angel-oak/dscr-program-reference.md", section: "Rent÷PITIA" }], requiresManualReview: true, notes: ["portal-gated threshold"] },
];

const evaluation = {
  id: "eval-1",
  applicationId: "app-1",
  trigger: "worksheet_confirmed",
  paths: paths as unknown,
  primaryMonthlyQualifyingIncome: "10000.00",
  recommendedPathId: "bank_statement",
  incomeBasis: "urla_line_items",
  requiresManualReview: true,
  inputsFingerprint: "a".repeat(64),
  evaluationFingerprint: "b".repeat(64),
  createdAt: new Date(),
} as unknown as IncomePathEvaluation;

const worksheetEmployment = {
  id: "emp-1",
  applicationId: "app-1",
  employerName: "Simworth Consulting",
  isSelfEmployed: true,
  selfEmploymentIncome: {
    version: 1,
    businessStructure: "sole_proprietorship",
    confirmedByBorrowerAt: "2026-07-11T08:00:00.000Z",
    sourceTaxInsightId: "insight-9",
    scheduleC: { currentYear: { netProfitOrLoss: 60000, depreciation: 3000 } },
    // NOTE: worksheets carry no SSN/full EIN — PII-safe by construction.
  },
} as unknown as EmploymentHistory;

const documents = [
  {
    id: "doc-1",
    fileName: "2025-tax-return.pdf",
    documentType: "tax_return",
    extractionResponseHash: "c".repeat(64),
    notes: JSON.stringify({ modelId: "claude-opus-4-8", promptVersion: "2026-07-v3", responseHash: "c".repeat(64) }),
  },
  { id: "doc-2", fileName: "id.png", documentType: "government_id", extractionResponseHash: null, notes: null },
] as unknown as Document[];

const situation = {
  id: "sit-1",
  userId: "user-1",
  profile: {
    version: 1,
    summary: "Self-employed across 1 entity with W-2 wages alongside.",
    taxYears: [2025, 2024],
    entityCount: 1,
    flags: [{ id: "self_employed", label: "Self-employed income", detail: "…", evidence: [] }],
    incomePaths: [],
    documentRequests: [],
    tieOutSummary: { pass: 7, variance: 0, notEvaluable: 0, info: 1 },
  } as unknown,
} as unknown as SituationProfileRow;

function baseInputs(over: Partial<IncomePackageInputs> = {}): IncomePackageInputs {
  return {
    applicationId: "app-1",
    lenderId: "angel-oak",
    submittedBy: "user-lo",
    submittedAt: new Date("2026-07-11T12:00:00.000Z"),
    simulated: true,
    evaluation,
    situation,
    confirmedWorksheets: [worksheetEmployment],
    documents,
    ...over,
  };
}

describe("assembleIncomePackage", () => {
  it("produces a schema-valid package with per-path math + citations", () => {
    const pkg = assembleIncomePackage(baseInputs());
    expect(() => incomeAnalysisPackageSchema.parse(pkg)).not.toThrow();
    expect(pkg.primaryMonthlyQualifyingIncome).toBe(10000);
    expect(pkg.recommendedPathId).toBe("bank_statement");
    expect(pkg.evaluationFingerprint).toBe("b".repeat(64));
    // Every path carries at least one citation.
    for (const p of pkg.paths) expect(p.citations.length).toBeGreaterThan(0);
  });

  it("includes non-QM path sections for a non-QM lender (Angel Oak)", () => {
    const pkg = assembleIncomePackage(baseInputs({ lenderId: "angel-oak" }));
    const ids = pkg.paths.map((p) => p.pathId);
    expect(ids).toContain("bank_statement");
    expect(ids).toContain("dscr");
    expect(pkg.omittedSections).toHaveLength(0);
  });

  it("omits non-QM sections for an agency-only lender and records the omission", () => {
    const pkg = assembleIncomePackage(baseInputs({ lenderId: "uwm" }));
    const ids = pkg.paths.map((p) => p.pathId);
    expect(ids).not.toContain("bank_statement");
    expect(ids).not.toContain("dscr");
    expect(ids).toContain("agency_wage");
    expect(ids).toContain("self_employment");
    expect(pkg.omittedSections.join(" ")).toMatch(/Non-QM path sections.*omitted/i);
  });

  it("carries the confirmed worksheet with provenance, and labels the document manifest", () => {
    const pkg = assembleIncomePackage(baseInputs());
    expect(pkg.confirmedWorksheets).toHaveLength(1);
    expect(pkg.confirmedWorksheets[0].confirmedByBorrowerAt).toBe("2026-07-11T08:00:00.000Z");
    expect(pkg.confirmedWorksheets[0].sourceTaxInsightId).toBe("insight-9");
    // Manifest is hashes + lineage, labeled — never content.
    const taxDoc = pkg.documentManifest.find((d) => d.documentId === "doc-1")!;
    expect(taxDoc.label).toBe("machine-read; human-confirmed");
    expect(taxDoc.contentHash).toBe("c".repeat(64));
    expect(taxDoc.extraction?.modelId).toBe("claude-opus-4-8");
    const idDoc = pkg.documentManifest.find((d) => d.documentId === "doc-2")!;
    expect(idDoc.extraction).toBeNull(); // not machine-read
  });

  it("never leaks raw model output or a full identifier", () => {
    const pkg = assembleIncomePackage(baseInputs());
    const serialized = JSON.stringify(pkg);
    // No encrypted-raw fields, no SSN pattern, no full 9-digit EIN pattern.
    expect(serialized).not.toMatch(/rawResponseEncrypted|extractionRawEncrypted|ciphertext/i);
    expect(serialized).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN
    expect(serialized).not.toMatch(/\b\d{2}-\d{7}\b/); // full EIN
  });

  it("carries honest simulated labeling", () => {
    expect(assembleIncomePackage(baseInputs({ simulated: true })).simulated).toBe(true);
    expect(assembleIncomePackage(baseInputs({ simulated: false })).simulated).toBe(false);
  });

  it("degrades cleanly when no evaluation exists yet", () => {
    const pkg = assembleIncomePackage(baseInputs({ evaluation: null, confirmedWorksheets: [], situation: null }));
    expect(pkg.primaryMonthlyQualifyingIncome).toBeNull();
    expect(pkg.paths).toHaveLength(0);
    expect(pkg.situation).toBeNull();
    expect(() => incomeAnalysisPackageSchema.parse(pkg)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// The submission-readiness gate (pure deriveSubmissionStages)
// ---------------------------------------------------------------------------

function cleanStage(over: Partial<StageDerivationInputs> = {}): StageDerivationInputs {
  return {
    urla: { gseGatingFailed: false, criticalErrors: [], missingDocuments: [], qmStatus: "QM", pointsAndFeesCompliant: true, tridStatus: { leRequired: true, leDueDate: new Date("2099-01-01"), leIssued: true } },
    uldd: { valid: true, errors: [], warnings: [] },
    aus: { casefileId: "CF-1", recommendation: "Approve/Eligible", lpaAssessed: true },
    consents: { eDisclosure: true, antiSteering: true },
    deliveryEdits: { deliverable: true, fatalCount: 0, warningCount: 0, notEvaluatedCount: 0 },
    incomeAnalysis: { requiresIncomePackage: false, hasCurrentEvaluation: false, openFlaggedReviewItems: 0 },
    ...over,
  };
}
const pkgStage = (r: ReturnType<typeof deriveSubmissionStages>) => r.stages.find((s) => s.key === "lenderPackage")!;

describe("income-analysis submission gate", () => {
  it("does not gate a wage-earner file that doesn't need the income package", () => {
    const r = deriveSubmissionStages(cleanStage());
    expect(pkgStage(r).status).toBe("ready");
    expect(r.readyToSubmitToLender).toBe(true);
  });

  it("blocks an SE/non-agency file with no income evaluation", () => {
    const r = deriveSubmissionStages(
      cleanStage({ incomeAnalysis: { requiresIncomePackage: true, hasCurrentEvaluation: false, openFlaggedReviewItems: 0 } }),
    );
    expect(pkgStage(r).status).toBe("blocked");
    expect(pkgStage(r).blockers.join(" ")).toMatch(/Income analysis not yet run/i);
    expect(r.readyToSubmitToLender).toBe(false);
  });

  it("blocks when flagged review items are still open", () => {
    const r = deriveSubmissionStages(
      cleanStage({ incomeAnalysis: { requiresIncomePackage: true, hasCurrentEvaluation: true, openFlaggedReviewItems: 2 } }),
    );
    expect(pkgStage(r).status).toBe("blocked");
    expect(pkgStage(r).blockers.join(" ")).toMatch(/2 flagged income review item/i);
  });

  it("passes an SE file once evaluation exists and no flagged items remain", () => {
    const r = deriveSubmissionStages(
      cleanStage({ incomeAnalysis: { requiresIncomePackage: true, hasCurrentEvaluation: true, openFlaggedReviewItems: 0 } }),
    );
    expect(pkgStage(r).status).toBe("ready");
    expect(r.readyToSubmitToLender).toBe(true);
  });
});
