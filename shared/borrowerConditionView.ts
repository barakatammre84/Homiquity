/**
 * Borrower-facing loan-condition view — the masked read model behind
 * GET /api/loan-applications/:id/pipeline and /:id/conditions for non-staff
 * callers.
 *
 * Modeled on shared/borrowerOfferView.ts: a strict whitelist. The raw
 * loan_conditions row carries staff clearance free text (clearanceNotes),
 * the clearing staff member's user id, internal rule/task linkage
 * (sourceRule, linkedTaskId), and the wholesale-lender submission link
 * (lenderSubmissionId) — none of which may reach a borrower payload
 * (borrower transparency doctrine: wholesale-lender identity is never
 * exposed). Condition title/description can be staff-transcribed from a
 * lender's portal, so both are scrubbed against the wholesale catalog's
 * identifiers on the way out.
 */
import { scrubLenderIdentity } from "./borrowerOfferView";
import { WHOLESALE_LENDERS } from "./wholesaleLenders";

/**
 * Names + ids of every cataloged wholesale lender, PLUS derived shorthand
 * aliases — staff transcribe conditions from lender portals in the industry
 * register ("Angel Oak", "Rocket Pro", "United Wholesale"), which neither the
 * full legal name nor the hyphenated id matches. Derived per lender: the id
 * with hyphens as spaces ("angel oak", "rocket pro tpo") and the first two
 * words of the display name ("Angel Oak", "United Wholesale"). §9 review
 * F-1 (2026-08-04) probed exactly these bypasses. Exported for reuse by other
 * borrower-view mappers (borrowerActivityView scrubs feed text with it).
 */
export const LENDER_IDENTIFIERS: readonly string[] = WHOLESALE_LENDERS.flatMap((l) => {
  const nameWords = l.name.split(/\s+/);
  return [
    l.name,
    l.id,
    l.id.replace(/-/g, " "),
    ...(nameWords.length > 2 ? [nameWords.slice(0, 2).join(" ")] : []),
  ];
});

/**
 * Structural subset of the LoanCondition row the mapper reads. Declared here
 * (not imported from the schema) so the mapper stays dependency-light; extra
 * fields on the input are ignored — the OUTPUT is the contract.
 */
export interface MaskableLoanCondition {
  id: string;
  applicationId: string;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  requiredDocumentTypes: string[] | null;
  clearedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface BorrowerConditionView {
  id: string;
  applicationId: string;
  category: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  requiredDocumentTypes: string[];
  clearedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export function toBorrowerConditionView(condition: MaskableLoanCondition): BorrowerConditionView {
  const scrub = (text: string) => scrubLenderIdentity(text, LENDER_IDENTIFIERS);
  const description = condition.description ? scrub(condition.description) : undefined;
  return {
    id: condition.id,
    applicationId: condition.applicationId,
    category: condition.category,
    title: scrub(condition.title),
    ...(description !== undefined ? { description } : {}),
    priority: condition.priority,
    status: condition.status,
    requiredDocumentTypes: condition.requiredDocumentTypes ?? [],
    ...(condition.clearedAt ? { clearedAt: condition.clearedAt } : {}),
    ...(condition.createdAt ? { createdAt: condition.createdAt } : {}),
    ...(condition.updatedAt ? { updatedAt: condition.updatedAt } : {}),
  };
}

export function toBorrowerConditionViews(
  conditions: MaskableLoanCondition[],
): BorrowerConditionView[] {
  return conditions.map(toBorrowerConditionView);
}
