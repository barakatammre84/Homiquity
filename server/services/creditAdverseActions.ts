// ECOA/Reg B §1002.9 adverse actions: generation, the notice text, the HMDA→Reg B reason mapping, the ensureAdverseActionForDenial chokepoint, delivery tracking.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { adverseActions, type InsertAdverseAction, type AdverseAction, type CreditPull } from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { COMPANY_CONFIG } from "../config/company";
import { logCreditAction } from "./creditAuditChain";
import { getLatestCreditPull } from "./creditPulls";
import { ADVERSE_ACTION_REASONS, BUREAU_CONTACT_INFO, ECOA_ADMINISTERING_AGENCY } from "./creditCatalogs";

/**
 * Fixed bureau order for every deterministic attribution below (score-source
 * tie-break, furnishing-CRA ordering). Order changes change which bureau a
 * notice attributes a score to — never reorder casually.
 */
export const BUREAU_ATTRIBUTION_ORDER = ["experian", "equifax", "transunion"] as const;
export type BureauKey = (typeof BUREAU_ATTRIBUTION_ORDER)[number];

const BUREAU_SCORE_FIELD = {
  experian: "experianScore",
  equifax: "equifaxScore",
  transunion: "transunionScore",
} as const satisfies Record<BureauKey, keyof CreditPull>;

export type BureauContact = (typeof BUREAU_CONTACT_INFO)[BureauKey];

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
    creditScoreSource?: BureauKey;
    /**
     * FCRA §615(a) trigger: the action was based in whole or in part on a
     * consumer report. Defaults to `!!creditScoreSource` (the staff
     * pre-generate path signals report basis via the score source); the
     * denial chokepoint passes it explicitly from the pull record.
     */
    basedOnConsumerReport?: boolean;
    /** §1681g(f)(1)(D): the date the disclosed score was created (pull.completedAt). */
    creditScoreDate?: Date | null;
    /**
     * §1681m(a)(3): every CRA that furnished the report (a tri-merge is
     * furnished by all three). Defaults to `[creditScoreSource]`.
     */
    furnishingBureaus?: BureauKey[];
    /**
     * True only when the CALLER verified the basis pull is real bureau data
     * (`isSimulated: false`). Feeds computeFcraCompliant; defaults to false —
     * a report-based notice from an unverified basis must not self-certify.
     */
    basisPullVerifiedReal?: boolean;
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
  // consumer report. Do NOT default to a bureau (previously Experian) or the
  // notice would falsely assert a report was used on denials made from
  // self-reported data. ECOA content (below) is unconditional; the
  // consumer-report framing is gated on this flag.
  const basedOnConsumerReport = data.basedOnConsumerReport ?? !!data.creditScoreSource;
  const furnishingBureaus: BureauKey[] = data.furnishingBureaus?.length
    ? data.furnishingBureaus
    : data.creditScoreSource
      ? [data.creditScoreSource]
      : [];
  // §1681m(a)(3)(A) requires naming the CRA "that furnished the report" — a
  // report-based notice with no CRA to name cannot be truthful. Expected
  // callers never hit this (the chokepoint refuses first; the compliance
  // endpoint derives report basis from a source), so throwing is correct.
  if (basedOnConsumerReport && furnishingBureaus.length === 0) {
    throw new Error(
      "A consumer-report-based adverse action must identify the furnishing consumer reporting agency (FCRA §615(a)(3)); none was provided",
    );
  }
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
    creditScoreDate: data.creditScoreDate,
    bureau,
    furnishingBureaus: furnishingBureaus.map((b) => BUREAU_CONTACT_INFO[b]),
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
    // otherwise they would misrepresent the basis of the action. Columns hold
    // the score-source bureau; the notice text carries the contact block for
    // EVERY furnishing bureau (§1681m(a)(3) attaches to each CRA that
    // furnished the report, not just the one whose score was disclosed).
    bureauName: bureau?.name,
    bureauAddress: bureau?.address,
    bureauPhone: bureau?.phone,
    bureauWebsite: bureau?.website,
    noticeText,
    noticeDate: new Date(),
    basedOnConsumerReport,
    fcraCompliant: computeFcraCompliant({
      basedOnConsumerReport,
      fromRealPull: data.basisPullVerifiedReal ?? false,
      creditScoreUsed: basedOnConsumerReport ? (data.creditScoreUsed ?? null) : null,
      scoreDateDisclosed: !!data.creditScoreDate,
      // F3 TODO (WF5-F2 adjudication §3, F3 vendor-contract requirements):
      // §1681g(f)(1)(B) needs the range of the MODEL actually used (the stored
      // 300–850 is the classic-FICO assumption, unverified per-model),
      // §1681g(f)(1)(C) needs the model's key factors (≤4, plus the inquiries
      // factor per §1681g(f)(9)), and §1681g(f)(1)(E) needs the provider
      // entity. credit_pulls has no fields for any of these until the live
      // credit vendor contract lands — held false so a scored report-based
      // notice honestly computes fcraCompliant: false until then.
      scoreRangeDisclosed: false,
      keyFactorsDisclosed: false,
      providerEntityDisclosed: false,
      allFurnishingCrasIdentified: furnishingBureaus.length > 0,
    }),
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

/**
 * The fcra_compliant assertion, computed — never stamped. It means: "this
 * notice contains every FCRA §615(a) disclosure APPLICABLE to the facts of
 * this action" (WF5-F2 adjudication §3(c)).
 *
 *  - Not report-based → no §615(a) duty attaches; the unconditional ECOA block
 *    satisfies everything applicable → true.
 *  - Report-based → true only when the full applicable set rendered from a
 *    REAL pull. The CRA-did-not-decide statement, the 60-day free-copy notice
 *    (§1681j) and the dispute-right notice (§1681i) are template constants of
 *    the rights block, which renders exactly when the furnishing CRAs are
 *    identified — so `allFurnishingCrasIdentified` subsumes them.
 *  - The score-disclosure conjuncts (§1681m(a)(2) → §1681g(f)(1)(B)–(E))
 *    attach only when "a numerical credit score ... [was] used" — vacuous for
 *    a scoreless (thin-file) report.
 *
 * Deterministic: pure function of its inputs.
 */
export function computeFcraCompliant(input: {
  basedOnConsumerReport: boolean;
  /** The basis pull is verified real bureau data (isSimulated: false). */
  fromRealPull: boolean;
  /** The disclosed score, or null when no score was used in the action. */
  creditScoreUsed: number | null;
  /** §1681g(f)(1)(D): date the score was created. */
  scoreDateDisclosed: boolean;
  /** §1681g(f)(1)(B): score range of the model actually used. */
  scoreRangeDisclosed: boolean;
  /** §1681g(f)(1)(C): the model's key adverse factors (≤4 + inquiries per (f)(9)). */
  keyFactorsDisclosed: boolean;
  /** §1681g(f)(1)(E): the entity that provided the score. */
  providerEntityDisclosed: boolean;
  /** §1681m(a)(3): name/address/phone rendered for every furnishing CRA. */
  allFurnishingCrasIdentified: boolean;
}): boolean {
  if (!input.basedOnConsumerReport) return true;
  const scoreDisclosureComplete =
    input.creditScoreUsed == null
      ? true
      : input.scoreDateDisclosed &&
        input.scoreRangeDisclosed &&
        input.keyFactorsDisclosed &&
        input.providerEntityDisclosed;
  return input.fromRealPull && input.allFurnishingCrasIdentified && scoreDisclosureComplete;
}

export function generateAdverseActionNotice(data: {
  actionType: string;
  primaryReason: string;
  secondaryReasons?: string[];
  /** True only when the action was actually based on a consumer report/score. */
  basedOnConsumerReport?: boolean;
  creditScoreUsed?: number;
  /** §1681g(f)(1)(D): the date the disclosed score was created. */
  creditScoreDate?: Date | null;
  bureau: typeof BUREAU_CONTACT_INFO.experian | null;
  /**
   * Contact blocks for every CRA that furnished the report (§1681m(a)(3) —
   * a tri-merge is furnished by all three). Defaults to `[bureau]`.
   */
  furnishingBureaus?: BureauContact[];
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
  // is included only when the action was based on a consumer report and the
  // furnishing CRA(s) are known. On denials made from self-reported data these
  // blocks are correctly omitted (and the ECOA block below still applies).
  const craContacts: BureauContact[] = data.furnishingBureaus?.length
    ? data.furnishingBureaus
    : data.bureau
      ? [data.bureau]
      : [];
  if (data.basedOnConsumerReport && craContacts.length > 0) {
    if (data.creditScoreUsed) {
      // F3 TODO (WF5-F2 adjudication §3, F3 vendor-contract requirements): this
      // block is INCOMPLETE for §1681g(f)(1) until the live credit vendor
      // supplies (B) the actual score range of the model used (300–850 below is
      // the classic-FICO assumption), (C) the model's key factors — at most 4,
      // plus the inquiries factor per §1681g(f)(9) — and (E) the provider
      // entity. Key factors MUST come from the scoring model; NEVER restate
      // denial reasons as score factors (the pre-fix template's "Key factors
      // ... are listed above" pointed at denial reasons — a false statement —
      // and was removed rather than fabricated). computeFcraCompliant holds
      // these conjuncts false until the fields exist on credit_pulls.
      notice += `
CREDIT SCORE INFORMATION:
Your credit score: ${data.creditScoreUsed}
Credit scores range from 300 to 850.${data.creditScoreDate ? `\nDate of score: ${data.creditScoreDate.toLocaleDateString()}` : ""}
`;
    }

    const craNoun = craContacts.length > 1 ? "consumer reporting agencies" : "consumer reporting agency";
    notice += `
YOUR RIGHTS UNDER THE FAIR CREDIT REPORTING ACT:

You have the right to obtain a free copy of your credit report from the ${craNoun} listed below within 60 days of receiving this notice. The ${craNoun} did not make the decision to take this action and cannot provide specific reasons for it.

You have the right to dispute the accuracy or completeness of any information in your credit report.

${craContacts.length > 1 ? "CONSUMER REPORTING AGENCIES:" : "CONSUMER REPORTING AGENCY:"}
${craContacts.map((b) => `${b.name}\n${b.address}\nPhone: ${b.phone}\nWebsite: ${b.website}`).join("\n\n")}
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

/**
 * The bureau whose per-bureau score equals the pull's representativeScore —
 * the score source a §1681m(a)(2) disclosure attributes. Deterministic: ties
 * resolve by BUREAU_ATTRIBUTION_ORDER. Null when no bureau's stored score
 * matches (an attribution would then be fabricated — refuse, don't guess).
 */
export function resolveRepresentativeScoreSource(
  pull: Pick<CreditPull, "representativeScore" | "experianScore" | "equifaxScore" | "transunionScore">,
): BureauKey | null {
  if (pull.representativeScore == null) return null;
  for (const bureauKey of BUREAU_ATTRIBUTION_ORDER) {
    if (pull[BUREAU_SCORE_FIELD[bureauKey]] === pull.representativeScore) return bureauKey;
  }
  return null;
}

/**
 * Every CRA the pull record lists as furnishing the report (§1681m(a)(3)
 * attaches to each of them — a tri-merge is furnished by all three). Fixed
 * order, deduped, unknown strings dropped. F3 note: the current schema records
 * the requested bureau set; the live-vendor contract must record which bureaus
 * actually returned files so this can narrow to the true furnishing set.
 */
export function resolveFurnishingBureaus(pull: Pick<CreditPull, "bureaus">): BureauKey[] {
  const listed = new Set(pull.bureaus ?? []);
  return BUREAU_ATTRIBUTION_ORDER.filter((b) => listed.has(b));
}

export type DenialFcraPosture =
  | { kind: "no_consumer_report" }
  | { kind: "refuse"; reason: "simulated_pull" | "unattributable_score"; error: string }
  | {
      kind: "consumer_report";
      creditPullId: string;
      creditScoreUsed: number | null;
      creditScoreSource: BureauKey | null;
      creditScoreDate: Date | null;
      furnishingBureaus: BureauKey[];
    };

/**
 * FCRA §615(a) basis of a denial, resolved from the application's latest
 * COMPLETED credit pull (WF5-F2 adjudication §3). Pure and deterministic —
 * the chokepoint's three branches hang off this:
 *
 *  - no pull            → ECOA-only notice (no §615(a) duty attaches).
 *  - simulated pull     → REFUSE the denial. A truthful §615(a) notice cannot
 *    be generated from fabricated bureau data, and the file must not be
 *    deniable at all: real denials must not occur on any file carrying a
 *    completed simulated pull, in any environment (the production guard in
 *    creditPulls.ts is env-overridable and legacy simulated rows can exist).
 *  - real pull          → generate with the full report basis threaded. The
 *    pull's representativeScore is authoritative over application.creditScore.
 *
 * The refusal copy deliberately names NO bureau: §1681m(a)(3)(A) requires the
 * CRA "that furnished the report", and for simulated data none did — naming
 * one would fabricate the attribution and aim the borrower's §1681j
 * free-report and §1681i dispute rights at an agency holding no such report.
 */
export function resolveDenialFcraPosture(latestCompletedPull: CreditPull | null): DenialFcraPosture {
  if (!latestCompletedPull) return { kind: "no_consumer_report" };

  if (latestCompletedPull.isSimulated) {
    return {
      kind: "refuse",
      reason: "simulated_pull",
      error:
        "Denial blocked: this application's completed credit pull contains simulated bureau data (no live credit vendor is connected — roadmap F3). " +
        "A truthful FCRA §615(a) adverse-action notice cannot be generated from simulated data: no consumer reporting agency furnished a report, so the notice cannot honestly identify one or direct the borrower's free-report and dispute rights to it. " +
        "Denial of this file is blocked until a live-vendor credit pull exists.",
    };
  }

  const furnishingBureaus = resolveFurnishingBureaus(latestCompletedPull);
  const creditScoreSource = resolveRepresentativeScoreSource(latestCompletedPull);
  const scoreUnattributable =
    latestCompletedPull.representativeScore != null && creditScoreSource == null;
  if (furnishingBureaus.length === 0 || scoreUnattributable) {
    return {
      kind: "refuse",
      reason: "unattributable_score",
      error:
        "Denial blocked: this application's completed credit pull cannot support a truthful FCRA §615(a) disclosure — " +
        (furnishingBureaus.length === 0
          ? "the pull record does not identify which consumer reporting agency furnished the report."
          : "its representative score does not match any furnishing bureau's score on the pull record.") +
        " Review the credit pull data before denying.",
    };
  }

  return {
    kind: "consumer_report",
    creditPullId: latestCompletedPull.id,
    creditScoreUsed: latestCompletedPull.representativeScore ?? null,
    creditScoreSource,
    creditScoreDate: latestCompletedPull.completedAt ?? null,
    furnishingBureaus,
  };
}

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
 *
 * FCRA §615(a) basis (WF5-F2): the chokepoint resolves the application's
 * latest completed credit pull ITSELF — the deny seams cannot thread it — and
 * branches three ways (see resolveDenialFcraPosture). The refusal branch runs
 * BEFORE the existing-notice no-op: a simulated-pull file must not be deniable
 * at all, and a pre-generated ECOA-only notice must not bypass that block.
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
  const latestPull = await getLatestCreditPull(params.applicationId);
  const posture = resolveDenialFcraPosture(latestPull);
  if (posture.kind === "refuse") {
    return { ok: false, error: posture.error };
  }

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
    let adverseAction: AdverseAction;
    if (posture.kind === "consumer_report") {
      // The pull's representativeScore is authoritative over the copy written
      // onto application.creditScore at ingestion; surface a divergence (stale
      // or hand-edited application score) rather than silently preferring it.
      // UUIDs only — score VALUES never go to stdout (repo control: consumer-
      // report data lives in the role-gated credit_audit_log chain, and this
      // notice generation writes its entry there below).
      if (
        params.creditScoreUsed != null &&
        posture.creditScoreUsed != null &&
        params.creditScoreUsed !== posture.creditScoreUsed
      ) {
        console.warn(
          `[adverse-action] application ${params.applicationId}: application.creditScore diverges from pull ${posture.creditPullId} representativeScore; the pull's score is used`,
        );
      }
      adverseAction = await generateAdverseAction({
        applicationId: params.applicationId,
        creditPullId: posture.creditPullId,
        userId: params.userId,
        actionType: "denial",
        primaryReason: reasonKeys[0],
        secondaryReasons: reasonKeys.slice(1),
        basedOnConsumerReport: true,
        creditScoreUsed: posture.creditScoreUsed ?? undefined,
        creditScoreSource: posture.creditScoreSource ?? undefined,
        creditScoreDate: posture.creditScoreDate,
        furnishingBureaus: posture.furnishingBureaus,
        // resolveDenialFcraPosture only reaches "consumer_report" for
        // isSimulated: false pulls.
        basisPullVerifiedReal: true,
        generatedBy: params.generatedBy,
      });
    } else {
      // No completed pull on file → ECOA-only notice (unchanged behavior).
      // creditScoreUsed is passed through but generateAdverseAction ignores it
      // when the action is not report-based.
      adverseAction = await generateAdverseAction({
        applicationId: params.applicationId,
        userId: params.userId,
        actionType: "denial",
        primaryReason: reasonKeys[0],
        secondaryReasons: reasonKeys.slice(1),
        creditScoreUsed: params.creditScoreUsed ?? undefined,
        generatedBy: params.generatedBy,
      });
    }
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

