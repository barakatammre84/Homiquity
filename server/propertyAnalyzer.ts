/**
 * Property Analysis Engine
 * 
 * Integrates RESO property data, Mello-Roos detection, and property eligibility analysis
 * Supports "Can I buy this house?" reverse-engineering with special assessment detection
 */

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

export function recommendLTV(
  propertyType: string,
  yearBuilt?: number,
  squareFeet?: number
): number {
  let baseLTV = 95; // Standard conventional max

  // Property type adjustments
  const typeAdjustments: Record<string, number> = {
    single_family: 95,
    townhouse: 90,
    condo: 85,
    multi_family: 80,
    manufactured: 75,
    other: 80,
  };

  baseLTV = typeAdjustments[propertyType] || 95;

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

export function analyzeProperty(request: PropertyAnalysisRequest): PropertyAnalysis {
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

  const recommendedLTV = recommendLTV(
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

export function getPMIRateCard(creditScore: number, ltv: number): {
  annualRate: number;
  monthlyRate: number;
  term: number;
  coverage: number; // Coverage percentage at this LTV
} {
  // MGIC/Enact-style rate cards by credit score and LTV bands
  const rateCards: Record<string, Record<string, { annual: number; coverage: number }>> = {
    "780_plus": {
      "95": { annual: 0.35, coverage: 30 },
      "90": { annual: 0.25, coverage: 30 },
      "85": { annual: 0.20, coverage: 25 },
      "80": { annual: 0, coverage: 0 },
    },
    "760_779": {
      "95": { annual: 0.42, coverage: 30 },
      "90": { annual: 0.30, coverage: 30 },
      "85": { annual: 0.22, coverage: 25 },
      "80": { annual: 0, coverage: 0 },
    },
    "740_759": {
      "95": { annual: 0.50, coverage: 30 },
      "90": { annual: 0.35, coverage: 30 },
      "85": { annual: 0.25, coverage: 25 },
      "80": { annual: 0, coverage: 0 },
    },
    "720_739": {
      "95": { annual: 0.62, coverage: 30 },
      "90": { annual: 0.45, coverage: 30 },
      "85": { annual: 0.32, coverage: 25 },
      "80": { annual: 0, coverage: 0 },
    },
    "below_720": {
      "95": { annual: 1.35, coverage: 30 },
      "90": { annual: 0.75, coverage: 30 },
      "85": { annual: 0.50, coverage: 25 },
      "80": { annual: 0, coverage: 0 },
    },
  };

  // Determine score tier
  let scoreTier = "below_720";
  if (creditScore >= 780) scoreTier = "780_plus";
  else if (creditScore >= 760) scoreTier = "760_779";
  else if (creditScore >= 740) scoreTier = "740_759";
  else if (creditScore >= 720) scoreTier = "720_739";

  // Determine LTV tier
  let ltvTier = "95";
  if (ltv <= 80) ltvTier = "80";
  else if (ltv <= 85) ltvTier = "85";
  else if (ltv <= 90) ltvTier = "90";
  else ltvTier = "95";

  const rateData = rateCards[scoreTier]?.[ltvTier] || { annual: 0.60, coverage: 30 };

  return {
    annualRate: rateData.annual,
    monthlyRate: rateData.annual / 12,
    term: 360, // 30 years standard
    coverage: rateData.coverage,
  };
}
