/**
 * Borrower-facing deal-activity view — the masked read model behind the
 * `activities` arrays of GET /api/loan-applications/:id and GET /api/dashboard
 * for non-staff callers.
 *
 * Modeled on shared/borrowerConditionView.ts / borrowerTaskView.ts: a strict
 * whitelist over both COLUMNS and ACTIVITY TYPES. The raw deal_activities row
 * is the shared staff/system event log — its description and metadata carry
 * staff clearance free text ("Reason: <clearanceNotes>"), staff decision
 * notes, wholesale-lender names ("N condition(s) from <lender> logged"), and
 * internal ops entries (autopilot review analysis, TRID/CoC compliance
 * bookkeeping, MISMO export notes) — none of which may reach a client-role
 * payload (borrower transparency doctrine: wholesale-lender identity is never
 * exposed; Borrower Clarity 2026-08-04: staff free text never reaches client
 * roles). The visible_to_roles column on the table was never wired up; this
 * view is THE masking layer.
 *
 * Three tiers, default-deny:
 *  - VERBATIM types: every writer emits fixed/derived borrower-directed copy,
 *    so title/description pass through — scrubbed against the wholesale
 *    catalog's identifiers on the way out. Writer contract: a VERBATIM type's
 *    description must stay derived/fixed copy; staff free text belongs in
 *    metadata (embargoed here), never in the description.
 *  - TEMPLATE types: the event itself is borrower-relevant but its text embeds
 *    staff free text or lender identity, so title AND description are replaced
 *    with fixed borrower copy (the borrowerTaskView transparency-row pattern).
 *  - Everything else — including any future unclassified type — is dropped.
 *
 * Lives in shared/ because it is pure and dependency-free at runtime: the
 * server maps rows through it, the client imports the view type, and the unit
 * suite exercises it without a database. Schema imports are type-only.
 */

import { scrubLenderIdentity } from "./borrowerOfferView";
import { LENDER_IDENTIFIERS } from "./borrowerConditionView";
import type { DealActivity } from "./schema";

/**
 * deal_activities columns that may reach a client-role payload (directly, or —
 * for performedBy — viewer-scoped to the caller's own actions). Together with
 * BORROWER_ACTIVITY_EMBARGOED_COLUMNS this classifies EVERY column;
 * tests/borrowerActivityView.test.ts pins the union against the live table,
 * so a new deal_activities column fails the unit gate until it is classified
 * deliberately.
 */
export const BORROWER_ACTIVITY_VIEW_COLUMNS = [
  "id",
  "applicationId",
  "activityType",
  "title",
  "description",
  "performedBy",
  "createdAt",
] as const satisfies readonly (keyof DealActivity)[];

/** deal_activities columns that must never appear in a client-role payload. */
export const BORROWER_ACTIVITY_EMBARGOED_COLUMNS = [
  "metadata",
  "visibleToRoles",
] as const satisfies readonly (keyof DealActivity)[];

/**
 * Types whose writers all emit fixed or derived borrower-directed copy
 * (audited 2026-08-04 against every createDealActivity call site). The two
 * status_change writers that injected free text (staff decision notes,
 * deal-fell-through reason) were moved to metadata in the same change.
 */
const VERBATIM_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  "status_change",
  "document_uploaded",
  "rate_locked",
  "rate_lock_extended",
  "consent_given",
  "team_updated",
  "partner_order_created",
]);

/**
 * §9 finding (2026-08-04): rows of these types written BEFORE the writer
 * contract landed can carry staff free text in description — the pre-contract
 * statusDecisions writer put staff decision notes there, the deal-fell-through
 * writer appended a free-text reason, and the task-engine upload writer
 * embedded staff-owned task titles. Those historical rows are not rewritten
 * (the feed is append-only history), so the view masks them instead: at or
 * after the cutover the description passes through (scrubbed); before it —
 * or when createdAt is missing/unparseable — only the title survives, which
 * every audited writer of these types has always derived from fixed copy.
 * The cutover is deliberately set AFTER the merge date so a slow deploy can
 * only over-mask (new-writer rows briefly lose descriptions), never leak.
 */
const LEGACY_FREETEXT_TYPES: ReadonlySet<string> = new Set([
  "status_change",
  "document_uploaded",
]);
const WRITER_CONTRACT_CUTOVER_MS = Date.parse("2026-08-06T00:00:00Z");

function isUnderWriterContract(createdAt: Date | string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && t >= WRITER_CONTRACT_CUTOVER_MS;
}

/**
 * Structural subset of the DealActivity row the mapper reads. Declared here
 * so callers can pass full rows or narrowed selects; extra fields on the
 * input are ignored — the OUTPUT is the contract.
 */
export interface MaskableDealActivity {
  id: string;
  applicationId: string;
  activityType: string;
  title: string;
  description: string | null;
  metadata?: unknown;
  performedBy?: string | null;
  createdAt?: Date | string | null;
}

export interface BorrowerActivityView {
  id: string;
  applicationId: string;
  activityType: string;
  title: string;
  description?: string;
  /**
   * Present only when the activity was performed by the viewer (the borrower
   * dashboard renders own-action vs system icons from its presence); staff
   * user ids are never emitted.
   */
  performedBy?: string;
  createdAt?: Date | string;
}

/** metadata.count when the writer recorded a positive integer, else null. */
function metadataCount(metadata: unknown): number | null {
  if (metadata && typeof metadata === "object" && "count" in metadata) {
    const count = (metadata as { count: unknown }).count;
    if (typeof count === "number" && Number.isInteger(count) && count > 0) return count;
  }
  return null;
}

/**
 * Mask one activity row for a client-role viewer, or null when the type is
 * not borrower-visible. viewerUserId (the requester's own id) scopes
 * performedBy exactly as borrowerTaskView scopes assignedToUserId.
 */
export function toBorrowerActivityView(
  activity: MaskableDealActivity,
  viewerUserId?: string,
): BorrowerActivityView | null {
  const base = {
    id: activity.id,
    applicationId: activity.applicationId,
    activityType: activity.activityType,
    ...(viewerUserId !== undefined &&
    activity.performedBy != null &&
    activity.performedBy === viewerUserId
      ? { performedBy: activity.performedBy }
      : {}),
    ...(activity.createdAt ? { createdAt: activity.createdAt } : {}),
  };

  if (VERBATIM_ACTIVITY_TYPES.has(activity.activityType)) {
    const scrub = (text: string) => scrubLenderIdentity(text, LENDER_IDENTIFIERS);
    const descriptionMasked =
      LEGACY_FREETEXT_TYPES.has(activity.activityType) &&
      !isUnderWriterContract(activity.createdAt);
    const description =
      activity.description && !descriptionMasked ? scrub(activity.description) : undefined;
    return {
      ...base,
      title: scrub(activity.title),
      ...(description !== undefined ? { description } : {}),
    };
  }

  switch (activity.activityType) {
    // Condition events carry staff clearanceNotes in description free text and
    // metadata.notes; the borrower keeps the headline, the notes stay internal
    // (per-condition detail lives on the borrowerConditionView surfaces).
    case "condition_cleared":
      return {
        ...base,
        title: "Condition Cleared",
        description: "A condition on your file was reviewed and cleared.",
      };
    case "condition_waived":
      return {
        ...base,
        title: "Condition Waived",
        description: "A condition on your file was waived. Nothing more is needed from you for it.",
      };
    case "condition_not_applicable":
      return {
        ...base,
        title: "Condition No Longer Applies",
        description: "A condition on your file was determined not to apply.",
      };
    // The raw description names the wholesale lender; rebuild from the typed
    // count instead (metadata.submissionId stays internal with the rest).
    case "lender_conditions_logged": {
      const count = metadataCount(activity.metadata);
      return {
        ...base,
        title: "New Conditions Added",
        description:
          count !== null
            ? `${count} new condition(s) were added to your file for clearing.`
            : "New conditions were added to your file for clearing.",
      };
    }
    // The raw description embeds the free-text withdrawal reason/details.
    case "application_withdrawn":
      return {
        ...base,
        title: "Application Withdrawn",
        description: "The application was withdrawn.",
      };
    default:
      // Default-deny: "note" (staff/system grab-bag), "autopilot_review",
      // "compliance_event", and anything future land here. A new type becomes
      // borrower-visible by classifying it above deliberately.
      return null;
  }
}

export function toBorrowerActivityViews(
  activities: MaskableDealActivity[],
  viewerUserId?: string,
): BorrowerActivityView[] {
  return activities
    .map((activity) => toBorrowerActivityView(activity, viewerUserId))
    .filter((view): view is BorrowerActivityView => view !== null);
}
