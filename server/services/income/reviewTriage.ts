import { db } from "../../db";
import { and, desc, eq } from "drizzle-orm";
import {
  reviewItems,
  extractedFields,
  incomePathEvaluations,
  logicalDocuments,
  loanApplications,
  type ReviewItem,
  type ReviewItemTier,
  type ReviewItemType,
} from "@shared/schema";
import type { IncomePathResult } from "@shared/incomePaths";
import { computeHash } from "../encryptionService";
import {
  getLatestInstancesForUser,
  type PublicTaxFormInstance,
} from "../taxDocumentIntelligence";
import { runTieOuts, type TieOutCheck } from "../taxReconciliation";
import { recalculateDecision } from "../decisionEngine";

/**
 * Exception-only review triage (UAL P5). Deterministically turns the accuracy
 * machinery's outputs into the two ACTIONABLE tiers — auto-accepted data never
 * becomes an item:
 *
 *  - one_click  — the machine is fairly sure; a human confirms in one action
 *                 (low-confidence extractions below the existing 0.7
 *                 needs-review convention, DSCR/bank-statement acknowledgments
 *                 whose math is cited but whose program judgment is AE-gated);
 *  - flagged    — the machine found a contradiction or a rule that demands
 *                 judgment (tie-out variances, the Form 1084 calculator's own
 *                 requiresManualReview, low-confidence fields that ALSO sit
 *                 inside a variance).
 *
 * No new thresholds are invented: 0.7 is the documentConfidence needs-review
 * convention already in-repo; variances carry their own arithmetic rounding
 * tolerance from the tie-out engine; path flags come from the cited
 * calculators. The natural key embeds the offending values, so changed inputs
 * mint a NEW item while resolved items stay resolved — resolutions are the
 * accuracy loop's labeled data (measurement + extraction-prompt iteration
 * only; never model retraining inside underwriting).
 */

/** The in-repo needs-review confidence convention (documentConfidence.ts). */
export const REVIEW_CONFIDENCE_THRESHOLD = 0.7;

export interface CandidateReviewItem {
  naturalKey: string;
  itemType: ReviewItemType;
  tier: ReviewItemTier;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
}

const keyHash = (parts: unknown[]) => computeHash(JSON.stringify(parts)).slice(0, 16);

/** Pure core: candidates from extraction instances + tie-out checks. */
export function triageExtractionAndTieOuts(
  instances: PublicTaxFormInstance[],
  checks: TieOutCheck[],
): CandidateReviewItem[] {
  const items: CandidateReviewItem[] = [];

  // Fields referenced by any variance check — these escalate to flagged.
  const varianceFieldRefs = new Set<string>();
  for (const c of checks) {
    if (c.status !== "variance") continue;
    for (const ref of c.sourceRefs) {
      varianceFieldRefs.add(`${ref.logicalDocumentId}|${ref.fieldName}`);
    }
  }

  // (a) Low-confidence extracted fields (existing 0.7 convention).
  for (const inst of instances) {
    for (const [fieldName, fv] of Object.entries(inst.fields)) {
      if (fv.confidence >= REVIEW_CONFIDENCE_THRESHOLD) continue;
      const inVariance = varianceFieldRefs.has(`${inst.logicalDocumentId}|${fieldName}`);
      items.push({
        naturalKey: `xlc:${inst.formType}:${inst.taxYear ?? ""}:${fieldName}:${keyHash([inst.entityName, fv.value, fv.confidence])}`,
        itemType: "extraction_low_confidence",
        tier: inVariance ? "flagged" : "one_click",
        title: `Confirm ${fieldName} on the ${inst.taxYear ?? ""} ${inst.formType}`.trim(),
        detail: `The extractor read ${JSON.stringify(fv.value)} with confidence ${fv.confidence} — below the ${REVIEW_CONFIDENCE_THRESHOLD} needs-review convention${inVariance ? ", and this field sits inside a cross-form variance" : ""}. Confirm against the document or correct it.`,
        evidence: {
          logicalDocumentId: inst.logicalDocumentId,
          formType: inst.formType,
          taxYear: inst.taxYear,
          entityName: inst.entityName,
          fieldName,
          machineValue: fv.value,
          confidence: fv.confidence,
          pageStart: inst.pageStart,
        },
      });
    }
  }

  // (b) Tie-out variances — always flagged; a human resolves the contradiction.
  for (const c of checks) {
    if (c.status !== "variance") continue;
    items.push({
      naturalKey: `tov:${c.checkId}:${c.taxYear}:${c.entityName ?? ""}:${keyHash([c.expected, c.actual])}`,
      itemType: "tieout_variance",
      tier: "flagged",
      title: `Cross-form variance: ${c.checkId.replace(/_/g, " ")} (${c.taxYear})`,
      detail: c.detail,
      evidence: {
        checkId: c.checkId,
        taxYear: c.taxYear,
        entityName: c.entityName ?? null,
        expected: c.expected,
        actual: c.actual,
        varianceAmount: c.varianceAmount,
        tolerance: c.tolerance,
        authority: c.authority,
        sourceRefs: c.sourceRefs,
      },
    });
  }

  return items;
}

/** Pure core: candidates from a persisted income-path evaluation's path set. */
export function triageIncomePaths(paths: IncomePathResult[]): CandidateReviewItem[] {
  const items: CandidateReviewItem[] = [];
  for (const p of paths) {
    if (!p.requiresManualReview) continue;
    if (p.pathId === "self_employment" && p.kind === "dti_income") {
      items.push({
        naturalKey: `sei:${keyHash([p.monthlyQualifyingIncome, p.notes])}`,
        itemType: "se_income_review",
        tier: "flagged",
        title: "Self-employment income needs human confirmation",
        detail: p.notes.join(" ") || "The Form 1084 calculator flagged this figure for manual review.",
        evidence: { pathId: p.pathId, monthlyQualifyingIncome: p.monthlyQualifyingIncome, notes: p.notes },
      });
    } else if (p.pathId === "dscr" && p.kind === "coverage_ratio") {
      items.push({
        naturalKey: `dscr:${keyHash([p.coverageRatio, p.notes])}`,
        itemType: "dscr_review",
        tier: "one_click",
        title: `Acknowledge DSCR ${p.coverageRatio ?? "—"} (qualifying minimum is AE-gated)`,
        detail: p.notes.join(" "),
        evidence: { pathId: p.pathId, coverageRatio: p.coverageRatio, notes: p.notes },
      });
    } else if (p.pathId === "bank_statement" && p.kind === "dti_income") {
      items.push({
        naturalKey: `bsi:${keyHash([p.monthlyQualifyingIncome, p.notes])}`,
        itemType: "bank_statement_review",
        tier: "one_click",
        title: `Acknowledge bank-statement income $${p.monthlyQualifyingIncome}/mo (deposit screening is AE-gated)`,
        detail: p.notes.join(" "),
        evidence: { pathId: p.pathId, monthlyQualifyingIncome: p.monthlyQualifyingIncome, notes: p.notes },
      });
    }
  }
  return items;
}

/**
 * IO: regenerate candidates from the user's latest extractions (+ the
 * application's latest persisted income evaluation when given) and persist the
 * new ones. Insert-only on (user_id, natural_key): existing items — open or
 * human-resolved — are never touched. Returns the open items.
 */
export async function syncReviewItems(
  userId: string,
  applicationId?: string | null,
): Promise<ReviewItem[]> {
  const instances = await getLatestInstancesForUser(userId);
  const checks = runTieOuts(instances);
  const candidates = [...triageExtractionAndTieOuts(instances, checks)];

  if (applicationId) {
    // Ownership guard: the income-path evaluation must belong to an application
    // owned by `userId`. Without this, a caller could pass any applicationId
    // (the route treats userId===self as "owner" and skips the deal-team gate)
    // and read another borrower's income figures via their evaluation. The
    // evaluations table has no userId, so verify through the application.
    const [app] = await db
      .select({ userId: loanApplications.userId })
      .from(loanApplications)
      .where(eq(loanApplications.id, applicationId))
      .limit(1);
    if (app?.userId === userId) {
      const [evaluation] = await db
        .select()
        .from(incomePathEvaluations)
        .where(eq(incomePathEvaluations.applicationId, applicationId))
        .orderBy(desc(incomePathEvaluations.createdAt))
        .limit(1);
      if (evaluation) {
        candidates.push(...triageIncomePaths(evaluation.paths as IncomePathResult[]));
      }
    }
  }

  if (candidates.length > 0) {
    await db
      .insert(reviewItems)
      .values(
        candidates.map((c) => ({
          userId,
          applicationId: applicationId ?? null,
          naturalKey: c.naturalKey,
          itemType: c.itemType,
          tier: c.tier,
          title: c.title.slice(0, 300),
          detail: c.detail,
          evidence: c.evidence,
        })),
      )
      .onConflictDoNothing({ target: [reviewItems.userId, reviewItems.naturalKey] });
  }

  return db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.userId, userId), eq(reviewItems.status, "open")))
    .orderBy(desc(reviewItems.createdAt));
}

export interface ResolveReviewItemInput {
  itemId: string;
  actorId: string;
  action: "confirmed" | "overridden" | "dismissed";
  correctedValue?: string;
  note?: string;
}

/**
 * Resolve one item. A confirm/override on an extracted field also stamps the
 * field row human-verified (the orphaned engine's humanVerified columns — the
 * accuracy loop's ground truth), and any application-linked resolution
 * triggers a decision recalc.
 */
export async function resolveReviewItem(input: ResolveReviewItemInput): Promise<ReviewItem | null> {
  const [item] = await db.select().from(reviewItems).where(eq(reviewItems.id, input.itemId)).limit(1);
  if (!item || item.status !== "open") return null;

  const [updated] = await db
    .update(reviewItems)
    .set({
      status: input.action,
      correctedValue: input.action === "overridden" ? (input.correctedValue ?? null) : null,
      resolutionNote: input.note ?? null,
      resolvedBy: input.actorId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reviewItems.id, input.itemId))
    .returning();

  // Ground-truth stamp on the extracted field, when the item points at one.
  const ev = (item.evidence ?? {}) as { logicalDocumentId?: string; fieldName?: string };
  if (
    (input.action === "confirmed" || input.action === "overridden") &&
    ev.logicalDocumentId &&
    ev.fieldName
  ) {
    await db
      .update(extractedFields)
      .set({
        humanVerified: true,
        humanCorrectedValue: input.action === "overridden" ? (input.correctedValue ?? null) : null,
        verifiedByUserId: input.actorId,
        verifiedAt: new Date(),
      })
      .where(
        and(
          eq(extractedFields.logicalDocumentId, ev.logicalDocumentId),
          eq(extractedFields.fieldName, ev.fieldName),
        ),
      );
    // A fully human-verified form instance may leave needs_review.
    await db
      .update(logicalDocuments)
      .set({ verifiedByUserId: input.actorId, verifiedAt: new Date() })
      .where(eq(logicalDocuments.id, ev.logicalDocumentId));
  }

  if (item.applicationId) {
    // Fire-and-forget by contract (recalculateDecision never throws upward).
    void recalculateDecision(item.applicationId, "review_item_resolved");
  }

  return updated;
}

/** Open-item count per application — the LO Command Center file-health input. */
export async function countOpenReviewItems(applicationId: string): Promise<number> {
  const rows = await db
    .select({ id: reviewItems.id })
    .from(reviewItems)
    .where(and(eq(reviewItems.applicationId, applicationId), eq(reviewItems.status, "open")));
  return rows.length;
}
