// ---------------------------------------------------------------------------
// Admin pricing policy — the platform fee schedule and wholesale comp bands.
//
// These two numbers are the whole of audit F-17's economics: the platform's own
// fees and originator compensation draw on ONE Reg Z points-and-fees budget.
// Both were previously a code change away from being adjusted — the fee
// schedule as compile-time constants, the comp bands as seed data with no
// surface. Re-pricing after a lender negotiation should not need a deploy.
//
// Append-only for the fee schedule: publishing supersedes the active row and
// inserts a new version rather than mutating in place, because a fee schedule
// is a fact about how a file was priced at a point in time and an issued Loan
// Estimate has to stay reproducible.
// ---------------------------------------------------------------------------
import type { Express } from "express";
import { z } from "zod";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { platformFeeSchedules, wholesaleLenders } from "@shared/schema";
import { requireRole } from "../../auth";
import { logAudit } from "../../auditLog";
import { parseBodyOr400 } from "../validate";
import { routeParam } from "../../http/routeParams";
import {
  DEFAULT_PLATFORM_FEE_SCHEDULE,
  estimatedNoteDate,
  maxElectableCompensationBps,
  resolvePlatformFinanceCharges,
  type PlatformFeeSchedule,
} from "../../services/loanCosts";
import {
  getActiveFeeSchedule,
  invalidateFeeScheduleCache,
} from "../../services/platformFeeSchedule";

// Bounds are deliberately generous — this is a business dial, not a validator
// of business judgement. What it must stop is a typo that silently prices every
// file wrong: a negative fee, or a rate entered as "1" meaning 100%.
const publishSchema = z.object({
  applicationFee: z.number().min(0).max(100_000),
  underwritingFee: z.number().min(0).max(100_000),
  taxServiceFee: z.number().min(0).max(100_000),
  /** FRACTION, not percent: 0.01 = 1%. Capped at 5% to catch percent/fraction slips. */
  originationFeeRate: z.number().min(0).max(0.05),
  note: z.string().trim().min(1).max(500),
});

const compensationSchema = z.object({
  compensationType: z.enum(["LENDER_PAID", "BORROWER_PAID", "EITHER"]),
  defaultBps: z.number().int().min(0).max(1000),
  minBps: z.number().int().min(0).max(1000),
  maxBps: z.number().int().min(0).max(1000),
});

/**
 * What a candidate schedule would do to real files.
 *
 * The point of showing this at publish time is that the fee schedule and the
 * comp plan share one cap: raising fees does not just raise revenue, it eats
 * the room compensation needs, and past a point the platform's own charges
 * start getting trimmed (F-17) or the file stops being originable at all.
 * Better to see that before publishing than to discover it per-file.
 */
function previewSchedule(schedule: PlatformFeeSchedule) {
  const noteDate = estimatedNoteDate(null);
  const sizes = [100_000, 150_000, 200_000, 250_000, 300_000, 400_000];
  return sizes.map(loanAmount => {
    const resolved = resolvePlatformFinanceCharges(
      noteDate,
      loanAmount,
      { model: "lender_paid", bps: 200 },
      schedule,
    );
    return {
      loanAmount,
      feesCharged: resolved.total,
      standardTotal: resolved.standardTotal,
      trimmed: resolved.reduced,
      originable: resolved.originable,
      maxElectableBps: maxElectableCompensationBps(noteDate, loanAmount, "lender_paid", schedule),
    };
  });
}

export function registerPricingPolicyRoutes(app: Express) {
  // -------------------------------------------------------------------------
  // Fee schedule — read the active one plus its history and a live preview.
  // -------------------------------------------------------------------------
  app.get("/api/admin/pricing-policy/fee-schedule", requireRole("admin"), async (_req, res) => {
    try {
      const active = await getActiveFeeSchedule();
      const history = await db
        .select()
        .from(platformFeeSchedules)
        .orderBy(desc(platformFeeSchedules.version))
        .limit(20);

      res.json({
        active: active.schedule,
        version: active.version,
        effectiveFrom: active.effectiveFrom,
        /** True when nothing is published and the compiled-in baseline is in force. */
        usingBaseline: active.version === null,
        baseline: DEFAULT_PLATFORM_FEE_SCHEDULE,
        preview: previewSchedule(active.schedule),
        history: history.map(row => ({
          version: row.version,
          applicationFee: Number(row.applicationFee),
          underwritingFee: Number(row.underwritingFee),
          taxServiceFee: Number(row.taxServiceFee),
          originationFeeRate: Number(row.originationFeeRate),
          effectiveFrom: row.effectiveFrom,
          supersededAt: row.supersededAt,
          note: row.note,
        })),
      });
    } catch (error) {
      console.error("Fee schedule read error:", error);
      res.status(500).json({ error: "Failed to read the platform fee schedule" });
    }
  });

  // Dry-run: what would this schedule do, without publishing it.
  app.post("/api/admin/pricing-policy/fee-schedule/preview", requireRole("admin"), async (req, res) => {
    const data = parseBodyOr400(publishSchema.omit({ note: true }), req.body, res);
    if (data === undefined) return;
    res.json({ preview: previewSchedule(data) });
  });

  // -------------------------------------------------------------------------
  // Publish a new version. Append-only: supersede the active row and insert,
  // both inside one transaction so there is never a window with zero or two
  // active schedules (the partial unique index in migration 0046 is the
  // backstop if two publishes race).
  // -------------------------------------------------------------------------
  app.post("/api/admin/pricing-policy/fee-schedule", requireRole("admin"), async (req, res) => {
    try {
      const data = parseBodyOr400(publishSchema, req.body, res);
      if (data === undefined) return;

      const published = await db.transaction(async tx => {
        await tx
          .update(platformFeeSchedules)
          .set({ supersededAt: new Date() })
          .where(isNull(platformFeeSchedules.supersededAt));

        const [{ max }] = await tx
          .select({ max: sql<number | null>`max(${platformFeeSchedules.version})` })
          .from(platformFeeSchedules);

        const [row] = await tx
          .insert(platformFeeSchedules)
          .values({
            version: (max ?? 0) + 1,
            applicationFee: String(data.applicationFee),
            underwritingFee: String(data.underwritingFee),
            taxServiceFee: String(data.taxServiceFee),
            originationFeeRate: String(data.originationFeeRate),
            note: data.note,
            createdBy: req.user!.id,
          })
          .returning();
        return row;
      });

      invalidateFeeScheduleCache();

      // A fee change is disclosed to every borrower priced after it and eats
      // the same QM budget as compensation — it is never an anonymous edit.
      logAudit(req, "platform_fee_schedule.published", "platform_fee_schedule", published.id, {
        version: published.version,
        applicationFee: data.applicationFee,
        underwritingFee: data.underwritingFee,
        taxServiceFee: data.taxServiceFee,
        originationFeeRate: data.originationFeeRate,
        note: data.note,
      });

      res.status(201).json({
        version: published.version,
        effectiveFrom: published.effectiveFrom,
        preview: previewSchedule(data),
      });
    } catch (error) {
      console.error("Fee schedule publish error:", error);
      res.status(500).json({ error: "Failed to publish the platform fee schedule" });
    }
  });

  // -------------------------------------------------------------------------
  // Wholesale comp bands — already DB-backed, previously with no surface.
  // -------------------------------------------------------------------------
  app.get("/api/admin/pricing-policy/lenders", requireRole("admin"), async (_req, res) => {
    try {
      const lenders = await db
        .select({
          id: wholesaleLenders.id,
          lenderName: wholesaleLenders.lenderName,
          lenderCode: wholesaleLenders.lenderCode,
          status: wholesaleLenders.status,
          brokerCompensation: wholesaleLenders.brokerCompensation,
        })
        .from(wholesaleLenders)
        .orderBy(wholesaleLenders.lenderName);
      res.json({ lenders });
    } catch (error) {
      console.error("Lender comp read error:", error);
      res.status(500).json({ error: "Failed to read wholesale lender compensation" });
    }
  });

  app.patch("/api/admin/pricing-policy/lenders/:id", requireRole("admin"), async (req, res) => {
    try {
      const id = routeParam(req, "id");
      const data = parseBodyOr400(compensationSchema, req.body, res);
      if (data === undefined) return;

      if (data.minBps > data.maxBps) {
        return res.status(400).json({ error: "minBps cannot exceed maxBps" });
      }
      if (data.defaultBps < data.minBps || data.defaultBps > data.maxBps) {
        return res.status(400).json({ error: "defaultBps must sit within [minBps, maxBps]" });
      }

      const [existing] = await db
        .select()
        .from(wholesaleLenders)
        .where(eq(wholesaleLenders.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Wholesale lender not found" });
      }

      const [updated] = await db
        .update(wholesaleLenders)
        .set({ brokerCompensation: data })
        .where(eq(wholesaleLenders.id, id))
        .returning();

      logAudit(req, "wholesale_lender.compensation_updated", "wholesale_lender", id, {
        lenderName: existing.lenderName,
        previous: existing.brokerCompensation ?? null,
        next: data,
      });

      res.json({
        id: updated.id,
        lenderName: updated.lenderName,
        brokerCompensation: updated.brokerCompensation,
      });
    } catch (error) {
      console.error("Lender comp update error:", error);
      res.status(500).json({ error: "Failed to update wholesale lender compensation" });
    }
  });
}
