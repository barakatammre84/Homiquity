/**
 * Trust-proxy hop count, env-configurable for the persistent-host path.
 *
 * This governs `req.protocol` (and therefore secure-cookie behavior). One hop
 * (the platform's TLS-terminating LB) is the default; fronting the app with a
 * CDN adds a second, which TRUST_PROXY_HOPS=2 covers without a code change.
 * Parsed defensively: a missing, non-numeric, or negative value falls back to
 * 1 rather than throwing at boot or silently trusting everything.
 *
 * ⚠️ It does NOT govern client-IP identity any more, and no value of
 * TRUST_PROXY_HOPS can. Express derives `req.ip` from `X-Forwarded-For`, and
 * Railway's edge does not send that header (its spec lists `X-Real-IP`
 * instead), so `req.ip` is the socket peer — a rotating internal proxy
 * address. Rate limiting and every consent/audit IP go through
 * server/clientIp.ts, which reads `X-Real-IP`. Setting a hop count here to
 * "fix" an IP problem changes nothing except a maintainer's confidence.
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
