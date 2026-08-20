// ---------------------------------------------------------------------------
// What happens to an extraction once the model has read the document.
//
// WHY THIS IS ONE FUNCTION AND NOT TWO CALL SITES. Extraction reaches a
// document by two routes:
//
//   A. POST /api/documents/:id/extract — a STAFF action, from the review
//      workbench (DocumentReviewPanel.tsx is its only caller).
//   B. the fire-and-forget auto-extraction inside POST /api/documents/upload —
//      what runs when a BORROWER uploads a pay stub, bank statement or lease.
//      Nothing in the borrower UI triggers (A).
//
// They drifted. (A) grew the F-028 fact persistence, the F-030 readiness wiring
// and the model/prompt lineage columns; (B) kept writing field NAMES to
// `documents.notes` and nothing else. So on the only path a borrower can reach,
// the numbers the model read were discarded and the file went on asking for
// them — which is the exact gap `documentFacts.ts` says it closes.
//
// Two call sites implementing "the same" post-extraction behaviour is what let
// that happen, so the behaviour lives here and both routes call it. Anything a
// single path genuinely owns — the tax-insight derivation, task events, the
// audit row — deliberately stays in its route.
// ---------------------------------------------------------------------------

import type { ExtractedDocumentData } from "../extractionCore";
import { recordCoarseExtraction } from "./documentConfidence";
import { DOCUMENT_STATUS } from "@shared/documentStatus";

/** The slice of IStorage this needs — keeps the unit testable without a DB. */
interface DocumentUpdater {
  updateDocument(id: string, patch: Record<string, unknown>): Promise<unknown>;
}

export interface ApplyExtractionResult {
  humanReviewRequired: boolean;
  /** Number of `extracted_fields` rows written (0 when the read was low-confidence). */
  factsPersisted: number;
  /** Readiness fields credited from the values (empty when low-confidence). */
  readinessFieldsUpdated: string[];
}

export async function applyExtractionToDocument(params: {
  storage: DocumentUpdater;
  /** Owner of the document — readiness is credited to the borrower, not the actor. */
  userId: string;
  documentId: string;
  documentType: string;
  applicationId: string | null;
  fileSize?: number;
  extracted: ExtractedDocumentData;
}): Promise<ApplyExtractionResult> {
  const { storage, userId, documentId, documentType, applicationId, fileSize, extracted } = params;

  const { humanReviewRequired } = await recordCoarseExtraction({
    documentId,
    documentType,
    applicationId,
    confidence: extracted.confidence,
    extractedFields: extracted.extractedFields,
    fileSize,
  });

  await storage.updateDocument(documentId, {
    // MR-2: AI confidence never auto-verifies. "verified" is reserved for
    // POST /api/documents/:id/verify — a human on the deal team. A read that
    // clears the type's confidence threshold is staged "verifying" for that
    // human to confirm; everything else stays "uploaded".
    status: !humanReviewRequired ? DOCUMENT_STATUS.VERIFYING : DOCUMENT_STATUS.UPLOADED,
    notes: JSON.stringify({
      extractedAt: new Date().toISOString(),
      extractedFields: extracted.extractedFields,
      confidence: extracted.confidence,
      humanReviewRequired,
      warnings: extracted.warnings,
      modelId: extracted.modelId,
      promptVersion: extracted.promptVersion,
      responseHash: extracted.rawResponseHash,
    }),
    extractionResponseHash: extracted.rawResponseHash,
    extractionRawEncrypted: extracted.rawResponseEncrypted,
    extractionRawIv: extracted.rawResponseIv,
    extractionRawKeyId: extracted.rawResponseKeyId,
  });

  // A low-confidence read is a guess, and a guess is not a fact: it is recorded
  // on the document (above) for a human to look at, and it feeds nothing.
  if (extracted.confidence === "low") {
    return { humanReviewRequired, factsPersisted: 0, readinessFieldsUpdated: [] };
  }

  // Both of the below are non-fatal by contract: a lost downstream signal must
  // never turn into a failed extraction, and on path (B) the caller is a
  // fire-and-forget task whose rejection nobody surfaces.
  let factsPersisted = 0;
  try {
    const { persistDocumentFacts } = await import("./documentFacts");
    factsPersisted = await persistDocumentFacts(
      documentId,
      documentType,
      extracted as unknown as Record<string, any>,
      extracted.confidence,
      extracted.modelId,
    );
  } catch (factErr) {
    console.warn("[DocumentFacts] persist failed (non-fatal):", factErr);
  }

  let readinessFieldsUpdated: string[] = [];
  try {
    const { wireExtractionToReadiness } = await import("./optimizationEngine");
    // Pass the extraction RESULT, not `extractedFields` — the latter is a
    // string[] of field NAMES, and handing it to a value-reading map is what
    // made every value-bearing readiness row silently skip (F-030).
    const readinessResult = await wireExtractionToReadiness(
      userId,
      documentId,
      documentType,
      extracted as unknown as Record<string, any>,
      extracted.confidence,
    );
    readinessFieldsUpdated = readinessResult.fieldsUpdated;
    console.log(`[OPT-1] Readiness fields updated: ${readinessFieldsUpdated.join(", ") || "none"}`);
  } catch (readinessErr) {
    console.warn("[OPT-1] Readiness wiring failed (non-fatal):", readinessErr);
  }

  return { humanReviewRequired, factsPersisted, readinessFieldsUpdated };
}
