import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * In-process micro-cache for GET endpoints that serve semi-static, public data
 * (rate sheets, learning-center content). Two layers:
 *
 * 1. A short server-side TTL cache keyed on the full URL, so bursts of anonymous
 *    traffic collapse to one DB read per key per window. Bounded (LRU-ish:
 *    oldest entry evicted at capacity) so an unbounded query space (e.g. many
 *    zip codes) can't grow it without limit.
 * 2. A Cache-Control header so the browser and any CDN in front of the app can
 *    reuse the response too (s-maxage targets shared/CDN caches;
 *    stale-while-revalidate lets a CDN serve slightly-stale data instantly).
 *
 * Only mount on routes with NO per-request side effects and NO auth-varying
 * output — never on endpoints that increment view counts or read the session.
 * On serverless the cache is per-instance, which is fine for read-heavy public
 * data: each instance warms independently and the header still enables CDN reuse.
 */

interface CacheEntry {
  body: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 500;

export function microCache(ttlSeconds: number): RequestHandler {
  const store = new Map<string, CacheEntry>();
  const ttlMs = ttlSeconds * 1000;

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();

    const key = req.originalUrl;
    const now = Date.now();
    const hit = store.get(key);

    if (hit && hit.expiresAt > now) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader(
        "Cache-Control",
        `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`,
      );
      return res.json(hit.body);
    }
    // Drop an expired entry so it doesn't count against capacity.
    if (hit) store.delete(key);

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only cache successful responses; errors must not be sticky.
      if (res.statusCode === 200) {
        if (store.size >= MAX_ENTRIES) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { body, expiresAt: Date.now() + ttlMs });
      }
      res.setHeader("X-Cache", "MISS");
      res.setHeader(
        "Cache-Control",
        `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`,
      );
      return originalJson(body);
    };

    next();
  };
}
