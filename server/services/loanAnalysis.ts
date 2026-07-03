import { storage } from "../storage";
import { lookupResolver } from "./lookupResolver";
import { recalculateDecision, type InstantDecision } from "./decisionEngine";

// =============================================================================
// DETERMINISTIC INTAKE ANALYSIS
//
// Replaces the former LLM-backed intake analysis (server/gemini.ts). Every
// number here is computed with closed-form math; every threshold comes from
// the Postgres lookup matrices or a cited guideline. No AI model sits in this
// path (Reg B / ECOA — see tests/complianceInvariants.test.ts).
//
// Decision locus:
//   - APPROVED (engine)        -> "pre_approved"  (automation may say yes)
//   - MANUAL_REVIEW / REJECTED -> "under_review"  (only a human may say no —
//     a formal denial requires ECOA adverse-action handling, so intake never
//     auto-denies; the engine's reasons are preserved for the underwriter)
//   - NEEDS_MORE_INFO          -> "under_review" with the specific gaps
// =============================================================================

export interface LoanScenario {
  loanType: "conventional" | "fha" | "va";
  loanTerm: number;
  interestRate: string;
  apr: string;
  points: string;
  pointsCost: string;
  monthlyPayment: string;
  principalAndInterest: string;
  propertyTax: string;
  homeInsurance: string;
  pmi: string;
  loanAmount: string;
  closingCosts: string;
  cashToClose: string;
  totalInterestPaid: string;
  downPaymentAmount: string;
  downPaymentPercent: string;
  isRecommended: boolean;
}

export interface IntakeAnalysisResult {
  /** Application status to persist. Intake never sets "denied" (ECOA locus). */
  outcome: "pre_approved" | "under_review";
  isApproved: boolean;
  preApprovalAmount: string;
  dtiRatio: string;
  ltvRatio: string;
  analysis: {
    strengths: string[];
    concerns: string[];
    recommendations: string[];
  };
  scenarios: LoanScenario[];
  /** The full engine decision, for callers that want status/qualifier/reasons. */
  decision: InstantDecision | null;
}

// Same rate model as generateLoanEstimate (loanEstimate.ts): product base rate
// with representative-FICO adjustments. Illustrative until real rate-sheet
// pricing (pricingAdapter.computeOffers) is bound to the borrower UI.
function baseRateFor(loanType: "conventional" | "fha" | "va", creditScore: number): number {
  let rate = 6.875;
  if (loanType === "va") rate = 6.25;
  else if (loanType === "fha") rate = 6.5;

  if (creditScore >= 780) rate -= 0.25;
  else if (creditScore >= 760) rate -= 0.125;
  else if (creditScore < 680) rate += 0.375;
  else if (creditScore < 700) rate += 0.25;
  return rate;
}

function monthlyPI(loanAmount: number, annualRate: number, termMonths: number): number {
  if (annualRate <= 0) return loanAmount / termMonths;
  const r = annualRate / 100 / 12;
  return (loanAmount * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function toNumber(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[,$]/g, ""));
  return isNaN(n) ? 0 : n;
}

interface ScenarioInputs {
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  creditScore: number;
  isVeteran: boolean;
  isFirstTimeBuyer: boolean;
  /** Engine-resolved monthly PMI for the conventional path (matrix-driven). */
  enginePmiMonthly: number | null;
}

// Escrow model matches generateLoanEstimate: tax 1.2%/yr, insurance
// max($1,200, 0.3% of price)/yr.
function escrowFor(purchasePrice: number): { tax: number; insurance: number } {
  return {
    tax: (purchasePrice * 0.012) / 12,
    insurance: Math.max(1200, purchasePrice * 0.003) / 12,
  };
}

function buildScenario(
  loanType: "conventional" | "fha" | "va",
  inputs: ScenarioInputs,
  opts: { points?: number; isRecommended?: boolean } = {},
): LoanScenario {
  const { purchasePrice, downPayment, loanAmount, creditScore } = inputs;
  const termMonths = 360;
  const points = opts.points ?? 0;
  // 1 discount point buys ~0.25% off the rate (standard rule of thumb; the
  // real buy-down comes from rate sheets once Contract 2 lands).
  const rate = baseRateFor(loanType, creditScore) - points * 0.25;
  const { tax, insurance } = escrowFor(purchasePrice);
  const ltv = (loanAmount / purchasePrice) * 100;

  let mi = 0;
  if (loanType === "conventional" && ltv > 80) {
    // Prefer the engine's matrix-resolved PMI premium; fall back to 0.6%/yr.
    mi = inputs.enginePmiMonthly ?? (loanAmount * 0.006) / 12;
  } else if (loanType === "fha") {
    // FHA annual MIP, 0.85% for LTV > 95% is the common case; 0.80% under.
    mi = (loanAmount * (ltv > 95 ? 0.0085 : 0.008)) / 12;
  }
  // VA loans carry no monthly MI (funding fee is financed, not escrowed).

  const pi = monthlyPI(loanAmount, rate, termMonths);
  const pointsCost = loanAmount * (points / 100); // 1 point = 1% of loan amount
  const closingPct = loanType === "fha" ? 0.035 : loanType === "va" ? 0.025 : 0.03;
  const closingCosts = loanAmount * closingPct + pointsCost;

  return {
    loanType,
    loanTerm: 30,
    interestRate: rate.toFixed(3),
    apr: (rate + (loanType === "fha" ? 0.5 : 0.25)).toFixed(3),
    points: String(points),
    pointsCost: pointsCost.toFixed(2),
    monthlyPayment: (pi + tax + insurance + mi).toFixed(2),
    principalAndInterest: pi.toFixed(2),
    propertyTax: tax.toFixed(2),
    homeInsurance: insurance.toFixed(2),
    pmi: mi.toFixed(2),
    loanAmount: loanAmount.toFixed(2),
    closingCosts: closingCosts.toFixed(2),
    cashToClose: (downPayment + closingCosts).toFixed(2),
    totalInterestPaid: (pi * termMonths - loanAmount).toFixed(2),
    downPaymentAmount: downPayment.toFixed(2),
    downPaymentPercent: ((downPayment / purchasePrice) * 100).toFixed(2),
    isRecommended: opts.isRecommended ?? false,
  };
}

function buildScenarios(inputs: ScenarioInputs): LoanScenario[] {
  const scenarios: LoanScenario[] = [
    buildScenario("conventional", inputs, { isRecommended: !inputs.isVeteran }),
    buildScenario("conventional", inputs, { points: 1 }),
  ];
  if (inputs.creditScore <= 720 || inputs.isFirstTimeBuyer) {
    scenarios.push(buildScenario("fha", inputs));
  }
  if (inputs.isVeteran) {
    scenarios.push(buildScenario("va", inputs, { isRecommended: true }));
  }
  return scenarios;
}

/**
 * Maximum purchase price the borrower's income supports at the policy DTI cap,
 * solved in closed form from the same payment model as the scenarios:
 *
 *   budget = dtiCap * monthlyIncome - monthlyDebts        (max total PITI)
 *   budget = loan*k + (loan+down)*t/12 + ins + loan*p/12  (payment at price)
 *   =>  loan = (budget - ins - down*t/12) / (k + t/12 + p/12)
 *
 * where k is the amortization factor, t the annual tax rate, p the annual
 * PMI rate (0 when the resulting LTV would be <= 80%).
 */
function maxQualifyingPurchase(
  dtiCapPct: number,
  monthlyIncome: number,
  monthlyDebts: number,
  downPayment: number,
  creditScore: number,
): number {
  const budget = (dtiCapPct / 100) * monthlyIncome - monthlyDebts;
  if (budget <= 0) return 0;

  const rate = baseRateFor("conventional", creditScore);
  const r = rate / 100 / 12;
  const n = 360;
  const k = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const t = 0.012; // annual property-tax model (matches loanEstimate)
  const ins = 150; // flat monthly insurance floor ($1,800/yr conservative)

  const solve = (pmiAnnual: number) => {
    const loan = (budget - ins - (downPayment * t) / 12) / (k + t / 12 + pmiAnnual / 12);
    return loan > 0 ? loan : 0;
  };

  // First assume PMI applies; if the solved LTV is actually <= 80%, re-solve without.
  let loan = solve(0.006);
  const price = loan + downPayment;
  if (price > 0 && loan / price <= 0.8) {
    loan = solve(0);
  }
  const maxPrice = loan + downPayment;
  return Math.floor(maxPrice / 1000) * 1000;
}

/** Friendly rewrite of engine-internal error strings that surface as gaps. */
function friendlyMissingItems(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (/VA PROTOCOL/i.test(item)) {
      out.push("Household size (required for VA residual-income review, VA Pamphlet 26-7, Ch. 4)");
      out.push("Home square footage (required for the VA utility-cost calculation)");
    } else if (/CRITICAL/i.test(item)) {
      out.push("Additional underwriting inputs are required — an underwriter will follow up.");
    } else {
      out.push(item);
    }
  }
  return out;
}

export async function analyzeIntake(applicationId: string): Promise<IntakeAnalysisResult> {
  const app = await storage.getLoanApplication(applicationId);
  if (!app) {
    throw new Error("Application not found");
  }

  // Compute the decision AND stamp an immutable snapshot (trigger: "intake"),
  // so the decision history starts at minute zero.
  const decision = await recalculateDecision(applicationId, "intake");

  const purchasePrice = toNumber(app.purchasePrice);
  const downPayment = toNumber(app.downPayment);
  const loanAmount = purchasePrice - downPayment;
  const creditScore = app.creditScore ?? 0;
  const monthlyIncome = decision?.metrics?.monthlyIncome ?? toNumber(app.annualIncome) / 12;
  const monthlyDebts = decision?.metrics?.monthlyDebts ?? toNumber(app.monthlyDebts);

  const scenarios =
    purchasePrice > 0 && loanAmount > 0 && creditScore > 0
      ? buildScenarios({
          purchasePrice,
          downPayment,
          loanAmount,
          creditScore,
          isVeteran: app.isVeteran ?? false,
          isFirstTimeBuyer: app.isFirstTimeBuyer ?? false,
          enginePmiMonthly: decision?.metrics ? decision.metrics.pmiMonthly : null,
        })
      : [];

  const strengths: string[] = [];
  const concerns: string[] = [];
  const recommendations: string[] = [];

  if (creditScore > 0) {
    strengths.push(
      `Credit score: ${creditScore} (620 minimum for conforming eligibility, Fannie Mae Eligibility Matrix)`,
    );
  }
  if (purchasePrice > 0 && downPayment > 0) {
    strengths.push(
      `Down payment: ${((downPayment / purchasePrice) * 100).toFixed(1)}% ($${downPayment.toLocaleString()})`,
    );
  }
  if (app.employmentYears) {
    strengths.push(`Employment: ${app.employmentType ?? "employed"}, ${app.employmentYears} years`);
  }

  const metrics = decision?.metrics ?? null;
  if (metrics) {
    if (metrics.monthsOfReserves > 0) {
      strengths.push(
        `Verified reserves: ${metrics.monthsOfReserves} months of PITI (post-haircut, Fannie Mae B3-4.1)`,
      );
    }
    if (metrics.pmiMonthly > 0) {
      recommendations.push(
        `PMI of $${metrics.pmiMonthly.toFixed(2)}/mo applies while LTV exceeds 80% — cancellable at 80% by request, auto-terminating at 78% (Homeowners Protection Act, 12 U.S.C. §4902)`,
      );
    }
  }
  if (app.isVeteran) {
    recommendations.push(
      "VA eligibility: $0-down purchase with no monthly mortgage insurance; qualification uses residual income, not DTI alone (VA Pamphlet 26-7, Ch. 4)",
    );
  }

  // Engine reasons are already threshold-cited — pass them through verbatim.
  if (decision) {
    concerns.push(...decision.reasons);
    if (decision.status === "NEEDS_MORE_INFO") {
      concerns.push(...friendlyMissingItems(decision.missingItems));
    }
    if (decision.decision === "MANUAL_REVIEW" && metrics) {
      concerns.push(
        `DTI of ${metrics.dti.toFixed(2)}% exceeds the 43% manual-underwriting cap (Reg Z ATR/QM, 12 CFR §1026.43; Fannie Mae B3-6-02) — eligible only with AUS approval, up to the 50% ceiling`,
      );
    }
    if (decision.qualifier === "PRELIMINARY") {
      recommendations.push(
        "Figures are based on self-reported information — verifying income and assets upgrades this to a decision-grade result",
      );
    }
  } else {
    concerns.push("Automated evaluation was unavailable — an underwriter will review your application.");
  }

  const isApproved = decision?.decision === "APPROVED";

  let preApprovalAmount = "0";
  if (isApproved && monthlyIncome > 0) {
    const dtiCapPct = await lookupResolver
      .getPolicyScalar("CONVENTIONAL_DTI_CAP")
      .catch(() => 43);
    const maxPrice = maxQualifyingPurchase(dtiCapPct, monthlyIncome, monthlyDebts, downPayment, creditScore);
    // Never issue less than the price the engine just approved.
    preApprovalAmount = String(Math.max(maxPrice, purchasePrice));
  }

  return {
    outcome: isApproved ? "pre_approved" : "under_review",
    isApproved,
    preApprovalAmount,
    dtiRatio: metrics ? metrics.dti.toFixed(2) : "0",
    ltvRatio: metrics ? metrics.ltv.toFixed(2) : "0",
    analysis: { strengths, concerns, recommendations },
    scenarios,
    decision,
  };
}
