// ---------------------------------------------------------------------------
// Application → readiness checklist writer.
//
// The IO half of shared/readinessMapping.ts. Seeds the checklist (a no-op when
// it already exists) and records every answer the application carries at
// `application_stated`.
//
// SAFE BY CONSTRUCTION IN BOTH DIRECTIONS:
//   * updateReadinessField never downgrades a tier, so re-running this after a
//     document has proved a field leaves the tier-1 row alone. Stating income
//     and later proving it strengthens ONE row rather than creating two truths.
//   * It asserts only what the application actually holds, so an empty draft
//     records nothing rather than inflating the score.
//
// Non-fatal by contract: readiness is a signal. A failure here must never fail
// an application write.
// ---------------------------------------------------------------------------

import {
  initializeReadinessChecklist,
  updateReadinessField,
} from "./intentTracker";
import {
  readinessAssertionsFromApplication,
  type ReadinessApplicationInput,
} from "@shared/readinessMapping";

export async function syncApplicationToReadiness(
  userId: string,
  applicationId: string,
  application: ReadinessApplicationInput,
): Promise<{ fieldsRecorded: string[] }> {
  const assertions = readinessAssertionsFromApplication(application);
  if (assertions.length === 0) return { fieldsRecorded: [] };

  await initializeReadinessChecklist(userId, applicationId);

  const fieldsRecorded: string[] = [];
  for (const { fieldName, status } of assertions) {
    try {
      await updateReadinessField(userId, fieldName, {
        verificationStatus: status,
        sourceTable: "loan_applications",
        sourceField: fieldName,
        sourceRecordId: applicationId,
      });
      fieldsRecorded.push(fieldName);
    } catch (err) {
      console.warn(`[Readiness] application sync failed for ${fieldName}:`, err);
    }
  }
  return { fieldsRecorded };
}
