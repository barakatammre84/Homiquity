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
import { classifyMessageStatus, parseMessageStatusEvent } from "../services/twilioMessageStatus";
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

  // Outbound delivery receipts (Twilio "Status callback URL"). Twilio POSTs here
  // on every Status transition of a message WE sent — queued, sent, delivered,
  // failed, undelivered.
  //
  // This is NOT a log sink. Error 21610 ("Attempt to send to unsubscribed
  // recipient") means Twilio is holding an opt-out that our ledger does not
  // have — the recipient replied STOP through a path that never reached us
  // (before this webhook existed, via Twilio's Advanced Opt-Out, or to a
  // different sender in the Messaging Service). Every send to that number will
  // keep failing while our own guard believes they are contactable. Mirroring
  // the code into the ledger converges the two, and it is the ledger that
  // evaluateOutboundSms actually reads.
  //
  // Authenticated exactly like the inbound webhook, with one difference that
  // matters: the signature covers the URL Twilio was configured with, and this
  // endpoint's URL is NOT the inbound one. It therefore pins
  // TWILIO_STATUS_CALLBACK_URL, never TWILIO_WEBHOOK_URL — inheriting the
  // inbound pin would produce a signature that can never match.
  //
  // Responds 204 with no body. Twilio ignores the body of a status callback,
  // and TwiML returned here would be an error. What Twilio does watch is the
  // status code: sustained non-2xx marks the webhook unhealthy.
  app.post("/api/webhooks/sms/status", async (req, res) => {
    try {
      const contentType = req.headers["content-type"] ?? "";
      const isForm = contentType.includes("urlencoded") || contentType.includes("multipart/form-data");
      const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : null;

      const auth = evaluateTwilioWebhookAuth({
        authToken: process.env.TWILIO_AUTH_TOKEN,
        isProduction: process.env.NODE_ENV === "production",
        signature: req.headers["x-twilio-signature"],
        urls: candidateWebhookUrls(req, {
          configuredUrl: process.env.TWILIO_STATUS_CALLBACK_URL ?? null,
          defaultPath: "/api/webhooks/sms/status",
        }),
        params: (req.body ?? {}) as Record<string, unknown>,
        rawBody,
        isForm,
      });

      if (!auth.ok) {
        console.error(`[webhooks] SMS status callback rejected: ${auth.reason}`);
        captureMessage("SMS status callback rejected", "warning", {
          reason: auth.reason,
          status: auth.status,
          // Deliberately no MessageSid or phone number: a rejected request is
          // unverified input, and To is borrower PII.
        });
        return res
          .status(auth.status)
          .json({ error: auth.status === 503 ? "Webhook not configured" : "Invalid webhook signature" });
      }

      const event = parseMessageStatusEvent((req.body ?? {}) as Record<string, unknown>);
      const { outcome, recordOptOut } = classifyMessageStatus(event);

      if (recordOptOut) {
        // keyword is null on purpose: no one typed a keyword at us. The opt-out
        // is inferred from a carrier-level rejection, and source records that
        // provenance honestly rather than dressing it up as an inbound STOP.
        await storage.setSmsOptOut({
          phone: event.to!,
          optedOut: true,
          keyword: null,
          source: "twilio_status_callback",
        });
        // Best-effort cleanup, same posture as the inbound STOP path: the ledger
        // row is what suppresses sending, so a sweep failure must not lose it.
        try {
          await storage.applyLeadContactabilityByPhone(event.to!, true);
        } catch (sweepError) {
          console.error("Status-callback opt-out recorded but the lead sweep failed:", sweepError);
          captureMessage("SMS status-callback opt-out lead sweep failed", "error", {
            error: sweepError instanceof Error ? sweepError.message : String(sweepError),
          });
        }
      } else if (outcome === "failed") {
        // Not consent-related — an operational failure worth surfacing so a
        // systematically undeliverable sender or number gets noticed. MessageSid
        // only: it is an opaque Twilio id, and the recipient number is PII.
        captureMessage("Outbound SMS delivery failed", "warning", {
          messageSid: event.messageSid ?? "unknown",
          status: event.status ?? "unknown",
          errorCode: event.errorCode ?? "none",
        });
      }

      return res.status(204).end();
    } catch (error) {
      console.error("SMS status callback error:", error);
      res.status(500).json({ error: "Failed to process SMS status callback" });
    }
  });
}
