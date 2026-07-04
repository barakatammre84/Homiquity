import type { Express } from "express";
import type { IStorage } from "../storage";
import {
  normalizePhone,
  classifyKeyword,
  OPT_OUT_CONFIRMATION,
  OPT_IN_CONFIRMATION,
  HELP_RESPONSE,
} from "../services/smsCompliance";

export function registerWebhookRoutes(app: Express, storage: IStorage) {
  // Inbound SMS webhook (provider-agnostic). Handles the CTIA STOP / START / HELP
  // keywords: STOP writes the opt-out to the canonical ledger, stamps the
  // timestamp, and clears any queued outreach by flipping matching leads to
  // do-not-contact. Accepts Twilio-style form fields (From/Body) or JSON.
  //
  // NOTE: when a real SMS provider is wired, add signature verification here
  // (e.g. X-Twilio-Signature against the auth token). Opt-OUT is fail-safe even
  // unauthenticated (it only suppresses messaging); guard opt-IN once a provider
  // secret exists so a forged START can't re-subscribe someone.
  app.post("/api/webhooks/sms", async (req, res) => {
    try {
      const body = req.body ?? {};
      const from = body.From ?? body.from ?? body.sender;
      const text = body.Body ?? body.body ?? body.message ?? body.text;

      const phone = normalizePhone(typeof from === "string" ? from : null);
      if (!phone) {
        return res.status(400).json({ error: "Missing or invalid 'From' phone number" });
      }

      const keyword = classifyKeyword(typeof text === "string" ? text : null);

      if (keyword === "stop") {
        await storage.setSmsOptOut({ phone, optedOut: true, keyword: "STOP", source: "sms_webhook" });
        const purged = await storage.applyLeadContactabilityByPhone(phone, true);
        return res.json({ ok: true, action: "opted_out", leadsUpdated: purged, reply: OPT_OUT_CONFIRMATION });
      }

      if (keyword === "start") {
        await storage.setSmsOptOut({ phone, optedOut: false, keyword: "START", source: "sms_webhook" });
        await storage.applyLeadContactabilityByPhone(phone, false);
        return res.json({ ok: true, action: "opted_in", reply: OPT_IN_CONFIRMATION });
      }

      if (keyword === "help") {
        return res.json({ ok: true, action: "help", reply: HELP_RESPONSE });
      }

      // Non-keyword inbound message: acknowledge without changing opt-out state.
      return res.json({ ok: true, action: "ignored" });
    } catch (error) {
      console.error("SMS webhook error:", error);
      res.status(500).json({ error: "Failed to process inbound SMS" });
    }
  });
}
