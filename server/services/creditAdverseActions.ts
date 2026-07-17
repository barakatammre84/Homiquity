// ECOA/Reg B §1002.9 adverse actions: generation, the notice text, the HMDA→Reg B reason mapping, the ensureAdverseActionForDenial chokepoint, delivery tracking.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { adverseActions, type InsertAdverseAction, type AdverseAction } from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { COMPANY_CONFIG } from "../config/company";
import { logCreditAction } from "./creditAuditChain";
import { ADVERSE_ACTION_REASONS, BUREAU_CONTACT_INFO, ECOA_ADMINISTERING_AGENCY } from "./creditCatalogs";

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

  // FCRA §615(a) content applies only when the action was actually based on a
  // consumer report — signaled by a bureau score source. Do NOT default to a
  // bureau (previously Experian) or the notice would falsely assert a report
  // was used on denials made from self-reported data. ECOA content (below) is
  // unconditional; the consumer-report framing is gated on this flag.
  const basedOnConsumerReport = !!data.creditScoreSource;
  const bureau = data.creditScoreSource ? BUREAU_CONTACT_INFO[data.creditScoreSource] : null;

  const primaryReasonDetail = ADVERSE_ACTION_REASONS[data.primaryReason];
  const secondaryReasonDetails = data.secondaryReasons?.map(r => ADVERSE_ACTION_REASONS[r]);

  const primaryBureauCodes = basedOnConsumerReport
    ? primaryReasonDetail?.bureauReasonCodes?.[data.creditScoreSource as keyof typeof primaryReasonDetail.bureauReasonCodes] || []
    : [];

  const noticeText = generateAdverseActionNotice({
    actionType: data.actionType,
    primaryReason: primaryReasonDetail?.description || "Credit decision factors",
    secondaryReasons: secondaryReasonDetails?.map(r => r?.description || ""),
    basedOnConsumerReport,
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
    creditScoreUsed: basedOnConsumerReport ? data.creditScoreUsed : undefined,
    creditScoreSource: data.creditScoreSource,
    scoreRangeLow: basedOnConsumerReport ? 300 : undefined,
    scoreRangeHigh: basedOnConsumerReport ? 850 : undefined,
    // Bureau contact fields are stored only when a consumer report was used —
    // otherwise they would misrepresent the basis of the action.
    bureauName: bureau?.name,
    bureauAddress: bureau?.address,
    bureauPhone: bureau?.phone,
    bureauWebsite: bureau?.website,
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

export function generateAdverseActionNotice(data: {
  actionType: string;
  primaryReason: string;
  secondaryReasons?: string[];
  /** True only when the action was actually based on a consumer report/score. */
  basedOnConsumerReport?: boolean;
  creditScoreUsed?: number;
  bureau: typeof BUREAU_CONTACT_INFO.experian | null;
  bureauReasonCodes?: string[];
}): string {
  const actionTypeText = {
    denial: "DENIAL OF CREDIT",
    counteroffer: "COUNTEROFFER OF CREDIT TERMS",
    rate_adjustment: "INTEREST RATE ADJUSTMENT",
    terms_change: "MODIFICATION OF CREDIT TERMS",
  }[data.actionType] || "ADVERSE ACTION NOTICE";

  // Only claim a consumer report was used when one actually was — asserting it
  // otherwise is a factual misstatement (FCRA §615(a) applies to report-based
  // actions).
  const basisSentence = data.basedOnConsumerReport
    ? "The decision was based, in whole or in part, on information obtained from a consumer reporting agency."
    : "";

  let notice = `
NOTICE OF ${actionTypeText}

Date: ${new Date().toLocaleDateString()}

Dear Applicant,

This notice is to inform you that action has been taken on your mortgage loan application.${basisSentence ? ` ${basisSentence}` : ""}

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

  // FCRA §615(a) content — score disclosure + CRA contact + report rights —
  // is included only when the action was based on a consumer report and a
  // bureau is present. On denials made from self-reported data these blocks
  // are correctly omitted (and the ECOA block below still applies).
  if (data.basedOnConsumerReport && data.bureau) {
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
`;
  }

  // ECOA / Reg B §1002.9(b)(1): every adverse action on a credit application
  // must carry the equal-credit-opportunity notice, the creditor's identity,
  // and the administering federal agency — regardless of whether a consumer
  // report was used. This block is mandatory; the FCRA block above is not a
  // substitute for it.
  notice += `
YOUR RIGHTS UNDER THE EQUAL CREDIT OPPORTUNITY ACT:

The federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant has the capacity to enter into a binding contract); because all or part of the applicant's income derives from any public assistance program; or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act. The federal agency that administers compliance with this law concerning this creditor is:
${ECOA_ADMINISTERING_AGENCY}

CREDITOR:
${COMPANY_CONFIG.legalName}
NMLS #${COMPANY_CONFIG.nmlsId}
${COMPANY_CONFIG.contactEmail} | ${COMPANY_CONFIG.contactPhone}

For questions about this notice, please contact ${COMPANY_CONFIG.legalName} using the information above.

This notice is required by the Equal Credit Opportunity Act${data.basedOnConsumerReport ? " and the Fair Credit Reporting Act" : ""}.
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

/**
 * Every adverse-action notice that has been generated but never marked
 * delivered — the raw material for the ECOA §1002.9 delivery-window watchdog
 * (see services/adverseActionDelivery.ts). The sweep classifies the entire set
 * every run, so ordering is not load-bearing.
 */
export async function getUndeliveredAdverseActions(): Promise<AdverseAction[]> {
  return db
    .select()
    .from(adverseActions)
    .where(isNull(adverseActions.deliveredAt))
    .orderBy(desc(adverseActions.noticeDate));
}

// HMDA LAR denial-reason labels (what the staff UI collects) mapped onto the
// ECOA/Reg B adverse-action reason catalog above, so any denial can produce a
// compliant notice without double data entry. Keep in sync with
// HMDA_DENIAL_REASONS in client/src/pages/staff/BorrowerFile.tsx.
export const HMDA_TO_ADVERSE_ACTION_REASON: Record<string, string> = {
  "Debt-to-income ratio": "dti_high",
  "Employment history": "employment_history",
  "Credit history": "insufficient_credit_history",
  "Collateral": "collateral_insufficient",
  "Insufficient cash (downpayment, closing costs)": "insufficient_funds_to_close",
  "Unverifiable information": "unverifiable_information",
  "Credit application incomplete": "application_incomplete",
  "Mortgage insurance denied": "mortgage_insurance_denied",
  "Other": "other_credit_decision_factors",
};

export interface EnsureAdverseActionResult {
  ok: boolean;
  /** Present when ok is false — a borrower-safe message the route returns as 422. */
  error?: string;
  adverseActionId?: string;
  /** True when a new notice was generated; false when one already existed. */
  created?: boolean;
}

/**
 * ECOA/Reg B §1002.9 + FCRA §615 invariant: a denied application must carry an
 * adverse-action notice. This is the single chokepoint every denial path calls
 * BEFORE flipping status/stage — if it returns { ok: false }, the caller must
 * refuse the denial (return the error as a 422). Idempotent: a no-op when a
 * notice already exists (e.g. staff pre-generated one via the compliance
 * endpoint). Never throws for expected conditions.
 */
export async function ensureAdverseActionForDenial(params: {
  applicationId: string;
  /** The borrower's user id. */
  userId: string;
  denialReasons?: string[];
  creditScoreUsed?: number | null;
  /** The staff user performing the denial. */
  generatedBy: string;
}): Promise<EnsureAdverseActionResult> {
  const existing = await getAdverseActionsByApplication(params.applicationId);
  if (existing.length > 0) {
    return { ok: true, created: false, adverseActionId: existing[0].id };
  }

  const reasonKeys = (params.denialReasons || [])
    .map((r) => HMDA_TO_ADVERSE_ACTION_REASON[r])
    .filter((k): k is string => !!k);
  if (reasonKeys.length === 0) {
    return {
      ok: false,
      error:
        "Denial reasons could not be mapped to adverse-action reasons; generate an adverse-action notice via the compliance endpoint first",
    };
  }

  try {
    const adverseAction = await generateAdverseAction({
      applicationId: params.applicationId,
      userId: params.userId,
      actionType: "denial",
      primaryReason: reasonKeys[0],
      secondaryReasons: reasonKeys.slice(1),
      creditScoreUsed: params.creditScoreUsed ?? undefined,
      generatedBy: params.generatedBy,
    });
    return { ok: true, created: true, adverseActionId: adverseAction.id };
  } catch (err) {
    console.error("Adverse action generation failed — denial blocked:", err);
    return {
      ok: false,
      error: "Could not generate the required adverse-action notice; the denial was not applied",
    };
  }
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

