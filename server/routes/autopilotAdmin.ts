import type { Express } from "express";
import { z } from "zod";
import { and, eq, gte, lte, like, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  autopilotConfig,
  loanConditions,
  dealActivities,
  aiInteractions,
  notifications,
  AUTOPILOT_GUIDELINE_MODES,
} from "@shared/schema";
import type { User } from "@shared/schema";
import { requireRole } from "../auth";
import { logAudit } from "../auditLog";
import { invalidateAutopilotConfigCache } from "../services/autopilot/config";

/**
 * Autopilot admin console API (Phase 5) — "activate it yourself" + "measure the ROI".
 *
 *   GET   /api/autopilot/config    → current operator config
 *   PATCH /api/autopilot/config    → flip the kill switch / capability toggles /
 *                                    LO pilot allowlist (admin only, audited)
 *   GET   /api/autopilot/metrics   → broker ROI: documents reviewed, follow-ups
 *                                    created, applications touched, hours saved
 *
 * Homiquity is a broker: these surface the agent's packaging work; nothing here
 * makes a credit decision.
 */

const MINUTES_SAVED_PER_REVIEW = 8; // Blend's stated manual-review time per doc.

// Exported for unit testing (tests/autopilotConsole.test.ts).
export const configPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    followUpGenerationEnabled: z.boolean().optional(),
    applicationDataUpdatesEnabled: z.boolean().optional(),
    decisionRelayEnabled: z.boolean().optional(),
    loanOfficerAllowlist: z.array(z.string().min(1)).nullable().optional(),
    guidelineMode: z.enum(AUTOPILOT_GUIDELINE_MODES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

async function readConfigRow() {
  const [row] = await db.select().from(autopilotConfig).limit(1);
  return row ?? null;
}

export function registerAutopilotAdminRoutes(app: Express) {
  app.get("/api/autopilot/config", requireRole("admin"), async (_req, res) => {
    try {
      const row = await readConfigRow();
      if (!row) return res.status(404).json({ error: "Autopilot config not initialized" });
      return res.json({
        enabled: row.enabled,
        followUpGenerationEnabled: row.followUpGenerationEnabled,
        applicationDataUpdatesEnabled: row.applicationDataUpdatesEnabled,
        decisionRelayEnabled: row.decisionRelayEnabled,
        loanOfficerAllowlist: (row.loanOfficerAllowlist as string[] | null) ?? null,
        guidelineMode: row.guidelineMode,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      });
    } catch (err) {
      console.error("[autopilot-admin] config read error:", err);
      return res.status(500).json({ error: "Failed to read Autopilot config" });
    }
  });

  app.patch("/api/autopilot/config", requireRole("admin"), async (req, res) => {
    try {
      const parsed = configPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid config", details: parsed.error.flatten().fieldErrors });
      }
      const user = req.user as User;
      const row = await readConfigRow();
      if (!row) return res.status(404).json({ error: "Autopilot config not initialized" });

      const updates: Record<string, unknown> = { updatedBy: user.id, updatedAt: new Date() };
      const d = parsed.data;
      if (d.enabled !== undefined) updates.enabled = d.enabled;
      if (d.followUpGenerationEnabled !== undefined) updates.followUpGenerationEnabled = d.followUpGenerationEnabled;
      if (d.applicationDataUpdatesEnabled !== undefined) updates.applicationDataUpdatesEnabled = d.applicationDataUpdatesEnabled;
      if (d.decisionRelayEnabled !== undefined) updates.decisionRelayEnabled = d.decisionRelayEnabled;
      if (d.loanOfficerAllowlist !== undefined) {
        updates.loanOfficerAllowlist = d.loanOfficerAllowlist && d.loanOfficerAllowlist.length > 0 ? d.loanOfficerAllowlist : null;
      }
      if (d.guidelineMode !== undefined) updates.guidelineMode = d.guidelineMode;

      await db.update(autopilotConfig).set(updates).where(eq(autopilotConfig.singleton, true));
      invalidateAutopilotConfigCache(); // the kill switch takes effect immediately

      logAudit(req, "autopilot.config.updated", "autopilot_config", row.id, { changed: Object.keys(d) });

      const fresh = await readConfigRow();
      return res.json({
        enabled: fresh!.enabled,
        followUpGenerationEnabled: fresh!.followUpGenerationEnabled,
        applicationDataUpdatesEnabled: fresh!.applicationDataUpdatesEnabled,
        decisionRelayEnabled: fresh!.decisionRelayEnabled,
        loanOfficerAllowlist: (fresh!.loanOfficerAllowlist as string[] | null) ?? null,
        guidelineMode: fresh!.guidelineMode,
        updatedAt: fresh!.updatedAt,
        updatedBy: fresh!.updatedBy,
      });
    } catch (err) {
      console.error("[autopilot-admin] config update error:", err);
      return res.status(500).json({ error: "Failed to update Autopilot config" });
    }
  });

  app.get("/api/autopilot/metrics", requireRole("admin"), async (req, res) => {
    try {
      const to = req.query.to ? new Date(String(req.query.to)) : new Date();
      const from = req.query.from
        ? new Date(String(req.query.from))
        : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({ error: "Invalid from/to date" });
      }

      const [[documents], [actions], [followUps], [apps], [approvals], [adverse]] = await Promise.all([
        // Documents the agent reviewed — one ai_interactions row per extraction.
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(aiInteractions)
          .where(
            and(
              eq(aiInteractions.workflow, "autopilot_extraction"),
              gte(aiInteractions.createdAt, from),
              lte(aiInteractions.createdAt, to),
            ),
          ),
        // Agent actions narrated to the deal team.
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(dealActivities)
          .where(
            and(
              eq(dealActivities.activityType, "autopilot_review"),
              gte(dealActivities.createdAt, from),
              lte(dealActivities.createdAt, to),
            ),
          ),
        // Follow-ups the agent itself generated. Only AUTOPILOT_* source rules
        // are Autopilot-attributable — DOC_REQ_* conditions are also produced by
        // the normal intake pipeline (Phase 3 reuses that rule for idempotent
        // convergence), so counting them would over-credit the agent with the
        // pipeline's work. Every number here maps to work the agent actually did.
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(loanConditions)
          .where(
            and(
              eq(loanConditions.isAutoGenerated, true),
              like(loanConditions.sourceRule, "AUTOPILOT%"),
              gte(loanConditions.createdAt, from),
              lte(loanConditions.createdAt, to),
            ),
          ),
        // Distinct applications the agent touched.
        db
          .select({ n: sql<number>`count(distinct ${dealActivities.applicationId})::int` })
          .from(dealActivities)
          .where(
            and(
              eq(dealActivities.activityType, "autopilot_review"),
              gte(dealActivities.createdAt, from),
              lte(dealActivities.createdAt, to),
            ),
          ),
        // Approvals relayed to borrowers (clear-to-close + funded). The relay
        // tags each notification with metadata.source, so the count is
        // Autopilot-attributable.
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(notifications)
          .where(
            and(
              sql`${notifications.metadata}->>'source' = 'autopilot_decision_relay'`,
              inArray(notifications.type, ["loan_approved", "loan_funded"]),
              gte(notifications.createdAt, from),
              lte(notifications.createdAt, to),
            ),
          ),
        // Adverse-action flags raised to staff on a lender denial (ECOA §1002.9).
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(notifications)
          .where(
            and(
              sql`${notifications.metadata}->>'source' = 'autopilot_decision_relay'`,
              eq(notifications.type, "adverse_action_required"),
              gte(notifications.createdAt, from),
              lte(notifications.createdAt, to),
            ),
          ),
      ]);

      const documentsReviewed = documents?.n ?? 0;
      return res.json({
        range: { from: from.toISOString(), to: to.toISOString() },
        documentsReviewed,
        agentActions: actions?.n ?? 0,
        followUpsCreated: followUps?.n ?? 0,
        applicationsTouched: apps?.n ?? 0,
        approvalsRelayed: approvals?.n ?? 0,
        adverseActionFlags: adverse?.n ?? 0,
        hoursSaved: Math.round(((documentsReviewed * MINUTES_SAVED_PER_REVIEW) / 60) * 10) / 10,
        minutesSavedPerReview: MINUTES_SAVED_PER_REVIEW,
      });
    } catch (err) {
      console.error("[autopilot-admin] metrics error:", err);
      return res.status(500).json({ error: "Failed to compute Autopilot metrics" });
    }
  });

  // Daily agent-activity trend (autopilot_review deal activities per day) over
  // the range, zero-filled so the chart is continuous.
  app.get("/api/autopilot/metrics/trend", requireRole("admin"), async (req, res) => {
    try {
      const to = req.query.to ? new Date(String(req.query.to)) : new Date();
      const from = req.query.from
        ? new Date(String(req.query.from))
        : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({ error: "Invalid from/to date" });
      }

      const rows = await db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${dealActivities.createdAt}), 'YYYY-MM-DD')`,
          n: sql<number>`count(*)::int`,
        })
        .from(dealActivities)
        .where(
          and(
            eq(dealActivities.activityType, "autopilot_review"),
            gte(dealActivities.createdAt, from),
            lte(dealActivities.createdAt, to),
          ),
        )
        .groupBy(sql`date_trunc('day', ${dealActivities.createdAt})`);

      const byDay = new Map(rows.map((r) => [r.day, r.n]));
      const buckets: { date: string; count: number }[] = [];
      const cursor = new Date(from);
      cursor.setUTCHours(0, 0, 0, 0);
      while (cursor <= to) {
        const key = cursor.toISOString().slice(0, 10);
        buckets.push({ date: key, count: byDay.get(key) ?? 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return res.json({ buckets });
    } catch (err) {
      console.error("[autopilot-admin] metrics trend error:", err);
      return res.status(500).json({ error: "Failed to compute Autopilot trend" });
    }
  });
}
