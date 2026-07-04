/**
 * Qualified Mortgage (QM) points-and-fees and APR-APOR spread thresholds used
 * by Fannie Mae Loan Delivery edits.
 *
 * Source of truth: docs/fannie-mae/"Loan Delivery Qualified Mortgage (QM)
 * Edits Job Aid 2026 Update.pdf" (updated 2026-01-05), main table (2026) and
 * the "Appendix – Previous Thresholds" tables (2025, 2024). Thresholds are
 * selected by NOTE DATE year — Reg Z 1026.43(e) dollar amounts are adjusted
 * annually by the CFPB.
 *
 * Loan Delivery edit semantics (per the job aid):
 *  - The Original Loan Amount picks the tier (range lookup).
 *  - The max-allowable points-and-fees dollar amount for percentage tiers is
 *    computed on the Regulation Z Total Loan Amount, not the original amount.
 *  - The APR-APOR spread is computed from the UCD-provided APR and APOR. For
 *    short-reset ARMs (first rate change within 5 years of first payment) the
 *    gse:QualifiedMortgageShortResetARM_APRPercent is used as the APR.
 *  - Exempt loans (AbilityToRepayMethodType = "Exempt"): points and fees may
 *    not exceed 5% of the Regulation Z Total Loan Amount (edit C47) and the
 *    APR may not exceed the APOR by 6.5000% or more (edits C52/C96/C92/C99).
 *
 * Never extend these tables from memory: add a new year only after the CFPB /
 * Fannie Mae job aid publishes it, and cite the document in the commit.
 */

export interface PointsAndFeesTier {
  /** Inclusive lower bound on the ORIGINAL loan amount for this tier. */
  minLoanAmount: number;
  /** Exclusive upper bound on the original loan amount (null = no cap). */
  maxLoanAmount: number | null;
  /** Cap as a percentage of the Regulation Z Total Loan Amount, when set. */
  maxPercentOfTotalLoanAmount?: number;
  /** Cap as a flat dollar amount, when set. */
  maxDollarAmount?: number;
}

export interface AprAporSpreadTier {
  /** Inclusive lower bound on the original loan amount for this tier. */
  minLoanAmount: number;
  /** Exclusive upper bound on the original loan amount (null = no cap). */
  maxLoanAmount: number | null;
  /** Maximum allowable APR-APOR spread, in percentage points. */
  maxSpreadPercent: number;
}

export interface QmThresholdTable {
  /** Note-date year the table applies to. */
  noteYear: number;
  /** ATR-covered loans — Loan Delivery edits C87/C88. */
  pointsAndFees: PointsAndFeesTier[];
  /**
   * ATR-covered first-lien transactions — edits C85 (fixed), C94 (ARM),
   * C90/C97 (short-reset ARM).
   */
  aprAporSpread: AprAporSpreadTier[];
  /**
   * ATR-covered first-lien transactions secured by a manufactured home —
   * edits C86 (fixed), C95 (ARM), C91/C98 (short-reset ARM).
   */
  aprAporSpreadManufacturedHome: AprAporSpreadTier[];
}

/** Exempt-loan caps do not vary by year in the job aid. */
export const EXEMPT_MAX_POINTS_AND_FEES_PERCENT = 5; // edit C47
export const EXEMPT_MAX_APR_APOR_SPREAD_PERCENT = 6.5; // edits C52/C96/C92/C99

export const QM_THRESHOLD_TABLES: QmThresholdTable[] = [
  {
    // "2026 Loan Amounts and Value Thresholds - Based on Note Date"
    noteYear: 2026,
    pointsAndFees: [
      { minLoanAmount: 0, maxLoanAmount: 17_245, maxPercentOfTotalLoanAmount: 8 },
      { minLoanAmount: 17_245, maxLoanAmount: 27_592, maxDollarAmount: 1_380 },
      { minLoanAmount: 27_592, maxLoanAmount: 82_775, maxPercentOfTotalLoanAmount: 5 },
      { minLoanAmount: 82_775, maxLoanAmount: 137_958, maxDollarAmount: 4_139 },
      { minLoanAmount: 137_958, maxLoanAmount: null, maxPercentOfTotalLoanAmount: 3 },
    ],
    aprAporSpread: [
      { minLoanAmount: 0, maxLoanAmount: 82_775, maxSpreadPercent: 6.5 },
      { minLoanAmount: 82_775, maxLoanAmount: 137_958, maxSpreadPercent: 3.5 },
      { minLoanAmount: 137_958, maxLoanAmount: null, maxSpreadPercent: 2.25 },
    ],
    aprAporSpreadManufacturedHome: [
      // Job aid expresses this tier as "less than or equal to $137,958".
      { minLoanAmount: 0, maxLoanAmount: 137_958.01, maxSpreadPercent: 6.5 },
      { minLoanAmount: 137_958.01, maxLoanAmount: null, maxSpreadPercent: 2.25 },
    ],
  },
  {
    // Appendix: "2025 Loan Amounts and Value Thresholds - Based on Note Date"
    noteYear: 2025,
    pointsAndFees: [
      { minLoanAmount: 0, maxLoanAmount: 16_855, maxPercentOfTotalLoanAmount: 8 },
      { minLoanAmount: 16_855, maxLoanAmount: 26_968, maxDollarAmount: 1_348 },
      { minLoanAmount: 26_968, maxLoanAmount: 80_905, maxPercentOfTotalLoanAmount: 5 },
      { minLoanAmount: 80_905, maxLoanAmount: 134_841, maxDollarAmount: 4_045 },
      { minLoanAmount: 134_841, maxLoanAmount: null, maxPercentOfTotalLoanAmount: 3 },
    ],
    aprAporSpread: [
      { minLoanAmount: 0, maxLoanAmount: 80_905, maxSpreadPercent: 6.5 },
      { minLoanAmount: 80_905, maxLoanAmount: 134_841, maxSpreadPercent: 3.5 },
      { minLoanAmount: 134_841, maxLoanAmount: null, maxSpreadPercent: 2.25 },
    ],
    aprAporSpreadManufacturedHome: [
      { minLoanAmount: 0, maxLoanAmount: 134_841.01, maxSpreadPercent: 6.5 },
      { minLoanAmount: 134_841.01, maxLoanAmount: null, maxSpreadPercent: 2.25 },
    ],
  },
  {
    // Appendix: "2024 Loan Amounts and Value Thresholds - Based on Note Date"
    noteYear: 2024,
    pointsAndFees: [
      { minLoanAmount: 0, maxLoanAmount: 16_308, maxPercentOfTotalLoanAmount: 8 },
      { minLoanAmount: 16_308, maxLoanAmount: 26_092, maxDollarAmount: 1_305 },
      { minLoanAmount: 26_092, maxLoanAmount: 78_277, maxPercentOfTotalLoanAmount: 5 },
      { minLoanAmount: 78_277, maxLoanAmount: 130_461, maxDollarAmount: 3_914 },
      { minLoanAmount: 130_461, maxLoanAmount: null, maxPercentOfTotalLoanAmount: 3 },
    ],
    aprAporSpread: [
      { minLoanAmount: 0, maxLoanAmount: 78_277, maxSpreadPercent: 6.5 },
      { minLoanAmount: 78_277, maxLoanAmount: 130_461, maxSpreadPercent: 3.5 },
      { minLoanAmount: 130_461, maxLoanAmount: null, maxSpreadPercent: 2.25 },
    ],
    aprAporSpreadManufacturedHome: [
      { minLoanAmount: 0, maxLoanAmount: 130_461.01, maxSpreadPercent: 6.5 },
      { minLoanAmount: 130_461.01, maxLoanAmount: null, maxSpreadPercent: 2.25 },
    ],
  },
];

/**
 * Resolve the threshold table for a note date. Returns null for years the job
 * aid does not cover locally (pre-2024, or a future year not yet published) —
 * callers must surface "manual review" rather than borrowing an adjacent
 * year's dollar amounts.
 */
export function resolveQmThresholds(noteDate: Date | string): QmThresholdTable | null {
  const d = typeof noteDate === "string" ? new Date(noteDate) : noteDate;
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  return QM_THRESHOLD_TABLES.find(t => t.noteYear === year) ?? null;
}

export interface PointsAndFeesEvaluation {
  evaluated: boolean;
  /** Why the check could not run, when evaluated=false. */
  reason?: string;
  compliant?: boolean;
  maxAllowableAmount?: number;
  tierDescription?: string;
}

/**
 * ATR-covered points-and-fees check (Loan Delivery edits C87/C88).
 * `originalLoanAmount` selects the tier; percentage caps apply to
 * `regulationZTotalLoanAmount`.
 */
export function evaluateCoveredPointsAndFees(
  noteDate: Date | string,
  originalLoanAmount: number,
  regulationZTotalLoanAmount: number,
  regulationZTotalPointsAndFeesAmount: number,
): PointsAndFeesEvaluation {
  const table = resolveQmThresholds(noteDate);
  if (!table) {
    return {
      evaluated: false,
      reason: `No QM threshold table available for the note date (${String(noteDate)}); manual review required`,
    };
  }
  const tier = table.pointsAndFees.find(
    t => originalLoanAmount >= t.minLoanAmount && (t.maxLoanAmount === null || originalLoanAmount < t.maxLoanAmount),
  );
  if (!tier) {
    return { evaluated: false, reason: "Original loan amount did not match a points-and-fees tier" };
  }
  const maxAllowable = tier.maxDollarAmount !== undefined
    ? tier.maxDollarAmount
    : (tier.maxPercentOfTotalLoanAmount! / 100) * regulationZTotalLoanAmount;
  const tierDescription = tier.maxDollarAmount !== undefined
    ? `$${tier.maxDollarAmount.toLocaleString("en-US")} flat cap`
    : `${tier.maxPercentOfTotalLoanAmount}% of Regulation Z Total Loan Amount`;
  return {
    evaluated: true,
    compliant: regulationZTotalPointsAndFeesAmount <= maxAllowable,
    maxAllowableAmount: Math.round(maxAllowable * 100) / 100,
    tierDescription: `${table.noteYear} table, ${tierDescription}`,
  };
}

/** Exempt-loan points-and-fees check (Loan Delivery edit C47): flat 5% cap. */
export function evaluateExemptPointsAndFees(
  regulationZTotalLoanAmount: number,
  regulationZTotalPointsAndFeesAmount: number,
): PointsAndFeesEvaluation {
  const maxAllowable = (EXEMPT_MAX_POINTS_AND_FEES_PERCENT / 100) * regulationZTotalLoanAmount;
  return {
    evaluated: true,
    compliant: regulationZTotalPointsAndFeesAmount <= maxAllowable,
    maxAllowableAmount: Math.round(maxAllowable * 100) / 100,
    tierDescription: `${EXEMPT_MAX_POINTS_AND_FEES_PERCENT}% of Regulation Z Total Loan Amount (exempt loans)`,
  };
}

export interface AprSpreadEvaluation {
  evaluated: boolean;
  reason?: string;
  compliant?: boolean;
  spreadPercent?: number;
  maxAllowableSpreadPercent?: number;
  tierDescription?: string;
}

/**
 * ATR-covered APR-APOR spread check (edits C85/C86/C94/C95/C90/C91/C97/C98).
 * For short-reset ARMs pass the gse:QualifiedMortgageShortResetARM_APRPercent
 * as `aprPercent`.
 */
export function evaluateCoveredAprSpread(
  noteDate: Date | string,
  originalLoanAmount: number,
  aprPercent: number,
  averagePrimeOfferRatePercent: number,
  manufacturedHome: boolean,
): AprSpreadEvaluation {
  const table = resolveQmThresholds(noteDate);
  if (!table) {
    return {
      evaluated: false,
      reason: `No QM threshold table available for the note date (${String(noteDate)}); manual review required`,
    };
  }
  const tiers = manufacturedHome ? table.aprAporSpreadManufacturedHome : table.aprAporSpread;
  const tier = tiers.find(
    t => originalLoanAmount >= t.minLoanAmount && (t.maxLoanAmount === null || originalLoanAmount < t.maxLoanAmount),
  );
  if (!tier) {
    return { evaluated: false, reason: "Original loan amount did not match an APR-APOR spread tier" };
  }
  const spread = aprPercent - averagePrimeOfferRatePercent;
  return {
    evaluated: true,
    // The job aid phrases the limit as "cannot exceed the APOR by the spread"
    // — a spread equal to the max is out of compliance for the 2.25/3.5
    // tiers' wording ("greater than the allowed APR spread" fires the edit),
    // so compliant means strictly not-greater-than the allowed value.
    compliant: spread <= tier.maxSpreadPercent,
    spreadPercent: Math.round(spread * 10_000) / 10_000,
    maxAllowableSpreadPercent: tier.maxSpreadPercent,
    tierDescription: `${table.noteYear} ${manufacturedHome ? "manufactured-home" : "first-lien"} table`,
  };
}

/**
 * Exempt-loan APR-APOR spread check (edits C52/C96/C92/C99): the APR "cannot
 * exceed the APOR by 6.5000% or more" — a spread of exactly 6.5 fails.
 */
export function evaluateExemptAprSpread(
  aprPercent: number,
  averagePrimeOfferRatePercent: number,
): AprSpreadEvaluation {
  const spread = aprPercent - averagePrimeOfferRatePercent;
  return {
    evaluated: true,
    compliant: spread < EXEMPT_MAX_APR_APOR_SPREAD_PERCENT,
    spreadPercent: Math.round(spread * 10_000) / 10_000,
    maxAllowableSpreadPercent: EXEMPT_MAX_APR_APOR_SPREAD_PERCENT,
    tierDescription: "exempt loans (6.5000% hard limit, inclusive)",
  };
}
