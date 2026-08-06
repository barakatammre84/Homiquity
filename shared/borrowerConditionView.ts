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


/**
 * Names + ids of the wholesale lenders to scrub, PLUS derived shorthand
 * aliases — staff transcribe conditions from lender portals in the industry
 * register ("Angel Oak", "Rocket Pro", "United Wholesale"), which neither the
 * full legal name nor the hyphenated id matches. Derived per lender: the id
 * with hyphens as spaces ("angel oak", "rocket pro tpo") and the first two
 * words of the display name ("Angel Oak", "United Wholesale"). §9 review
 * F-1 (2026-08-04) probed exactly these bypasses.
 *
 * Built from `wholesale_lenders` rows by the caller rather than from a
 * module-level constant: the lender catalog is a table now. The mappers below
 * take the resulting list as a REQUIRED argument specifically so that adding a
 * new caller cannot silently produce an empty scrub list — an omission is a
 * compile error, not a leak.
 */
export function buildLenderIdentifiers(
  lenders: readonly { lenderId: string; lenderName: string }[],
): string[] {
  return lenders.flatMap((l) => {
    const nameWords = l.lenderName.split(/\s+/);
    return [
      l.lenderName,
      l.lenderId,
      l.lenderId.replace(/-/g, " "),
      ...(nameWords.length > 2 ? [nameWords.slice(0, 2).join(" ")] : []),
    ];
  });
}

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

export function toBorrowerConditionView(
  condition: MaskableLoanCondition,
  lenderIdentifiers: readonly string[],
): BorrowerConditionView {
  const scrub = (text: string) => scrubLenderIdentity(text, lenderIdentifiers);
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
  lenderIdentifiers: readonly string[],
): BorrowerConditionView[] {
  return conditions.map((c) => toBorrowerConditionView(c, lenderIdentifiers));
}
