import type { Express } from "express";
import type { IStorage } from "../storage";
import {
  normalizePhone,
  classifyKeyword,
  OPT_OUT_CONFIRMATION,
  OPT_IN_CONFIRMATION,
  HELP_RESPONSE,
} from "../services/smsCompliance";
import { candidateWebhookUrls, evaluateTwilioWebhookAuth } from "../services/twilioSignature";
import { captureMessage } from "../services/errorMonitoring";

export function registerWebhookRoutes(app: Express, storage: IStorage) {
  // Inbound SMS webhook. Handles the CTIA STOP / START / HELP keywords: STOP
  // writes the opt-out to the canonical ledger, stamps the timestamp, and clears
  // any queued outreach by flipping matching leads to do-not-contact. Accepts
  // Twilio-style form fields (From/Body) or JSON.
  //
  // AUTHENTICATION: every request is authenticated by its X-Twilio-Signature
  // against TWILIO_AUTH_TOKEN (see services/twilioSignature.ts). Unauthenticated
  // it was a lead-state mutation primitive for anyone who found the URL —
  // suppress any phone number, flip any matching lead to do-not-contact.
  //
  // The opt-OUT fail-safe from the original stub survives, narrowed to what it
  // can honestly mean once requests are authenticated: an AUTHENTIC STOP still
  // suppresses even when the rest of the processing fails. The ledger write is
  // what actually stops outbound (evaluateOutboundSms reads it), so it goes
  // first and the lead sweep can fail without losing it. What is deliberately
  // NOT preserved is honoring an UNVERIFIED STOP — that is the vulnerability,
  // not a safety property.
  //
  // A rejection is reported to monitoring rather than only logged: a rejected
  // request may be a real opt-out that a URL/secret misconfiguration is
  // dropping, and a silently dropped opt-out is a TCPA problem.
  //
  // Residual risk, inherent to Twilio's scheme rather than to this code: the
  // signature carries no timestamp or nonce, so a captured request can be
  // replayed. The writes here are idempotent, which bounds it — the one case
  // that is not merely redundant is replaying a captured START to re-subscribe
  // a number that has since sent STOP. Closing that needs MessageSid
  // de-duplication (a stored seen-set); tracked, not shipped here.
  app.post("/api/webhooks/sms", async (req, res) => {
    try {
      const contentType = req.headers["content-type"] ?? "";
      const isForm = contentType.includes("urlencoded") || contentType.includes("multipart/form-data");
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : null;

      const auth = evaluateTwilioWebhookAuth({
        authToken: process.env.TWILIO_AUTH_TOKEN,
        isProduction: process.env.NODE_ENV === "production",
        signature: req.headers["x-twilio-signature"],
        urls: candidateWebhookUrls(req),
        params: (req.body ?? {}) as Record<string, unknown>,
        rawBody,
        isForm,
      });

      if (!auth.ok) {
        console.error(`[webhooks] inbound SMS rejected: ${auth.reason}`);
        captureMessage("Inbound SMS webhook rejected", "warning", {
          reason: auth.reason,
          status: auth.status,
          // No phone number or message body — a rejected request is unverified
          // input and this endpoint's payload is PII.
        });
        return res
          .status(auth.status)
          .json({ error: auth.status === 503 ? "Webhook not configured" : "Invalid webhook signature" });
      }

      const body = req.body ?? {};
      const from = body.From ?? body.from ?? body.sender;
      const text = body.Body ?? body.body ?? body.message ?? body.text;

      const phone = normalizePhone(typeof from === "string" ? from : null);
      if (!phone) {
        return res.status(400).json({ error: "Missing or invalid 'From' phone number" });
      }

      const keyword = classifyKeyword(typeof text === "string" ? text : null);

      if (keyword === "stop") {
        // Ledger first: this row is what suppresses outbound messaging. The
        // lead sweep is best-effort cleanup on top of it, so its failure must
        // not discard a recorded opt-out or turn the request into a 500.
        await storage.setSmsOptOut({ phone, optedOut: true, keyword: "STOP", source: "sms_webhook" });
        let purged = 0;
        try {
          purged = await storage.applyLeadContactabilityByPhone(phone, true);
        } catch (sweepError) {
          console.error("SMS opt-out recorded but the lead do-not-contact sweep failed:", sweepError);
          captureMessage("SMS opt-out lead sweep failed", "error", {
            error: sweepError instanceof Error ? sweepError.message : String(sweepError),
          });
        }
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
