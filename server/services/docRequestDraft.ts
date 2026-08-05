/**
 * Roadmap LO-M17: pre-filled document-request drafts from a file's
 * outstanding conditions — the "No-Stall Guarantee" piece where the LO
 * approves a generated ask instead of composing one from memory.
 *
 * Same missing-document rules as the A8 nudge planner
 * (lifecycleEngine.planMissingDocNudges) and the rejection-revert logic:
 *  - only OUTSTANDING conditions with a non-empty requiredDocumentTypes list
 *    are upload asks (anything else is staff work, not a borrower request);
 *  - a condition is satisfied when ANY non-rejected upload matches any of its
 *    required types via the alias-aware matcher — a rejected upload does NOT
 *    satisfy (the borrower owes a replacement);
 *  - one draft item per document type, deduplicated across conditions (two
 *    conditions needing a W-2 is one ask, with both condition titles carried).
 *
 * Pure and deterministic — the route supplies the rows. This DRAFTS only:
 * nothing is sent until a human approves it through POST /api/messages, which
 * applies the document_request staff gate and notification path unchanged.
 */
import { documentTypesMatch } from "@shared/documentTypes";
import { DOCUMENT_STATUS } from "@shared/documentStatus";

export interface DraftConditionRow {
  id: string;
  status: string;
  title: string;
  requiredDocumentTypes: string[] | null;
}

export interface DraftDocumentRow {
  documentType: string;
  status: string | null;
}

export interface DocRequestDraftItem {
  /** Machine document type — becomes documentRequestData.documentType. */
  documentType: string;
  /** Humanized label — becomes documentRequestData.documentName. */
  documentName: string;
  /** Which outstanding condition(s) this ask clears. */
  conditionTitles: string[];
}

function humanize(documentType: string): string {
  const words = documentType.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildDocRequestDraft(
  conditions: DraftConditionRow[],
  documents: DraftDocumentRow[],
): DocRequestDraftItem[] {
  const usableUploads = documents.filter((d) => d.status !== DOCUMENT_STATUS.REJECTED);

  const byType = new Map<string, DocRequestDraftItem>();
  for (const condition of conditions) {
    if (condition.status !== "outstanding") continue;
    const required = condition.requiredDocumentTypes ?? [];
    if (required.length === 0) continue;

    const satisfied = required.some((req) =>
      usableUploads.some((up) => documentTypesMatch(req, up.documentType)),
    );
    if (satisfied) continue;

    // The condition's FIRST required type is the canonical ask; alternates in
    // the list are aliases of the same evidence, not extra requests.
    const documentType = required[0];
    const existing = byType.get(documentType);
    if (existing) {
      if (!existing.conditionTitles.includes(condition.title)) {
        existing.conditionTitles.push(condition.title);
      }
    } else {
      byType.set(documentType, {
        documentType,
        documentName: humanize(documentType),
        conditionTitles: [condition.title],
      });
    }
  }

  return [...byType.values()];
}
