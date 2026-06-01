/**
 * Loan Pricing Engine - LLPA Matrix & PMI Calculation
 * 
 * Implements Fannie Mae Loan Level Price Adjustments (LLPA) and PMI rate lookups
 * Based on 2025/2026 pricing matrices
 */

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
// FANNIE MAE LLPA MATRIX (Simplified 2025 Model)
// ============================================================================

interface LLPAMatrixEntry {
  ltv: string; // "<=60", "60-70", "70-75", "75-80", "80-85", "85-90", "90-95", ">95"
  score780plus: number;
  score760_779: number;
  score740_759: number;
  score720_739: number;
  score700_719: number;
  score680_699: number;
  score660_679: number;
  score640_659: number;
  scoreBelowZero: number; // Score < 640
}

const LLPA_MATRIX: LLPAMatrixEntry[] = [
  {
    ltv: "<=60",
    score780plus: -0.25,
    score760_779: -0.125,
    score740_759: 0,
    score720_739: 0.125,
    score700_719: 0.375,
    score680_699: 0.75,
    score660_679: 1.125,
    score640_659: 1.5,
    scoreBelowZero: 2.0,
  },
  {
    ltv: "60-70",
    score780plus: -0.25,
    score760_779: -0.125,
    score740_759: 0,
    score720_739: 0.125,
    score700_719: 0.375,
    score680_699: 0.75,
    score660_679: 1.125,
    score640_659: 1.5,
    scoreBelowZero: 2.0,
  },
  {
    ltv: "70-75",
    score780plus: 0,
    score760_779: 0.125,
    score740_759: 0.375,
    score720_739: 0.625,
    score700_719: 0.875,
    score680_699: 1.25,
    score660_679: 1.75,
    score640_659: 2.125,
    scoreBelowZero: 2.875,
  },
  {
    ltv: "75-80",
    score780plus: 0.375,
    score760_779: 0.625,
    score740_759: 1.0,
    score720_739: 1.375,
    score700_719: 1.75,
    score680_699: 2.25,
    score660_679: 2.75,
    score640_659: 3.25,
    scoreBelowZero: 4.0,
  },
  {
    ltv: "80-85",
    score780plus: 0.875,
    score760_779: 1.25,
    score740_759: 1.75,
    score720_739: 2.25,
    score700_719: 2.875,
    score680_699: 3.5,
    score660_679: 4.375,
    score640_659: 5.0,
    scoreBelowZero: 5.875,
  },
  {
    ltv: "85-90",
    score780plus: 1.625,
    score760_779: 2.125,
    score740_759: 2.75,
    score720_739: 3.375,
    score700_719: 4.125,
    score680_699: 4.875,
    score660_679: 5.75,
    score640_659: 6.75,
    scoreBelowZero: 7.875,
  },
  {
    ltv: "90-95",
    score780plus: 2.5,
    score760_779: 3.125,
    score740_759: 3.875,
    score720_739: 4.625,
    score700_719: 5.5,
    score680_699: 6.375,
    score660_679: 7.375,
    score640_659: 8.375,
    scoreBelowZero: 9.75,
  },
  {
    ltv: ">95",
    score780plus: 3.75,
    score760_779: 4.625,
    score740_759: 5.5,
    score720_739: 6.625,
    score700_719: 7.75,
    score680_699: 8.875,
    score660_679: 10.25,
    score640_659: 11.5,
    scoreBelowZero: 13.125,
  },
];

// ============================================================================
// LLPA LOOKUP FUNCTION
// ============================================================================

export function lookupLLPA(creditScore: number, ltv: number): number {
  // Find correct score band
  let scoreKey: keyof Omit<LLPAMatrixEntry, "ltv">;

  if (creditScore >= 780) scoreKey = "score780plus";
  else if (creditScore >= 760) scoreKey = "score760_779";
  else if (creditScore >= 740) scoreKey = "score740_759";
  else if (creditScore >= 720) scoreKey = "score720_739";
  else if (creditScore >= 700) scoreKey = "score700_719";
  else if (creditScore >= 680) scoreKey = "score680_699";
  else if (creditScore >= 660) scoreKey = "score660_679";
  else if (creditScore >= 640) scoreKey = "score640_659";
  else scoreKey = "scoreBelowZero";

  // Find correct LTV band
  let ltvBand: LLPAMatrixEntry | undefined;
  if (ltv <= 60) ltvBand = LLPA_MATRIX[0];
  else if (ltv <= 70) ltvBand = LLPA_MATRIX[1];
  else if (ltv <= 75) ltvBand = LLPA_MATRIX[2];
  else if (ltv <= 80) ltvBand = LLPA_MATRIX[3];
  else if (ltv <= 85) ltvBand = LLPA_MATRIX[4];
  else if (ltv <= 90) ltvBand = LLPA_MATRIX[5];
  else if (ltv <= 95) ltvBand = LLPA_MATRIX[6];
  else ltvBand = LLPA_MATRIX[7];

  return ltvBand?.[scoreKey] || 0;
}

// ============================================================================
// LLPA PRICING WITH PROPERTY TYPE ADJUSTMENTS
// ============================================================================

export function calculateLLPA(
  loanAmount: number,
  creditScore: number,
  ltv: number,
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family" = "single_family",
  occupancyType: "primary_residence" | "second_home" | "investment" = "primary_residence",
  isFirstTimeHomeBuyer: boolean = false,
  borrowerIncome: number = 0,
  areaMedianIncome: number = 0
): LLPAResult {
  // Base LLPA from matrix
  const baseLLPA = lookupLLPA(creditScore, ltv);

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

  // Placeholder PMI - simplified
  const pmiAnnualRate = ltv > 80 ? 0.6 : 0;
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

export function lookupPMIRate(creditScore: number, ltv: number): number {
  // Use property analyzer's rate card for accurate PMI pricing
  const { propertyAnalyzer } = require("./propertyAnalyzer");
  const rateCard = propertyAnalyzer.getPMIRateCard(creditScore, ltv);
  return rateCard.annualRate;
}
