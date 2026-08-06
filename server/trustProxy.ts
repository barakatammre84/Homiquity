/**
 * Trust-proxy hop count, env-configurable for the persistent-host path.
 *
 * `req.ip` feeds the TCPA/audit IP capture (server/auditLog.ts, borrower
 * consents, lead intake) and the per-IP rate limiters, and `req.protocol`
 * drives secure-cookie behavior — all of it is wrong if the hop count does
 * not match the real proxy chain. One hop (the platform's TLS-terminating
 * LB) is the default; fronting the app with a CDN adds a second, which
 * TRUST_PROXY_HOPS=2 covers without a code change. Parsed defensively: a
 * missing, non-numeric, or negative value falls back to 1 rather than
 * throwing at boot or silently trusting everything.
 *
 * Both trust-proxy call sites (server/app.ts and the defensive re-set in
 * server/integrations/auth/session.ts) MUST read this one function — two
 * literals drifted is how an IP-capture bug ships.
 */
export function trustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}
