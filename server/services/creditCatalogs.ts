// FCRA disclosure text + version, the ECOA/Reg B adverse-action reason catalog, bureau contacts, and state-specific disclosure rules.
// Split from the old server/services/creditService.ts — which re-exports all of it.

// v2 (2026-07): rebranded disclosure text from MortgageAI to Homiquity.
export const CURRENT_DISCLOSURE_VERSION = "FCRA-2025-v2";

// ECOA/Reg B §1002.9(b)(1) requires the adverse-action notice to name the
// federal agency that administers compliance for this creditor. For a
// non-depository mortgage creditor that default is the CFPB.
// COUNSEL: confirm the correct administering agency (CFPB vs. FTC, and the
// exact address per Reg B Appendix A) for this entity before production use.
export const ECOA_ADMINISTERING_AGENCY =
  "Bureau of Consumer Financial Protection, 1700 G Street NW, Washington, DC 20552";

export const FCRA_DISCLOSURE_TEXT = `CONSUMER CREDIT AUTHORIZATION AND DISCLOSURE

By providing your consent below, you authorize Homiquity and its designated agents to:

1. OBTAIN YOUR CREDIT REPORT: We will request a consumer credit report from one or more consumer reporting agencies (Experian, Equifax, and/or TransUnion) in connection with your mortgage loan application.

2. CREDIT INQUIRY TYPE: This authorization permits both "soft" inquiries (which do not affect your credit score) and "hard" inquiries (which may temporarily lower your credit score) as necessary for loan processing.

3. USE OF INFORMATION: Credit information obtained will be used solely for the purpose of evaluating your mortgage loan application and determining appropriate loan terms.

4. YOUR RIGHTS UNDER THE FAIR CREDIT REPORTING ACT (FCRA):
   - You have the right to obtain a free copy of your credit report from each credit bureau once every 12 months at www.annualcreditreport.com
   - If credit is denied or terms are changed based on credit information, you will receive an adverse action notice
   - You have the right to dispute inaccurate information on your credit report
   - You may request that your credit file be "frozen" to prevent access

5. MULTIPLE INQUIRIES: Multiple credit inquiries for mortgage loans made within a 45-day period are typically counted as a single inquiry for scoring purposes.

6. RETENTION: This authorization remains valid for 120 days from the date of your consent unless revoked in writing.

By clicking "I Authorize" you confirm that:
- You are the individual named on this application
- The information you provided is accurate
- You authorize the credit inquiry described above`;

interface AdverseActionReasonDetail {
  description: string;
  bureauReasonCodes: {
    experian?: string[];
    equifax?: string[];
    transunion?: string[];
    fico?: string[];
  };
  category: "credit_history" | "payment_history" | "credit_utilization" | "derogatory" | "income" | "other";
  severity: "high" | "medium" | "low";
}

export const ADVERSE_ACTION_REASONS: Record<string, AdverseActionReasonDetail> = {
  credit_score_low: {
    description: "Credit score does not meet minimum requirements",
    bureauReasonCodes: {
      experian: ["001", "002"],
      equifax: ["01", "02"],
      transunion: ["AA", "AB"],
      fico: ["1", "2"],
    },
    category: "credit_history",
    severity: "high",
  },
  dti_high: {
    description: "Debt-to-income ratio exceeds maximum threshold",
    bureauReasonCodes: {
      experian: ["038"],
      equifax: ["38"],
      transunion: ["BT"],
      fico: ["38"],
    },
    category: "income",
    severity: "high",
  },
  insufficient_credit_history: {
    description: "Insufficient credit history to evaluate",
    bureauReasonCodes: {
      experian: ["009", "010"],
      equifax: ["09", "10"],
      transunion: ["AI", "AJ"],
      fico: ["9", "10"],
    },
    category: "credit_history",
    severity: "medium",
  },
  derogatory_items: {
    description: "Derogatory items on credit report",
    bureauReasonCodes: {
      experian: ["022", "023", "024"],
      equifax: ["22", "23", "24"],
      transunion: ["BF", "BG", "BH"],
      fico: ["22", "23", "24"],
    },
    category: "derogatory",
    severity: "high",
  },
  recent_late_payments: {
    description: "Recent late payment history",
    bureauReasonCodes: {
      experian: ["003", "004", "005"],
      equifax: ["03", "04", "05"],
      transunion: ["AC", "AD", "AE"],
      fico: ["3", "4", "5"],
    },
    category: "payment_history",
    severity: "high",
  },
  high_credit_utilization: {
    description: "High credit utilization ratio",
    bureauReasonCodes: {
      experian: ["014", "015"],
      equifax: ["14", "15"],
      transunion: ["AN", "AO"],
      fico: ["14", "15"],
    },
    category: "credit_utilization",
    severity: "medium",
  },
  bankruptcy_recent: {
    description: "Recent bankruptcy on credit report",
    bureauReasonCodes: {
      experian: ["020"],
      equifax: ["20"],
      transunion: ["BD"],
      fico: ["20"],
    },
    category: "derogatory",
    severity: "high",
  },
  foreclosure_recent: {
    description: "Recent foreclosure on credit report",
    bureauReasonCodes: {
      experian: ["021"],
      equifax: ["21"],
      transunion: ["BE"],
      fico: ["21"],
    },
    category: "derogatory",
    severity: "high",
  },
  collections_active: {
    description: "Active collection accounts",
    bureauReasonCodes: {
      experian: ["040", "041"],
      equifax: ["40", "41"],
      transunion: ["BV", "BW"],
      fico: ["40", "41"],
    },
    category: "derogatory",
    severity: "high",
  },
  insufficient_income: {
    description: "Insufficient income for requested loan amount",
    bureauReasonCodes: {
      experian: ["098"],
      equifax: ["98"],
      transunion: ["CZ"],
      fico: ["98"],
    },
    category: "income",
    severity: "medium",
  },
  too_many_inquiries: {
    description: "Too many recent credit inquiries",
    bureauReasonCodes: {
      experian: ["008"],
      equifax: ["08"],
      transunion: ["AH"],
      fico: ["8"],
    },
    category: "other",
    severity: "low",
  },
  short_credit_history: {
    description: "Length of credit history is too short",
    bureauReasonCodes: {
      experian: ["011"],
      equifax: ["11"],
      transunion: ["AK"],
      fico: ["11"],
    },
    category: "credit_history",
    severity: "medium",
  },
  too_few_accounts: {
    description: "Too few accounts with credit history",
    bureauReasonCodes: {
      experian: ["013"],
      equifax: ["13"],
      transunion: ["AM"],
      fico: ["13"],
    },
    category: "credit_history",
    severity: "low",
  },

  // Non-bureau denial reasons from the Reg B model notice (Form C-1). These
  // carry no bureau reason codes — they arise from underwriting, not the
  // credit report. They complete the mapping from the HMDA LAR denial-reason
  // list so every denial can auto-generate a compliant adverse-action notice.
  employment_history: {
    description: "Employment history does not meet requirements (length, stability, or type of employment)",
    bureauReasonCodes: {},
    category: "income",
    severity: "medium",
  },
  collateral_insufficient: {
    description: "Value or type of collateral is not sufficient for the requested loan",
    bureauReasonCodes: {},
    category: "other",
    severity: "high",
  },
  insufficient_funds_to_close: {
    description: "Insufficient funds for down payment and/or closing costs",
    bureauReasonCodes: {},
    category: "other",
    severity: "medium",
  },
  unverifiable_information: {
    description: "Unable to verify information provided on the application (income, employment, residence, or credit references)",
    bureauReasonCodes: {},
    category: "other",
    severity: "medium",
  },
  application_incomplete: {
    description: "Credit application is incomplete",
    bureauReasonCodes: {},
    category: "other",
    severity: "low",
  },
  mortgage_insurance_denied: {
    description: "Mortgage insurance could not be obtained for the requested loan",
    bureauReasonCodes: {},
    category: "other",
    severity: "high",
  },
  other_credit_decision_factors: {
    description: "Other factors related to the credit decision (details available on request)",
    bureauReasonCodes: {},
    category: "other",
    severity: "medium",
  },
};

const ADVERSE_ACTION_SIMPLE: Record<string, string> = Object.fromEntries(
  Object.entries(ADVERSE_ACTION_REASONS).map(([key, val]) => [key, val.description])
);

export const BUREAU_CONTACT_INFO = {
  experian: {
    name: "Experian",
    address: "P.O. Box 4500, Allen, TX 75013",
    phone: "1-888-397-3742",
    website: "www.experian.com",
  },
  equifax: {
    name: "Equifax",
    address: "P.O. Box 740241, Atlanta, GA 30374",
    phone: "1-800-685-1111",
    website: "www.equifax.com",
  },
  transunion: {
    name: "TransUnion",
    address: "P.O. Box 1000, Chester, PA 19016",
    phone: "1-800-916-8800",
    website: "www.transunion.com",
  },
};

interface StateDisclosureRule {
  stateCode: string;
  stateName: string;
  additionalDisclosures: string[];
  requiredNotices: string[];
  creditReportFeeMax: number | null;
  appraisalFeeMax: number | null;
  specialRequirements: string[];
  waitingPeriodDays: number;
  additionalConsentRequired: boolean;
}

const STATE_DISCLOSURE_RULES: Record<string, StateDisclosureRule> = {
  CA: {
    stateCode: "CA",
    stateName: "California",
    additionalDisclosures: [
      "California Civil Code Section 1785.20.2 - You have the right to receive a free credit report from a consumer credit reporting agency upon request.",
      "California Financial Code Section 22502 - We are licensed by the California Department of Financial Protection and Innovation.",
    ],
    requiredNotices: [
      "NOTICE TO CALIFORNIA BORROWERS: Under California law, you have the right to receive a copy of your credit report from the credit bureau that furnished the report used in evaluating your application.",
    ],
    creditReportFeeMax: 30,
    appraisalFeeMax: null,
    specialRequirements: ["California privacy notice required"],
    waitingPeriodDays: 0,
    additionalConsentRequired: false,
  },
  NY: {
    stateCode: "NY",
    stateName: "New York",
    additionalDisclosures: [
      "New York Banking Law Section 6-l - You have the right to request a fair credit score from us.",
      "New York General Business Law Section 380 - Consumer credit reporting agencies must provide you with a free copy of your credit report upon request.",
    ],
    requiredNotices: [
      "NOTICE TO NEW YORK BORROWERS: Under New York law, you are entitled to receive a free copy of your credit score upon request.",
    ],
    creditReportFeeMax: null,
    appraisalFeeMax: null,
    specialRequirements: ["New York fair lending disclosure required"],
    waitingPeriodDays: 0,
    additionalConsentRequired: true,
  },
  TX: {
    stateCode: "TX",
    stateName: "Texas",
    additionalDisclosures: [
      "Texas Finance Code Section 392.101 - You have the right to dispute any inaccurate information in your credit report.",
    ],
    requiredNotices: [
      "NOTICE TO TEXAS BORROWERS: Complaints may be directed to the Texas Department of Banking at 2601 N. Lamar Blvd., Austin, Texas 78705.",
    ],
    creditReportFeeMax: null,
    appraisalFeeMax: null,
    specialRequirements: [],
    waitingPeriodDays: 0,
    additionalConsentRequired: false,
  },
  FL: {
    stateCode: "FL",
    stateName: "Florida",
    additionalDisclosures: [
      "Florida Statutes Chapter 494 - We are licensed by the Florida Office of Financial Regulation.",
    ],
    requiredNotices: [
      "NOTICE TO FLORIDA BORROWERS: The Office of Financial Regulation can be contacted at (850) 487-9687.",
    ],
    creditReportFeeMax: null,
    appraisalFeeMax: null,
    specialRequirements: [],
    waitingPeriodDays: 0,
    additionalConsentRequired: false,
  },
  CO: {
    stateCode: "CO",
    stateName: "Colorado",
    additionalDisclosures: [
      "Colorado Revised Statutes 12-61-903 - You have the right to receive a copy of any credit report used.",
    ],
    requiredNotices: [
      "NOTICE TO COLORADO BORROWERS: REGULATED BY THE DIVISION OF REAL ESTATE.",
    ],
    creditReportFeeMax: 40,
    appraisalFeeMax: 500,
    specialRequirements: ["Colorado requires 3-day waiting period for certain transactions"],
    waitingPeriodDays: 3,
    additionalConsentRequired: false,
  },
  NV: {
    stateCode: "NV",
    stateName: "Nevada",
    additionalDisclosures: [
      "Nevada Revised Statutes 645B - We are licensed by the Nevada Division of Mortgage Lending.",
    ],
    requiredNotices: [
      "NOTICE TO NEVADA BORROWERS: You may contact the Nevada Division of Mortgage Lending at (702) 486-0782.",
    ],
    creditReportFeeMax: 35,
    appraisalFeeMax: null,
    specialRequirements: [],
    waitingPeriodDays: 0,
    additionalConsentRequired: false,
  },
  IL: {
    stateCode: "IL",
    stateName: "Illinois",
    additionalDisclosures: [
      "Illinois Residential Mortgage License Act - We are licensed by the Illinois Department of Financial and Professional Regulation.",
    ],
    requiredNotices: [
      "NOTICE TO ILLINOIS BORROWERS: Contact IDFPR at 1-888-473-4858 for questions or complaints.",
    ],
    creditReportFeeMax: null,
    appraisalFeeMax: null,
    specialRequirements: ["Illinois fair lending notice required"],
    waitingPeriodDays: 0,
    additionalConsentRequired: false,
  },
};

const DEFAULT_STATE_RULE: StateDisclosureRule = {
  stateCode: "DEFAULT",
  stateName: "Default",
  additionalDisclosures: [],
  requiredNotices: [],
  creditReportFeeMax: null,
  appraisalFeeMax: null,
  specialRequirements: [],
  waitingPeriodDays: 0,
  additionalConsentRequired: false,
};

export function getStateDisclosureRules(stateCode: string): StateDisclosureRule {
  return STATE_DISCLOSURE_RULES[stateCode.toUpperCase()] || DEFAULT_STATE_RULE;
}

export function getAllStateDisclosureRules(): Record<string, StateDisclosureRule> {
  return STATE_DISCLOSURE_RULES;
}

export function getStateSpecificDisclosure(stateCode: string): string {
  const rules = getStateDisclosureRules(stateCode);
  if (rules.stateCode === "DEFAULT") {
    return "";
  }
  
  let disclosure = `\n\nSTATE-SPECIFIC DISCLOSURES FOR ${rules.stateName.toUpperCase()}:\n\n`;
  
  rules.additionalDisclosures.forEach((d, i) => {
    disclosure += `${i + 1}. ${d}\n`;
  });
  
  if (rules.requiredNotices.length > 0) {
    disclosure += "\n";
    rules.requiredNotices.forEach(notice => {
      disclosure += `${notice}\n`;
    });
  }
  
  if (rules.creditReportFeeMax !== null) {
    disclosure += `\nMaximum credit report fee: $${rules.creditReportFeeMax}`;
  }
  
  if (rules.waitingPeriodDays > 0) {
    disclosure += `\nRequired waiting period: ${rules.waitingPeriodDays} business days`;
  }
  
  return disclosure;
}

export function getCombinedDisclosure(stateCode?: string): string {
  let fullDisclosure = FCRA_DISCLOSURE_TEXT;
  
  if (stateCode) {
    const stateDisclosure = getStateSpecificDisclosure(stateCode);
    if (stateDisclosure) {
      fullDisclosure += stateDisclosure;
    }
  }
  
  return fullDisclosure;
}

