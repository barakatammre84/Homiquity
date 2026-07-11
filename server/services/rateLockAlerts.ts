import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { notifications } from "@shared/schema";

// Alert on locks expiring within this window. Keep in step with the default
// used by GET /api/rate-locks/expiring so the UI strip and the sweep agree.
const ALERT_WINDOW_DAYS = 7;

function daysUntil(expiresAt: string | Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

/**
 * Rate-lock expiration sweep.
 *
 * Turns the pull-only GET /api/rate-locks/expiring into a push: for every lock
 * expiring inside the alert window, notify the assigned loan officer so a lock
 * never lapses unseen. One notification per lock — once created it lingers in
 * the LO's inbox until read, so a daily cron does not re-spam the same lock.
 *
 * Intended to run from a Vercel cron (see server/routes/jobs.ts and
 * vercel.json). Safe to run manually as an admin.
 */
export async function runRateLockAlertSweep(): Promise<{ scanned: number; notified: number }> {
  const expiring = await storage.getExpiringRateLocks(ALERT_WINDOW_DAYS);
  let notified = 0;

  for (const lock of expiring) {
    try {
      const application = await storage.getLoanApplication(lock.applicationId);
      const loanOfficerId = application?.loanOfficerId;
      if (!loanOfficerId) continue; // no assigned LO to alert

      // Dedup: skip if this LO has already been notified about this exact lock.
      const [existing] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, loanOfficerId),
            eq(notifications.type, "rate_lock_expiring"),
            eq(notifications.entityId, lock.applicationId),
            sql`${notifications.metadata} ->> 'rateLockId' = ${lock.id}`,
          ),
        )
        .limit(1);
      if (existing) continue;

      const days = daysUntil(lock.expiresAt);
      await storage.createNotification({
        userId: loanOfficerId,
        type: "rate_lock_expiring",
        title: `Rate lock expiring in ${days} day${days === 1 ? "" : "s"}`,
        body: `The ${lock.interestRate}% lock on this file expires ${new Date(lock.expiresAt).toLocaleDateString()}. Extend it or move the file to close before it lapses.`,
        entityType: "loan_application",
        entityId: lock.applicationId,
        metadata: { rateLockId: lock.id, expiresAt: lock.expiresAt },
      });
      notified++;
    } catch (err) {
      // Non-fatal: one bad lock must not abort the whole sweep.
      console.error(`[rateLockAlerts] alert failed for lock ${lock.id}:`, err);
    }
  }

  return { scanned: expiring.length, notified };
}
