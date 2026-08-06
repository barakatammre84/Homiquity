/**
 * Twilio inbound-webhook signature verification (`X-Twilio-Signature`).
 *
 * The scheme below is transcribed from Twilio's published algorithm
 * (https://www.twilio.com/docs/usage/webhooks/webhooks-security and
 * https://www.twilio.com/docs/usage/security, read 2026-08-06):
 *
 *   1. Take the full request URL Twilio was configured to call — protocol
 *      through the end of the query string.
 *   2. For a POST, sort the POST parameters by name, Unix-style case-sensitive
 *      (i.e. byte order, not locale order).
 *   3. Append each parameter's name and value to the URL string, no delimiters.
 *   4. HMAC-SHA1 the result, keyed with the account AUTH TOKEN.
 *   5. Base64-encode the digest and compare it to `X-Twilio-Signature`.
 *
 * For an `application/json` body Twilio sends no POST params: it appends a
 * `bodySHA256` query parameter to the signed URL, so the signature covers the
 * URL only and the body is authenticated by checking sha256(rawBody) against
 * that parameter. Skipping that second check would leave a JSON body
 * unauthenticated even with a valid signature, so it is mandatory here.
 *
 * Why not the `twilio` SDK: signature validation is the only thing we would use
 * it for, and the whole SMS surface is otherwise provider-agnostic. Twilio's
 * docs do recommend the SDK helpers, so the risk of hand-rolling — drifting
 * from the published algorithm — is pinned by testing against the worked
 * example Twilio publishes in that same document (see tests/twilioSignature).
 *
 * The AUTH TOKEN is the signing key. An API key secret (TWILIO_API_KEY_SECRET)
 * is NOT interchangeable with it: Twilio signs webhooks with the account's
 * primary auth token regardless of which credential the app authenticates with.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";

/** Query parameter Twilio adds to the signed URL when the body is JSON. */
const BODY_SHA256_PARAM = "bodySHA256";

/**
 * Build the base64 HMAC-SHA1 signature for a URL + POST parameter set.
 * Exported so tests can sign fixtures the way Twilio would.
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, unknown> = {},
): string {
  // Unix-style case-sensitive ordering — byte order, NOT localeCompare, which
  // would sort "a" before "B" and produce a signature that never matches.
  const names = Object.keys(params).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let payload = url;
  for (const name of names) {
    payload += name + stringifyParam(params[name]);
  }
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

/**
 * express's urlencoded parser yields `string` for the single-valued fields
 * Twilio actually sends. Arrays (repeated keys) and null are coerced the way
 * string concatenation would, so a hostile duplicate key cannot throw.
 */
function stringifyParam(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(stringifyParam).join(",");
  return typeof value === "string" ? value : String(value);
}

/** Constant-time signature comparison; false for any length mismatch. */
export function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  // timingSafeEqual throws on differing lengths, so length is compared first.
  // Signature length is not secret (it is a fixed-size base64 SHA-1 digest).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify the JSON-body hash Twilio puts in the signed URL's `bodySHA256`
 * parameter. Returns false when the parameter is absent: a JSON request whose
 * body is not covered by the signature must not be treated as authenticated.
 */
export function jsonBodyHashMatches(url: string, rawBody: string): boolean {
  let expected: string | null;
  try {
    expected = new URL(url).searchParams.get(BODY_SHA256_PARAM);
  } catch {
    return false;
  }
  if (!expected) return false;
  const actual = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return signaturesMatch(expected.toLowerCase(), actual);
}

/**
 * Candidate URLs to check the signature against.
 *
 * The signature covers the URL Twilio was *configured* with, so a proxy that
 * rewrites scheme or host will break verification and silently drop real
 * STOPs — a TCPA problem, not just an availability one. Two defences:
 *   - `TWILIO_WEBHOOK_URL` pins the exact configured URL when set;
 *   - otherwise the request is reconstructed from the forwarded headers, and
 *     the https form is also tried, since Twilio calls https in production
 *     while the proxy hands the app a plaintext hop.
 *
 * Trying several candidates does not weaken the check: each is a full HMAC
 * comparison against the same secret, and a caller without the auth token
 * cannot produce a valid signature for any host they name.
 */
export function candidateWebhookUrls(req: {
  originalUrl?: string;
  protocol?: string;
  headers: Record<string, unknown>;
  get?: (header: string) => string | undefined;
}): string[] {
  const urls: string[] = [];
  const push = (u: string | null | undefined) => {
    if (u && !urls.includes(u)) urls.push(u);
  };

  const configured = process.env.TWILIO_WEBHOOK_URL?.trim();
  const path = req.originalUrl ?? "/api/webhooks/sms";
  const queryIndex = path.indexOf("?");
  const query = queryIndex === -1 ? "" : path.slice(queryIndex);

  if (configured) {
    push(configured);
    // Twilio appends bodySHA256 to the configured URL for JSON bodies, so the
    // pinned URL alone would not match those requests.
    if (query && !configured.includes("?")) push(configured + query);
  }

  const headerValue = (name: string): string | undefined => {
    const raw = req.headers?.[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    // A comma-joined X-Forwarded-* list means several proxies appended; the
    // first entry is the client-facing hop, which is what Twilio called.
    return typeof value === "string" ? value.split(",")[0]?.trim() : undefined;
  };

  const host = headerValue("x-forwarded-host") ?? req.get?.("host") ?? headerValue("host");
  if (host) {
    const proto = headerValue("x-forwarded-proto") ?? req.protocol ?? "https";
    push(`${proto}://${host}${path}`);
    push(`https://${host}${path}`);
  }

  return urls;
}

export type TwilioWebhookAuth =
  | { ok: true; mode: "verified" | "unconfigured" }
  | { ok: false; status: 403 | 503; reason: string };

/**
 * The authorization decision for an inbound Twilio webhook, kept pure so the
 * policy is unit-testable without an HTTP server.
 *
 * Fail-closed posture mirrors `PLAID_WEBHOOK_SECRET` on
 * `/api/webhooks/plaid-assets`: in production an unset signing secret disables
 * the endpoint (503) rather than leaving it open. Outside production an unset
 * token keeps the provider-agnostic path usable for local testing — but a token
 * that IS set is always enforced, in every environment.
 */
export function evaluateTwilioWebhookAuth(input: {
  authToken: string | null | undefined;
  isProduction: boolean;
  signature: string | string[] | null | undefined;
  urls: string[];
  params: Record<string, unknown>;
  /** Raw request body — required when the request is JSON rather than a form. */
  rawBody?: string | null;
  isForm: boolean;
}): TwilioWebhookAuth {
  const authToken = input.authToken?.trim();

  if (!authToken) {
    if (input.isProduction) {
      return { ok: false, status: 503, reason: "TWILIO_AUTH_TOKEN is not configured" };
    }
    return { ok: true, mode: "unconfigured" };
  }

  const signature = Array.isArray(input.signature) ? input.signature[0] : input.signature;
  if (!signature) {
    return { ok: false, status: 403, reason: "missing X-Twilio-Signature header" };
  }

  // JSON bodies carry no POST params; the body is bound to the signature only
  // through the URL's bodySHA256 parameter, so both halves must hold.
  const params = input.isForm ? input.params : {};

  const matchedUrl = input.urls.find((url) => signaturesMatch(computeTwilioSignature(authToken, url, params), signature));
  if (!matchedUrl) {
    return { ok: false, status: 403, reason: "signature does not match request" };
  }

  if (!input.isForm) {
    const rawBody = input.rawBody ?? "";
    if (!jsonBodyHashMatches(matchedUrl, rawBody)) {
      return { ok: false, status: 403, reason: "JSON body does not match the signed bodySHA256" };
    }
  }

  return { ok: true, mode: "verified" };
}
