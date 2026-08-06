// ---------------------------------------------------------------------------
// Extracted document FACTS — the values, not just the field names (F-028).
//
// THE GAP THIS CLOSES. A borrower uploads a pay stub. A model reads it. The
// numbers are then discarded: only lineage (field NAMES, confidence, model id)
// is kept, on documents.notes. So the borrower graph had no tier-1 income path
// from pay stubs and no tier-1 asset path at all, and the platform kept asking
// for figures it had already been shown. Tax returns escaped this only because
// tax_insights exists for them specifically.
//
// This is NOT a revert of F-027. That finding removed branches which read
// VALUES out of documents.notes — a column a borrower could write through the
// upload description box, so the only data those branches ever saw was forged.
// The capability was correctly deleted and never replaced; this is the
// replacement, on a server-written table a borrower cannot reach.
//
// WHERE THE VALUES LIVE. `extracted_fields` already models exactly this —
// polymorphic value columns, mandatory confidence, MISMO path, human-review
// columns — and its logicalDocumentId/pageId are already nullable. Migration
// 0052 adds `document_id` so the simple-upload pipeline can attribute rows to a
// `documents` row instead of a UAL logical document. Reusing it beats standing
// up a parallel table that would drift.
// ---------------------------------------------------------------------------

import { db } from "../db";
import { extractedFields } from "@shared/schema";
import { eq, inArray, and, isNotNull } from "drizzle-orm";
import { coarseConfidenceToNumeric } from "./documentConfidence";

export interface DocumentFact {
  fieldName: string;
  /** Mirrors extracted_fields.field_category. */
  fieldCategory: "income" | "asset" | "identity";
  valueNumeric?: number;
  valueString?: string;
  valueType: "currency" | "string";
}

/**
 * Monthly income from a pay stub's year-to-date gross.
 *
 * Deliberately derived from YTD rather than the period gross: annualizing a
 * single period needs a pay frequency the extractor does not emit, whereas
 * YTD-over-months-elapsed is the standard averaging method and needs only the
 * period end date the stub already carries. It also absorbs overtime and
 * commission variation instead of extrapolating one good cheque.
 *
 * Returns null rather than a guess when the inputs cannot support the figure:
 * no date, no YTD, or less than a full month elapsed (a stub dated 8 January
 * would divide by ~0.25 and amplify noise into a fantasy salary).
 */
export function monthlyIncomeFromYtd(
  ytdGross: number | undefined | null,
  payPeriodEndDate: string | undefined | null,
): number | null {
  if (!ytdGross || ytdGross <= 0 || !payPeriodEndDate) return null;

  const end = new Date(payPeriodEndDate);
  if (Number.isNaN(end.getTime())) return null;

  const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const monthsElapsed = end.getMonth() + end.getDate() / daysInMonth;
  if (monthsElapsed < 1) return null;

  return Math.round((ytdGross / monthsElapsed) * 100) / 100;
}

/**
 * The facts a given extraction yields. Pure — no IO, so the mapping is
 * testable against the real interfaces in server/extractionCore.ts.
 *
 * `lease_agreement` is deliberately absent. Its monthlyRent is gross rent, and
 * rental income carries a vacancy haircut before it is income; emitting it as a
 * plain income fact would overstate qualifying income on an advisory surface.
 * Rental income has its own path (Schedule E / the non-W2 plan).
 */
export function buildDocumentFacts(
  documentType: string,
  extracted: Record<string, any>,
): DocumentFact[] {
  const facts: DocumentFact[] = [];

  if (documentType === "pay_stub") {
    const monthly = monthlyIncomeFromYtd(extracted.ytdGross, extracted.payPeriodEndDate);
    if (monthly !== null) {
      facts.push({
        fieldName: "monthly_income_ytd_avg",
        fieldCategory: "income",
        valueNumeric: monthly,
        valueType: "currency",
      });
    }
    if (extracted.employerName) {
      facts.push({
        fieldName: "employer_name",
        fieldCategory: "identity",
        valueString: String(extracted.employerName),
        valueType: "string",
      });
    }
  }

  if (documentType === "bank_statement") {
    if (typeof extracted.closingBalance === "number" && extracted.closingBalance > 0) {
      facts.push({
        fieldName: "closing_balance",
        fieldCategory: "asset",
        valueNumeric: extracted.closingBalance,
        valueType: "currency",
      });
    }
    if (extracted.accountType) {
      facts.push({
        fieldName: "account_type",
        fieldCategory: "asset",
        valueString: String(extracted.accountType),
        valueType: "string",
      });
    }
  }

  return facts;
}

/**
 * Persist the facts for one extracted document, replacing any prior run's rows
 * for that document so a re-extraction corrects rather than duplicates.
 *
 * Non-fatal by contract: the caller treats a failure here as a lost signal, not
 * a failed extraction.
 */
export async function persistDocumentFacts(
  documentId: string,
  documentType: string,
  extracted: Record<string, any>,
  confidence: "high" | "medium" | "low",
  modelId?: string | null,
): Promise<number> {
  const facts = buildDocumentFacts(documentType, extracted);
  if (facts.length === 0) return 0;

  const numericConfidence = coarseConfidenceToNumeric(confidence);

  await db.delete(extractedFields).where(eq(extractedFields.documentId, documentId));
  await db.insert(extractedFields).values(
    facts.map(f => ({
      documentId,
      fieldName: f.fieldName,
      fieldCategory: f.fieldCategory,
      valueString: f.valueString ?? null,
      valueNumeric: f.valueNumeric !== undefined ? String(f.valueNumeric) : null,
      valueType: f.valueType,
      confidence: String(numericConfidence),
      extractionMethod: "claude",
      modelVersion: modelId ?? null,
    })),
  );

  return facts.length;
}

export interface DocumentFactRow {
  documentId: string;
  fieldName: string;
  fieldCategory: string | null;
  valueNumeric: number | null;
  valueString: string | null;
  humanVerified: boolean;
}

/** Facts for a set of simple-upload documents, for the borrower graph. */
export async function getFactsForDocuments(documentIds: string[]): Promise<DocumentFactRow[]> {
  if (documentIds.length === 0) return [];

  const rows = await db
    .select()
    .from(extractedFields)
    .where(
      and(
        isNotNull(extractedFields.documentId),
        inArray(extractedFields.documentId, documentIds),
      ),
    );

  return rows.map(r => ({
    documentId: r.documentId as string,
    fieldName: r.fieldName,
    fieldCategory: r.fieldCategory,
    valueNumeric: r.valueNumeric !== null ? Number(r.valueNumeric) : null,
    valueString: r.valueString,
    humanVerified: !!r.humanVerified,
  }));
}
