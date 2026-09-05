import type { LoanCondition } from "@shared/schema";
import { DOCUMENT_STATUS } from "@shared/documentStatus";
import { documentTypesMatch } from "@shared/documentTypes";

/**
 * Select submitted conditions that lose their only usable document when a
 * reviewer rejects one upload. Kept pure so both the transactional review
 * writer and focused tests use the same rule.
 */
export function conditionsToRevertAfterRejection(input: {
  conditions: Array<Pick<LoanCondition, "id" | "status" | "requiredDocumentTypes">>;
  documents: Array<{ documentType: string; status: string | null }>;
  rejectedDocumentType: string;
}): string[] {
  const { conditions, documents, rejectedDocumentType } = input;
  return conditions
    .filter(
      (condition) =>
        condition.status === "submitted" &&
        (condition.requiredDocumentTypes ?? []).some((type) =>
          documentTypesMatch(type, rejectedDocumentType),
        ),
    )
    .filter(
      (condition) =>
        !documents.some(
          (document) =>
            document.status !== DOCUMENT_STATUS.REJECTED &&
            (condition.requiredDocumentTypes ?? []).some((type) =>
              documentTypesMatch(type, document.documentType),
            ),
        ),
    )
    .map((condition) => condition.id);
}
