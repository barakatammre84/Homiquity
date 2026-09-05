import { sql } from "drizzle-orm";
import { documentLineage, documents } from "@shared/schema";
import { DOCUMENT_STATUS } from "@shared/documentStatus";

/**
 * SQL eligibility for a query that has joined `documents` and left-joined its
 * `document_lineage` row. Legacy documents without lineage remain eligible;
 * rejected rows and any lineage version with a newer successor do not.
 */
export function currentDocumentEvidencePredicate() {
  return sql<boolean>`
    ${documents.status} IS DISTINCT FROM ${DOCUMENT_STATUS.REJECTED}
    AND NOT EXISTS (
      SELECT 1
        FROM document_lineage AS newer_document_lineage
       WHERE newer_document_lineage.application_id = ${documentLineage.applicationId}
         AND newer_document_lineage.lineage_id = ${documentLineage.lineageId}
         AND newer_document_lineage.version_number > ${documentLineage.versionNumber}
    )
  `;
}
