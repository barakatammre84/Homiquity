import { db } from "../db";
import { 
  creditConsents, 
  creditPulls, 
  adverseActions, 
  creditAuditLog,
  draftConsentProgress,
  loanApplications,
  users,
  type InsertCreditConsent,
  type InsertCreditPull,
  type InsertAdverseAction,
  type InsertCreditAuditLog,
  type InsertDraftConsentProgress,
  type CreditConsent,
  type CreditPull,
  type AdverseAction,
  type DraftConsentProgress,
} from "@shared/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { 
  computeAuditEntryHash, 
  encryptSensitiveData, 
  computeHash,
  verifyHashChain 
} from "./encryptionService";

const CURRENT_DISCLOSURE_VERSION = "FCRA-2025-v1";

const FCRA_DISCLOSURE_TEXT = `CONSUMER CREDIT AUTHORIZATION AND DISCLOSURE

By providing your consent below, you authorize MortgageAI and its designated agents to:

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

const ADVERSE_ACTION_REASONS: Record<string, AdverseActionReasonDetail> = {
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
};

const ADVERSE_ACTION_SIMPLE: Record<string, string> = Object.fromEntries(
  Object.entries(ADVERSE_ACTION_REASONS).map(([key, val]) => [key, val.description])
);

const BUREAU_CONTACT_INFO = {
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

export async function createCreditConsent(
  data: {
    applicationId: string;
    userId: string;
    consentType: string;
    borrowerFullName: string;
    borrowerSSNLast4?: string;
    borrowerDOB?: string;
    consentGiven: boolean;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<CreditConsent> {
  const consent: InsertCreditConsent = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentType: data.consentType,
    disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    disclosureText: FCRA_DISCLOSURE_TEXT,
    consentGiven: data.consentGiven,
    consentTimestamp: new Date(),
    borrowerFullName: data.borrowerFullName,
    borrowerSSNLast4: data.borrowerSSNLast4,
    borrowerDOB: data.borrowerDOB,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    signatureType: "electronic",
    isActive: true,
  };

  const [result] = await db.insert(creditConsents).values(consent).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    userId: data.userId,
    consentId: result.id,
    action: data.consentGiven ? "consent_given" : "consent_declined",
    actionDetails: {
      consentType: data.consentType,
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    },
    performedBy: data.userId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });

  return result;
}

export async function getActiveConsent(applicationId: string): Promise<CreditConsent | null> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(
      and(
        eq(creditConsents.applicationId, applicationId),
        eq(creditConsents.isActive, true),
        eq(creditConsents.consentGiven, true)
      )
    )
    .orderBy(desc(creditConsents.consentTimestamp))
    .limit(1);

  return consent || null;
}

export async function revokeConsent(
  consentId: string,
  reason: string,
  performedBy: string,
  ipAddress?: string
): Promise<void> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(eq(creditConsents.id, consentId));

  if (!consent) {
    throw new Error("Consent not found");
  }

  await db
    .update(creditConsents)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(creditConsents.id, consentId));

  await logCreditAction({
    applicationId: consent.applicationId,
    userId: consent.userId,
    consentId: consentId,
    action: "consent_revoked",
    actionDetails: { reason },
    performedBy,
    ipAddress,
  });
}

export async function requestCreditPull(
  data: {
    applicationId: string;
    consentId: string;
    requestedBy: string;
    pullType: "soft" | "hard" | "tri_merge";
    bureaus: string[];
    ipAddress?: string;
  }
): Promise<CreditPull> {
  const consent = await getActiveConsent(data.applicationId);
  if (!consent || consent.id !== data.consentId) {
    throw new Error("Valid consent required before credit pull");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 120);

  const pull: InsertCreditPull = {
    applicationId: data.applicationId,
    consentId: data.consentId,
    requestedBy: data.requestedBy,
    pullType: data.pullType,
    bureaus: data.bureaus,
    status: "pending",
    requestedAt: new Date(),
    expiresAt,
  };

  const [result] = await db.insert(creditPulls).values(pull).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    creditPullId: result.id,
    consentId: data.consentId,
    action: "pull_requested",
    actionDetails: {
      pullType: data.pullType,
      bureaus: data.bureaus,
    },
    performedBy: data.requestedBy,
    ipAddress: data.ipAddress,
  });

  return result;
}

export async function simulateCreditPullCompletion(
  creditPullId: string,
  simulatedScores?: {
    experian?: number;
    equifax?: number;
    transunion?: number;
  }
): Promise<CreditPull> {
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.id, creditPullId));

  if (!pull) {
    throw new Error("Credit pull not found");
  }

  const experian = simulatedScores?.experian || Math.floor(Math.random() * 200) + 600;
  const equifax = simulatedScores?.equifax || Math.floor(Math.random() * 200) + 600;
  const transunion = simulatedScores?.transunion || Math.floor(Math.random() * 200) + 600;

  const scores = [experian, equifax, transunion].sort((a, b) => a - b);
  const representativeScore = scores[1];

  const totalDebt = Math.floor(Math.random() * 50000) + 5000;
  const monthlyPayments = Math.floor(totalDebt * 0.03);
  const totalTradelines = Math.floor(Math.random() * 15) + 3;
  const openTradelines = Math.floor(Math.random() * 8) + 2;
  const derogatoryCount = Math.floor(Math.random() * 3);
  const inquiryCount30Days = Math.floor(Math.random() * 3);
  const inquiryCount90Days = Math.floor(Math.random() * 5);

  const simulatedRawResponse = JSON.stringify({
    requestId: `SIM-${Date.now()}`,
    timestamp: new Date().toISOString(),
    bureaus: {
      experian: { score: experian, reportDate: new Date().toISOString() },
      equifax: { score: equifax, reportDate: new Date().toISOString() },
      transunion: { score: transunion, reportDate: new Date().toISOString() },
    },
    tradelines: { total: totalTradelines, open: openTradelines },
    derogatory: derogatoryCount,
    inquiries: { last30Days: inquiryCount30Days, last90Days: inquiryCount90Days },
    debt: { total: totalDebt, monthlyPayment: monthlyPayments },
    simulationMode: true,
  });

  const rawResponseHash = computeHash(simulatedRawResponse);
  const encryptedResponse = encryptSensitiveData(simulatedRawResponse);

  const [updated] = await db
    .update(creditPulls)
    .set({
      status: "completed",
      experianScore: experian,
      equifaxScore: equifax,
      transunionScore: transunion,
      representativeScore,
      totalTradelines,
      openTradelines,
      totalDebt: totalDebt.toString(),
      monthlyPayments: monthlyPayments.toString(),
      derogatoryCount,
      inquiryCount30Days,
      inquiryCount90Days,
      encryptedRawResponse: encryptedResponse.encryptedContent,
      encryptionKeyId: encryptedResponse.keyId,
      encryptionIV: encryptedResponse.iv,
      vendorResponseHash: rawResponseHash,
      vendorRequestId: `SIM-${creditPullId.substring(0, 8)}`,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creditPulls.id, creditPullId))
    .returning();

  await logCreditAction({
    applicationId: pull.applicationId,
    creditPullId: creditPullId,
    consentId: pull.consentId,
    action: "pull_completed",
    actionDetails: {
      representativeScore,
      bureausReturned: pull.bureaus,
      responseHashStored: true,
    },
  });

  return updated;
}

export async function getCreditPullsByApplication(applicationId: string): Promise<CreditPull[]> {
  return db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.applicationId, applicationId))
    .orderBy(desc(creditPulls.requestedAt));
}

export async function getLatestCreditPull(applicationId: string): Promise<CreditPull | null> {
  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(
      and(
        eq(creditPulls.applicationId, applicationId),
        eq(creditPulls.status, "completed")
      )
    )
    .orderBy(desc(creditPulls.completedAt))
    .limit(1);

  return pull || null;
}

export function validateAdverseActionReason(reasonKey: string): boolean {
  return reasonKey in ADVERSE_ACTION_REASONS;
}

export function getValidAdverseActionReasonKeys(): string[] {
  return Object.keys(ADVERSE_ACTION_REASONS);
}

export async function generateAdverseAction(
  data: {
    applicationId: string;
    creditPullId?: string;
    userId: string;
    actionType: "denial" | "counteroffer" | "rate_adjustment" | "terms_change";
    primaryReason: string;
    secondaryReasons?: string[];
    creditScoreUsed?: number;
    creditScoreSource?: "experian" | "equifax" | "transunion";
    generatedBy: string;
  }
): Promise<AdverseAction> {
  // Validate primary reason key exists
  if (!validateAdverseActionReason(data.primaryReason)) {
    throw new Error(`Invalid primary reason key: ${data.primaryReason}. Valid keys: ${getValidAdverseActionReasonKeys().join(", ")}`);
  }
  
  // Validate secondary reason keys exist
  if (data.secondaryReasons) {
    for (const reason of data.secondaryReasons) {
      if (!validateAdverseActionReason(reason)) {
        throw new Error(`Invalid secondary reason key: ${reason}. Valid keys: ${getValidAdverseActionReasonKeys().join(", ")}`);
      }
    }
  }

  const bureau = data.creditScoreSource 
    ? BUREAU_CONTACT_INFO[data.creditScoreSource]
    : BUREAU_CONTACT_INFO.experian;

  const primaryReasonDetail = ADVERSE_ACTION_REASONS[data.primaryReason];
  const secondaryReasonDetails = data.secondaryReasons?.map(r => ADVERSE_ACTION_REASONS[r]);
  
  const bureauKey = data.creditScoreSource || "experian";
  const primaryBureauCodes = primaryReasonDetail?.bureauReasonCodes?.[bureauKey as keyof typeof primaryReasonDetail.bureauReasonCodes] || [];
  
  const noticeText = generateAdverseActionNotice({
    actionType: data.actionType,
    primaryReason: primaryReasonDetail?.description || "Credit decision factors",
    secondaryReasons: secondaryReasonDetails?.map(r => r?.description || ""),
    creditScoreUsed: data.creditScoreUsed,
    bureau,
    bureauReasonCodes: primaryBureauCodes,
  });

  const adverseAction: InsertAdverseAction = {
    applicationId: data.applicationId,
    creditPullId: data.creditPullId,
    userId: data.userId,
    actionType: data.actionType,
    primaryReason: primaryReasonDetail?.description || "Credit decision factors",
    secondaryReasons: secondaryReasonDetails?.map(r => r?.description || ""),
    creditScoreUsed: data.creditScoreUsed,
    creditScoreSource: data.creditScoreSource,
    scoreRangeLow: 300,
    scoreRangeHigh: 850,
    bureauName: bureau.name,
    bureauAddress: bureau.address,
    bureauPhone: bureau.phone,
    bureauWebsite: bureau.website,
    noticeText,
    noticeDate: new Date(),
    fcraCompliant: true,
    generatedBy: data.generatedBy,
  };

  const [result] = await db.insert(adverseActions).values(adverseAction).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    creditPullId: data.creditPullId,
    adverseActionId: result.id,
    userId: data.userId,
    action: "adverse_action_generated",
    actionDetails: {
      actionType: data.actionType,
      primaryReason: data.primaryReason,
    },
    performedBy: data.generatedBy,
  });

  return result;
}

function generateAdverseActionNotice(data: {
  actionType: string;
  primaryReason: string;
  secondaryReasons?: string[];
  creditScoreUsed?: number;
  bureau: typeof BUREAU_CONTACT_INFO.experian;
  bureauReasonCodes?: string[];
}): string {
  const actionTypeText = {
    denial: "DENIAL OF CREDIT",
    counteroffer: "COUNTEROFFER OF CREDIT TERMS",
    rate_adjustment: "INTEREST RATE ADJUSTMENT",
    terms_change: "MODIFICATION OF CREDIT TERMS",
  }[data.actionType] || "ADVERSE ACTION NOTICE";

  let notice = `
NOTICE OF ${actionTypeText}

Date: ${new Date().toLocaleDateString()}

Dear Applicant,

This notice is to inform you that action has been taken on your mortgage loan application. The decision was based, in whole or in part, on information obtained from a consumer reporting agency.

ACTION TAKEN: ${data.actionType.replace(/_/g, " ").toUpperCase()}

PRINCIPAL REASON(S) FOR THIS DECISION:

1. ${data.primaryReason}${data.bureauReasonCodes && data.bureauReasonCodes.length > 0 ? ` (Reason Code: ${data.bureauReasonCodes.join(", ")})` : ""}
`;

  if (data.secondaryReasons && data.secondaryReasons.length > 0) {
    data.secondaryReasons.forEach((reason, index) => {
      notice += `${index + 2}. ${reason}\n`;
    });
  }

  if (data.bureauReasonCodes && data.bureauReasonCodes.length > 0) {
    notice += `
BUREAU REASON CODES:
The following standardized reason codes apply to this decision:
${data.bureauReasonCodes.map(code => `- Code ${code}`).join("\n")}
These codes are industry-standard identifiers used by credit bureaus.
`;
  }

  if (data.creditScoreUsed) {
    notice += `
CREDIT SCORE INFORMATION:
Your credit score: ${data.creditScoreUsed}
Credit scores range from 300 to 850.
Key factors that adversely affected your credit score are listed above.
`;
  }

  notice += `
YOUR RIGHTS UNDER THE FAIR CREDIT REPORTING ACT:

You have the right to obtain a free copy of your credit report from the consumer reporting agency named below within 60 days of receiving this notice. The consumer reporting agency did not make the decision to take this action and cannot provide specific reasons for it.

You have the right to dispute the accuracy or completeness of any information in your credit report.

CONSUMER REPORTING AGENCY:
${data.bureau.name}
${data.bureau.address}
Phone: ${data.bureau.phone}
Website: ${data.bureau.website}

For questions about this notice, please contact us at:
MortgageAI
support@mortgageai.com

This notice is required by the Fair Credit Reporting Act.
`;

  return notice;
}

export async function getAdverseActionsByApplication(applicationId: string): Promise<AdverseAction[]> {
  return db
    .select()
    .from(adverseActions)
    .where(eq(adverseActions.applicationId, applicationId))
    .orderBy(desc(adverseActions.noticeDate));
}

export async function markAdverseActionDelivered(
  adverseActionId: string,
  deliveryMethod: string,
  deliveryConfirmation?: string
): Promise<void> {
  await db
    .update(adverseActions)
    .set({
      deliveryMethod,
      deliveredAt: new Date(),
      deliveryConfirmation,
      updatedAt: new Date(),
    })
    .where(eq(adverseActions.id, adverseActionId));

  const [action] = await db
    .select()
    .from(adverseActions)
    .where(eq(adverseActions.id, adverseActionId));

  if (action) {
    await logCreditAction({
      applicationId: action.applicationId,
      adverseActionId,
      userId: action.userId,
      action: "adverse_action_delivered",
      actionDetails: { deliveryMethod, deliveryConfirmation },
    });
  }
}

async function logCreditAction(data: {
  applicationId?: string;
  userId?: string;
  consentId?: string;
  creditPullId?: string;
  adverseActionId?: string;
  action: string;
  actionDetails?: Record<string, unknown>;
  performedBy?: string;
  performedByRole?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const timestamp = new Date();
  
  let previousEntryHash: string | null = null;
  let sequenceNumber = 1;
  
  if (data.applicationId) {
    const [lastEntry] = await db
      .select({
        entryHash: creditAuditLog.entryHash,
        sequenceNumber: creditAuditLog.sequenceNumber,
      })
      .from(creditAuditLog)
      .where(eq(creditAuditLog.applicationId, data.applicationId))
      .orderBy(desc(creditAuditLog.timestamp))
      .limit(1);
    
    if (lastEntry) {
      previousEntryHash = lastEntry.entryHash;
      sequenceNumber = (lastEntry.sequenceNumber || 0) + 1;
    }
  }
  
  const entryHash = computeAuditEntryHash({
    applicationId: data.applicationId || null,
    userId: data.userId || null,
    action: data.action,
    actionDetails: data.actionDetails || null,
    timestamp,
    previousEntryHash,
  });
  
  const log: InsertCreditAuditLog = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentId: data.consentId,
    creditPullId: data.creditPullId,
    adverseActionId: data.adverseActionId,
    action: data.action,
    actionDetails: data.actionDetails,
    performedBy: data.performedBy,
    performedByRole: data.performedByRole,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    entryHash,
    previousEntryHash,
    sequenceNumber,
    timestamp,
  };

  await db.insert(creditAuditLog).values(log);
}

export async function getCreditAuditLog(
  applicationId: string,
  limit: number = 100
): Promise<typeof creditAuditLog.$inferSelect[]> {
  return db
    .select()
    .from(creditAuditLog)
    .where(eq(creditAuditLog.applicationId, applicationId))
    .orderBy(desc(creditAuditLog.timestamp))
    .limit(limit);
}

export function getDisclosureText(): string {
  return FCRA_DISCLOSURE_TEXT;
}

export function getDisclosureVersion(): string {
  return CURRENT_DISCLOSURE_VERSION;
}

export function getAdverseActionReasons(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ADVERSE_ACTION_REASONS).map(([key, val]) => [key, val.description])
  );
}

export function getAdverseActionReasonsDetailed(): typeof ADVERSE_ACTION_REASONS {
  return ADVERSE_ACTION_REASONS;
}

export function getReasonBureauCodes(
  reasonKey: string, 
  bureau: "experian" | "equifax" | "transunion" | "fico"
): string[] {
  const reason = ADVERSE_ACTION_REASONS[reasonKey];
  if (!reason) return [];
  return reason.bureauReasonCodes[bureau] || [];
}

export async function verifyAuditLogIntegrity(
  applicationId: string
): Promise<{ valid: boolean; brokenAt?: number; reason?: string; totalEntries: number }> {
  const entries = await db
    .select()
    .from(creditAuditLog)
    .where(eq(creditAuditLog.applicationId, applicationId))
    .orderBy(creditAuditLog.timestamp);
  
  if (entries.length === 0) {
    return { valid: true, totalEntries: 0 };
  }
  
  const result = verifyHashChain(
    entries.map(e => ({
      entryHash: e.entryHash,
      previousEntryHash: e.previousEntryHash,
      applicationId: e.applicationId,
      userId: e.userId,
      action: e.action,
      actionDetails: e.actionDetails as Record<string, any> | null,
      timestamp: e.timestamp,
    }))
  );
  
  return { ...result, totalEntries: entries.length };
}

export interface AuditExportPackage {
  applicationId: string;
  exportedAt: string;
  exportedBy: string;
  integrityVerified: boolean;
  consent: CreditConsent | null;
  creditPulls: CreditPull[];
  adverseActions: AdverseAction[];
  auditEntries: Array<{
    sequenceNumber: number | null;
    action: string;
    timestamp: Date;
    entryHash: string;
    previousEntryHash: string | null;
    actionDetails: Record<string, any> | null;
    performedBy: string | null;
  }>;
  summary: {
    totalPulls: number;
    totalAdverseActions: number;
    totalAuditEntries: number;
    firstActivity: string | null;
    lastActivity: string | null;
  };
}

export async function generateAuditExportPackage(
  applicationId: string,
  exportedBy: string
): Promise<AuditExportPackage> {
  const consent = await getActiveConsent(applicationId);
  const pulls = await getCreditPullsByApplication(applicationId);
  const actions = await getAdverseActionsByApplication(applicationId);
  const auditEntries = await getCreditAuditLog(applicationId, 1000);
  const integrityCheck = await verifyAuditLogIntegrity(applicationId);
  
  const sortedAudit = [...auditEntries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  await logCreditAction({
    applicationId,
    action: "audit_package_exported",
    actionDetails: {
      exportedBy,
      integrityVerified: integrityCheck.valid,
      entryCount: auditEntries.length,
    },
    performedBy: exportedBy,
  });
  
  return {
    applicationId,
    exportedAt: new Date().toISOString(),
    exportedBy,
    integrityVerified: integrityCheck.valid,
    consent,
    creditPulls: pulls,
    adverseActions: actions,
    auditEntries: sortedAudit.map(e => ({
      sequenceNumber: e.sequenceNumber,
      action: e.action,
      timestamp: e.timestamp,
      entryHash: e.entryHash,
      previousEntryHash: e.previousEntryHash,
      actionDetails: e.actionDetails as Record<string, any> | null,
      performedBy: e.performedBy,
    })),
    summary: {
      totalPulls: pulls.length,
      totalAdverseActions: actions.length,
      totalAuditEntries: auditEntries.length,
      firstActivity: sortedAudit[0]?.timestamp.toISOString() || null,
      lastActivity: sortedAudit[sortedAudit.length - 1]?.timestamp.toISOString() || null,
    },
  };
}

export async function generateCSVExport(applicationId: string): Promise<string> {
  const auditEntries = await getCreditAuditLog(applicationId, 1000);
  const sortedAudit = [...auditEntries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const headers = [
    "Sequence",
    "Timestamp",
    "Action",
    "Entry Hash",
    "Previous Hash",
    "Performed By",
    "Details",
  ];
  
  const rows = sortedAudit.map(e => [
    e.sequenceNumber?.toString() || "",
    e.timestamp.toISOString(),
    e.action,
    e.entryHash,
    e.previousEntryHash || "GENESIS",
    e.performedBy || "",
    JSON.stringify(e.actionDetails || {}),
  ]);
  
  const escapeCSV = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };
  
  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map(row => row.map(escapeCSV).join(",")),
  ].join("\n");
  
  return csvContent;
}

// Draft Consent Progress - Save & Resume functionality

export async function saveDraftConsent(
  applicationId: string,
  userId: string,
  data: Partial<InsertDraftConsentProgress>
): Promise<DraftConsentProgress> {
  const existing = await db
    .select()
    .from(draftConsentProgress)
    .where(and(
      eq(draftConsentProgress.applicationId, applicationId),
      eq(draftConsentProgress.userId, userId)
    ))
    .limit(1);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  if (existing.length > 0) {
    const [updated] = await db
      .update(draftConsentProgress)
      .set({
        ...data,
        lastSavedAt: new Date(),
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(draftConsentProgress.id, existing[0].id))
      .returning();
    
    await logCreditAction({
      applicationId,
      userId,
      action: "consent_progress_saved",
      actionDetails: {
        currentStep: data.currentStep,
        disclosureRead: data.disclosureRead,
        acknowledged: data.acknowledged,
      },
      performedBy: userId,
    });
    
    return updated;
  } else {
    const [created] = await db
      .insert(draftConsentProgress)
      .values({
        applicationId,
        userId,
        ...data,
        lastSavedAt: new Date(),
        expiresAt,
      })
      .returning();
    
    await logCreditAction({
      applicationId,
      userId,
      action: "consent_progress_started",
      actionDetails: {
        consentType: data.consentType || "hard_pull",
      },
      performedBy: userId,
    });
    
    return created;
  }
}

export async function getDraftConsent(
  applicationId: string,
  userId: string
): Promise<DraftConsentProgress | null> {
  const result = await db
    .select()
    .from(draftConsentProgress)
    .where(and(
      eq(draftConsentProgress.applicationId, applicationId),
      eq(draftConsentProgress.userId, userId)
    ))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const draft = result[0];
  if (draft.expiresAt && new Date(draft.expiresAt) < new Date()) {
    await deleteDraftConsent(applicationId, userId);
    return null;
  }
  
  return draft;
}

export async function deleteDraftConsent(
  applicationId: string,
  userId: string
): Promise<void> {
  await db
    .delete(draftConsentProgress)
    .where(and(
      eq(draftConsentProgress.applicationId, applicationId),
      eq(draftConsentProgress.userId, userId)
    ));
}

export async function cleanupExpiredDrafts(): Promise<number> {
  const result = await db
    .delete(draftConsentProgress)
    .where(lt(draftConsentProgress.expiresAt, new Date()))
    .returning();
  
  return result.length;
}

// ============================================================================
// DATA RETENTION POLICIES
// ============================================================================

interface RetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number | null; // null = never delete, archive only
  legalBasis: string;
  regulatoryReference: string;
}

const DATA_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  credit_consent: {
    dataType: "credit_consent",
    retentionPeriodDays: 2555, // 7 years
    archiveAfterDays: 365, // Archive after 1 year
    deleteAfterDays: null, // Never delete - regulatory requirement
    legalBasis: "FCRA Section 604(b)(3) - Permissible purpose verification",
    regulatoryReference: "15 U.S.C. § 1681b(b)(3)",
  },
  credit_pull: {
    dataType: "credit_pull",
    retentionPeriodDays: 2555, // 7 years
    archiveAfterDays: 365,
    deleteAfterDays: null,
    legalBasis: "FCRA compliance and loan file retention",
    regulatoryReference: "12 CFR 1002.12 - Record retention",
  },
  adverse_action: {
    dataType: "adverse_action",
    retentionPeriodDays: 1825, // 5 years minimum under ECOA
    archiveAfterDays: 365,
    deleteAfterDays: null,
    legalBasis: "ECOA adverse action notice retention",
    regulatoryReference: "12 CFR 1002.12(b)(1)",
  },
  credit_audit_log: {
    dataType: "credit_audit_log",
    retentionPeriodDays: 2555, // 7 years
    archiveAfterDays: 730, // Archive after 2 years
    deleteAfterDays: null, // Never delete audit logs
    legalBasis: "Regulatory examination support and compliance verification",
    regulatoryReference: "CFPB Exam Manual - Fair Lending",
  },
  raw_bureau_response: {
    dataType: "raw_bureau_response",
    retentionPeriodDays: 2555,
    archiveAfterDays: 180, // Archive after 6 months (PII-heavy)
    deleteAfterDays: 2920, // Delete after 8 years
    legalBasis: "Loan file documentation with PII minimization",
    regulatoryReference: "GLBA Privacy Rule",
  },
  draft_consent: {
    dataType: "draft_consent",
    retentionPeriodDays: 7,
    archiveAfterDays: 7,
    deleteAfterDays: 7,
    legalBasis: "Session data - no regulatory retention requirement",
    regulatoryReference: "N/A",
  },
};

interface RetentionStatus {
  dataType: string;
  recordId: string;
  createdAt: Date;
  currentAgeDays: number;
  status: "active" | "archive_eligible" | "archived" | "delete_eligible";
  archiveEligibleDate: Date;
  deleteEligibleDate: Date | null;
  policy: RetentionPolicy;
}

export function getRetentionPolicies(): Record<string, RetentionPolicy> {
  return DATA_RETENTION_POLICIES;
}

export function getRetentionPolicy(dataType: string): RetentionPolicy | null {
  return DATA_RETENTION_POLICIES[dataType] || null;
}

function calculateRetentionStatus(
  dataType: string,
  recordId: string,
  createdAt: Date,
  archivedAt?: Date | null
): RetentionStatus | null {
  const policy = DATA_RETENTION_POLICIES[dataType];
  if (!policy) return null;

  const now = new Date();
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  const archiveEligibleDate = new Date(createdAt);
  archiveEligibleDate.setDate(archiveEligibleDate.getDate() + policy.archiveAfterDays);

  let deleteEligibleDate: Date | null = null;
  if (policy.deleteAfterDays) {
    deleteEligibleDate = new Date(createdAt);
    deleteEligibleDate.setDate(deleteEligibleDate.getDate() + policy.deleteAfterDays);
  }

  let status: RetentionStatus["status"] = "active";
  if (archivedAt) {
    status = "archived";
  } else if (deleteEligibleDate && now >= deleteEligibleDate) {
    status = "delete_eligible";
  } else if (now >= archiveEligibleDate) {
    status = "archive_eligible";
  }

  return {
    dataType,
    recordId,
    createdAt,
    currentAgeDays: ageDays,
    status,
    archiveEligibleDate,
    deleteEligibleDate,
    policy,
  };
}

export async function getApplicationRetentionStatus(
  applicationId: string
): Promise<{
  applicationId: string;
  records: RetentionStatus[];
  summary: {
    total: number;
    active: number;
    archiveEligible: number;
    archived: number;
    deleteEligible: number;
  };
  oldestRecord: Date | null;
  retentionCompliant: boolean;
}> {
  const [consents, pulls, actions, auditLogs] = await Promise.all([
    db.select().from(creditConsents).where(eq(creditConsents.applicationId, applicationId)),
    db.select().from(creditPulls).where(eq(creditPulls.applicationId, applicationId)),
    db.select().from(adverseActions).where(eq(adverseActions.applicationId, applicationId)),
    db.select().from(creditAuditLog).where(eq(creditAuditLog.applicationId, applicationId)),
  ]);

  const records: RetentionStatus[] = [];

  // Process consents
  for (const consent of consents) {
    const status = calculateRetentionStatus(
      "credit_consent",
      consent.id,
      consent.createdAt!,
      null
    );
    if (status) records.push(status);
  }

  // Process credit pulls
  for (const pull of pulls) {
    const status = calculateRetentionStatus(
      "credit_pull",
      pull.id,
      pull.createdAt!,
      pull.archivedAt
    );
    if (status) records.push(status);
  }

  // Process adverse actions
  for (const action of actions) {
    const status = calculateRetentionStatus(
      "adverse_action",
      action.id,
      action.createdAt!,
      null
    );
    if (status) records.push(status);
  }

  // Process audit logs
  for (const log of auditLogs) {
    const status = calculateRetentionStatus(
      "credit_audit_log",
      log.id.toString(),
      log.timestamp!,
      null
    );
    if (status) records.push(status);
  }

  const summary = {
    total: records.length,
    active: records.filter(r => r.status === "active").length,
    archiveEligible: records.filter(r => r.status === "archive_eligible").length,
    archived: records.filter(r => r.status === "archived").length,
    deleteEligible: records.filter(r => r.status === "delete_eligible").length,
  };

  const oldestRecord = records.length > 0
    ? new Date(Math.min(...records.map(r => r.createdAt.getTime())))
    : null;

  // Retention compliant means no records are delete-eligible without being archived
  const retentionCompliant = records.every(
    r => r.status !== "delete_eligible" || r.policy.deleteAfterDays === null
  );

  return {
    applicationId,
    records,
    summary,
    oldestRecord,
    retentionCompliant,
  };
}

export async function getArchiveEligibleRecords(): Promise<{
  creditPulls: CreditPull[];
  totalCount: number;
  byType: Record<string, number>;
}> {
  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - DATA_RETENTION_POLICIES.credit_pull.archiveAfterDays);

  const eligiblePulls = await db
    .select()
    .from(creditPulls)
    .where(
      and(
        lt(creditPulls.createdAt, archiveCutoff),
        eq(creditPulls.status, "completed")
      )
    );

  // Filter out already archived
  const notArchived = eligiblePulls.filter(p => !p.archivedAt);

  return {
    creditPulls: notArchived,
    totalCount: notArchived.length,
    byType: {
      credit_pull: notArchived.length,
    },
  };
}

export async function archiveCreditPull(
  creditPullId: string,
  archiveReason: string,
  performedBy: string
): Promise<void> {
  await db
    .update(creditPulls)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creditPulls.id, creditPullId));

  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.id, creditPullId));

  if (pull) {
    await logCreditAction({
      applicationId: pull.applicationId,
      creditPullId: creditPullId,
      userId: pull.requestedBy,
      action: "credit_pull_archived",
      actionDetails: {
        reason: archiveReason,
        archivedAt: new Date().toISOString(),
      },
      performedBy,
    });
  }
}

export async function getRetentionComplianceReport(): Promise<{
  generatedAt: Date;
  policies: RetentionPolicy[];
  recordCounts: Record<string, number>;
  archiveEligibleCounts: Record<string, number>;
  deleteEligibleCounts: Record<string, number>;
  retentionReviewCounts: Record<string, number>;
  recommendations: string[];
}> {
  const now = new Date();
  const policies = Object.values(DATA_RETENTION_POLICIES);

  // Get actual data with creation dates for proper analysis
  const [consents, pulls, actions, auditLogs] = await Promise.all([
    db.select().from(creditConsents),
    db.select().from(creditPulls),
    db.select().from(adverseActions),
    db.select().from(creditAuditLog),
  ]);

  const recordCounts: Record<string, number> = {
    credit_consent: consents.length,
    credit_pull: pulls.length,
    adverse_action: actions.length,
    credit_audit_log: auditLogs.length,
  };

  // Calculate archive-eligible, delete-eligible, and retention-review counts
  const archiveEligibleCounts: Record<string, number> = {
    credit_consent: 0,
    credit_pull: 0,
    adverse_action: 0,
    credit_audit_log: 0,
  };
  const deleteEligibleCounts: Record<string, number> = {
    credit_consent: 0,
    credit_pull: 0,
    adverse_action: 0,
    credit_audit_log: 0,
  };
  const retentionReviewCounts: Record<string, number> = {
    credit_consent: 0,
    credit_pull: 0,
    adverse_action: 0,
    credit_audit_log: 0,
  };

  // Helper function to check record status
  const checkRecordStatus = (
    createdAt: Date | null,
    policy: RetentionPolicy,
    archivedAt?: Date | null
  ): "active" | "archive_eligible" | "delete_eligible" | "retention_review" => {
    if (!createdAt) return "active";
    
    const ageMs = now.getTime() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    
    // Check if data has exceeded the retention period (regardless of deleteAfterDays)
    // This is a compliance violation - data should be reviewed for retention justification
    if (ageDays >= policy.retentionPeriodDays) {
      return "delete_eligible"; // Exceeding retention period = compliance flag
    }
    
    // Check delete eligibility (if explicit delete policy exists)
    if (policy.deleteAfterDays && ageDays >= policy.deleteAfterDays) {
      return "delete_eligible";
    }
    
    // Check if approaching retention period end (within 180 days of max retention)
    if (ageDays >= policy.retentionPeriodDays - 180) {
      return "retention_review";
    }
    
    // Check archive eligibility
    if (ageDays >= policy.archiveAfterDays && !archivedAt) {
      return "archive_eligible";
    }
    
    return "active";
  };

  // Process credit consents
  for (const consent of consents) {
    const status = checkRecordStatus(consent.createdAt, DATA_RETENTION_POLICIES.credit_consent);
    if (status === "archive_eligible") archiveEligibleCounts.credit_consent++;
    if (status === "delete_eligible") deleteEligibleCounts.credit_consent++;
    if (status === "retention_review") retentionReviewCounts.credit_consent++;
  }

  // Process credit pulls
  for (const pull of pulls) {
    const status = checkRecordStatus(pull.createdAt, DATA_RETENTION_POLICIES.credit_pull, pull.archivedAt);
    if (status === "archive_eligible") archiveEligibleCounts.credit_pull++;
    if (status === "delete_eligible") deleteEligibleCounts.credit_pull++;
    if (status === "retention_review") retentionReviewCounts.credit_pull++;
  }

  // Process adverse actions
  for (const action of actions) {
    const status = checkRecordStatus(action.createdAt, DATA_RETENTION_POLICIES.adverse_action);
    if (status === "archive_eligible") archiveEligibleCounts.adverse_action++;
    if (status === "delete_eligible") deleteEligibleCounts.adverse_action++;
    if (status === "retention_review") retentionReviewCounts.adverse_action++;
  }

  // Process audit logs
  for (const log of auditLogs) {
    const status = checkRecordStatus(log.timestamp, DATA_RETENTION_POLICIES.credit_audit_log);
    if (status === "archive_eligible") archiveEligibleCounts.credit_audit_log++;
    if (status === "delete_eligible") deleteEligibleCounts.credit_audit_log++;
    if (status === "retention_review") retentionReviewCounts.credit_audit_log++;
  }

  // Generate recommendations
  const recommendations: string[] = [];

  const archiveTotal = Object.values(archiveEligibleCounts).reduce((a, b) => a + b, 0);
  if (archiveTotal > 0) {
    recommendations.push(
      `${archiveTotal} records are eligible for archival. Consider running the archive process.`
    );
  }

  const reviewTotal = Object.values(retentionReviewCounts).reduce((a, b) => a + b, 0);
  if (reviewTotal > 0) {
    recommendations.push(
      `${reviewTotal} records are approaching the end of their retention period (within 180 days). Review for compliance planning.`
    );
  }

  if (recordCounts.credit_audit_log > 10000) {
    recommendations.push(
      "Audit log has grown large. Consider exporting older entries to cold storage."
    );
  }

  const deleteTotal = Object.values(deleteEligibleCounts).reduce((a, b) => a + b, 0);
  if (deleteTotal > 0) {
    recommendations.push(
      `${deleteTotal} records are past their retention period. Review for secure deletion.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("All retention policies are being met. No action required.");
  }

  return {
    generatedAt: now,
    policies,
    recordCounts,
    archiveEligibleCounts,
    deleteEligibleCounts,
    retentionReviewCounts,
    recommendations,
  };
}
