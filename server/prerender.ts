import type { NextFunction, Request, Response } from "express";

import { BOT_UA_REGEX } from "@shared/seo/botUserAgents";

type RenderSeoDocument = (
  pathname: string,
  origin?: string,
) => Promise<{ html: string | null; status: number; noindex?: boolean }>;

/**
 * Bot-prerender trigger — decides which document requests reach the SEO
 * renderer. Every guard is load-bearing:
 *
 *   - GET only — the renderer serves documents, never accepts state.
 *   - not /api/ — API routes answer for themselves (and register earlier).
 *   - no dot anywhere in the path — mirrors the rewrite's `(?!.*\.)`. Anything
 *     dotted is a file request and must fall through to express.static /
 *     Vite; without this guard the middleware swallows /assets/*.js,
 *     /favicon.png and robots.txt as injected HTML (the documented ordering
 *     trap that once kept the catch-all gated behind a platform env var).
 *   - bot UA only — humans keep the fast static SPA path (dynamic rendering
 *     of equivalent content, not cloaking).
 *
 * Mount ordering is the other half of the contract: directly ahead of
 * express.static (prod) / vite.middlewares (dev) — see registerSeoRoutes,
 * which deliberately does NOT mount it. The response shape
 * (status passthrough, X-Robots-Tag on noindex, 502 on a missing template,
 * 500 on a render throw) is identical to the /api/seo/render endpoint's.
 *
 * The factory seam exists for tests/seoPrerender.test.ts, which injects a
 * stub renderer instead of standing up a built dist/ template; production
 * wiring (server/routes/seo.ts) passes the real renderSeoDocument.
 */
export function makePrerenderMiddleware(render: RenderSeoDocument) {
  return function prerender(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.includes(".")) {
      next();
      return;
    }
    const userAgent = req.headers["user-agent"];
    if (!userAgent || !BOT_UA_REGEX.test(userAgent)) {
      next();
      return;
    }
    void (async () => {
      try {
        const origin = `${req.protocol}://${req.get("host")}`;
        const { html, status, noindex } = await render(req.path, origin);
        if (!html) {
          res.status(502).send("SEO render unavailable");
          return;
        }
        if (noindex) res.set("X-Robots-Tag", "noindex");
        res
          .status(status)
          .set("Content-Type", "text/html; charset=utf-8")
          .set("Cache-Control", "public, max-age=300")
          .send(html);
      } catch (err) {
        console.error("SEO document render error:", err);
        res.status(500).send("SEO render error");
      }
    })();
  };
}
