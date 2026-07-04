import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireRole } from "../auth";
import { logAudit } from "../auditLog";
import { z } from "zod";
import type { InsertLead } from "@shared/schema";

// Which staff work leads: the sales funnel (admin + loan officers + assistants).
// Processors/underwriters/closers act post-application, so they're excluded here.
const LEAD_STAFF_ROLES = ["admin", "lo", "loa"] as const;

// Public intake payload. Deliberately no SSN/DOB (soft-pull-first). TrustedForm
// evidence is REQUIRED: every lead must carry proof of TCPA consent so we can
// defend an outbound contact per-lead, not per-account.
const decimalString = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "must be numeric")
  .transform((v) => (v === "" ? undefined : v));

const leadIntakeSchema = z
  .object({
    source: z.string().min(1).max(100),
    sourceCampaign: z.string().max(255).optional(),
    utmSource: z.string().max(100).optional(),
    utmMedium: z.string().max(100).optional(),
    utmCampaign: z.string().max(255).optional(),
    externalLeadId: z.string().max(255).optional(),

    // Compliance evidence — a TrustedForm certificate URL is mandatory.
    trustedFormCertUrl: z.string().url().max(500),
    consentTcpaText: z.string().max(5000).optional(),
    consentCapturedAt: z.coerce.date().optional(),

    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(40).optional(),

    loanPurpose: z.enum(["purchase", "refinance", "cash_out_refinance", "heloc"]).optional(),
    propertyZip: z.string().max(20).optional(),
    propertyState: z.string().length(2).optional(),
    estimatedPropertyValue: decimalString.optional(),
    estimatedDownPayment: decimalString.optional(),
    selfReportedCreditRange: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  })
  // A lead with no way to reach the borrower is not actionable.
  .refine((d) => !!(d.email || d.phone), {
    message: "At least one of email or phone is required",
    path: ["email"],
  });

const listQuerySchema = z.object({
  status: z.string().max(30).optional(),
  source: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function registerLeadRoutes(app: Express, storage: IStorage) {
  // Public, unauthenticated intake for landing pages and aggregator webhooks.
  // Rate-limited in app.ts (leadsLimiter).
  app.post("/api/leads", async (req, res) => {
    try {
      const parsed = leadIntakeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid lead payload",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const data = parsed.data;

      // Idempotency: an aggregator that resends the same externalLeadId gets the
      // existing row rather than a 500 from the unique constraint.
      if (data.externalLeadId) {
        const existing = await storage.getLeadByExternalId(data.source, data.externalLeadId);
        if (existing) {
          return res.status(200).json({ lead: { id: existing.id, status: existing.status }, duplicate: true });
        }
      }

      const forwardedFor = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
      const insert: InsertLead = {
        source: data.source,
        sourceCampaign: data.sourceCampaign ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        externalLeadId: data.externalLeadId ?? null,
        rawPayload: req.body,

        trustedFormCertUrl: data.trustedFormCertUrl,
        consentTcpaText: data.consentTcpaText ?? null,
        // Default the consent timestamp to now when the caller doesn't supply one.
        consentCapturedAt: data.consentCapturedAt ?? new Date(),
        consentIp: (req.ip || forwardedFor || null)?.slice(0, 64) ?? null,
        consentUserAgent: req.headers["user-agent"] ?? null,

        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,

        loanPurpose: data.loanPurpose ?? null,
        propertyZip: data.propertyZip ?? null,
        propertyState: data.propertyState?.toUpperCase() ?? null,
        estimatedPropertyValue: data.estimatedPropertyValue ?? null,
        estimatedDownPayment: data.estimatedDownPayment ?? null,
        selfReportedCreditRange: data.selfReportedCreditRange ?? null,
      };

      let lead;
      try {
        lead = await storage.createLead(insert);
      } catch (err: any) {
        // Lost a race on the (source, externalLeadId) unique index — treat as dup.
        if (err?.code === "23505" && data.externalLeadId) {
          const existing = await storage.getLeadByExternalId(data.source, data.externalLeadId);
          if (existing) {
            return res.status(200).json({ lead: { id: existing.id, status: existing.status }, duplicate: true });
          }
        }
        throw err;
      }

      logAudit(req, "lead.created", "lead", lead.id, { source: lead.source });
      // Echo back only non-PII identifiers to the (unauthenticated) caller.
      res.status(201).json({ lead: { id: lead.id, status: lead.status } });
    } catch (error) {
      console.error("Create lead error:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  // Staff list view. Internal sales roles only.
  app.get("/api/leads", requireRole(...LEAD_STAFF_ROLES), async (req, res) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten().fieldErrors });
      }
      const leadList = await storage.listLeads(parsed.data);
      res.json(leadList);
    } catch (error) {
      console.error("List leads error:", error);
      res.status(500).json({ error: "Failed to list leads" });
    }
  });

  app.get("/api/leads/:id", requireRole(...LEAD_STAFF_ROLES), async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      res.json(lead);
    } catch (error) {
      console.error("Get lead error:", error);
      res.status(500).json({ error: "Failed to get lead" });
    }
  });

  // Admin-only removal (spam pruning, CCPA/GDPR erasure, test cleanup).
  app.delete("/api/leads/:id", requireRole("admin"), async (req, res) => {
    try {
      const removed = await storage.deleteLead(req.params.id);
      if (!removed) return res.status(404).json({ error: "Lead not found" });
      logAudit(req, "lead.deleted", "lead", req.params.id, {});
      res.json({ success: true });
    } catch (error) {
      console.error("Delete lead error:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });
}
