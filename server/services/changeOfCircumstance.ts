// ---------------------------------------------------------------------------
// TRID change of circumstance → revised Loan Estimate workflow.
//
// Reg Z §1026.19(e)(3)(iv)(A)–(F) enumerates the only reasons a creditor may
// use a revised Loan Estimate; §1026.19(e)(4)(i) requires the revised LE to
// be provided within 3 business days of receiving information sufficient to
// establish that the reason occurred. Business-day math comes exclusively
// from services/businessDays.ts (weekends + federal holidays — never
// reimplement with calendar days).
//
// Scope boundaries (deliberate):
//   * Fee-tolerance / good-faith cure math is NOT automated — every recorded
//     change carries a manual-review posture (counsel item in
//     kb/compliance/COMPLIANCE_COUNSEL_REVIEW.md §6). Deterministic records +
//     deadline enforcement only; no charge comparisons here.
//   * §1026.19(e)(4)(ii) (revised LE no later than 4 business days before
//     consummation / CD interplay) is the lender's closing-side timing in the
//     wholesale model and is not enforced pre-submission.
//
// Delivery mirrors the original-LE mechanism: the borrower's next retrieval
// of the (always regenerated) LE behind e-disclosure consent stamps
// revisedLeDeliveredAt on every open record (ESIGN electronic delivery, same
// rationale as the leIssuedDate stamp in routes/underwriting.ts).
// An OPEN record past its due date blocks wholesale submission via broker
// readiness stage 1 — the same hard-stop posture as an overdue original LE.
// ---------------------------------------------------------------------------

import { storage } from "../storage";
import { addBusinessDays } from "./businessDays";
import { cocReasonById, type CocReasonType } from "@shared/compliance/changeOfCircumstance";
import type { ChangeOfCircumstance } from "@shared/schema";

/** informationReceivedAt + 3 business days (§1026.19(e)(4)(i)). Pure. */
export function computeRevisedLeDueDate(informationReceivedAt: Date): Date {
  return addBusinessDays(informationReceivedAt, 3);
}

/**
 * Overdue once the due date's calendar day has fully elapsed without
 * delivery — the same end-of-due-day convention as the original-LE clock in
 * services/trid.ts. Pure.
 */
export function isRevisedLeOverdue(revisedLeDueDate: Date, now: Date): boolean {
  const endOfDueDay = new Date(revisedLeDueDate);
  endOfDueDay.setUTCHours(23, 59, 59, 999);
  return now.getTime() > endOfDueDay.getTime();
}

export interface CocReadinessSummary {
  openCount: number;
  overdueRevisedLe: boolean;
}

/** Readiness input for broker submission stage 1. */
export async function getCocReadinessSummary(applicationId: string, now: Date = new Date()): Promise<CocReadinessSummary> {
  const open = await storage.getOpenChangeOfCircumstances(applicationId);
  return {
    openCount: open.length,
    overdueRevisedLe: open.some(c => isRevisedLeOverdue(new Date(c.revisedLeDueDate), now)),
  };
}

export async function recordChangeOfCircumstance(
  applicationId: string,
  input: { reasonType: CocReasonType; description: string; informationReceivedAt: Date },
  createdByUserId: string,
): Promise<ChangeOfCircumstance> {
  const reason = cocReasonById(input.reasonType);
  if (!reason) {
    throw new Error(`Unknown change-of-circumstance reason: ${input.reasonType}`);
  }

  const revisedLeDueDate = computeRevisedLeDueDate(input.informationReceivedAt);
  const coc = await storage.createChangeOfCircumstance({
    applicationId,
    reasonType: input.reasonType,
    description: input.description,
    informationReceivedAt: input.informationReceivedAt,
    revisedLeDueDate,
    status: "open",
    createdByUserId,
  });

  const dueLabel = revisedLeDueDate.toISOString().split("T")[0];
  await storage.createDealActivity({
    applicationId,
    activityType: "compliance_event",
    title: "Change of circumstance recorded — revised Loan Estimate clock started",
    description:
      `${reason.label} (${reason.cite}). A revised Loan Estimate must be provided by ${dueLabel} ` +
      `(3 business days from receipt of the establishing information, §1026.19(e)(4)(i)). ` +
      `Fee-tolerance impact routes to manual review.`,
    performedBy: createdByUserId,
    metadata: { cocId: coc.id, reasonType: input.reasonType },
  });

  const application = await storage.getLoanApplication(applicationId);
  if (application?.loanOfficerId) {
    await storage.createNotification({
      userId: application.loanOfficerId,
      type: "compliance_deadline",
      title: "Revised Loan Estimate due — change of circumstance",
      body:
        `Application ${applicationId.substring(0, 8).toUpperCase()}: ${reason.label}. ` +
        `The revised Loan Estimate is due by ${dueLabel}.`,
      entityType: "loan_application",
      entityId: applicationId,
      status: "unread",
    });
  }

  return coc;
}

/**
 * Stamp every open record delivered. Called from the borrower LE retrieval
 * route (the regenerated LE reflects current file data, so one retrieval
 * satisfies all open records). Returns the stamped rows.
 */
export async function markRevisedLeDelivered(applicationId: string, deliveredAt: Date = new Date()): Promise<ChangeOfCircumstance[]> {
  const open = await storage.getOpenChangeOfCircumstances(applicationId);
  if (open.length === 0) return [];
  const stamped = await storage.markChangeOfCircumstancesRedisclosed(
    open.map(c => c.id),
    deliveredAt,
  );
  await storage.createDealActivity({
    applicationId,
    activityType: "compliance_event",
    title: "Revised Loan Estimate delivered",
    description:
      `The borrower retrieved the regenerated Loan Estimate; ${stamped.length} open change(s) of ` +
      `circumstance marked redisclosed (electronic delivery under the file's e-disclosure consent).`,
    metadata: { cocIds: stamped.map(c => c.id) },
  });
  return stamped;
}

export async function voidChangeOfCircumstance(
  cocId: string,
  voidReason: string,
  voidedByUserId: string,
): Promise<ChangeOfCircumstance | undefined> {
  const coc = await storage.getChangeOfCircumstance(cocId);
  if (!coc || coc.status !== "open") return undefined;
  const updated = await storage.updateChangeOfCircumstance(cocId, {
    status: "voided",
    voidReason,
  });
  if (updated) {
    await storage.createDealActivity({
      applicationId: coc.applicationId,
      activityType: "compliance_event",
      title: "Change of circumstance voided",
      description: `Recorded in error: ${voidReason}`,
      performedBy: voidedByUserId,
      metadata: { cocId },
    });
  }
  return updated;
}
