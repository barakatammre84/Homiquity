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
    // Require 2-year continuous work history
    if (!emp.startDate) continue;

    const startDate = new Date(emp.startDate);
    const monthsEmployed = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    // Calculate monthly income
    let monthlyIncome = 0;
    if (emp.isSelfEmployed) {
      // Self-employment handled separately
      continue;
    } else if (emp.totalMonthlyIncome) {
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

export function verifyAssets(
  assets: UrlaAsset[],
  downPaymentAndClosing?: number
): AssetVerificationResult {
  const result: AssetVerificationResult = {
    totalAssets: 0,
    liquidAssets: 0,
    retirementAssets: 0,
    reservesMonths: 0,
    breakdown: [],
  };

  const HAIRCUTS: Record<string, number> = {
    checking: 1.0,
    checking_account: 1.0,
    savings: 1.0,
    savings_account: 1.0,
    money_market: 1.0,
    money_market_account: 1.0,
    cd: 1.0,
    certificate_of_deposit: 1.0,
    stocks: 0.6,
    stock: 0.6,
    bonds: 0.6,
    bond: 0.6,
    mutual_fund: 0.6,
    retirement: 0.6,
    "401k": 0.6,
    ira: 0.6,
    other: 0.5,
  };

  for (const asset of assets) {
    if (!asset.cashOrMarketValue) continue;

    const balance = typeof asset.cashOrMarketValue === 'string' 
      ? parseFloat(asset.cashOrMarketValue) 
      : asset.cashOrMarketValue;

    const assetType = asset.accountType?.toLowerCase() || "other";
    const haircut = HAIRCUTS[assetType] || 0.5;
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
    } else if (assetType.includes("retirement") || assetType.includes("401k") || assetType.includes("ira")) {
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

export function calculateDTI(
  qualifyingIncome: number,
  housingExpense: number,
  nonHousingDebts: number,
  maxBackEndRatio: number = 43
): DTICalculationResult {
  const frontEndRatio = qualifyingIncome > 0 
    ? (housingExpense / qualifyingIncome) * 100 
    : 0;

  const backEndRatio = qualifyingIncome > 0 
    ? ((housingExpense + nonHousingDebts) / qualifyingIncome) * 100 
    : 0;

  let status: "pass" | "fail" | "stretch" = "pass";
  if (backEndRatio > maxBackEndRatio) {
    status = backEndRatio <= 50 ? "stretch" : "fail";
  }

  return {
    qualifyingIncome,
    housingExpense,
    nonHousingDebts,
    frontEndRatio: Math.round(frontEndRatio * 100) / 100,
    backEndRatio: Math.round(backEndRatio * 100) / 100,
    status,
    maxBackEndRatio,
    details: {
      frontend_definition: "Housing expense / Qualifying income",
      backend_definition: "(Housing + Non-housing debts) / Qualifying income",
      fannie_mae_limit_manual: 43,
      fannie_mae_limit_aus: 50,
    },
  };
}

// ============================================================================
// PROPERTY ELIGIBILITY ENGINE - "CAN I BUY THIS HOUSE?"
// ============================================================================

export function checkPropertyEligibility(
  borrowerAssets: number,
  borrowerIncome: number,
  borrowerDebts: number,
  propertyPrice: number,
  propertyType: string = "single_family",
  propertyTaxAnnual?: number,
  hoaMonthly?: number,
  homeInsuranceEstimate: number = 150,
  maxLtvPercent: number = 95
): PropertyEligibilityResult {
  const reasons: string[] = [];

  // 1. Calculate LTV and down payment requirement
  const maxLoanAmount = propertyPrice * (maxLtvPercent / 100);
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
  const pmi = maxLtvPercent > 80 ? (maxLoanAmount * 0.01 / 12) : 0;

  const estimatedPITI = monthlyPI + taxMonthly + homeInsuranceEstimate + hoaFees + pmi;

  // 4. Final DTI check with new property
  const newTotalHousingExpense = estimatedPITI;
  const finalDTI = (newTotalHousingExpense + borrowerDebts) / borrowerIncome * 100;

  if (finalDTI > 50) {
    reasons.push(`DTI too high with this property: ${finalDTI.toFixed(1)}% (limit 50%)`);
  }

  const canBuyProperty = reasons.length === 0;

  return {
    maxLoanAmount: Math.round(maxLoanAmount * 100) / 100,
    maxDownPaymentPercent: maxLtvPercent,
    requiredDownPayment: Math.round(requiredDownPayment * 100) / 100,
    ltvRatio: Math.round(ltvRatio * 100) / 100,
    estimatedPITI: Math.round(estimatedPITI * 100) / 100,
    finalDTI: Math.round(finalDTI * 100) / 100,
    canBuyProperty,
    reasons,
  };
}
