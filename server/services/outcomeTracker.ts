import { db } from "../db";
import { storage } from "../storage";
import {
  loanOutcomes,
  loanApplications,
  anonymizedBorrowerFacts,
  type InsertLoanOutcome,
} from "@shared/schema";
import { eq, and, gte, sql, desc, isNotNull } from "drizzle-orm";
import { emitEvent } from "./analyticsEventPipeline";

function daysBetween(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getCreditBucket(score: number | null): string {
  if (!score) return "unknown";
  if (score >= 760) return "760+";
  if (score >= 720) return "720-759";
  if (score >= 680) return "680-719";
  if (score >= 640) return "640-679";
  return "below_640";
}

export async function recordStageTimestamp(
  applicationId: string,
  stage: string
): Promise<void> {
  const [existing] = await db.select().from(loanOutcomes)
    .where(eq(loanOutcomes.applicationId, applicationId)).limit(1);

  const app = await storage.getLoanApplication(applicationId);
  if (!app) return;

  const now = new Date();
  const updates: Record<string, any> = { updatedAt: now };

  switch (stage) {
    case "submitted":
      updates.submittedAt = now;
      updates.loanPurpose = app.loanPurpose || null;
      updates.productType = app.preferredLoanType || null;
      updates.propertyType = app.propertyType || null;
      updates.propertyState = app.propertyState || null;
      updates.creditScoreBucket = getCreditBucket(app.creditScore);
      updates.estimatedDti = app.dtiRatio?.toString() || null;
      updates.estimatedLtv = app.ltvRatio?.toString() || null;
      break;
    case "pre_approved":
      updates.preApprovedAt = now;
      updates.preApprovalAmount = app.preApprovalAmount?.toString() || app.purchasePrice?.toString() || null;
      updates.estimatedRate = null;
      if (existing?.submittedAt) {
        updates.daysSubmittedToPreApproval = daysBetween(existing.submittedAt, now);
      }
      break;
    case "conditional":
      updates.conditionalAt = now;
      if (existing?.preApprovedAt) {
        updates.daysPreApprovalToConditional = daysBetween(existing.preApprovedAt, now);
      }
      break;
    case "clear_to_close":
      updates.clearToCloseAt = now;
      if (existing?.conditionalAt) {
        updates.daysConditionalToCtc = daysBetween(existing.conditionalAt, now);
      }
      break;
    case "funded":
      updates.fundedAt = now;
      updates.outcome = "funded";
      if (existing?.clearToCloseAt) {
        updates.daysCtcToFunded = daysBetween(existing.clearToCloseAt, now);
      }
      if (existing?.submittedAt) {
        updates.totalDaysToClose = daysBetween(existing.submittedAt, now);
      }
      updates.finalLoanAmount = app.preApprovalAmount?.toString() || app.purchasePrice?.toString() || null;
      updates.finalRate = null;
      updates.finalDti = app.dtiRatio?.toString() || null;
      updates.finalLtv = app.ltvRatio?.toString() || null;
      if (existing?.preApprovalAmount && updates.finalLoanAmount) {
        const preAmt = parseFloat(existing.preApprovalAmount);
        const finalAmt = parseFloat(updates.finalLoanAmount);
        if (preAmt > 0 && finalAmt > 0) {
          updates.amountAccuracyPct = (Math.abs(1 - finalAmt / preAmt) * 100).toFixed(2);
        }
      }
      if (existing?.estimatedRate && updates.finalRate) {
        const estRate = parseFloat(existing.estimatedRate);
        const finRate = parseFloat(updates.finalRate);
        updates.rateAccuracyBps = (Math.abs(finRate - estRate) * 100).toFixed(2);
      }
      break;
    case "denied":
      updates.deniedAt = now;
      updates.outcome = "denied";
      updates.falloutStage = app.status || stage;
      break;
    case "withdrawn":
      updates.withdrawnAt = now;
      updates.outcome = "withdrawn";
      updates.falloutStage = app.status || stage;
      break;
  }

  if (existing) {
    await db.update(loanOutcomes)
      .set(updates)
      .where(eq(loanOutcomes.applicationId, applicationId));
  } else {
    await db.insert(loanOutcomes).values({
      applicationId,
      ...updates,
    } as InsertLoanOutcome).onConflictDoNothing();
  }

  await emitEvent("pipeline", "outcome_recorded", {
    applicationId,
    textValue: stage,
    payload: updates,
    automationTriggered: true,
  });
}

export async function updateConditionMetrics(applicationId: string): Promise<void> {
  try {
    const conditions = await storage.getLoanConditionsByApplication(applicationId);
    const issued = conditions.length;
    const cleared = conditions.filter(c => c.status === "cleared").length;
    const waived = conditions.filter(c => c.status === "waived").length;

    const clearedConditions = conditions.filter(c =>
      c.status === "cleared" && c.clearedAt && c.createdAt
    );
    let avgClearanceDays: string | null = null;
    if (clearedConditions.length > 0) {
      const totalDays = clearedConditions.reduce((sum, c) => {
        const days = daysBetween(c.createdAt!, c.clearedAt!) || 0;
        return sum + days;
      }, 0);
      avgClearanceDays = (totalDays / clearedConditions.length).toFixed(1);
    }

    await db.update(loanOutcomes).set({
      conditionsIssuedCount: issued,
      conditionsClearedCount: cleared,
      conditionsWaivedCount: waived,
      avgConditionClearanceDays: avgClearanceDays,
      updatedAt: new Date(),
    }).where(eq(loanOutcomes.applicationId, applicationId));
  } catch (error) {
    console.error("[OutcomeTracker] Failed to update condition metrics:", error);
  }
}

export async function getConversionFunnel(daysBack: number = 90): Promise<{
  submitted: number;
  preApproved: number;
  conditional: number;
  clearToClose: number;
  funded: number;
  denied: number;
  withdrawn: number;
  conversionRate: number;
  avgDaysToClose: number | null;
  avgDaysToPreApproval: number | null;
}> {
  const cutoff = sql`now() - interval '${sql.raw(daysBack.toString())} days'`;

  const [counts] = await db.select({
    submitted: sql<number>`count(*) filter (where ${loanOutcomes.submittedAt} is not null)::int`,
    preApproved: sql<number>`count(*) filter (where ${loanOutcomes.preApprovedAt} is not null)::int`,
    conditional: sql<number>`count(*) filter (where ${loanOutcomes.conditionalAt} is not null)::int`,
    clearToClose: sql<number>`count(*) filter (where ${loanOutcomes.clearToCloseAt} is not null)::int`,
    funded: sql<number>`count(*) filter (where ${loanOutcomes.fundedAt} is not null)::int`,
    denied: sql<number>`count(*) filter (where ${loanOutcomes.deniedAt} is not null)::int`,
    withdrawn: sql<number>`count(*) filter (where ${loanOutcomes.withdrawnAt} is not null)::int`,
    avgDaysToClose: sql<number>`avg(${loanOutcomes.totalDaysToClose})::numeric(5,1)`,
    avgDaysToPreApproval: sql<number>`avg(${loanOutcomes.daysSubmittedToPreApproval})::numeric(5,1)`,
  }).from(loanOutcomes)
    .where(gte(loanOutcomes.createdAt, cutoff));

  const submitted = counts?.submitted || 0;
  const funded = counts?.funded || 0;

  return {
    submitted,
    preApproved: counts?.preApproved || 0,
    conditional: counts?.conditional || 0,
    clearToClose: counts?.clearToClose || 0,
    funded,
    denied: counts?.denied || 0,
    withdrawn: counts?.withdrawn || 0,
    conversionRate: submitted > 0 ? Math.round((funded / submitted) * 10000) / 100 : 0,
    avgDaysToClose: counts?.avgDaysToClose || null,
    avgDaysToPreApproval: counts?.avgDaysToPreApproval || null,
  };
}

export async function getEstimateAccuracy(daysBack: number = 90): Promise<{
  avgAmountAccuracyPct: number | null;
  avgRateAccuracyBps: number | null;
  avgDtiVariance: number | null;
  avgLtvVariance: number | null;
  sampleSize: number;
}> {
  const cutoff = sql`now() - interval '${sql.raw(daysBack.toString())} days'`;

  const [metrics] = await db.select({
    avgAmountAccuracy: sql<number>`avg(${loanOutcomes.amountAccuracyPct})::numeric(5,2)`,
    avgRateAccuracy: sql<number>`avg(${loanOutcomes.rateAccuracyBps})::numeric(6,2)`,
    avgDtiVariance: sql<number>`avg(abs(coalesce(${loanOutcomes.finalDti}::numeric,0) - coalesce(${loanOutcomes.estimatedDti}::numeric,0)))::numeric(5,2)`,
    avgLtvVariance: sql<number>`avg(abs(coalesce(${loanOutcomes.finalLtv}::numeric,0) - coalesce(${loanOutcomes.estimatedLtv}::numeric,0)))::numeric(5,2)`,
    sampleSize: sql<number>`count(*) filter (where ${loanOutcomes.outcome} = 'funded')::int`,
  }).from(loanOutcomes)
    .where(and(
      gte(loanOutcomes.createdAt, cutoff),
      eq(loanOutcomes.outcome, "funded")
    ));

  return {
    avgAmountAccuracyPct: metrics?.avgAmountAccuracy || null,
    avgRateAccuracyBps: metrics?.avgRateAccuracy || null,
    avgDtiVariance: metrics?.avgDtiVariance || null,
    avgLtvVariance: metrics?.avgLtvVariance || null,
    sampleSize: metrics?.sampleSize || 0,
  };
}

export async function getOutcomesBySegment(
  segmentField: "creditScoreBucket" | "loanPurpose" | "productType" | "propertyState",
  daysBack: number = 90
): Promise<Array<{
  segment: string;
  total: number;
  funded: number;
  denied: number;
  withdrawn: number;
  conversionRate: number;
  avgDaysToClose: number | null;
}>> {
  const cutoff = sql`now() - interval '${sql.raw(daysBack.toString())} days'`;
  const fieldMap = {
    creditScoreBucket: loanOutcomes.creditScoreBucket,
    loanPurpose: loanOutcomes.loanPurpose,
    productType: loanOutcomes.productType,
    propertyState: loanOutcomes.propertyState,
  };
  const field = fieldMap[segmentField];

  const rows = await db.select({
    segment: field,
    total: sql<number>`count(*)::int`,
    funded: sql<number>`count(*) filter (where ${loanOutcomes.outcome} = 'funded')::int`,
    denied: sql<number>`count(*) filter (where ${loanOutcomes.outcome} = 'denied')::int`,
    withdrawn: sql<number>`count(*) filter (where ${loanOutcomes.outcome} = 'withdrawn')::int`,
    avgDays: sql<number>`avg(${loanOutcomes.totalDaysToClose})::numeric(5,1)`,
  }).from(loanOutcomes)
    .where(and(
      gte(loanOutcomes.createdAt, cutoff),
      isNotNull(field)
    ))
    .groupBy(field)
    .orderBy(sql`count(*) desc`);

  return rows.map(r => ({
    segment: r.segment || "unknown",
    total: r.total,
    funded: r.funded,
    denied: r.denied,
    withdrawn: r.withdrawn,
    conversionRate: r.total > 0 ? Math.round((r.funded / r.total) * 10000) / 100 : 0,
    avgDaysToClose: r.avgDays || null,
  }));
}

export async function refreshAnonymizedInsights(): Promise<void> {
  try {
    const outcomes = await db.select().from(loanOutcomes)
      .where(isNotNull(loanOutcomes.outcome));

    if (outcomes.length < 5) return;

    const buckets: Record<string, typeof outcomes> = {};
    for (const o of outcomes) {
      const key = `${o.creditScoreBucket || "unknown"}_${o.loanPurpose || "unknown"}_${o.productType || "unknown"}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(o);
    }

    const cohortDate = new Date();

    for (const [key, group] of Object.entries(buckets)) {
      if (group.length < 3) continue;

      const [creditBucket, purpose, product] = key.split("_");
      const funded = group.filter(g => g.outcome === "funded");
      const fundedDays = funded.map(f => f.totalDaysToClose).filter((d): d is number => d !== null);
      const denied = group.filter(g => g.outcome === "denied");

      const falloutReasons: Record<string, number> = {};
      for (const d of denied) {
        const reason = d.falloutReason || d.falloutStage || "unknown";
        falloutReasons[reason] = (falloutReasons[reason] || 0) + 1;
      }

      await db.insert(anonymizedBorrowerFacts).values({
        cohortDate,
        creditScoreBucket: creditBucket,
        loanPurpose: purpose,
        productType: product,
        borrowerCount: group.length,
        conversionRate: (funded.length / group.length).toFixed(4),
        falloutRate: (denied.length / group.length).toFixed(4),
        avgTimeToCloseDays: fundedDays.length > 0
          ? (fundedDays.reduce((a, b) => a + b, 0) / fundedDays.length).toFixed(1)
          : null,
        falloutReasons,
      });
    }

    await emitEvent("system", "anonymized_insights_refreshed", {
      payload: { outcomeCount: outcomes.length, bucketCount: Object.keys(buckets).length },
      automationTriggered: true,
    });
  } catch (error) {
    console.error("[OutcomeTracker] Failed to refresh anonymized insights:", error);
  }
}
