import { db } from "../db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  taxExtractionRuns,
  logicalDocuments,
  extractedFields,
  type Document,
  type TaxExtractionRun,
} from "@shared/schema";
import {
  TAX_FORM_FIELD_CATALOG,
  aggregateFieldConfidence,
  normalizeEntityName,
  taxFieldCategory,
  taxFieldValueType,
  MAX_FORM_INSTANCES,
  type ExtractedFieldValue,
  type TaxFormInstance,
  type TaxFormType,
  type K1Variant,
} from "@shared/taxFormExtraction";
import {
  classifyTaxDocument,
  extractTaxFormInstanceFields,
  EXTRACTION_PROMPT_VERSION,
  type TaxFormInstanceExtraction,
} from "../extractionService";
import { getReviewThreshold, recordExtractionConfidence } from "./documentConfidence";

/**
 * Tax Document Intelligence orchestrator (UAL P2a — Situation Identification
 * Engine). Drives the two extraction passes over an uploaded tax package and
 * persists the result into the Document Intelligence tables:
 *
 *   tax_extraction_runs   — append-only ledger, one row per run (re-runs make
 *                           new rows; readers use the latest completed run);
 *   logical_documents     — one row per detected form instance, carrying that
 *                           instance's encrypted raw model response (lineage);
 *   extracted_fields      — one row per readable field, with the model's own
 *                           per-field confidence. No confidence → no row.
 *
 * Doctrine: this output is PROVISIONAL. Nothing here becomes an underwriting
 * input until a human confirms it (MR-2 / L2 I1); logical documents land as
 * "needs_review" and the type-specific confidence gate decides whether the
 * source document may stage as "verifying" (never "verified").
 */

/** Per-form extraction calls run a few at a time — a 100-page package can hold dozens of instances. */
const EXTRACTION_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Client/staff-facing shape — derived values only, never lineage ciphertext. */
export interface PublicTaxFormInstance {
  logicalDocumentId: string;
  formType: TaxFormType;
  taxYear: number | null;
  entityName: string | null;
  k1Variant: K1Variant | null;
  pageStart: number | null;
  pageEnd: number | null;
  classificationConfidence: number;
  fields: Record<string, ExtractedFieldValue>;
  warnings: string[];
}

export interface TaxIntelligenceRunSummary {
  runId: string;
  documentId: string;
  status: "completed" | "failed" | "running";
  simulated: boolean;
  modelId: string | null;
  promptVersion: string | null;
  pageCount: number | null;
  formCount: number;
  /** Conservative aggregate (bottom-half mean) of every confidence in the run. */
  overallConfidence: number;
  /** Whether the type-specific confidence gate requires human review before staging. */
  humanReviewRequired: boolean;
  forms: PublicTaxFormInstance[];
  warnings: string[];
  error?: string;
  startedAt: string;
  completedAt: string | null;
}

interface PersistedInstance {
  logicalDocumentId: string;
  instanceMeta: {
    formType: TaxFormType;
    taxYear: number | null;
    entityName: string | null;
    k1Variant: K1Variant | null;
    pageStart: number | null;
    pageEnd: number | null;
    confidence: number;
  };
  extraction: TaxFormInstanceExtraction;
}

function toTaxFormInstances(persisted: PersistedInstance[]): TaxFormInstance[] {
  return persisted.map((p) => ({
    formType: p.instanceMeta.formType,
    taxYear: p.extraction.taxYear,
    entityName: p.extraction.entityName,
    k1Variant: p.instanceMeta.k1Variant,
    pageStart: p.instanceMeta.pageStart,
    pageEnd: p.instanceMeta.pageEnd,
    classificationConfidence: p.instanceMeta.confidence,
    fields: p.extraction.fields,
    warnings: p.extraction.warnings,
  }));
}

/**
 * Run the full multi-form extraction for an uploaded tax document and persist
 * everything. Returns the run summary either way — a failed run is a real,
 * queryable outcome, not an exception.
 */
export async function runTaxDocumentIntelligence(document: Document): Promise<TaxIntelligenceRunSummary> {
  const [run] = await db
    .insert(taxExtractionRuns)
    .values({
      documentId: document.id,
      userId: document.userId,
      applicationId: document.applicationId ?? null,
      status: "running",
      promptVersion: EXTRACTION_PROMPT_VERSION,
    })
    .returning();

  const failRun = async (error: string, extra?: Partial<typeof taxExtractionRuns.$inferInsert>) => {
    await db
      .update(taxExtractionRuns)
      .set({ status: "failed", error, completedAt: new Date(), ...extra })
      .where(eq(taxExtractionRuns.id, run.id));
    return {
      runId: run.id,
      documentId: document.id,
      status: "failed" as const,
      simulated: false,
      modelId: null,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      pageCount: null,
      formCount: 0,
      overallConfidence: 0,
      humanReviewRequired: true,
      forms: [],
      warnings: [],
      error,
      startedAt: run.startedAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  };

  try {
    // Pass 1 — classification.
    const cls = await classifyTaxDocument(document.storagePath, document.mimeType ?? undefined);
    if (!cls.classification) {
      return failRun(cls.failureReason ?? "Classification produced no usable result", {
        modelId: cls.lineage.modelId,
        classificationResponseHash: cls.lineage.rawResponseHash,
        classificationRawEncrypted: cls.lineage.rawResponseEncrypted,
        classificationRawIv: cls.lineage.rawResponseIv,
        classificationRawKeyId: cls.lineage.rawResponseKeyId,
        simulated: cls.simulated,
      });
    }

    const instances = cls.classification.forms.slice(0, MAX_FORM_INSTANCES);

    // Pass 2 — per-instance field extraction (bounded concurrency).
    const extractions = await mapWithConcurrency(instances, EXTRACTION_CONCURRENCY, (instance) =>
      extractTaxFormInstanceFields(document.storagePath, instance, document.mimeType ?? undefined),
    );

    // Persist run results atomically: logical documents + their fields.
    const persisted: PersistedInstance[] = [];
    await db.transaction(async (tx) => {
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        const extraction = extractions[i];

        const fieldConfidences = Object.values(extraction.fields).map((f) => f.confidence);
        const aggregated =
          fieldConfidences.length > 0
            ? fieldConfidences.reduce((s, c) => s + c, 0) / fieldConfidences.length
            : instance.confidence;

        const [logicalDoc] = await tx
          .insert(logicalDocuments)
          .values({
            loanId: document.applicationId ?? null,
            borrowerId: document.userId,
            documentType: instance.formType,
            aggregatedConfidence: aggregated.toFixed(4),
            status: "needs_review",
            taxYear: extraction.taxYear ?? instance.taxYear ?? null,
            institutionName: extraction.entityName ?? instance.entityName ?? null,
            sourceDocumentId: document.id,
            extractionRunId: run.id,
            pageStart: instance.pageStart ?? null,
            pageEnd: instance.pageEnd ?? null,
            k1Variant: instance.k1Variant ?? null,
            modelId: extraction.lineage.modelId ?? null,
            promptVersion: extraction.lineage.promptVersion ?? null,
            rawResponseHash: extraction.lineage.rawResponseHash ?? null,
            rawResponseEncrypted: extraction.lineage.rawResponseEncrypted ?? null,
            rawResponseIv: extraction.lineage.rawResponseIv ?? null,
            rawResponseKeyId: extraction.lineage.rawResponseKeyId ?? null,
          })
          .returning({ id: logicalDocuments.id });

        const catalog = TAX_FORM_FIELD_CATALOG[instance.formType];
        const fieldRows = Object.entries(extraction.fields)
          // Only cataloged fields persist — the Zod schema already enforces
          // this, but the persistence layer must not trust its caller either.
          .filter(([name]) => catalog[name] !== undefined)
          .map(([name, fv]) => {
            const kind = catalog[name].kind;
            const valueType = taxFieldValueType(kind);
            return {
              logicalDocumentId: logicalDoc.id,
              pageId: null,
              pageNumber: instance.pageStart ?? null,
              fieldName: name,
              fieldCategory: taxFieldCategory(name, kind),
              valueString: valueType === "string" ? String(fv.value) : null,
              valueNumeric:
                valueType === "currency" || valueType === "number" ? String(fv.value) : null,
              valueBoolean: valueType === "boolean" ? Boolean(fv.value) : null,
              valueType,
              confidence: fv.confidence.toFixed(4),
              extractionMethod: extraction.simulated ? "simulated" : "claude",
              modelVersion: extraction.lineage.modelId ?? null,
            };
          });
        if (fieldRows.length > 0) {
          await tx.insert(extractedFields).values(fieldRows);
        }

        persisted.push({
          logicalDocumentId: logicalDoc.id,
          instanceMeta: {
            formType: instance.formType,
            taxYear: instance.taxYear ?? null,
            entityName: instance.entityName ?? null,
            k1Variant: instance.k1Variant ?? null,
            pageStart: instance.pageStart ?? null,
            pageEnd: instance.pageEnd ?? null,
            confidence: instance.confidence,
          },
          extraction,
        });
      }
    });

    const taxFormInstances = toTaxFormInstances(persisted);
    const overall = aggregateFieldConfidence(taxFormInstances);
    const simulated = cls.simulated || extractions.some((e) => e.simulated);

    // Quality gate: real per-field confidences feed the existing
    // document-confidence machinery (which decides human review — MR-2).
    const { humanReviewRequired } = await recordExtractionConfidence({
      documentId: document.id,
      documentType: document.documentType,
      applicationId: document.applicationId ?? undefined,
      overallConfidence: overall,
      fieldConfidences: persisted.flatMap((p) =>
        Object.entries(p.extraction.fields).map(([name, fv]) => ({
          fieldName: `${p.instanceMeta.formType}.${name}`,
          value: fv.value,
          confidence: fv.confidence,
          needsReview: fv.confidence < 0.7,
        })),
      ),
      fileSize: document.fileSize ?? undefined,
      pageCount: cls.classification.pageCount ?? undefined,
      extractionEngine: simulated ? "simulated" : "claude",
      extractionVersion: EXTRACTION_PROMPT_VERSION,
    });

    const completedAt = new Date();
    await db
      .update(taxExtractionRuns)
      .set({
        status: "completed",
        simulated,
        modelId: cls.lineage.modelId ?? null,
        classificationResponseHash: cls.lineage.rawResponseHash ?? null,
        classificationRawEncrypted: cls.lineage.rawResponseEncrypted ?? null,
        classificationRawIv: cls.lineage.rawResponseIv ?? null,
        classificationRawKeyId: cls.lineage.rawResponseKeyId ?? null,
        pageCount: cls.classification.pageCount ?? null,
        formCount: persisted.length,
        overallConfidence: overall.toFixed(4),
        completedAt,
      })
      .where(eq(taxExtractionRuns.id, run.id));

    return {
      runId: run.id,
      documentId: document.id,
      status: "completed",
      simulated,
      modelId: cls.lineage.modelId ?? null,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      pageCount: cls.classification.pageCount ?? null,
      formCount: persisted.length,
      overallConfidence: overall,
      humanReviewRequired,
      forms: persisted.map((p) => ({
        logicalDocumentId: p.logicalDocumentId,
        formType: p.instanceMeta.formType,
        taxYear: p.extraction.taxYear,
        entityName: p.extraction.entityName,
        k1Variant: p.instanceMeta.k1Variant,
        pageStart: p.instanceMeta.pageStart,
        pageEnd: p.instanceMeta.pageEnd,
        classificationConfidence: p.instanceMeta.confidence,
        fields: p.extraction.fields,
        warnings: p.extraction.warnings,
      })),
      warnings: cls.classification.warnings ?? [],
      startedAt: run.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  } catch (error) {
    console.error("Tax document intelligence run failed:", error);
    return failRun(error instanceof Error ? error.message : "Tax document intelligence run failed");
  }
}

/**
 * Read the latest extraction run for a document, rehydrating form instances
 * from logical_documents + extracted_fields. Never exposes lineage ciphertext.
 */
export async function getLatestTaxIntelligence(
  documentId: string,
): Promise<TaxIntelligenceRunSummary | null> {
  const [run] = await db
    .select()
    .from(taxExtractionRuns)
    .where(eq(taxExtractionRuns.documentId, documentId))
    .orderBy(desc(taxExtractionRuns.startedAt))
    .limit(1);
  if (!run) return null;

  const forms = run.status === "completed" ? await loadRunForms(run) : [];
  const overall = run.overallConfidence ? Number(run.overallConfidence) : 0;

  return {
    runId: run.id,
    documentId: run.documentId,
    status: run.status as TaxIntelligenceRunSummary["status"],
    simulated: run.simulated,
    modelId: run.modelId,
    promptVersion: run.promptVersion,
    pageCount: run.pageCount,
    formCount: run.formCount ?? forms.length,
    overallConfidence: overall,
    humanReviewRequired: overall < getReviewThreshold("tax_return"),
    forms,
    warnings: [],
    error: run.error ?? undefined,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

/**
 * Every form instance visible for a user right now: the latest completed run
 * of each of their tax documents, deduped across documents (the same form
 * identity uploaded twice — e.g. last year's return re-uploaded inside this
 * year's package — resolves to the most recent run's copy). This is the input
 * surface for P2b entity resolution and the tie-out engine.
 */
export async function getLatestInstancesForUser(userId: string): Promise<PublicTaxFormInstance[]> {
  const runs = await db
    .select()
    .from(taxExtractionRuns)
    .where(and(eq(taxExtractionRuns.userId, userId), eq(taxExtractionRuns.status, "completed")))
    .orderBy(desc(taxExtractionRuns.startedAt));

  // Latest run per document; `runs` is newest-first so first wins.
  const latestByDoc = new Map<string, TaxExtractionRun>();
  for (const run of runs) {
    if (!latestByDoc.has(run.documentId)) latestByDoc.set(run.documentId, run);
  }

  const seen = new Set<string>();
  const instances: PublicTaxFormInstance[] = [];
  // Iterate newest-run-first so the dedupe keeps the freshest copy.
  const ordered = [...latestByDoc.values()].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  for (const run of ordered) {
    for (const form of await loadRunForms(run)) {
      const key = `${form.formType}|${form.taxYear ?? ""}|${form.entityName ? normalizeEntityName(form.entityName) : ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      instances.push(form);
    }
  }
  return instances;
}

async function loadRunForms(run: TaxExtractionRun): Promise<PublicTaxFormInstance[]> {
  const docs = await db
    .select({
      id: logicalDocuments.id,
      documentType: logicalDocuments.documentType,
      taxYear: logicalDocuments.taxYear,
      institutionName: logicalDocuments.institutionName,
      k1Variant: logicalDocuments.k1Variant,
      pageStart: logicalDocuments.pageStart,
      pageEnd: logicalDocuments.pageEnd,
      aggregatedConfidence: logicalDocuments.aggregatedConfidence,
    })
    .from(logicalDocuments)
    .where(eq(logicalDocuments.extractionRunId, run.id));
  if (docs.length === 0) return [];

  // One query for every field in the run (inArray, no N+1).
  const fieldRows = await db
    .select({
      logicalDocumentId: extractedFields.logicalDocumentId,
      fieldName: extractedFields.fieldName,
      valueString: extractedFields.valueString,
      valueNumeric: extractedFields.valueNumeric,
      valueBoolean: extractedFields.valueBoolean,
      valueType: extractedFields.valueType,
      confidence: extractedFields.confidence,
    })
    .from(extractedFields)
    .where(inArray(extractedFields.logicalDocumentId, docs.map((d) => d.id)));

  const fieldsByDoc = new Map<string, Record<string, ExtractedFieldValue>>();
  for (const row of fieldRows) {
    if (!row.logicalDocumentId) continue;
    const bucket = fieldsByDoc.get(row.logicalDocumentId) ?? {};
    bucket[row.fieldName] = {
      value:
        row.valueType === "currency" || row.valueType === "number"
          ? Number(row.valueNumeric)
          : row.valueType === "boolean"
            ? Boolean(row.valueBoolean)
            : row.valueString,
      confidence: Number(row.confidence),
    };
    fieldsByDoc.set(row.logicalDocumentId, bucket);
  }

  return docs.map((d) => ({
    logicalDocumentId: d.id,
    formType: d.documentType as TaxFormType,
    taxYear: d.taxYear,
    entityName: d.institutionName,
    k1Variant: (d.k1Variant as K1Variant | null) ?? null,
    pageStart: d.pageStart,
    pageEnd: d.pageEnd,
    classificationConfidence: Number(d.aggregatedConfidence),
    fields: fieldsByDoc.get(d.id) ?? {},
    warnings: [],
  }));
}
