import type { Express, Request } from "express";
import { requireRole } from "../auth";
import { runLifecycleSweep, graduateClosedLoan } from "../services/lifecycleEngine";
import { buildStaffSignals } from "../services/signalEngine";
import { logAudit } from "../auditLog";
import { db } from "../db";
import { intentEvents } from "@shared/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

/**
 * Scheduled-job endpoints.
 *
 * /api/jobs/lifecycle is invoked two ways:
 * - Vercel cron (vercel.json "crons") — authenticated with the CRON_SECRET
 *   env var, which Vercel sends as "Authorization: Bearer <CRON_SECRET>".
 * - Manually by an admin session (useful locally and for on-demand runs).
 *
 * If CRON_SECRET is unset (e.g. before the env var is configured), only the
 * admin path works — the job degrades to manual rather than becoming open.
 */

function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

export function registerJobRoutes(app: Express) {
  app.get("/api/jobs/lifecycle", async (req, res, next) => {
    if (isCronRequest(req)) {
      try {
        const result = await runLifecycleSweep();
        return res.json({ ok: true, trigger: "cron", ...result });
      } catch (err) {
        console.error("[jobs] Lifecycle sweep failed:", err);
        return res.status(500).json({ ok: false, error: "Lifecycle sweep failed" });
      }
    }
    // Not a cron call — fall through to the admin-authenticated variant.
    return requireRole("admin")(req, res, async () => {
      try {
        const result = await runLifecycleSweep();
        logAudit(req, "jobs.lifecycle_sweep", "system", "lifecycle", { ...result });
        res.json({ ok: true, trigger: "manual", ...result });
      } catch (err) {
        console.error("[jobs] Lifecycle sweep failed:", err);
        res.status(500).json({ ok: false, error: "Lifecycle sweep failed" });
      }
    });
  });

  // The loan-officer signals feed: one prioritized "who needs attention"
  // queue derived from the platform's machine-generated signals.
  app.get(
    "/api/signals/staff",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (_req, res) => {
      try {
        const signals = await buildStaffSignals();
        res.json({ signals });
      } catch (err) {
        console.error("[signals] Staff feed failed:", err);
        res.status(500).json({ error: "Failed to build signals feed" });
      }
    },
  );

  // Friction summary — the raw material of the continuous learning loop.
  // Aggregates server-observed friction events (blocked gates, failed
  // uploads) so the daily guardian can turn recurring walls into scenario
  // proposals or UX fixes. Proposals only — friction never changes rules.
  app.get(
    "/api/jobs/friction-summary",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const days = Math.min(Math.max(parseInt(String(req.query.days ?? "7"), 10) || 7, 1), 90);
        const since = new Date(Date.now() - days * 24 * 3600 * 1000);
        const [byPoint, recent] = await Promise.all([
          db
            .select({
              point: intentEvents.targetLabel,
              count: sql<number>`count(*)::int`,
            })
            .from(intentEvents)
            .where(and(eq(intentEvents.eventType, "friction_event"), gte(intentEvents.occurredAt, since)))
            .groupBy(intentEvents.targetLabel)
            .orderBy(desc(sql`count(*)`)),
          db
            .select({
              point: intentEvents.targetLabel,
              applicationId: intentEvents.targetId,
              metadata: intentEvents.metadata,
              occurredAt: intentEvents.occurredAt,
            })
            .from(intentEvents)
            .where(and(eq(intentEvents.eventType, "friction_event"), gte(intentEvents.occurredAt, since)))
            .orderBy(desc(intentEvents.occurredAt))
            .limit(25),
        ]);
        res.json({ windowDays: days, byPoint, recent });
      } catch (err) {
        console.error("[jobs] Friction summary failed:", err);
        res.status(500).json({ error: "Failed to build friction summary" });
      }
    },
  );

  // Backfill: graduate an already-funded loan into a homeowner profile
  // (the automatic hook only fires on NEW funded transitions).
  app.post("/api/jobs/graduate/:applicationId", requireRole("admin"), async (req, res) => {
    try {
      await graduateClosedLoan(req.params.applicationId);
      logAudit(req, "jobs.graduate_loan", "loan_application", req.params.applicationId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[jobs] Graduation failed:", err);
      res.status(500).json({ ok: false, error: "Graduation failed" });
    }
  });
}
