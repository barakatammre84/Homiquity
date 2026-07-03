import type { PreUwFlagCode } from "./preUnderwriting";

/**
 * Machine-readable catalog of implemented underwriting scenarios — the
 * read-only "GET /scenario/catalog" surface of the scenario architecture.
 *
 * This is a PROJECTION of what is implemented in code, for consumption by
 * staff tooling, lender due-diligence, and scenario-generation prompts
 * ("read the catalog before proposing" — duplicate prevention). It is NOT a
 * rules engine: changing this file changes nothing about underwriting
 * behavior. Rules change only through the registry pipeline
 * (kb/UNDERWRITING_SCENARIOS.md → cited, tested code).
 *
 * Maintenance contract (checked by tests/scenarioCatalog.test.ts): every
 * implemented S-XX in the registry has an entry here, flag codes are typed
 * against PreUwFlagCode, versions bump when the rule's math changes.
 */

export interface ScenarioCatalogEntry {
  scenarioId: string;
  version: string;
  title: string;
  /** The pre-underwriting flag this scenario raises; null for routing-only scenarios. */
  flagCode: PreUwFlagCode | null;
  status: "implemented" | "engine_ready";
  triggers: string[];
  regulations: string[];
  riskImpact: string;
  workflow: {
    loanOfficerActions: string[];
    borrowerActions: string[];
    automationEngineActions: string[];
  };
  engineRef: string;
}

export const SCENARIO_CATALOG: ScenarioCatalogEntry[] = [
  {
    scenarioId: "S-01",
    version: "1.0.0",
    title: "Hybrid W-2 / Self-Employed Creator (income seasoning)",
    flagCode: "INCOME_SEASONING",
    status: "implemented",
    triggers: [
      "incomeSources[].yearsInRole < 24 months for self-employment/rental/investment income",
      "self-reported vs verified income delta > 5% (armed for verified income feeds)",
    ],
    regulations: ["Fannie Mae Selling Guide B3-3.2"],
    riskImpact:
      "Unseasoned supplementary income overstates qualifying income; <12 months is not usable, 12-24 months requires compensating factors.",
    workflow: {
      loanOfficerActions: ["Review seasoning months per source; confirm compensating factors for 12-24 month income"],
      borrowerActions: ["Upload last two years of federal tax returns (1040s)", "Upload business license or contracts evidencing continuity"],
      automationEngineActions: ["Raise INCOME_SEASONING flag (blocking <12mo, warning 12-24mo)", "Send document-request outreach naming the exact months and documents"],
    },
    engineRef: "server/services/underwritingNuance.ts assessIncomeSeasoning",
  },
  {
    scenarioId: "S-02",
    version: "1.0.0",
    title: "Relocating Military Veteran (VA residual income)",
    flagCode: null,
    status: "engine_ready",
    triggers: [
      "isVeteran + loanPurpose=purchase (funnel VA path)",
      "residual computation at URLA/AUS stage when square footage + household size exist",
    ],
    regulations: ["VA Pamphlet 26-7 Chapter 4 (Table 4-2)"],
    riskImpact:
      "VA files are qualified on residual income, not conventional DTI caps; DTI > 41% requires 120% of the regional residual baseline.",
    workflow: {
      loanOfficerActions: ["Confirm household size and property square footage before VA decisioning"],
      borrowerActions: ["Confirm household size; provide utility estimates if requested"],
      automationEngineActions: [
        "Route veteran purchases to the $0-down path with PMI guidance suppressed",
        "Compute residual vs regional baseline with $0.14/sqft utility deduction and 41%/120% cushion",
      ],
    },
    engineRef: "server/services/underwritingNuance.ts computeVaResidualIncome / VA_RESIDUAL_MATRIX",
  },
  {
    scenarioId: "S-03",
    version: "1.0.0",
    title: "The Sleeper Debt Trap (undisclosed liabilities)",
    flagCode: "VERIFIED_DEBT_DTI",
    status: "implemented",
    triggers: [
      "credit_pulls.liabilities contains student_loan with $0/deferred payment",
      "tradeline openedDaysAgo <= 90",
      "adjusted DTI exceeds the 43% flag threshold",
    ],
    regulations: ["Fannie Mae Selling Guide B3-6-05"],
    riskImpact:
      "Self-reported debt understates true obligations; deferred student loans are qualified at 1% of balance and new tradelines are counted.",
    workflow: {
      loanOfficerActions: ["Review the adjusted-debt composition; validate any payoff plan before closing"],
      borrowerActions: ["Optionally pay off the smallest qualifying balance identified by the what-if calculation", "Provide payoff confirmation or a letter of explanation for new tradelines"],
      automationEngineActions: [
        "Recompute DTI from the verified liability ledger",
        "Raise VERIFIED_DEBT_DTI with the smallest-single-payoff what-if suggestion",
      ],
    },
    engineRef: "server/services/underwritingNuance.ts adjustLiabilities / computeWhatIfPayoff",
  },
  {
    scenarioId: "S-04",
    version: "1.1.0",
    title: "The Mattress Money Gift Fund (large-deposit sourcing)",
    flagCode: "LARGE_DEPOSIT_SOURCING",
    status: "implemented",
    triggers: ["verification_reports.raw_payload.transactions contains a single deposit > 50% of monthly qualifying income"],
    regulations: [
      "Fannie Mae Selling Guide B3-4.2-02 (Depository Accounts)",
      "Fannie Mae Selling Guide B3-4.3-04 (gift funds resolution path)",
    ],
    riskImpact: "Unsourced large deposits may conceal undisclosed loans or unacceptable cash; funds must be documented before use.",
    workflow: {
      loanOfficerActions: ["Review the flagged transaction; verify sourcing documentation"],
      borrowerActions: ["Provide a signed gift letter + donor transfer confirmation, or sale/transfer documentation"],
      automationEngineActions: ["Detect deposits above the 50% threshold from VOA transactions", "Raise LARGE_DEPOSIT_SOURCING naming the exact deposit, date, and threshold"],
    },
    engineRef: "server/services/underwritingNuance.ts detectSignificantDeposits",
  },
  {
    scenarioId: "S-05",
    version: "1.0.0",
    title: "Rental Income Calculation (Schedule E)",
    flagCode: "RENTAL_INCOME_OFFSET",
    status: "implemented",
    triggers: ["incomeSources[].type = rental with one or more rentalProperties entries"],
    regulations: ["Fannie Mae Selling Guide B3-3.1-08 (Rental Income)"],
    riskImpact:
      "Gross rent overstates qualifying income; a 25% vacancy/expense factor must be applied and netted against the property's own PITIA before it can offset DTI.",
    workflow: {
      loanOfficerActions: ["Review the per-property qualifying rent and net offset before finalizing DTI"],
      borrowerActions: ["Upload the executed lease agreement(s) and most recent Schedule E for each rental property"],
      automationEngineActions: [
        "Compute qualifying rental income at 75% of gross rent per property",
        "Net against the property's reported PITIA/debt payment",
        "Raise RENTAL_INCOME_OFFSET naming the qualifying amount and required documents",
      ],
    },
    engineRef: "server/services/underwritingNuance.ts calculateRentalIncomeOffsets",
  },
  {
    scenarioId: "F-LOW-RESERVES",
    version: "1.0.0",
    title: "Low post-closing reserves (foundation)",
    flagCode: "LOW_RESERVES_WARNING",
    status: "implemented",
    triggers: ["(verified assets − down payment) / estimated PITI < 2 months"],
    regulations: ["Platform policy; Fannie B3-4.1-01 mapping pending (see regulatory ledger)"],
    riskImpact: "Thin post-closing liquidity increases early-default risk.",
    workflow: {
      loanOfficerActions: ["Review reserve condition before approval-grade stages"],
      borrowerActions: ["Link additional accounts or document gift funds"],
      automationEngineActions: ["Raise LOW_RESERVES_WARNING", "Materialize a Reserve Funds Verification condition"],
    },
    engineRef: "server/services/preUnderwriting.ts",
  },
  {
    scenarioId: "F-COMPLEX-INCOME",
    version: "1.0.0",
    title: "Self-employed complex income (foundation)",
    flagCode: "COMPLEX_INCOME_CHECK",
    status: "implemented",
    triggers: ["employmentType = self_employed"],
    regulations: ["Fannie Mae Selling Guide B3-3.2 (documentation requirements)"],
    riskImpact: "Business income requires 2-year tax documentation before approval-grade decisions.",
    workflow: {
      loanOfficerActions: ["Hold clear-to-close until tax-return conditions clear"],
      borrowerActions: ["Upload 2 years of 1040s and a YTD P&L"],
      automationEngineActions: [
        "Force the complex-income block into the intake route",
        "Generate 2-year tax-return conditions that gate clear-to-close",
      ],
    },
    engineRef: "server/services/preUnderwriting.ts + server/pipelineEngine.ts + client/src/funnel/preApprovalMachine.ts",
  },
];
