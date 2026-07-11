import type { CoverageRatioPathResult, DtiIncomePathResult } from "@shared/incomePaths";

/**
 * Non-QM program paths (UAL P3 stubs; qualification math is P4).
 *
 * DSCR and bank-statement income are lender-program-specific (Angel Oak in the
 * Target-5 catalog) and have NO agency citation. Until the program reference
 * lands in docs/lender-programs/ (UAL P4), these paths are HARD-BLOCKED: they
 * are registered so the LO sees the path exists, but they return NO figure —
 * a wrong non-QM number must never reach a lender package. There is no env
 * flag: the gate is a static in-repo fact.
 *
 * P4 flips `enabled` to true IN THE SAME COMMIT as the transcribed program
 * reference, and an fs-existence test asserts every enabled path's citation
 * files exist (the mechanical form of "no citation, no implementation").
 */

export const DSCR_PROGRAM = {
  enabled: false as boolean,
  citationFiles: ["docs/lender-programs/angel-oak/dscr-program-reference.md"],
};

export const BANK_STATEMENT_PROGRAM = {
  enabled: false as boolean,
  citationFiles: ["docs/lender-programs/angel-oak/bank-statement-program-reference.md"],
};

const PROGRAM_REFERENCE_NOT_IN_REPO = "PROGRAM_REFERENCE_NOT_IN_REPO";

/**
 * DSCR is property qualification (coverage ratio), NOT borrower income — it
 * ranks separately and never competes with a DTI income figure. `hasRental`
 * decides applicability vs not-indicated when disabled.
 */
export function computeDscrPath(hasRental: boolean): CoverageRatioPathResult {
  if (!DSCR_PROGRAM.enabled) {
    return {
      pathId: "dscr",
      kind: "coverage_ratio",
      role: "alternative",
      status: hasRental ? "unavailable" : "not_indicated",
      coverageRatio: null,
      citations: [],
      requiresManualReview: false,
      unavailableReason: hasRental ? PROGRAM_REFERENCE_NOT_IN_REPO : undefined,
      notes: hasRental
        ? [
            "Rental activity suggests a DSCR route, but DSCR qualification is hard-blocked until the Angel Oak program reference is in-repo (UAL P4).",
          ]
        : [],
    };
  }
  // P4 implements the real coverage-ratio math here, gated on the citation file.
  return {
    pathId: "dscr",
    kind: "coverage_ratio",
    role: "alternative",
    status: "not_indicated",
    coverageRatio: null,
    citations: [{ doc: DSCR_PROGRAM.citationFiles[0], section: "DSCR program matrix" }],
    requiresManualReview: false,
    notes: [],
  };
}

/**
 * Bank-statement income is a DTI-income alternative METHOD (used instead of
 * full-doc tax returns), gated the same way.
 */
export function computeBankStatementPath(hasSelfEmployment: boolean): DtiIncomePathResult {
  if (!BANK_STATEMENT_PROGRAM.enabled) {
    return {
      pathId: "bank_statement",
      kind: "dti_income",
      role: "alternative",
      status: hasSelfEmployment ? "unavailable" : "not_indicated",
      monthlyQualifyingIncome: 0,
      appliedToDti: false,
      citations: [],
      requiresManualReview: false,
      unavailableReason: hasSelfEmployment ? PROGRAM_REFERENCE_NOT_IN_REPO : undefined,
      notes: hasSelfEmployment
        ? [
            "Self-employment suggests a bank-statement program candidate, but its math is hard-blocked until the Angel Oak program reference is in-repo (UAL P4).",
          ]
        : [],
    };
  }
  return {
    pathId: "bank_statement",
    kind: "dti_income",
    role: "alternative",
    status: "not_indicated",
    monthlyQualifyingIncome: 0,
    appliedToDti: false,
    citations: [{ doc: BANK_STATEMENT_PROGRAM.citationFiles[0], section: "Bank-statement program matrix" }],
    requiresManualReview: false,
    notes: [],
  };
}
