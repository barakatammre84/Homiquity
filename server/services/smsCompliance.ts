/**
 * SMS compliance helpers — phone normalization and inbound-keyword handling for
 * the STOP / START / HELP flow (TCPA §64.1200, CTIA Messaging Principles).
 *
 * The opt-out ledger (shared/schema smsOptOuts) plus the quiet-hours guard
 * (./quietHours) are the two controls an outbound SMS/dialer feature MUST honor
 * before sending. This module holds the dependency-free parts.
 */

import { isContactAllowed } from "./quietHours";

// CTIA-mandated opt-out keywords (case-insensitive, first word of the message).
const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);
// Opt back in.
const START_KEYWORDS = new Set(["START", "YES", "UNSTOP", "OPTIN"]);
// Help.
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

export type InboundKeyword = "stop" | "start" | "help" | "unknown";

export const OPT_OUT_CONFIRMATION =
  "You have been unsubscribed and will receive no further messages. Reply START to resubscribe.";
export const OPT_IN_CONFIRMATION =
  "You are resubscribed and will receive messages again. Reply STOP to unsubscribe.";
export const HELP_RESPONSE =
  "Homiquity Mortgage alerts. Reply STOP to unsubscribe, START to resubscribe. Msg&data rates may apply.";

/**
 * Normalize a raw phone string to digits-only US national form ("1XXXXXXXXXX").
 * Returns null when there aren't enough digits to be a US number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  // Drop a leading international "00" dialing prefix. Safe unconditionally: US
  // 10-digit numbers never start with 0 (area codes are 2xx–9xx).
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) return `1${digits}`; // add US country code
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return null;
}

/** Classify the first word of an inbound SMS body into an opt-out action. */
export function classifyKeyword(body: string | null | undefined): InboundKeyword {
  if (!body) return "unknown";
  // Providers sometimes wrap the keyword in punctuation ("STOP." / "\"STOP\"").
  const first = body.trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "").toUpperCase() ?? "";
  if (STOP_KEYWORDS.has(first)) return "stop";
  if (START_KEYWORDS.has(first)) return "start";
  if (HELP_KEYWORDS.has(first)) return "help";
  return "unknown";
}

/**
 * The single guard an outbound SMS/dialer feature must pass before sending:
 * the recipient must not be opted out AND it must be inside TCPA calling hours
 * in their local time. Caller supplies `optedOut` (from storage.isPhoneOptedOut)
 * and the recipient ZIP; kept pure so it's trivially testable.
 */
export function evaluateOutboundSms(opts: {
  optedOut: boolean;
  zip?: string | null;
  timezone?: string | null;
  now?: Date;
}): { canSend: boolean; reason: string } {
  if (opts.optedOut) return { canSend: false, reason: "Recipient has opted out of SMS (STOP)" };
  const quiet = isContactAllowed({ zip: opts.zip, timezone: opts.timezone, now: opts.now });
  return { canSend: quiet.allowed, reason: quiet.reason };
}
