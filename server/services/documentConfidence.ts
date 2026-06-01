import { db } from "../db";
import {
  documentConfidenceScores,
  type InsertDocumentConfidence,
} from "@shared/schema";
import { eq, and, gte, sql, desc, avg } from "drizzle-orm";
import { emitEvent } from "./analyticsEventPipeline";

export interface FieldConfidence {
  fieldName: string;
  value: any;
  confidence: number;
  needsReview: boolean;
}

export async function recordExtractionConfidence(options: {
  documentId: string;
  documentType: string;
  applicationId?: string;
  overallConfidence: number;
  fieldConfidences: FieldConfidence[];
  processingTimeMs?: number;
  fileSize?: number;
  pageCount?: number;
  extractionEngine?: string;
  extractionVersion?: string;
}): Promise<void> {
  const reviewThreshold = getReviewThreshold(options.documentType);
  const humanReviewRequired = options.overallConfidence < reviewThreshold;

  await db.insert(documentConfidenceScores).values({
    documentId: options.documentId,
    documentType: options.documentType,
    applicationId: options.applicationId || null,
    extractionEngine: options.extractionEngine || "gemini",
    extractionVersion: options.extractionVersion || null,
    overallConfidence: options.overallConfidence.toFixed(4),
    fieldConfidences: options.fieldConfidences,
    humanReviewRequired,
    fieldsExtracted: options.fieldConfidences.length,
    processingTimeMs: options.processingTimeMs || null,
    fileSize: options.fileSize || null,
    pageCount: options.pageCount || null,
  });

  await emitEvent("document", "confidence_scored", {
    entityType: "document",
    entityId: options.documentId,
    applicationId: options.applicationId,
    numericValue: options.overallConfidence,
    payload: {
      documentType: options.documentType,
      fieldsExtracted: options.fieldConfidences.length,
      humanReviewRequired,
      lowConfidenceFields: options.fieldConfidences.filter(f => f.confidence < 0.7).map(f => f.fieldName),
    },
    automationTriggered: true,
  });
}

function getReviewThreshold(documentType: string): number {
  const thresholds: Record<string, number> = {
    tax_return: 0.85,
    w2: 0.80,
    pay_stub: 0.80,
    bank_statement: 0.80,
    government_id: 0.90,
    appraisal: 0.85,
    title_report: 0.85,
    insurance: 0.75,
    other: 0.80,
  };
  return thresholds[documentType] || 0.80;
}

export async function recordHumanReview(
  documentId: string,
  reviewedBy: string,
  corrections: {
    fieldsCorrect: number;
    fieldsCorrected: number;
    fieldsMissed: number;
  }
): Promise<void> {
  const totalFields = corrections.fieldsCorrect + corrections.fieldsCorrected + corrections.fieldsMissed;
  const accuracyPct = totalFields > 0
    ? ((corrections.fieldsCorrect / totalFields) * 100).toFixed(2)
    : null;

  await db.update(documentConfidenceScores).set({
    humanReviewCompleted: true,
    humanReviewedBy: reviewedBy,
    humanReviewedAt: new Date(),
    fieldsCorrect: corrections.fieldsCorrect,
    fieldsCorrected: corrections.fieldsCorrected,
    fieldsMissed: corrections.fieldsMissed,
    fieldAccuracyPct: accuracyPct,
  }).where(eq(documentConfidenceScores.documentId, documentId));

  await emitEvent("document", "human_review_completed", {
    entityType: "document",
    entityId: documentId,
    actorId: reviewedBy,
    numericValue: accuracyPct ? parseFloat(accuracyPct) : undefined,
    payload: corrections,
  });
}

export async function getAccuracyByDocType(daysBack: number = 90): Promise<Array<{
  documentType: string;
  totalExtractions: number;
  avgConfidence: number;
  reviewedCount: number;
  avgAccuracy: number | null;
  avgProcessingTimeMs: number | null;
  needsReviewCount: number;
}>> {
  const cutoff = sql`now() - interval '${sql.raw(daysBack.toString())} days'`;

  const rows = await db.select({
    documentType: documentConfidenceScores.documentType,
    totalExtractions: sql<number>`count(*)::int`,
    avgConfidence: sql<number>`avg(${documentConfidenceScores.overallConfidence}::numeric)::numeric(5,4)`,
    reviewedCount: sql<number>`count(*) filter (where ${documentConfidenceScores.humanReviewCompleted} = true)::int`,
    avgAccuracy: sql<number>`avg(${documentConfidenceScores.fieldAccuracyPct}::numeric) filter (where ${documentConfidenceScores.humanReviewCompleted} = true)::numeric(5,2)`,
    avgProcessingTime: sql<number>`avg(${documentConfidenceScores.processingTimeMs})::int`,
    needsReviewCount: sql<number>`count(*) filter (where ${documentConfidenceScores.humanReviewRequired} = true and ${documentConfidenceScores.humanReviewCompleted} = false)::int`,
  }).from(documentConfidenceScores)
    .where(gte(documentConfidenceScores.extractedAt, cutoff))
    .groupBy(documentConfidenceScores.documentType);

  return rows.map(r => ({
    documentType: r.documentType,
    totalExtractions: r.totalExtractions,
    avgConfidence: r.avgConfidence || 0,
    reviewedCount: r.reviewedCount,
    avgAccuracy: r.avgAccuracy || null,
    avgProcessingTimeMs: r.avgProcessingTime || null,
    needsReviewCount: r.needsReviewCount,
  }));
}

export async function getPendingReviews(): Promise<Array<{
  id: string;
  documentId: string;
  documentType: string;
  applicationId: string | null;
  overallConfidence: number;
  fieldsExtracted: number;
  extractedAt: Date;
}>> {
  return db.select({
    id: documentConfidenceScores.id,
    documentId: documentConfidenceScores.documentId,
    documentType: documentConfidenceScores.documentType,
    applicationId: documentConfidenceScores.applicationId,
    overallConfidence: sql<number>`${documentConfidenceScores.overallConfidence}::numeric`,
    fieldsExtracted: documentConfidenceScores.fieldsExtracted,
    extractedAt: documentConfidenceScores.extractedAt,
  }).from(documentConfidenceScores)
    .where(and(
      eq(documentConfidenceScores.humanReviewRequired, true),
      eq(documentConfidenceScores.humanReviewCompleted, false)
    ))
    .orderBy(documentConfidenceScores.overallConfidence)
    .limit(50) as any;
}

export async function getConfidenceTrend(documentType: string, daysBack: number = 90): Promise<Array<{
  date: string;
  avgConfidence: number;
  count: number;
}>> {
  const cutoff = sql`now() - interval '${sql.raw(daysBack.toString())} days'`;

  return db.select({
    date: sql<string>`date(${documentConfidenceScores.extractedAt})`,
    avgConfidence: sql<number>`avg(${documentConfidenceScores.overallConfidence}::numeric)::numeric(5,4)`,
    count: sql<number>`count(*)::int`,
  }).from(documentConfidenceScores)
    .where(and(
      eq(documentConfidenceScores.documentType, documentType),
      gte(documentConfidenceScores.extractedAt, cutoff)
    ))
    .groupBy(sql`date(${documentConfidenceScores.extractedAt})`)
    .orderBy(sql`date(${documentConfidenceScores.extractedAt})`) as any;
}
