/**
 * Twilio message STATUS CALLBACK handling — the delivery-receipt side of SMS.
 *
 * Two different Twilio webhooks point at this app and they are easy to confuse:
 *   - `/api/webhooks/sms`        — INBOUND messages people send us (STOP/START/HELP)
 *   - `/api/webhooks/sms/status` — delivery receipts for messages WE send
 *
 * Facts below are from Twilio's Message Resource documentation
 * (https://www.twilio.com/docs/messaging/api/message-resource, read 2026-08-06):
 *
 *   - Whenever a Message's Status changes, Twilio POSTs the StatusCallback URL
 *     with a subset of the standard request properties plus `MessageStatus` and
 *     `ErrorCode`.
 *   - The documented statuses are `queued`, `failed`, `sent`, `delivered`,
 *     `undelivered`.
 *   - `ErrorCode` is populated when the status is `failed` or `undelivered`.
 *
 * Twilio explicitly warns in that same document that the property set "varies by
 * messaging channel and event type and [is] subject to change", and that they
 * "occasionally add new properties without advance notice". That shapes the
 * design here more than anything else: parsing is DELIBERATELY permissive. An
 * unrecognized status is carried through as-is rather than rejected, because
 * returning 4xx to Twilio for a status they just introduced would mark the
 * webhook as failing and, on repeated failures, get delivery attempts throttled.
 * Signature verification is the security boundary; the parser is not.
 */

import { normalizePhone } from "./smsCompliance";

/**
 * "Attempt to send to unsubscribed recipient" —
 * https://www.twilio.com/docs/api/errors/21610 (read 2026-08-06). Twilio returns
 * this when the destination has replied STOP to one of our previous messages;
 * sends keep failing until they reply START.
 *
 * This is the one error code with a compliance consequence rather than an
 * operational one, and it is why this endpoint is not merely a log sink: it
 * means TWILIO knows about an opt-out that OUR ledger does not. Reconciling the
 * two is what `recordOptOut` below drives.
 */
export const OPT_OUT_ERROR_CODE = "21610";

/** Statuses that mean the message will not be delivered. */
export const FAILURE_STATUSES = new Set(["failed", "undelivered"]);

/** Statuses that mean the message reached the handset. */
export const DELIVERED_STATUSES = new Set(["delivered"]);

/** Statuses that are still in flight — informational, no action. */
export const IN_FLIGHT_STATUSES = new Set(["queued", "accepted", "scheduled", "sending", "sent"]);

export type MessageStatusOutcome = "delivered" | "failed" | "in_flight" | "unknown";

export interface MessageStatusEvent {
  /** Twilio's SID for the message this receipt describes ("SM…"/"MM…"), if sent. */
  messageSid: string | null;
  /** Recipient, normalized to the ledger's digits-only form; null if unparseable. */
  to: string | null;
  /** Raw status string, lowercased. Never coerced into a closed enum — see header. */
  status: string | null;
  /** Error code as a string ("21610"); Twilio sends it numeric over JSON. */
  errorCode: string | null;
}

/**
 * Pull the fields we act on out of a status-callback payload.
 *
 * Accepts both Twilio's canonical PascalCase form fields and the lowercase
 * variants, mirroring the provider-agnostic shape the inbound webhook already
 * accepts so local/simulated testing does not need a Twilio signature.
 */
export function parseMessageStatusEvent(params: Record<string, unknown>): MessageStatusEvent {
  const str = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    // Repeated keys arrive as arrays from the urlencoded parser; take the first
    // rather than stringifying the whole array into nonsense.
    const single = Array.isArray(value) ? value[0] : value;
    if (single === null || single === undefined) return null;
    const text = typeof single === "string" ? single : String(single);
    const trimmed = text.trim();
    return trimmed === "" ? null : trimmed;
  };

  const rawTo = str(params.To ?? params.to ?? params.recipient);
  const status = str(params.MessageStatus ?? params.messageStatus ?? params.SmsStatus ?? params.status);

  return {
    messageSid: str(params.MessageSid ?? params.messageSid ?? params.SmsSid ?? params.sid),
    to: normalizePhone(rawTo),
    status: status ? status.toLowerCase() : null,
    errorCode: str(params.ErrorCode ?? params.errorCode ?? params.error_code),
  };
}

export interface MessageStatusClassification {
  outcome: MessageStatusOutcome;
  /**
   * True when this receipt proves the recipient is unsubscribed and our ledger
   * should be brought in line with Twilio's view.
   */
  recordOptOut: boolean;
}

/**
 * Decide what a receipt means and whether it carries an opt-out.
 *
 * The opt-out rule is deliberately narrow: error 21610 ONLY. Other failures are
 * not consent signals and must not suppress a number —
 *   - 30003/30005 (unreachable/unknown destination) are handset or routing
 *     facts, not a withdrawal of consent;
 *   - 30004 ("Message blocked") can be carrier filtering, a landline, or a
 *     powered-off device, per Twilio's own listed causes, and treating it as
 *     opt-out would silently suppress borrowers who never asked to be.
 *
 * The write this enables only ever ADDS suppression — it can never re-subscribe
 * anyone — so the failure mode of being wrong is a borrower we stop texting,
 * not a borrower we text after they said stop. That asymmetry is why it is safe
 * to act on automatically, and why the inverse (auto-resubscribing on a
 * successful delivery) is not implemented and should not be.
 */
export function classifyMessageStatus(event: MessageStatusEvent): MessageStatusClassification {
  const status = event.status ?? "";
  const isFailure = FAILURE_STATUSES.has(status);

  const outcome: MessageStatusOutcome = isFailure
    ? "failed"
    : DELIVERED_STATUSES.has(status)
      ? "delivered"
      : IN_FLIGHT_STATUSES.has(status)
        ? "in_flight"
        : "unknown";

  // Require a usable phone number: an opt-out row keyed on null is not a record
  // of anything. Twilio pairs 21610 with a failure status, but the code is the
  // authority here — if a future status name accompanies it, the consent signal
  // is still real, so this does not additionally gate on `isFailure`.
  const recordOptOut = event.errorCode === OPT_OUT_ERROR_CODE && event.to !== null;

  return { outcome, recordOptOut };
}
