/**
 * The eligibility scalars the underwriting engine resolves, and where each one
 * lives.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Homiquity has TWO policy-as-data systems, and only one of them decides loans.
 *
 *   1. lookup_matrices — the live one. server/services/lookupResolver.ts
 *      resolves every threshold the engine uses from it, with a versioned
 *      ACTIVE/expiry lifecycle, date-awareness, cross-process cache stamps and
 *      "FULL REPLACEMENT — there are no silent fallbacks" for Reg B
 *      determinism. It is edited by the Pricing Matrices console, which is
 *      fully wired. Every decision snapshots what it resolved into
 *      ResolvedPolicy with a fingerprint.
 *
 *   2. policy_profiles + policy_thresholds — the Policy Operations console.
 *      A full DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> RETIRED
 *      workflow with approvals and overlays. Nothing reads it. Searching
 *      server/ and shared/ for either table returns exactly two files: the
 *      storage layer and the schema definition. Neither underwritingEngine.ts,
 *      decisionEngine.ts nor ruleEngine.ts touches them.
 *
 * So the gap is not "a UI over a hardcoded engine". It is two competing policy
 * systems where the engine is wired to the other one. That distinction decides
 * what the fix is: wiring system 2 in alongside system 1 would put the same
 * FICO floor in two stores, behind two consoles, with two lifecycles — which
 * is how a lender ends up deciding a loan on a threshold nobody believes is
 * active.
 *
 * This registry is the inventory that consolidation needs, and the guard that
 * stops the overlap widening while the direction is being chosen. It asserts
 * nothing about which system should win.
 */

/** Which store actually answers when the engine asks for this value today. */
export type PolicySystemOfRecord = "lookup_matrices";

export interface PolicyScalarEntry {
  /** The code the engine passes to lookupResolver.getPolicyScalar(). */
  matrixCode: string;
  /** Where the engine reads it from today. */
  systemOfRecord: PolicySystemOfRecord;
  /**
   * The equivalent policy_thresholds coordinates, if this scalar were to move
   * to the Policy Operations catalogue. category matches the RuleCategory the
   * Policy Ops console groups by; thresholdKey follows the snake_case examples
   * in the schema comment ("min_credit_score", "max_dti_front").
   *
   * These are the PROPOSED coordinates. No row exists at them today.
   */
  thresholdEquivalent: { category: string; thresholdKey: string };
  /** What the number means, for whoever has to reconcile the two systems. */
  description: string;
}

/**
 * Every scalar the engine resolves. Kept complete on purpose: the guard test
 * fails when the engine grows a getPolicyScalar() call that is not listed
 * here, so the inventory cannot silently fall behind the code.
 *
 * NOT included, deliberately: CONVENTIONAL_PMI, FANNIE_LLPA,
 * CONVENTIONAL_MAX_LTV and VA_RESIDUAL. Those are matrices — grids resolved by
 * coordinate (FICO band x LTV band), not single values. policy_thresholds
 * holds one value per row and has no cell model, so they cannot move there and
 * belong in lookup_matrices regardless of which way the eligibility scalars
 * go.
 */
export const POLICY_SCALARS: PolicyScalarEntry[] = [
  {
    matrixCode: "CONVENTIONAL_DTI_CAP",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "DTI", thresholdKey: "max_dti" },
    description: "Standard conventional debt-to-income ceiling, percent.",
  },
  {
    matrixCode: "CONVENTIONAL_STRETCH_DTI",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "DTI", thresholdKey: "max_dti_stretch" },
    description: "Higher DTI permitted with compensating factors, percent.",
  },
  {
    matrixCode: "CONVENTIONAL_LTV_CAP",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "DTI", thresholdKey: "max_ltv" },
    description: "Conventional loan-to-value ceiling, percent.",
  },
  {
    matrixCode: "CONVENTIONAL_FICO_FLOOR",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "CREDIT", thresholdKey: "min_credit_score" },
    description: "Representative FICO below which a conventional loan is declined.",
  },
  {
    matrixCode: "CONFORMING_LOAN_LIMIT",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "DTI", thresholdKey: "conforming_loan_limit" },
    description: "Maximum conforming loan amount, dollars.",
  },
  {
    matrixCode: "HAIRCUT_STOCK_INVESTMENT",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "ASSETS", thresholdKey: "haircut_stock_investment" },
    description: "Fraction of stock/investment balances counted as reserves.",
  },
  {
    matrixCode: "HAIRCUT_RETIREMENT",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "ASSETS", thresholdKey: "haircut_retirement" },
    description: "Fraction of retirement balances counted as reserves.",
  },
  {
    matrixCode: "VA_RESIDUAL_EXTRA_MEMBER",
    systemOfRecord: "lookup_matrices",
    thresholdEquivalent: { category: "INCOME", thresholdKey: "va_residual_extra_member" },
    description: "Added residual-income requirement per household member beyond the table.",
  },
];

/** Matrix codes resolved as grids; they have no policy_thresholds equivalent. */
export const POLICY_MATRICES = [
  "CONVENTIONAL_PMI",
  "FANNIE_LLPA",
  "CONVENTIONAL_MAX_LTV",
  "VA_RESIDUAL",
] as const;

export function policyScalarByCode(matrixCode: string): PolicyScalarEntry | undefined {
  return POLICY_SCALARS.find((s) => s.matrixCode === matrixCode);
}

/**
 * True while every engine threshold still comes from one store.
 *
 * The moment this is false, a decision's thresholds are being assembled from
 * two catalogues with independent lifecycles, and ResolvedPolicy's fingerprint
 * no longer identifies a single governing policy.
 */
export function hasSinglePolicySystemOfRecord(): boolean {
  return new Set(POLICY_SCALARS.map((s) => s.systemOfRecord)).size === 1;
}
