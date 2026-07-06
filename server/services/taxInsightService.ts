import type { ExtractedTaxReturnData } from "../extractionService";
import type { InsertTaxInsight, TaxInsight } from "@shared/schema";
import { storage } from "../storage";

/**
 * Turns a validated tax-return extraction into the derived signals stored in
 * tax_insights. Marketing/readiness signals only — never underwriting inputs
 * (figures are re-verified from source documents during an application).
 *
 * dscrCandidate deliberately requires better-than-low confidence: a garbled
 * extraction must not put someone on the staff investor-lead list.
 */

const toMoney = (v: number | undefined): string | null =>
  v === undefined ? null : v.toFixed(2);

export function deriveTaxInsight(
  extracted: ExtractedTaxReturnData,
): Omit<InsertTaxInsight, "userId" | "documentId"> {
  const scheduleE = extracted.scheduleE;
  const hasScheduleE =
    !!scheduleE &&
    (scheduleE.netRentalIncomeLoss !== undefined || (scheduleE.propertyCount ?? 0) > 0);
  const selfEmployed =
    !!extracted.scheduleC && extracted.scheduleC.netProfitLoss !== undefined;

  const parsedYear = parseInt(extracted.documentYear, 10);
  const taxYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear() - 1;

  return {
    taxYear,
    wagesW2: toMoney(extracted.w2Wages),
    grossIncome: toMoney(extracted.grossIncome),
    adjustedGrossIncome: toMoney(extracted.adjustedGrossIncome),
    scheduleCNetProfit: toMoney(extracted.scheduleC?.netProfitLoss),
    scheduleENetRental: toMoney(scheduleE?.netRentalIncomeLoss),
    scheduleEGrossRents: toMoney(scheduleE?.grossRents),
    rentalPropertyCount: scheduleE?.propertyCount ?? null,
    selfEmployed,
    dscrCandidate: hasScheduleE && extracted.confidence !== "low",
    confidence: extracted.confidence,
    modelId: extracted.modelId ?? null,
    promptVersion: extracted.promptVersion ?? null,
  };
}

/**
 * Derive + upsert (one row per user + tax year). Low-confidence extractions
 * still persist so the client can show "we couldn't read this clearly — try a
 * clearer copy" instead of silently dropping the upload.
 */
export async function saveTaxInsightForDocument(
  userId: string,
  documentId: string,
  extracted: ExtractedTaxReturnData,
): Promise<TaxInsight> {
  return storage.upsertTaxInsight({
    userId,
    documentId,
    ...deriveTaxInsight(extracted),
  });
}
