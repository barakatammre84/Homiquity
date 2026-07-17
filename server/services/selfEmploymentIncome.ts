/**
 * Deterministic self-employment income calculator — Fannie Mae Form 1084
 * Cash Flow Analysis / Selling Guide B3-3.5 & B3-3.6. Pure function: no IO, no
 * AI, no discretion (Reg B). Same worksheet in → same figure out.
 *
 * Every rule cites the section it implements. Do NOT add a rule or figure that
 * is not verified in docs/fannie-mae/self-employment-income-reference.md:
 *
 *  - Self-employed definition (25% ownership), 2-year average, stable-and-
 *    continuous standard ................................ B3-3.5-01
 *  - Schedule C add-backs / subtractions ................ B3-3.6-03
 *  - K-1 ordinary income: usable only with documented distributions or
 *    adequate business liquidity (quick/current ratio ≥ 1); guaranteed
 *    payments for 2+ years usable directly ............... B3-3.6-07
 *  - Entity business-return adjustments (add back depreciation / depletion /
 *    amortization-casualty-other losses; subtract travel & meals exclusion,
 *    non-recurring income, short-term obligations with roll-over waiver),
 *    applied at the K-1 ownership percentage ............. B3-3.7-01 / -02
 *  - Owner W-2 wages counted directly in the K-1 lane .... B3-3.7-02
 *
 * Where judgment is required (declining income, single-year history, income
 * gated out by liquidity, a net loss) the calculator is CONSERVATIVE and sets
 * requiresManualReview — it never automates an over-credit. A human confirms.
 */

import type { SelfEmploymentWorksheet } from "@shared/schema";

export interface SelfEmploymentIncomeResult {
  /** Monthly qualifying income usable toward DTI (never negative). */
  monthlyQualifyingIncome: number;
  /** Adjusted annual qualifying cash flow, most recent year. */
  netProfitYear1: number;
  /** Adjusted annual qualifying cash flow, prior year (0 when only one year). */
  netProfitYear2: number;
  /** Average annual qualifying cash flow used to derive the monthly figure. */
  avgAnnualCashFlow: number;
  /** Total add-backs applied across the averaged years (informational). */
  addBacks: number;
  /** Total subtractions applied across the averaged years (informational). */
  deductions: number;
  trend: "increasing" | "stable" | "declining" | "insufficient_history" | "loss" | "not_applicable";
  /** True when a human must confirm before the income is used. */
  requiresManualReview: boolean;
  /** Cited explanations for the LO / audit trail. */
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// --- Schedule C (B3-3.6-03) --------------------------------------------------

interface AnnualFigure {
  cashFlow: number;
  addBacks: number;
  deductions: number;
}

/** One Schedule C year → adjusted annual cash flow (B3-3.6-03). Add back the
 *  recurring non-cash items; subtract non-recurring income and the meals
 *  exclusion. */
function scheduleCAnnual(y: NonNullable<SelfEmploymentWorksheet["scheduleC"]>["currentYear"]): AnnualFigure {
  const addBacks =
    y.depreciation + y.depletion + y.amortizationOrCasualtyLoss + y.businessUseOfHome;
  const deductions = y.mealsExclusion + y.nonRecurringIncome;
  return { cashFlow: y.netProfitOrLoss + addBacks - deductions, addBacks, deductions };
}

// --- K-1: partnership / S-corp (B3-3.6-07) -----------------------------------

/** Is business liquidity adequate to withdraw ordinary income beyond
 *  distributions? Quick ratio for inventory-heavy businesses, current ratio
 *  otherwise; ≥ 1 is generally sufficient (B3-3.6-07). Returns null when it
 *  cannot be computed (no balance-sheet inputs). */
function liquidityAdequate(
  liq: NonNullable<SelfEmploymentWorksheet["k1"]>["liquidity"],
): boolean | null {
  if (!liq || liq.currentLiabilities <= 0) return null;
  const ratio =
    liq.inventory > 0
      ? (liq.currentAssets - liq.inventory) / liq.currentLiabilities // quick
      : liq.currentAssets / liq.currentLiabilities; // current
  return ratio >= 1;
}

// --- Two-year averaging + trend guard (B3-3.5-01) ----------------------------

interface AveragedYears {
  avg: number;
  year1: number;
  year2: number;
  trend: SelfEmploymentIncomeResult["trend"];
  manual: boolean;
}

/**
 * Average the most recent and prior year per B3-3.5-01's stable-and-continuous
 * standard. Conservative by construction:
 *  - single year → use it, flag review (2-year history generally required);
 *  - any net loss → flag review, never credit above the lower figure;
 *  - declining → use the most recent (lower) year, never average a decline up;
 *  - stable/increasing → straight two-year average.
 */
function averageTwoYears(recent: number, prior: number | null, notes: string[]): AveragedYears {
  if (prior === null) {
    notes.push(
      "Only one year of self-employment income provided. Fannie B3-3.5-01 generally requires a two-year average (a 12-month history qualifies only with the documented exception) — flagged for manual review.",
    );
    return { avg: recent, year1: recent, year2: 0, trend: "insufficient_history", manual: true };
  }
  if (recent < 0 || prior < 0) {
    notes.push(
      "A self-employment year shows a net loss. Qualifying income requires manual analysis under B3-3.5-01 (stable and continuous); used the lower of the two-year average and the most recent year, floored at zero.",
    );
    const avg = Math.min((recent + prior) / 2, recent);
    return { avg, year1: recent, year2: prior, trend: "loss", manual: true };
  }
  if (recent < prior) {
    notes.push(
      "Self-employment income is declining year over year. Used the most recent (lower) year rather than averaging the decline up, and flagged for manual analysis (B3-3.5-01 stable and continuous).",
    );
    return { avg: recent, year1: recent, year2: prior, trend: "declining", manual: true };
  }
  const avg = (recent + prior) / 2;
  return {
    avg,
    year1: recent,
    year2: prior,
    trend: recent > prior ? "increasing" : "stable",
    manual: false,
  };
}

const empty = (trend: SelfEmploymentIncomeResult["trend"], notes: string[]): SelfEmploymentIncomeResult => ({
  monthlyQualifyingIncome: 0,
  netProfitYear1: 0,
  netProfitYear2: 0,
  avgAnnualCashFlow: 0,
  addBacks: 0,
  deductions: 0,
  trend,
  requiresManualReview: false,
  notes,
});

/**
 * Compute monthly qualifying self-employment income from a captured worksheet.
 * Deterministic and cited; see the module header.
 */
export function computeSelfEmploymentQualifyingIncome(
  wk: SelfEmploymentWorksheet | null | undefined,
): SelfEmploymentIncomeResult {
  const notes: string[] = [];
  if (!wk) return empty("not_applicable", notes);

  // Sole proprietorship / single-member LLC → Schedule C (B3-3.6-03)
  if (wk.businessStructure === "sole_proprietorship" || wk.businessStructure === "single_member_llc") {
    if (!wk.scheduleC) return empty("insufficient_history", ["No Schedule C figures captured."]);
    const cur = scheduleCAnnual(wk.scheduleC.currentYear);
    const prior = wk.scheduleC.priorYear ? scheduleCAnnual(wk.scheduleC.priorYear) : null;
    const { avg, year1, year2, trend, manual } = averageTwoYears(
      cur.cashFlow,
      prior ? prior.cashFlow : null,
      notes,
    );
    return {
      monthlyQualifyingIncome: round2(Math.max(0, avg) / 12),
      netProfitYear1: round2(year1),
      netProfitYear2: round2(year2),
      avgAnnualCashFlow: round2(avg),
      addBacks: round2(cur.addBacks + (prior?.addBacks ?? 0)),
      deductions: round2(cur.deductions + (prior?.deductions ?? 0)),
      trend,
      requiresManualReview: manual,
      notes,
    };
  }

  // Partnership / S corporation → Schedule K-1 (B3-3.6-07) + entity-level
  // business-return analysis (B3-3.7-01 / B3-3.7-02)
  if (wk.businessStructure === "partnership" || wk.businessStructure === "s_corporation") {
    const k1 = wk.k1;
    if (!k1) return empty("insufficient_history", ["No K-1 figures captured."]);
    const gate = liquidityAdequate(k1.liquidity);
    let gatedDown = false;
    let liquidityUnknown = false;
    let entityWithoutOwnership = false;
    let entityAddBacks = 0;
    let entityDeductions = 0;

    // Borrower's share of the entity's cash-flow adjustments (B3-3.7-01/-02):
    // add back depreciation, depletion, amortization/casualty/other
    // non-recurring losses; subtract the travel & meals exclusion,
    // non-recurring income, and short-term obligations (mortgages/notes/bonds
    // payable < 1 year — waivable when they roll over regularly or liquid
    // assets cover them). Proportionate share per the K-1 ownership
    // percentage; without a captured percentage the adjustment is skipped and
    // flagged rather than guessed.
    const entityShare = (
      y: NonNullable<SelfEmploymentWorksheet["k1"]>["currentYear"],
    ): number => {
      const ea = y.entityAnalysis;
      if (!ea) return 0;
      if (wk.ownershipPercent === undefined || wk.ownershipPercent === null) {
        entityWithoutOwnership = true;
        return 0;
      }
      const share = wk.ownershipPercent / 100;
      const addBacks =
        ea.depreciation + ea.depletion + ea.amortizationCasualtyOtherLosses;
      const deductions =
        ea.travelMealsExclusion +
        ea.nonRecurringIncome +
        (ea.shortTermObligationsWaived ? 0 : ea.shortTermObligations);
      entityAddBacks += addBacks * share;
      entityDeductions += deductions * share;
      return (addBacks - deductions) * share;
    };

    // Per-year usable income: guaranteed payments held ≥2 years are usable
    // directly, as is the borrower's own-business W-2 salary (B3-3.7-02:
    // wages received "in addition to their proportionate share"; the agency
    // wage path skips self-employed rows, so it counts only here). The
    // adjusted business income — K-1 boxes plus the entity-share adjustment —
    // is usable only if documented distributions cover it OR business
    // liquidity is adequate; otherwise only the amount actually distributed
    // counts (B3-3.6-07, B3-3.7-01/-02).
    const usable = (y: NonNullable<SelfEmploymentWorksheet["k1"]>["currentYear"]): number => {
      const guaranteedDirect = k1.hasTwoYearGuaranteedPayments ? y.guaranteedPayments : 0;
      const gatedPool =
        y.ordinaryBusinessIncome +
        y.netRentalRealEstateIncome +
        y.otherNetRentalIncome +
        (k1.hasTwoYearGuaranteedPayments ? 0 : y.guaranteedPayments) +
        entityShare(y);
      let ordinaryUsable: number;
      if (gatedPool <= 0) {
        ordinaryUsable = gatedPool; // a loss flows through (handled by averaging guard)
      } else if (y.distributionsReceived >= gatedPool) {
        ordinaryUsable = gatedPool; // distributions cover the income used
      } else if (gate === true) {
        ordinaryUsable = gatedPool; // adequate liquidity confirmed
      } else {
        ordinaryUsable = Math.max(0, y.distributionsReceived); // only distributed income
        gatedDown = true;
        if (gate === null) liquidityUnknown = true;
      }
      return guaranteedDirect + k1.w2FromBusiness + ordinaryUsable;
    };

    const curUsable = usable(k1.currentYear);
    const priorUsable = k1.priorYear ? usable(k1.priorYear) : null;

    if (gatedDown) {
      notes.push(
        liquidityUnknown
          ? "K-1 ordinary income exceeds documented distributions and business liquidity could not be confirmed (no balance-sheet figures). Only distributed income was used; provide a business balance sheet to use the full amount (B3-3.6-07)."
          : "K-1 ordinary income exceeds documented distributions and the business liquidity ratio is below 1. Only distributed income was used (B3-3.6-07).",
      );
    }
    if (entityWithoutOwnership) {
      notes.push(
        "Business-return adjustments were captured but no ownership percentage is on the worksheet — the entity-level adjustment was skipped rather than guessed (B3-3.7: the borrower's share follows the K-1 ownership percentage). Capture the percentage to apply it; flagged for review.",
      );
    }
    if ((entityAddBacks !== 0 || entityDeductions !== 0) && !entityWithoutOwnership) {
      notes.push(
        `Entity cash-flow adjustment applied at ${wk.ownershipPercent}% ownership: +${round2(entityAddBacks)} add-backs (depreciation/depletion/amortization-casualty), −${round2(entityDeductions)} subtractions (travel & meals, non-recurring income, short-term obligations) per B3-3.7-01/-02.`,
      );
    }
    if (k1.w2FromBusiness > 0) {
      notes.push(
        `Included the borrower's own-business W-2 salary (${round2(k1.w2FromBusiness)}/yr) directly: B3-3.7-02 treats owner wages as income in addition to the K-1 share, and the wage path skips self-employed employment rows.`,
      );
    }

    const { avg, year1, year2, trend, manual } = averageTwoYears(curUsable, priorUsable, notes);
    return {
      monthlyQualifyingIncome: round2(Math.max(0, avg) / 12),
      netProfitYear1: round2(year1),
      netProfitYear2: round2(year2),
      avgAnnualCashFlow: round2(avg),
      addBacks: round2(entityAddBacks),
      deductions: round2(entityDeductions),
      trend,
      requiresManualReview: manual || gatedDown || entityWithoutOwnership,
      notes,
    };
  }

  // C corporation: the borrower's qualifying income is W-2 wages + dividends,
  // handled by the standard employment/other-income path — not the business's
  // ordinary income. No self-employment cash-flow figure here.
  notes.push(
    "C-corporation ordinary income is not the borrower's qualifying income; W-2 wages and dividends are captured through the standard income path.",
  );
  return empty("not_applicable", notes);
}
