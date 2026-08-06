import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * The real client IP, on a host whose proxy does not speak X-Forwarded-For.
 *
 * WHY THIS EXISTS
 *
 * Express derives `req.ip` from `X-Forwarded-For` and nothing else. Railway's
 * edge does not send that header — its published request spec lists
 * `X-Real-IP` (client remote IP), `X-Forwarded-Proto`, `X-Forwarded-Host`,
 * `X-Railway-Edge`, `X-Request-Start` and `X-Railway-Request-Id`, with no XFF
 * at all. So `req.ip` silently falls back to the socket peer: a rotating
 * Railway internal address shared by every visitor on the internet.
 *
 * That was measured, not assumed. Ten sequential requests from ONE client
 * against a single-replica service returned `ratelimit-remaining`
 * 498,497,498,497,497,496,495,494,496,495 across `ratelimit-reset` values of
 * 866/836/835/834 — several independent counters where there should have been
 * exactly one. `req.ip` is not stable per client, so it is not a client
 * identity.
 *
 * Two things break as a result, and both are silent:
 *
 *   1. RATE LIMITING keys on the wrong thing. Visitors share buckets with
 *      strangers, so `emailCaptureLimiter` (5 per 15 min) is closer to a
 *      SITE-WIDE cap on waitlist signups than a per-visitor one, and
 *      `authLimiter` (20 per 15 min) is a shared allowance that protects
 *      nobody from a determined attacker while locking out real users.
 *   2. EVERY CAPTURED IP IS A PROXY ADDRESS — TCPA lead consent, borrower
 *      consents, E-SIGN consent, application submission, and every audit row.
 *      An IP that identifies our own infrastructure is not evidence of who
 *      consented, which is the entire reason those columns exist.
 *
 * WHY NOT TRUST_PROXY_HOPS
 *
 * `trustProxyHops()` is still correct and still used — it governs
 * `req.protocol` (and therefore secure cookies) via Express's trust-proxy
 * setting. But no hop count can help here: the header Express counts hops in
 * is never sent. Setting `TRUST_PROXY_HOPS` to any number would change
 * nothing except a maintainer's belief that this was handled.
 *
 * SECURITY
 *
 * `X-Real-IP` is set by Railway's edge, which is the only public ingress to
 * this service, and it overwrites any client-supplied value. Client-supplied
 * `X-Forwarded-For` is deliberately NOT read here: Railway discards it, and
 * honouring it would hand an attacker a free rate-limit-bucket generator and
 * a way to forge the consent IP on a regulated record. `req.ip` remains the
 * fallback so local dev, tests, and any future XFF-speaking proxy still work.
 */

/** Header Railway's edge uses for the client's remote IP. */
const REAL_IP_HEADER = "x-real-ip";

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  // A comma-joined value should not occur for X-Real-IP, but tolerate it
  // rather than storing "a, b" in a regulated consent column.
  return value?.split(",")[0]?.trim() || undefined;
}

/**
 * The client IP, or `undefined` when it genuinely cannot be determined.
 *
 * Returns `undefined` rather than a placeholder: a NULL consent IP is an
 * honest gap, while a proxy address recorded as the consenter is a false
 * record.
 */
export function clientIp(req: Request): string | undefined {
  return firstHeaderValue(req.headers[REAL_IP_HEADER]) ?? req.ip ?? undefined;
}

/**
 * Same value, truncated to fit the `varchar(64)` consent/audit columns.
 * IPv6 with a zone id can exceed that; truncating beats a write failure on a
 * consent record.
 */
export function clientIpForRecord(req: Request): string | null {
  return clientIp(req)?.slice(0, 64) ?? null;
}

/**
 * express-rate-limit key. Routed through `ipKeyGenerator` so IPv6 clients are
 * bucketed by subnet — without it a single IPv6 host can trivially rotate
 * addresses within its own /64 and bypass every limiter.
 */
export function rateLimitKey(req: Request): string {
  return ipKeyGenerator(clientIp(req) ?? "unknown");
}
