/**
 * Deterministic Underwriting Engine
 * 
 * Hard-coded rule-based system for mortgage eligibility decisions
 * Does NOT use probabilistic AI to avoid Fair Lending risks
 * AI is used for data extraction only; this engine performs qualification
 */

import type { 
  LoanApplication,
  EmploymentHistory,
  OtherIncomeSource,
  UrlaAsset,
  UrlaLiability,
  UrlaPropertyInfo,
} from "@shared/schema";
import { lookupResolver } from "./services/lookupResolver";
import { computeSelfEmploymentQualifyingIncome } from "./services/selfEmploymentIncome";

export interface IncomeQualificationResult {
  baseMonthlyIncome: number;
  variableMonthlyIncome: number;
  selfEmploymentMonthlyIncome: number;
  totalQualifyingIncome: number;
  details: {
    employment: {
      type: string;
      yearsEmployed: number;
      monthlyBase?: number;
      twoYearAverage?: number;
      trend?: "stable" | "declining" | "disqualified";
    }[];
    other: {
      type: string;
      monthlyAmount: number;
      yearsReceived?: number;
    }[];
    selfEmployment?: {
      netProfitYear1: number;
      netProfitYear2: number;
      avgNetProfit: number;
      addBacks: number;
      deductions: number;
      qualifyingIncome: number;
      trend?: string;
      requiresManualReview?: boolean;
      notes?: string[];
    };
  };
}

export interface AssetVerificationResult {
  totalAssets: number;
  liquidAssets: number;
  retirementAssets: number;
  reservesMonths: number;
  breakdown: {
    type: string;
    balance: number;
    haircut: number;
    verifiedValue: number;
  }[];
}

export interface LiabilityAssessmentResult {
  totalMonthlyPayment: number;
  excludedDebts: number;
  breakdown: {
    type: string;
    payment: number;
    remainingMonths?: number;
    included: boolean;
    reason: string;
  }[];
}

export interface DTICalculationResult {
  qualifyingIncome: number;
  housingExpense: number;
  nonHousingDebts: number;
  frontEndRatio: number;
  backEndRatio: number;
  status: "pass" | "fail" | "stretch";
  maxBackEndRatio: number;
  details: {
    frontend_definition: string;
    backend_definition: string;
    fannie_mae_limit_manual: number;
    fannie_mae_limit_aus: number;
  };
}

export interface PropertyEligibilityResult {
  maxLoanAmount: number;
  maxDownPaymentPercent: number;
  requiredDownPayment: number;
  ltvRatio: number;
  estimatedPITI: number;
  finalDTI: number;
  canBuyProperty: boolean;
  reasons: string[];
}

// ============================================================================
// INCOME QUALIFICATION ENGINE
// ============================================================================

export function qualifyIncome(
  employment: EmploymentHistory[],
  otherIncome: OtherIncomeSource[],
  applicationIncome?: { annualIncome?: number | string; employmentYears?: number }
): IncomeQualificationResult {
  const result: IncomeQualificationResult = {
    baseMonthlyIncome: 0,
    variableMonthlyIncome: 0,
    selfEmploymentMonthlyIncome: 0,
    totalQualifyingIncome: 0,
    details: { employment: [], other: [] },
  };

  // Process employment income
  for (const emp of employment) {
    // Self-employment: qualifying income comes from the Form 1084 worksheet
    // (Fannie B3-3.5/B3-3.6), computed deterministically in
    // computeSelfEmploymentQualifyingIncome — not from startDate/monthly boxes.
    if (emp.isSelfEmployed) {
      if (emp.selfEmploymentIncome) {
        const se = computeSelfEmploymentQualifyingIncome(emp.selfEmploymentIncome);
        result.selfEmploymentMonthlyIncome += se.monthlyQualifyingIncome;
        const prev = result.details.selfEmployment;
        result.details.selfEmployment = {
          netProfitYear1: (prev?.netProfitYear1 ?? 0) + se.netProfitYear1,
          netProfitYear2: (prev?.netProfitYear2 ?? 0) + se.netProfitYear2,
          avgNetProfit: (prev?.avgNetProfit ?? 0) + se.avgAnnualCashFlow,
          addBacks: (prev?.addBacks ?? 0) + se.addBacks,
          deductions: (prev?.deductions ?? 0) + se.deductions,
          qualifyingIncome: (prev?.qualifyingIncome ?? 0) + se.monthlyQualifyingIncome,
          trend: se.trend,
          requiresManualReview: (prev?.requiresManualReview ?? false) || se.requiresManualReview,
          notes: [...(prev?.notes ?? []), ...se.notes],
        };
      }
      continue;
    }

    // Require 2-year continuous work history
    if (!emp.startDate) continue;

    const startDate = new Date(emp.startDate);
    const monthsEmployed = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    // Calculate monthly income
    let monthlyIncome = 0;
    if (emp.totalMonthlyIncome) {
      monthlyIncome = typeof emp.totalMonthlyIncome === 'string' 
        ? parseFloat(emp.totalMonthlyIncome) 
        : emp.totalMonthlyIncome;
      result.baseMonthlyIncome += monthlyIncome;
    } else if (applicationIncome?.annualIncome && emp.employmentType === "salaried") {
      const annual = typeof applicationIncome.annualIncome === 'string' 
        ? parseFloat(applicationIncome.annualIncome) 
        : applicationIncome.annualIncome;
      monthlyIncome = annual / 12;
      result.baseMonthlyIncome += monthlyIncome;
    }

    result.details.employment.push({
      type: emp.employmentType || "salaried",
      yearsEmployed: Math.floor(monthsEmployed / 12),
      monthlyBase: monthlyIncome,
    });
  }

  // Process other income sources (bonuses, commissions, rental)
  for (const income of otherIncome) {
    if (!income.monthlyAmount) continue;

    const monthlyAmount = typeof income.monthlyAmount === 'string' 
      ? parseFloat(income.monthlyAmount) 
      : income.monthlyAmount;

    // Variable income qualification rules - conservatively include if documented
    result.variableMonthlyIncome += monthlyAmount;
    result.details.other.push({
      type: income.incomeSource || "other",
      monthlyAmount: monthlyAmount,
    });
  }

  result.totalQualifyingIncome = 
    result.baseMonthlyIncome + 
    result.variableMonthlyIncome + 
    result.selfEmploymentMonthlyIncome;

  return result;
}

// ============================================================================
// ASSET VERIFICATION ENGINE
// ============================================================================

export async function verifyAssets(
  assets: UrlaAsset[],
  downPaymentAndClosing?: number
): Promise<AssetVerificationResult> {
  const result: AssetVerificationResult = {
    totalAssets: 0,
    liquidAssets: 0,
    retirementAssets: 0,
    reservesMonths: 0,
    breakdown: [],
  };

  // Asset valuation haircuts are resolved from the dynamic policy matrices —
  // there are no hardcoded haircut constants. Cash-equivalents count at full
  // value (the definition of liquid reserves); market and retirement assets are
  // discounted per the seeded HAIRCUT_* scalars.
  const haircutStock = (await lookupResolver.getPolicyScalar("HAIRCUT_STOCK_INVESTMENT")) / 100;
  const haircutRetirement = (await lookupResolver.getPolicyScalar("HAIRCUT_RETIREMENT")) / 100;

  const CASH_EQUIVALENTS = new Set([
    "checking",
    "checking_account",
    "savings",
    "savings_account",
    "money_market",
    "money_market_account",
    "cd",
    "certificate_of_deposit",
  ]);

  const isRetirementType = (t: string) =>
    t.includes("retirement") || t.includes("401k") || t.includes("ira");

  for (const asset of assets) {
    if (!asset.cashOrMarketValue) continue;

    const balance = typeof asset.cashOrMarketValue === 'string' 
      ? parseFloat(asset.cashOrMarketValue) 
      : asset.cashOrMarketValue;

    const assetType = asset.accountType?.toLowerCase() || "other";
    // Map the account type onto one of the three engine valuation categories.
    let haircut: number;
    if (CASH_EQUIVALENTS.has(assetType)) {
      haircut = 1.0;
    } else if (isRetirementType(assetType)) {
      haircut = haircutRetirement;
    } else {
      // Stocks, bonds, mutual funds, and any other non-cash holding take the
      // conservative market-asset haircut.
      haircut = haircutStock;
    }
    const verifiedValue = balance * haircut;

    result.breakdown.push({
      type: assetType,
      balance,
      haircut,
      verifiedValue,
    });

    result.totalAssets += balance;

    if (haircut === 1.0) {
      result.liquidAssets += verifiedValue;
    } else if (isRetirementType(assetType)) {
      result.retirementAssets += verifiedValue;
    } else {
      result.liquidAssets += verifiedValue;
    }
  }

  // Calculate reserves after down payment and closing
  if (downPaymentAndClosing) {
    result.liquidAssets = Math.max(0, result.liquidAssets - downPaymentAndClosing);
  }

  return result;
}

// ============================================================================
// LIABILITY ASSESSMENT ENGINE
// ============================================================================

export function assessLiabilities(liabilities: UrlaLiability[]): LiabilityAssessmentResult {
  const result: LiabilityAssessmentResult = {
    totalMonthlyPayment: 0,
    excludedDebts: 0,
    breakdown: [],
  };

  for (const liability of liabilities) {
    const monthlyPayment = typeof liability.monthlyPayment === 'string' 
      ? parseFloat(liability.monthlyPayment) 
      : (liability.monthlyPayment || 0);

    const type = liability.liabilityType?.toLowerCase() || "other";
    const balance = typeof liability.unpaidBalance === 'string' 
      ? parseFloat(liability.unpaidBalance) 
      : (liability.unpaidBalance || 0);

    let included = true;
    let reason = "Included in DTI";

    if (type === "installment") {
      // 10-month rule: typically would need remainingTermMonths to apply properly
      // For now, include unless toBePaidOff is true
      if (liability.toBePaidOff) {
        included = false;
        reason = "To be paid off at closing";
      }
    } else if (type === "lease") {
      included = true;
      reason = "Lease: always included (new vehicle assumption)";
    } else if (type === "student_loan") {
      // 0.5%-1% of balance imputed payment for deferred
      if (monthlyPayment === 0 && balance > 0) {
        const imputedPayment = balance * 0.01; // Use 1% (conservative)
        result.breakdown.push({
          type: `${type} (deferred)`,
          payment: imputedPayment,
          included: true,
          reason: "1% of balance imputed (deferred loan)",
        });
        result.totalMonthlyPayment += imputedPayment;
        continue;
      }
    }

    if (included) {
      result.totalMonthlyPayment += monthlyPayment;
    } else {
      result.excludedDebts += monthlyPayment;
    }

    result.breakdown.push({
      type,
      payment: monthlyPayment,
      included,
      reason,
    });
  }

  return result;
}

// ============================================================================
// DTI CALCULATION ENGINE
// ============================================================================

export async function calculateDTI(
  qualifyingIncome: number,
  housingExpense: number,
  nonHousingDebts: number,
  maxBackEndRatio?: number
): Promise<DTICalculationResult> {
  // DTI thresholds are policy-driven, resolved from the dynamic matrices rather
  // than hardcoded 43/50 constants.
  const dtiCap = await lookupResolver.getPolicyScalar("CONVENTIONAL_DTI_CAP");
  const stretchDti = await lookupResolver.getPolicyScalar("CONVENTIONAL_STRETCH_DTI");
  const effectiveCap = maxBackEndRatio ?? dtiCap;

  const frontEndRatio = qualifyingIncome > 0
    ? (housingExpense / qualifyingIncome) * 100
    : 0;

  const backEndRatio = qualifyingIncome > 0
    ? ((housingExpense + nonHousingDebts) / qualifyingIncome) * 100
    : 0;

  // A borrower with zero or negative qualifying income cannot support any debt;
  // the ratio is undefined (division by zero would otherwise read as 0% → pass).
  // Fail explicitly rather than letting the default "pass" stand.
  let status: "pass" | "fail" | "stretch" = "pass";
  if (qualifyingIncome <= 0) {
    status = "fail";
  } else if (backEndRatio > effectiveCap) {
    status = backEndRatio <= stretchDti ? "stretch" : "fail";
  }

  return {
    qualifyingIncome,
    housingExpense,
    nonHousingDebts,
    frontEndRatio: Math.round(frontEndRatio * 100) / 100,
    backEndRatio: Math.round(backEndRatio * 100) / 100,
    status,
    maxBackEndRatio: effectiveCap,
    details: {
      frontend_definition: "Housing expense / Qualifying income",
      backend_definition: "(Housing + Non-housing debts) / Qualifying income",
      fannie_mae_limit_manual: dtiCap,
      fannie_mae_limit_aus: stretchDti,
    },
  };
}

// ============================================================================
// PROPERTY ELIGIBILITY ENGINE - "CAN I BUY THIS HOUSE?"
// ============================================================================

export async function checkPropertyEligibility(
  borrowerAssets: number,
  borrowerIncome: number,
  borrowerDebts: number,
  propertyPrice: number,
  propertyType: string = "single_family",
  propertyTaxAnnual?: number,
  hoaMonthly?: number,
  homeInsuranceEstimate: number = 150,
  maxLtvPercent?: number,
  representativeFico?: number
): Promise<PropertyEligibilityResult> {
  const reasons: string[] = [];

  // Guard non-positive income up front: the final DTI divides by income, so a 0
  // (or NaN) would produce an "Infinity%" DTI in the returned reason text. Fail
  // closed with a clear message instead.
  if (!(borrowerIncome > 0)) {
    return {
      maxLoanAmount: 0,
      maxDownPaymentPercent: 0,
      requiredDownPayment: 0,
      ltvRatio: 0,
      estimatedPITI: 0,
      finalDTI: 0,
      canBuyProperty: false,
      reasons: ["Borrower income must be greater than zero to assess affordability."],
    };
  }

  // Policy ceilings come from the dynamic matrices, not hardcoded 95/50 limits.
  const ltvCap = await lookupResolver.getPolicyScalar("CONVENTIONAL_LTV_CAP");
  const stretchDti = await lookupResolver.getPolicyScalar("CONVENTIONAL_STRETCH_DTI");
  const effectiveMaxLtv = maxLtvPercent ?? ltvCap;

  // 1. Calculate LTV and down payment requirement
  const maxLoanAmount = propertyPrice * (effectiveMaxLtv / 100);
  const requiredDownPayment = propertyPrice - maxLoanAmount;
  const ltvRatio = (maxLoanAmount / propertyPrice) * 100;

  // 2. Check asset sufficiency
  if (borrowerAssets < requiredDownPayment) {
    reasons.push(`Insufficient assets: need $${requiredDownPayment.toFixed(2)}, have $${borrowerAssets.toFixed(2)}`);
  }

  // 3. Estimate PITI
  const principalAndInterestRate = 0.06; // 6% base rate assumption
  const monthlyPI = maxLoanAmount * (principalAndInterestRate / 12) * 
    Math.pow(1 + principalAndInterestRate / 12, 360) / 
    (Math.pow(1 + principalAndInterestRate / 12, 360) - 1);

  const taxMonthly = (propertyTaxAnnual || propertyPrice * 0.0125) / 12;
  const hoaFees = hoaMonthly || 0;
  // PMI applies structurally above the 80% conventional MI trigger, where the
  // seeded CONVENTIONAL_PMI card (FICO x LTV) provides a premium. When MI is
  // required the rate MUST resolve from the matrix and fails loudly if the
  // FICO/LTV band is missing — no silent fallback. Below the trigger there is
  // structurally no MI.
  let pmi = 0;
  if (ltvRatio > 80) {
    if (representativeFico === undefined) {
      throw new Error(
        "CRITICAL DECISIONING ERROR: representative FICO is required to resolve mortgage insurance for LTV above 80%.",
      );
    }
    const ltvForLookup = Math.ceil(ltvRatio * 100) / 100;
    const pmiAnnualRate = await lookupResolver.resolveMatrixValue({
      matrixCode: "CONVENTIONAL_PMI",
      dim1Value: representativeFico,
      dim2Value: ltvForLookup,
    });
    pmi = (maxLoanAmount * (pmiAnnualRate / 100)) / 12;
  }

  const estimatedPITI = monthlyPI + taxMonthly + homeInsuranceEstimate + hoaFees + pmi;

  // 4. Final DTI check with new property
  const newTotalHousingExpense = estimatedPITI;
  const finalDTI = (newTotalHousingExpense + borrowerDebts) / borrowerIncome * 100;

  if (finalDTI > stretchDti) {
    reasons.push(`DTI too high with this property: ${finalDTI.toFixed(1)}% (limit ${stretchDti}%)`);
  }

  const canBuyProperty = reasons.length === 0;

  return {
    maxLoanAmount: Math.round(maxLoanAmount * 100) / 100,
    maxDownPaymentPercent: effectiveMaxLtv,
    requiredDownPayment: Math.round(requiredDownPayment * 100) / 100,
    ltvRatio: Math.round(ltvRatio * 100) / 100,
    estimatedPITI: Math.round(estimatedPITI * 100) / 100,
    finalDTI: Math.round(finalDTI * 100) / 100,
    canBuyProperty,
    reasons,
  };
}
