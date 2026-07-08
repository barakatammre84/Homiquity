/**
 * Approval Strength — client-side educational scoring.
 *
 * This is a rough, EDUCATIONAL approximation of how the major factors lenders
 * weigh (credit, income documentation, existing debt load, down payment)
 * stack up for a shopper. It is deliberately NOT the underwriting engine:
 * it never calls the server, never sees a credit report, and must never be
 * used for an actual loan decision. Anonymous traffic gets arithmetic on
 * their own inputs, nothing more — no rate, no payment, no priced result.
 *
 * Deterministic by design: same inputs, same read. Thresholds are broad
 * industry conventions (e.g. most conventional programs look for 620+
 * credit and a two-year self-employment history), intentionally hedged in
 * the copy because real program rules vary by lender and change over time.
 */

export type IncomeShape =
  | "w2_2plus"
  | "w2_under2"
  | "self_employed_2plus"
  | "self_employed_under2";

export type CreditBand =
  | "760_plus"
  | "720_759"
  | "680_719"
  | "640_679"
  | "620_639"
  | "below_620";

export type PriceBand =
  | "under_200k"
  | "200_350k"
  | "350_500k"
  | "500_750k"
  | "750k_plus"
  | "not_sure";

export interface ApprovalStrengthInputs {
  incomeShape: IncomeShape;
  annualIncome: number;
  monthlyDebts: number;
  downPaymentSaved: number;
  creditBand: CreditBand;
  priceBand: PriceBand;
}

export type FactorStatus = "helping" | "neutral" | "hurting" | "unknown";

export type FactorId = "credit" | "income_shape" | "debt_load" | "down_payment";

export interface Factor {
  id: FactorId;
  label: string;
  status: FactorStatus;
  /** One-line read of where this factor stands. */
  headline: string;
  /** Educational "why lenders care / what moves it" copy. */
  detail: string;
  /** 0–100 internal score; null when the factor can't be assessed. */
  score: number | null;
}

export type StrengthBand = "strong" | "solid" | "mixed" | "needs_work";

export interface ApprovalStrengthResult {
  band: StrengthBand;
  bandLabel: string;
  summary: string;
  /** 0–100 blended score driving the band. */
  score: number;
  factors: Factor[];
  helping: Factor[];
  hurting: Factor[];
}

/** Midpoint used to turn "down payment saved" into a rough percentage. */
export const PRICE_BAND_MIDPOINTS: Record<Exclude<PriceBand, "not_sure">, number> = {
  under_200k: 150_000,
  "200_350k": 275_000,
  "350_500k": 425_000,
  "500_750k": 625_000,
  "750k_plus": 850_000,
};

const FACTOR_WEIGHTS: Record<FactorId, number> = {
  credit: 0.35,
  income_shape: 0.25,
  debt_load: 0.2,
  down_payment: 0.2,
};

function creditFactor(band: CreditBand): Factor {
  const base = { id: "credit" as const, label: "Credit" };
  switch (band) {
    case "760_plus":
      return {
        ...base,
        status: "helping",
        score: 95,
        headline: "Your credit range is in the strongest tier lenders use.",
        detail:
          "Credit history is the single heaviest factor in most reviews. In this range it works entirely in your favor — keep balances low and avoid new accounts while you shop.",
      };
    case "720_759":
      return {
        ...base,
        status: "helping",
        score: 85,
        headline: "Your credit range is a clear strength.",
        detail:
          "This range clears the bar for essentially every mainstream program. Lenders will focus their questions elsewhere in your file.",
      };
    case "680_719":
      return {
        ...base,
        status: "neutral",
        score: 70,
        headline: "Your credit range is workable for most programs.",
        detail:
          "You're comfortably above the minimums most conventional programs look for, with room to strengthen. Paying revolving balances below ~30% of their limits is usually the fastest lever.",
      };
    case "640_679":
      return {
        ...base,
        status: "neutral",
        score: 55,
        headline: "Your credit range qualifies for many programs, with less cushion.",
        detail:
          "Most conventional programs look for 620 or higher, so you're above the line — but lenders scrutinize the rest of the file more closely in this range. Small score gains matter here.",
      };
    case "620_639":
      return {
        ...base,
        status: "hurting",
        score: 40,
        headline: "Your credit range sits right at the edge many programs use.",
        detail:
          "Most conventional programs look for 620 or higher, so there's little margin. Some government-backed programs allow lower scores. A few months of on-time payments and lower balances can move you into a stronger range.",
      };
    case "below_620":
      return {
        ...base,
        status: "hurting",
        score: 20,
        headline: "Your credit range is below the line most conventional programs use.",
        detail:
          "Most conventional programs look for 620 or higher. Some government-backed options accept lower scores, but choices narrow. Pulling your free credit reports and disputing errors is the usual first step.",
      };
  }
}

function incomeShapeFactor(shape: IncomeShape): Factor {
  const base = { id: "income_shape" as const, label: "Income documentation" };
  switch (shape) {
    case "w2_2plus":
      return {
        ...base,
        status: "helping",
        score: 90,
        headline: "Steady W-2 income with a two-year history is the easiest to document.",
        detail:
          "Pay stubs and W-2s verify quickly, so this income shape rarely slows a file down. Keep the job stable through closing if you can.",
      };
    case "w2_under2":
      return {
        ...base,
        status: "neutral",
        score: 65,
        headline: "W-2 income with a shorter job history usually needs a little context.",
        detail:
          "Lenders like to see a two-year employment story, but recent grads, career changers in the same field, and similar cases are routinely fine with an explanation letter or school records.",
      };
    case "self_employed_2plus":
      return {
        ...base,
        status: "neutral",
        score: 70,
        headline: "Self-employment with a two-year track record is fully documentable.",
        detail:
          "Expect a heavier paperwork lift — typically two years of tax returns — and note that lenders work from your net (after-deduction) income, which can read lower than what you actually earn.",
      };
    case "self_employed_under2":
      return {
        ...base,
        status: "hurting",
        score: 30,
        headline: "Self-employment under two years is the hardest income shape to document.",
        detail:
          "Most programs want a two-year self-employment history shown on tax returns. Some make exceptions when the new business continues a prior W-2 career. Time and a strong first tax year are the main fixes.",
      };
  }
}

/** Existing monthly debts as a share of gross monthly income. */
export function debtShareOfIncome(annualIncome: number, monthlyDebts: number): number | null {
  if (annualIncome <= 0) return null;
  return monthlyDebts / (annualIncome / 12);
}

function debtLoadFactor(annualIncome: number, monthlyDebts: number): Factor {
  const base = { id: "debt_load" as const, label: "Existing debt load" };
  const share = debtShareOfIncome(annualIncome, monthlyDebts);
  if (share === null) {
    return {
      ...base,
      status: "unknown",
      score: null,
      headline: "Enter your income to see how your debts stack up.",
      detail:
        "Lenders compare your monthly debts to your gross monthly income. Without an income figure we can't gauge this factor.",
    };
  }
  const pct = Math.round(share * 100);
  if (share < 0.08) {
    return {
      ...base,
      status: "helping",
      score: 90,
      headline: `Your existing debts use about ${pct}% of your income — a light load.`,
      detail:
        "Lenders budget your total obligations against your income, so a light existing debt load leaves the most room for a future housing payment. This is a genuine strength.",
    };
  }
  if (share <= 0.2) {
    return {
      ...base,
      status: "neutral",
      score: 65,
      headline: `Your existing debts use about ${pct}% of your income — a typical load.`,
      detail:
        "This is in the normal range. Paying down a car loan or card balance before applying frees up room in the debt-to-income math lenders run.",
    };
  }
  if (share <= 0.35) {
    return {
      ...base,
      status: "hurting",
      score: 40,
      headline: `Your existing debts use about ${pct}% of your income — a heavy load.`,
      detail:
        "Existing obligations at this level consume a large share of the room lenders budget for total debt, before any housing payment is added. Paying down the highest-payment debt first usually helps most.",
    };
  }
  return {
    ...base,
    status: "hurting",
    score: 15,
    headline: `Your existing debts use about ${pct}% of your income — the factor working hardest against you.`,
    detail:
      "At this level, existing debts crowd out most of what lenders budget for total obligations. Reducing monthly payments — paying off, consolidating, or letting a loan season off — moves this factor more than anything else.",
  };
}

function downPaymentFactor(downPaymentSaved: number, priceBand: PriceBand): Factor {
  const base = { id: "down_payment" as const, label: "Down payment" };
  if (priceBand === "not_sure") {
    return {
      ...base,
      status: "unknown",
      score: null,
      headline: "Pick a rough price range to see how your savings stack up.",
      detail:
        "A down payment only means something relative to the price you're shopping. Choose a range above — even a rough one — and we'll gauge this factor.",
    };
  }
  const midpoint = PRICE_BAND_MIDPOINTS[priceBand];
  const share = downPaymentSaved / midpoint;
  const pct = share * 100;
  const pctLabel = pct >= 10 ? Math.round(pct).toString() : pct.toFixed(1);
  if (share >= 0.2) {
    return {
      ...base,
      status: "helping",
      score: 95,
      headline: `Your savings come to roughly ${pctLabel}% of a typical home in your range.`,
      detail:
        "At this level you'd typically avoid mortgage insurance on conventional loans and present the strongest possible file. Remember to hold back a cushion for closing costs and reserves.",
      };
  }
  if (share >= 0.1) {
    return {
      ...base,
      status: "helping",
      score: 75,
      headline: `Your savings come to roughly ${pctLabel}% of a typical home in your range.`,
      detail:
        "That's a solid down payment — comfortably above the minimums most programs use, though below the level where mortgage insurance typically drops off. Keep a separate cushion for closing costs.",
    };
  }
  if (share >= 0.05) {
    return {
      ...base,
      status: "neutral",
      score: 60,
      headline: `Your savings come to roughly ${pctLabel}% of a typical home in your range.`,
      detail:
        "This clears the minimums many programs use, but the file is thinner: closing costs come on top, and lenders like seeing reserves left over after closing. Every extra month of saving strengthens this factor.",
    };
  }
  if (share >= 0.03) {
    return {
      ...base,
      status: "neutral",
      score: 45,
      headline: `Your savings come to roughly ${pctLabel}% of a typical home in your range.`,
      detail:
        "You're near the entry point of low-down-payment programs, but closing costs (often meaningful on top of the down payment) can pinch. Down-payment assistance programs and gift funds are common ways buyers bridge this.",
    };
  }
  return {
    ...base,
    status: "hurting",
    score: 20,
    headline: `Your savings come to roughly ${pctLabel}% of a typical home in your range — below most program minimums.`,
    detail:
      "Most programs want at least a small down payment plus closing costs. Notable exceptions exist for eligible buyers (VA for qualifying service members and veterans, USDA in eligible rural areas), and gift funds or assistance programs can close the gap.",
  };
}

const BAND_META: Record<StrengthBand, { label: string; summary: string }> = {
  strong: {
    label: "Strong footing",
    summary:
      "The factors lenders weigh most look strong here. Files with this shape tend to move through review with few surprises — your main job is not to disturb it (no new debts, no job changes) while you shop.",
  },
  solid: {
    label: "Solid position",
    summary:
      "Most of your factors are working for you. Shore up the one or two flagged below and this becomes a strong file — the fixes are usually measured in weeks or months, not years.",
  },
  mixed: {
    label: "Mixed picture",
    summary:
      "Some factors help you, some work against you. That doesn't close doors — it means which program fits matters more, and the flagged factors below are where effort pays off fastest.",
  },
  needs_work: {
    label: "Needs some work",
    summary:
      "Several factors are working against you right now. The encouraging part: each one below is movable, and buyers rebuild these positions all the time. The factor details show where to start.",
  },
};

export function assessApprovalStrength(inputs: ApprovalStrengthInputs): ApprovalStrengthResult {
  const factors: Factor[] = [
    creditFactor(inputs.creditBand),
    incomeShapeFactor(inputs.incomeShape),
    debtLoadFactor(inputs.annualIncome, inputs.monthlyDebts),
    downPaymentFactor(inputs.downPaymentSaved, inputs.priceBand),
  ];

  // Blend scored factors by weight; unknown factors drop out and the
  // remaining weights renormalize so the band stays meaningful.
  let weighted = 0;
  let weightUsed = 0;
  for (const factor of factors) {
    if (factor.score === null) continue;
    weighted += factor.score * FACTOR_WEIGHTS[factor.id];
    weightUsed += FACTOR_WEIGHTS[factor.id];
  }
  const score = weightUsed > 0 ? Math.round(weighted / weightUsed) : 50;

  const band: StrengthBand =
    score >= 80 ? "strong" : score >= 62 ? "solid" : score >= 45 ? "mixed" : "needs_work";

  return {
    band,
    bandLabel: BAND_META[band].label,
    summary: BAND_META[band].summary,
    score,
    factors,
    helping: factors.filter((f) => f.status === "helping"),
    hurting: factors.filter((f) => f.status === "hurting"),
  };
}
