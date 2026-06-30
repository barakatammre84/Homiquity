/**
 * Property Analysis Engine
 * 
 * Integrates RESO property data, Mello-Roos detection, and property eligibility analysis
 * Supports "Can I buy this house?" reverse-engineering with special assessment detection
 */

import { lookupResolver } from "./services/lookupResolver";

export interface PropertyAnalysisRequest {
  address: string;
  city: string;
  state: string;
  zip: string;
  listPrice: number;
  propertyType: string;
  bedroomCount?: number;
  bathroomCount?: number;
  squareFeet?: number;
  yearBuilt?: number;
  publicRemarks?: string;
  privateRemarks?: string;
}

export interface MelloRoosAssessment {
  detected: boolean;
  description: string;
  estimatedAnnualAmount?: number;
  estimatedMonthlyAmount?: number;
  confidence: "high" | "medium" | "low";
}

export interface PropertyAnalysis {
  address: string;
  listPrice: number;
  propertyType: string;
  specialAssessments: MelloRoosAssessment;
  riskFlags: string[];
  recommendedLTV: number;
  estimatedPropertyTax: number;
  resoCrisp: {
    standardized: boolean;
    fields: Record<string, any>;
  };
}

// ============================================================================
// MELLO-ROOS / SPECIAL ASSESSMENT DETECTION
// ============================================================================

export function detectMelloRoos(
  publicRemarks: string = "",
  privateRemarks: string = "",
  listPrice: number,
  state: string
): MelloRoosAssessment {
  const allRemarks = (publicRemarks + " " + privateRemarks).toLowerCase();
  
  // Keywords indicating Mello-Roos or special tax districts
  const melloRoosKeywords = [
    "mello-roos",
    "mello roos",
    "community facilities district",
    "cfd",
    "special tax",
    "special assessment",
    "assessor parcel",
    "landscape assessment",
    "maintenance assessment",
    "improvement district",
  ];

  // Regional property tax patterns that might indicate special assessments
  const stateSpecificIndicators: Record<string, string[]> = {
    CA: ["prop 13 waiver", "new construction", "reassessment"],
    TX: ["tax abatement", "special taxing unit"],
    FL: ["homestead exemption loss", "property appraiser"],
  };

  let detected = false;
  let confidence: "high" | "medium" | "low" = "low";
  let estimatedMonthlyAmount = 0;

  // Check for direct keywords
  for (const keyword of melloRoosKeywords) {
    if (allRemarks.includes(keyword)) {
      detected = true;
      confidence = "high";
      break;
    }
  }

  // Check state-specific indicators
  const stateIndicators = stateSpecificIndicators[state] || [];
  for (const indicator of stateIndicators) {
    if (allRemarks.includes(indicator.toLowerCase())) {
      detected = true;
      confidence = confidence === "high" ? "high" : "medium";
    }
  }

  // Try to extract estimated amount from remarks
  // Pattern: looks for "$XXX" or "XXXX per month/month" or similar
  const dollarPattern = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per month|\/month|monthly)/gi;
  const annualPattern = /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per month|\/month|annually)/gi;

  let match;
  while ((match = dollarPattern.exec(allRemarks)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ""));
    if (amount > 0) {
      estimatedMonthlyAmount = amount;
      detected = true;
      confidence = "high";
    }
  }

  while ((match = annualPattern.exec(allRemarks)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ""));
    if (amount > 0) {
      estimatedMonthlyAmount = amount;
      detected = true;
      confidence = "high";
    }
  }

  // Heuristic: if no specific amount but detected keywords, estimate 0.5%-1.5% of purchase price annually
  if (detected && estimatedMonthlyAmount === 0) {
    const annualRate = 0.01; // Conservative 1%
    estimatedMonthlyAmount = (listPrice * annualRate) / 12;
  }

  return {
    detected,
    description: detected 
      ? `Special assessment detected${estimatedMonthlyAmount > 0 ? ` (~$${estimatedMonthlyAmount.toFixed(0)}/month)` : ""}`
      : "No special assessments detected",
    estimatedMonthlyAmount: estimatedMonthlyAmount || undefined,
    estimatedAnnualAmount: estimatedMonthlyAmount ? estimatedMonthlyAmount * 12 : undefined,
    confidence,
  };
}

// ============================================================================
// PROPERTY TAX ESTIMATION
// ============================================================================

export function estimatePropertyTax(
  listPrice: number,
  state: string,
  propertyType: string = "single_family"
): number {
  // State-based effective property tax rates (rough averages)
  const stateEffectiveRates: Record<string, number> = {
    AL: 0.0041,
    AZ: 0.0062,
    CA: 0.0076,
    CO: 0.0051,
    CT: 0.0222,
    DE: 0.0057,
    FL: 0.0085,
    GA: 0.0092,
    HI: 0.0028,
    IL: 0.0224,
    IN: 0.0085,
    IA: 0.0179,
    KS: 0.0137,
    KY: 0.0085,
    LA: 0.0055,
    ME: 0.0143,
    MD: 0.0109,
    MA: 0.0123,
    MI: 0.0150,
    MN: 0.0111,
    MS: 0.0079,
    MO: 0.0097,
    MT: 0.0084,
    NE: 0.0173,
    NV: 0.0060,
    NH: 0.0213,
    NJ: 0.0265,
    NM: 0.0080,
    NY: 0.0187,
    NC: 0.0084,
    ND: 0.0098,
    OH: 0.0137,
    OK: 0.0090,
    OR: 0.0097,
    PA: 0.0158,
    RI: 0.0143,
    SC: 0.0057,
    SD: 0.0131,
    TN: 0.0071,
    TX: 0.0180,
    UT: 0.0060,
    VT: 0.0192,
    VA: 0.0082,
    WA: 0.0084,
    WV: 0.0058,
    WI: 0.0187,
    WY: 0.0061,
  };

  const effectiveRate = stateEffectiveRates[state] || 0.0100; // Default 1% if not found
  const annualTax = listPrice * effectiveRate;
  return annualTax / 12; // Return monthly amount
}

// ============================================================================
// RECOMMENDED LTV BASED ON PROPERTY CHARACTERISTICS
// ============================================================================

export async function recommendLTV(
  propertyType: string,
  yearBuilt?: number,
  squareFeet?: number
): Promise<number> {
  // Standard conventional max LTV resolved from the dynamic policy matrix.
  const ltvCap = await lookupResolver.getPolicyScalar("CONVENTIONAL_LTV_CAP");
  let baseLTV = ltvCap;

  // Property type adjustments relative to the conventional cap
  const typeAdjustments: Record<string, number> = {
    single_family: ltvCap,
    townhouse: 90,
    condo: 85,
    multi_family: 80,
    manufactured: 75,
    other: 80,
  };

  baseLTV = typeAdjustments[propertyType] || ltvCap;

  // Age adjustment (older homes = lower LTV)
  if (yearBuilt) {
    const age = new Date().getFullYear() - yearBuilt;
    if (age > 50) baseLTV = Math.max(75, baseLTV - 5);
    if (age > 100) baseLTV = Math.max(70, baseLTV - 10);
  }

  // Size adjustment (very small homes = higher risk)
  if (squareFeet && squareFeet < 1000) {
    baseLTV = Math.max(80, baseLTV - 5);
  }

  return baseLTV;
}

// ============================================================================
// COMPREHENSIVE PROPERTY ANALYSIS
// ============================================================================

export async function analyzeProperty(request: PropertyAnalysisRequest): Promise<PropertyAnalysis> {
  const melloRoos = detectMelloRoos(
    request.publicRemarks,
    request.privateRemarks,
    request.listPrice,
    request.state
  );

  const monthlyPropertyTax = estimatePropertyTax(
    request.listPrice,
    request.state,
    request.propertyType
  );

  const recommendedLTV = await recommendLTV(
    request.propertyType,
    request.yearBuilt,
    request.squareFeet
  );

  const riskFlags: string[] = [];

  // Build risk assessment
  if (melloRoos.detected) {
    riskFlags.push(
      `Special assessment: ${melloRoos.estimatedMonthlyAmount?.toFixed(0) || "unknown"}/month`
    );
  }

  if (request.yearBuilt && new Date().getFullYear() - request.yearBuilt > 50) {
    riskFlags.push("Older property (>50 years) - higher maintenance risk");
  }

  if (request.squareFeet && request.squareFeet < 1000) {
    riskFlags.push("Small property - limited resale market");
  }

  if (request.propertyType === "condo") {
    riskFlags.push("Condo - verify HOA, reserves, warrantability");
  }

  // Adjust recommended LTV if special assessments detected
  let finalRecommendedLTV = recommendedLTV;
  if (melloRoos.detected && melloRoos.confidence === "high") {
    finalRecommendedLTV = Math.max(70, recommendedLTV - 5);
  }

  return {
    address: `${request.address}, ${request.city}, ${request.state} ${request.zip}`,
    listPrice: request.listPrice,
    propertyType: request.propertyType,
    specialAssessments: melloRoos,
    riskFlags,
    recommendedLTV: finalRecommendedLTV,
    estimatedPropertyTax: monthlyPropertyTax,
    resoCrisp: {
      standardized: true,
      fields: {
        listPrice: request.listPrice,
        propertyType: request.propertyType,
        bedroomCount: request.bedroomCount,
        bathroomCount: request.bathroomCount,
        squareFeet: request.squareFeet,
        yearBuilt: request.yearBuilt,
      },
    },
  };
}

// ============================================================================
// PMI RATE LOOKUP (Integrated with property analysis)
// ============================================================================

export async function getPMIRateCard(creditScore: number, ltv: number): Promise<{
  annualRate: number;
  monthlyRate: number;
  term: number;
  coverage: number; // Coverage percentage at this LTV
}> {
  // GSE structural MI coverage requirement by LTV band (35% for >95% LTV,
  // 30% for >90% LTV, 25% for >85% LTV, 12% for >80% LTV). Below the 80.01%
  // conventional PMI trigger there is structurally no mortgage insurance — this
  // is a policy fact, not a missing-data condition.
  let coverage = 0;
  if (ltv > 95) coverage = 35;
  else if (ltv > 90) coverage = 30;
  else if (ltv > 85) coverage = 25;
  else if (ltv > 80) coverage = 12;

  // No MI required below the trigger: rate is structurally zero (no lookup).
  if (coverage === 0) {
    return { annualRate: 0, monthlyRate: 0, term: 360, coverage: 0 };
  }

  // MI is required, so the premium MUST resolve from the dynamic CONVENTIONAL_PMI
  // matrix (FICO x LTV). A missing/out-of-range band here is a real compliance
  // error and fails loudly — no silent fallback. LTV is rounded up so it lands
  // in the correct seeded band.
  const ltvForLookup = Math.ceil(ltv * 100) / 100;
  const annualRate = await lookupResolver.resolveMatrixValue({
    matrixCode: "CONVENTIONAL_PMI",
    dim1Value: creditScore,
    dim2Value: ltvForLookup,
  });

  return {
    annualRate,
    monthlyRate: annualRate / 12,
    term: 360, // 30 years standard
    coverage,
  };
}
