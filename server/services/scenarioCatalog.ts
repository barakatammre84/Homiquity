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
 * (knowledge-base/compliance/UNDERWRITING_SCENARIOS.md → cited, tested code).
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
    regulations: ["Fannie Mae Selling Guide B3-3.5-01"],
    riskImpact:
      "Unseasoned supplementary income overstates qualifying income; <12 months is not usable, and 12-24 months counts only where the most recent returns reflect a full 12 months from the current business AND the file separately documents prior income at the same or greater level in the same field. (B3-3.5-01 states documentary conditions, not 'compensating factors' — that is B3-3.2-02's test for employment-related income.)",
    workflow: {
      loanOfficerActions: [
        "Review seasoning months per source; for 12-24 month income confirm BOTH B3-3.5-01 conditions — a full 12 months on the most recent returns and separately documented prior income at the same or greater level in the same field",
      ],
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
    regulations: ["Fannie Mae Selling Guide B3-3.8-01 (Rental Income; formerly B3-3.1-08)"],
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
    scenarioId: "S-06",
    version: "1.0.0",
    title: "Multi-Unit Subject Property Rental Income",
    flagCode: "SUBJECT_PROPERTY_RENTAL_OFFSET",
    status: "implemented",
    triggers: ["urla_property_info.numberOfUnits between 2-4 with occupancyType = primary_residence and estimatedMarketRent set"],
    regulations: ["Fannie Mae Selling Guide B3-3.8-01 (Rental Income from Subject Property; formerly B3-3.1-08)"],
    riskImpact:
      "Gross market rent on a purchased owner-occupied multi-unit property overstates qualifying income; a 25% vacancy/expense factor must be applied and netted against the subject property's own PITIA.",
    workflow: {
      loanOfficerActions: ["Review the qualifying rent and net offset against subject PITIA before finalizing DTI"],
      borrowerActions: ["Upload the appraisal rent schedule (Form 1025/1007) or executed leases for the non-owner-occupied unit(s)"],
      automationEngineActions: [
        "Compute qualifying rental income at 75% of estimated market rent",
        "Net against the subject property's estimated PITIA",
        "Raise SUBJECT_PROPERTY_RENTAL_OFFSET naming the qualifying amount and required documents",
      ],
    },
    engineRef: "server/services/underwritingNuance.ts calculateSubjectPropertyRentalOffset",
  },
  {
    scenarioId: "S-07",
    version: "1.0.0",
    title: "Rental Income Conversion (departing residence)",
    flagCode: "RENTAL_CONVERSION_OFFSET",
    status: "implemented",
    triggers: [
      'loan_applications.current_property_disposition = "converted_to_rental" with departing_residence ({ estimatedMarketRent, monthlyPitia }) present',
    ],
    regulations: [
      "Fannie Mae Selling Guide B3-3.8-01 (Rental Income, 10/08/2025; formerly B3-3.1-08) — departing residence joins the per-property offset set",
      "Fannie Mae Selling Guide B3-6-06 (recently converted properties — most recent Schedule E confirming no prior rental activity)",
      "Platform policy: projected-rent manual review (ledger platform-s07-departing-projected-rent-review)",
    ],
    riskImpact:
      "Projected market rent on a departing residence overstates qualifying income; 75% of projected rent is netted against the retained PITIA per property. A positive offset joins qualifying income only at decision-grade provenance, a net loss always counts against DTI, and because the rent is projected the rental path always flags manual review. The departing residence never enters the DSCR portfolio.",
    workflow: {
      loanOfficerActions: [
        "Review the departing-residence manual-review note (projected rent) before finalizing DTI",
      ],
      borrowerActions: [
        "Upload a rental appraisal (Form 1007) or executed lease for the departing residence, plus the most recent Schedule E confirming no prior rental activity",
      ],
      automationEngineActions: [
        "Synthesize the departing residence into the per-property B3-3.8-01 offset set (75% of projected rent net of retained PITIA)",
        "Apply the S-05 gates (positive offset only at decision-grade provenance; a loss always counts) and flag manual review because the rent is projected",
        "Raise RENTAL_CONVERSION_OFFSET naming the offset and required documents",
      ],
    },
    engineRef:
      "server/services/preUnderwriting.ts + server/services/income/orchestrator.ts departingResidenceInput + server/services/income/paths/rental.ts computeRentalPath",
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
    regulations: ["Fannie Mae Selling Guide B3-3.5-01 (documentation requirements)"],
    riskImpact:
      "Business income generally needs two years of federal tax returns before approval-grade decisions — or IRS-issued transcripts for the same two years (B3-3.1-02). B3-3.5-01 states this as the general path, not an absolute: one year may suffice where the business has existed five years and the borrower has held 25%+ ownership for five consecutive years, and business returns may be waived on the two-year path under that section's stated conditions.",
    workflow: {
      loanOfficerActions: ["Hold clear-to-close until tax-return conditions clear"],
      borrowerActions: [
        "Upload 2 years of 1040s (or IRS transcripts for the same years, per B3-3.1-02)",
        "Upload a YTD profit-and-loss statement where the lender requires one — B3-3.7-04 makes it discretionary and not required for most businesses, arising where the application is dated more than 120 days after the business's tax year end",
      ],
      automationEngineActions: [
        "Force the complex-income block into the intake route",
        "Generate 2-year tax-return conditions that gate clear-to-close",
      ],
    },
    engineRef: "server/services/preUnderwriting.ts + server/pipelineEngine.ts + client/src/funnel/preApprovalMachine.ts",
  },
  {
    scenarioId: "F-THIRD-PARTY-PAID-DEBT",
    version: "1.0.0",
    title: "Someone else pays that debt (B3-6-05, Debts Paid by Others)",
    flagCode: "THIRD_PARTY_PAID_DEBT",
    status: "implemented",
    triggers: [
      "urla_liabilities.paid_by_other_party = true and the borrower's answers satisfy shared/liabilityExclusions.ts: the payer is not an interested party; for a mortgage/HELOC, the payer is obligated and no rental income from that property is used",
    ],
    regulations: ["Fannie Mae Selling Guide B3-6-05, Debts Paid by Others (08/05/2026 edition)"],
    riskImpact:
      "The payment leaves the qualifying DTI the moment the answers qualify, as the Guide allows; without the 12-month third-party payment history the exclusion cannot be sustained at the lender, so the paperwork must travel with it.",
    workflow: {
      loanOfficerActions: [
        "Clear the per-liability condition on 12 months of the payer's cancelled checks or bank statements showing no delinquency; if it cannot be documented, uncheck the claim so the payment returns to the ratio",
      ],
      borrowerActions: ["Provide 12 months of cancelled checks or bank statements from the person who makes the payments"],
      automationEngineActions: [
        "Exclude the payment from both DTI paths and declare it in the MISMO package (LiabilityExclusionIndicator)",
        "Raise THIRD_PARTY_PAID_DEBT and reconcile one PRE_UW_THIRD_PARTY_PAID_DEBT:<liabilityId> condition per excluded debt — created, retired when withdrawn, never duplicated",
      ],
    },
    engineRef: "shared/liabilityExclusions.ts assessPaidByOtherParty + server/services/preUnderwriting.ts reconcileThirdPartyPaidDebtConditions",
  },
];
