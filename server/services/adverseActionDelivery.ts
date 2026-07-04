import { db } from "../db";
import { notifications } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { storage } from "../storage";
import { getUndeliveredAdverseActions } from "./creditService";
import type { AdverseAction } from "@shared/schema";

/**
 * ECOA / Reg B §1002.9 adverse-action DELIVERY watchdog.
 *
 * `ensureAdverseActionForDenial` (creditService) already guarantees a denied
 * application carries a *generated* notice. But generation is not notification:
 * Reg B §1002.9(a)(1) requires the applicant be NOTIFIED of adverse action
 * within 30 days. A notice that sits with `deliveredAt = null` past that window
 * is a live compliance gap, and until now nothing watched for it — the row just
 * sat in the table. This sweep is that watch: it classifies every undelivered
 * notice by how close it is to the 30-day deadline and raises a de-duplicated
 * staff task for the ones that need action, so the obligation is visible instead
 * of silent.
 *
 * The classifier is a pure function (tested in tests/adverseActionDelivery.test.ts);
 * the sweep is the daily job wired to Vercel cron via /api/jobs/adverse-action-delivery.
 */

/** ECOA §1002.9(a)(1): applicant must be notified within 30 days of adverse action. */
export const ECOA_DELIVERY_WINDOW_DAYS = 30;

/**
 * Raise the alarm well before the statutory deadline so staff have runway to
 * actually deliver. A notice undelivered this long is not yet a violation, but
 * it is on a trajectory to become one.
 */
export const ECOA_DELIVERY_WARNING_DAYS = 21;

export type DeliveryClassification = "delivered" | "on_track" | "warning" | "breach";

/** Whole days elapsed between two instants (floored, never negative). */
export function daysBetween(earlier: Date, later: Date): number {
  const ms = later.getTime() - earlier.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Classify a single adverse-action notice against the ECOA delivery window.
 * Pure: no IO, deterministic in (noticeDate, deliveredAt, now).
 *
 * - delivered: the notice has a delivery timestamp — obligation met, no alarm.
 * - breach:    undelivered and past the 30-day statutory window (a live violation).
 * - warning:   undelivered and within the pre-deadline warning band.
 * - on_track:  undelivered but still comfortably inside the window.
 */
export function classifyAdverseActionDelivery(
  input: { noticeDate: Date | null; deliveredAt: Date | null },
  now: Date,
): DeliveryClassification {
  if (input.deliveredAt) return "delivered";
  // A notice with no generation date can't be aged; treat conservatively as a
  // warning so it surfaces for a human rather than being silently ignored.
  if (!input.noticeDate) return "warning";

  const days = daysBetween(input.noticeDate, now);
  if (days >= ECOA_DELIVERY_WINDOW_DAYS) return "breach";
  if (days >= ECOA_DELIVERY_WARNING_DAYS) return "warning";
  return "on_track";
}

export interface OverdueDeliveryItem {
  adverseActionId: string;
  applicationId: string;
  daysOutstanding: number;
  classification: Extract<DeliveryClassification, "warning" | "breach">;
  notified: boolean;
}

export interface AdverseActionDeliverySweepResult {
  scanned: number;
  onTrack: number;
  warning: number;
  breach: number;
  notificationsCreated: number;
  overdue: OverdueDeliveryItem[];
}

const OVERDUE_NOTIFICATION_TYPE = "adverse_action_delivery_overdue";

/**
 * Has a staff member already been alerted (and not yet dismissed) about this
 * specific notice? Keeps the daily sweep idempotent — it won't pile a fresh
 * reminder onto the same person every night for the same unresolved notice.
 */
async function hasOpenDeliveryAlert(adverseActionId: string): Promise<boolean> {
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, OVERDUE_NOTIFICATION_TYPE),
        eq(notifications.entityType, "adverse_action"),
        eq(notifications.entityId, adverseActionId),
        eq(notifications.status, "unread"),
      ),
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Scan every undelivered adverse-action notice, classify it against the ECOA
 * delivery window, and raise a de-duplicated staff task for those in the
 * warning/breach bands. Returns a summary so the caller (cron endpoint) can
 * report and so the same numbers can back the compliance dashboard.
 */
export async function sweepUndeliveredAdverseActions(
  now: Date = new Date(),
): Promise<AdverseActionDeliverySweepResult> {
  const undelivered: AdverseAction[] = await getUndeliveredAdverseActions();

  const result: AdverseActionDeliverySweepResult = {
    scanned: undelivered.length,
    onTrack: 0,
    warning: 0,
    breach: 0,
    notificationsCreated: 0,
    overdue: [],
  };

  for (const aa of undelivered) {
    const classification = classifyAdverseActionDelivery(
      { noticeDate: aa.noticeDate, deliveredAt: aa.deliveredAt },
      now,
    );

    if (classification === "delivered" || classification === "on_track") {
      if (classification === "on_track") result.onTrack += 1;
      continue;
    }

    if (classification === "warning") result.warning += 1;
    if (classification === "breach") result.breach += 1;

    const daysOutstanding = aa.noticeDate ? daysBetween(aa.noticeDate, now) : 0;

    // Notify the staff member who generated the notice — they own delivery.
    // If no staff owner is recorded, the dashboard still surfaces the item; we
    // just can't route a personal task, so we don't invent a recipient.
    let notified = false;
    if (aa.generatedBy && !(await hasOpenDeliveryAlert(aa.id))) {
      const label =
        classification === "breach"
          ? `overdue by ${daysOutstanding - ECOA_DELIVERY_WINDOW_DAYS} day(s)`
          : `due in ${ECOA_DELIVERY_WINDOW_DAYS - daysOutstanding} day(s)`;
      await storage.createNotification({
        userId: aa.generatedBy,
        type: OVERDUE_NOTIFICATION_TYPE,
        title:
          classification === "breach"
            ? "Adverse-action notice delivery OVERDUE (ECOA)"
            : "Adverse-action notice delivery due soon (ECOA)",
        body: `An adverse-action notice generated ${daysOutstanding} day(s) ago has no delivery confirmation (${label}). ECOA §1002.9 requires the applicant be notified within ${ECOA_DELIVERY_WINDOW_DAYS} days — confirm delivery to close this out.`,
        entityType: "adverse_action",
        entityId: aa.id,
        status: "unread",
        metadata: { classification, daysOutstanding, applicationId: aa.applicationId },
      });
      result.notificationsCreated += 1;
      notified = true;
    }

    result.overdue.push({
      adverseActionId: aa.id,
      applicationId: aa.applicationId,
      daysOutstanding,
      classification,
      notified,
    });
  }

  return result;
}
