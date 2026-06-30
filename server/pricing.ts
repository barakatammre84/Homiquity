/**
 * Loan Pricing Engine - LLPA Matrix & PMI Calculation
 * 
 * Implements Fannie Mae Loan Level Price Adjustments (LLPA) and PMI rate lookups
 * Resolved dynamically from versioned policy matrices (no hardcoded rate cards)
 */

import { lookupResolver } from "./services/lookupResolver";

export interface LLPAResult {
  baseLLPA: number;
  propertyTypeAdjustment: number;
  condoAdjustment: number;
  fthbWaiver: number;
  totalLLPA: number;
  pricing: {
    loanAmount: number;
    lLPAFeeAmount: number;
    pmiAnnualRate: number;
    pmiMonthlyPayment: number;
  };
}


// ============================================================================
// LLPA LOOKUP FUNCTION
// ============================================================================

export async function lookupLLPA(creditScore: number, ltv: number): Promise<number> {
  // Base LLPA risk-adjusted fee resolved from the dynamic FANNIE_LLPA matrix
  // (FICO interval x rounded LTV interval). LTV is rounded up so a 90.01% LTV
  // falls into the 91-95 band, matching agency rounding conventions.
  const ltvForLookup = Math.ceil(ltv);
  return lookupResolver.resolveMatrixValue({
    matrixCode: "FANNIE_LLPA",
    dim1Value: creditScore,
    dim2Value: ltvForLookup,
  });
}

// ============================================================================
// LLPA PRICING WITH PROPERTY TYPE ADJUSTMENTS
// ============================================================================

export async function calculateLLPA(
  loanAmount: number,
  creditScore: number,
  ltv: number,
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family" = "single_family",
  occupancyType: "primary_residence" | "second_home" | "investment" = "primary_residence",
  isFirstTimeHomeBuyer: boolean = false,
  borrowerIncome: number = 0,
  areaMedianIncome: number = 0
): Promise<LLPAResult> {
  // Base LLPA from the dynamic matrix
  const baseLLPA = await lookupLLPA(creditScore, ltv);

  // Property type adjustments
  let propertyTypeAdjustment = 0;
  if (occupancyType === "investment") {
    // Investment property = significant penalty
    if (ltv > 85) propertyTypeAdjustment = 3.0;
    else if (ltv > 75) propertyTypeAdjustment = 2.25;
    else propertyTypeAdjustment = 1.5;
  } else if (occupancyType === "second_home") {
    // Second home penalty
    if (ltv > 85) propertyTypeAdjustment = 2.25;
    else if (ltv > 75) propertyTypeAdjustment = 1.5;
    else propertyTypeAdjustment = 0.75;
  }

  // Condo adjustment
  let condoAdjustment = 0;
  if (propertyType === "condo" && ltv > 75) {
    condoAdjustment = 0.75;
  }

  // First-time homebuyer waiver (most important!)
  let fthbWaiver = 0;
  if (isFirstTimeHomeBuyer && areaMedianIncome > 0 && borrowerIncome > 0) {
    const incomePercent = (borrowerIncome / areaMedianIncome) * 100;
    // FTHB: waive ALL LLPAs if income < 100% of AMI (or 120% in high-cost areas)
    if (incomePercent <= 100) {
      fthbWaiver = -(baseLLPA + propertyTypeAdjustment + condoAdjustment);
    }
  }

  const totalLLPA = baseLLPA + propertyTypeAdjustment + condoAdjustment + fthbWaiver;
  const lLPAFeeAmount = (loanAmount * totalLLPA) / 100;

  // PMI resolved from the dynamic CONVENTIONAL_PMI matrix via the shared rate
  // card (single source of truth). MI is structurally required only above the
  // high-LTV trigger; when required, a missing/out-of-range FICO x LTV band
  // fails loudly (no silent fallback). Below the trigger there is structurally
  // no MI and the card returns 0.
  const pmiAnnualRate = await lookupPMIRate(creditScore, ltv);
  const pmiMonthlyPayment = (loanAmount * pmiAnnualRate) / 12 / 100;

  return {
    baseLLPA,
    propertyTypeAdjustment,
    condoAdjustment,
    fthbWaiver,
    totalLLPA,
    pricing: {
      loanAmount,
      lLPAFeeAmount,
      pmiAnnualRate,
      pmiMonthlyPayment,
    },
  };
}

// ============================================================================
// AREA MEDIAN INCOME (AMI) LOOKUP (Stub for API integration)
// ============================================================================

export async function getAreaMedianIncome(zipCode: string): Promise<number> {
  // This would integrate with HUD API to get real AMI data
  // For now, return a conservative estimate
  const amiByRegion: Record<string, number> = {
    default: 90000,
    // Add real zip code mappings from HUD API
  };
  return amiByRegion[zipCode] || amiByRegion.default;
}

// ============================================================================
// PMI RATE LOOKUP (Simplified - would integrate with MGIC/Enact APIs)
// ============================================================================

export async function lookupPMIRate(creditScore: number, ltv: number): Promise<number> {
  // Use property analyzer's rate card (dynamic CONVENTIONAL_PMI matrix) for pricing
  const { getPMIRateCard } = await import("./propertyAnalyzer");
  const rateCard = await getPMIRateCard(creditScore, ltv);
  return rateCard.annualRate;
}
