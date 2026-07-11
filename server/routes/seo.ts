/**
 * Server-side SEO head injection (roadmap Phase 2).
 *
 * The app is a client-rendered SPA, so non-JS crawlers and social scrapers (Bing,
 * LinkedIn, Facebook, Slack, iMessage, X, …) otherwise see the generic homepage
 * shell for every URL. This route re-serves the index.html shell with a correct
 * per-URL <head> (title/description/canonical/OG/Twitter + JSON-LD) built from the
 * same shared builders the client uses — so shares and non-JS indexing work.
 *
 * On Vercel, page HTML is served statically by the CDN (the function only sees
 * /api/*), so a vercel.json rewrite routes crawler/scraper user-agents to
 * /api/seo/render?path=<original>. Human traffic keeps the fast static path. This
 * is dynamic rendering (equivalent content, just pre-rendered head) — not cloaking.
 */
import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";

import { storage } from "../storage";
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  type JsonLd,
} from "@shared/seo/schema";
import {
  buildSitemapXml,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  injectSeo,
  normalizePath,
  renderJsonLdScript,
  renderSeoHeadTags,
  resolveStaticMeta,
  STATIC_ROUTE_META,
  type ResolvedMeta,
  type SitemapArticle,
} from "@shared/seo/routeMeta";

let cachedTemplate: string | null = null;

/**
 * Load the index.html shell to inject into. Disk first (client/index.html in dev,
 * dist/public/index.html when self-hosted); on Vercel the function can't reach the
 * static asset on disk, so fall back to fetching the CDN-served /index.html.
 */
async function loadTemplate(origin?: string): Promise<string | null> {
  if (cachedTemplate) return cachedTemplate;
  // Dev serves from source (client/index.html); a built/self-hosted prod serves the
  // hashed-asset shell (dist/public/index.html). Order by env so each picks the right one.
  const isDev = process.env.NODE_ENV === "development";
  const candidates = isDev
    ? [
        path.resolve(process.cwd(), "client/index.html"),
        path.resolve(import.meta.dirname, "../../client/index.html"),
      ]
    : [
        path.resolve(process.cwd(), "dist/public/index.html"),
        path.resolve(import.meta.dirname, "../public/index.html"),
      ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        cachedTemplate = await fs.promises.readFile(candidate, "utf-8");
        return cachedTemplate;
      }
    } catch {
      /* try the next candidate */
    }
  }
  if (origin) {
    try {
      const res = await fetch(new URL("/index.html", origin));
      if (res.ok) {
        cachedTemplate = await res.text();
        return cachedTemplate;
      }
    } catch {
      /* fall through to null */
    }
  }
  return null;
}

/** Resolve a path to a fully-injected HTML document + HTTP status. */
export async function renderSeoDocument(
  pathname: string,
  origin?: string,
): Promise<{ html: string | null; status: number }> {
  const p = normalizePath(pathname);
  const template = await loadTemplate(origin);
  if (!template) return { html: null, status: 502 };

  // Article route: /learn/:slug (not the /learn hub or the first-time-buyer sub-hub).
  const articleMatch = p.match(/^\/learn\/([^/]+)$/);
  if (articleMatch && !STATIC_ROUTE_META[p] && articleMatch[1] !== "first-time-buyer") {
    const article = await storage.getArticleBySlug(articleMatch[1]);
    if (article && article.status === "published") {
      const categories = await storage.getActiveContentCategories();
      const category = categories.find((c) => c.id === article.categoryId);
      const meta: ResolvedMeta = {
        title: article.metaTitle || article.title,
        description:
          article.excerpt ||
          article.metaDescription ||
          `${article.title} — mortgage guidance from Homiquity's Learning Center.`,
        canonicalPath: p,
        ogType: "article",
        ogImage: article.featuredImage || undefined,
      };
      const jsonLd = renderJsonLdScript([
        articleSchema(article, category, p),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Learning Center", path: "/learn" },
          { name: article.title, path: p },
        ]),
      ]);
      return { html: injectSeo(template, renderSeoHeadTags(meta), jsonLd), status: 200 };
    }
    // Unknown/unpublished slug: 404 metadata; the SPA renders its own not-found body.
    const meta: ResolvedMeta = {
      title: "Article Not Found",
      description: "The article you're looking for doesn't exist or has been removed.",
      canonicalPath: p,
    };
    return { html: injectSeo(template, renderSeoHeadTags(meta), ""), status: 404 };
  }

  // Static registry route.
  const staticMeta = resolveStaticMeta(p);
  if (staticMeta) {
    const nodes: Array<JsonLd | null> = [];
    if (p === "/faq") {
      nodes.push(faqPageSchema(await storage.getPublishedFaqs()));
      nodes.push(breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "FAQ", path: "/faq" },
      ]));
    } else if (p !== "/") {
      const pageName = staticMeta.title.split(" — ")[0].split(" | ")[0];
      nodes.push(breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: pageName, path: p },
      ]));
    }
    return {
      html: injectSeo(template, renderSeoHeadTags(staticMeta), renderJsonLdScript(nodes)),
      status: 200,
    };
  }

  // Unknown/gated route: serve the shell with default metadata (the SPA handles routing/404).
  const meta: ResolvedMeta = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: p,
  };
  return { html: injectSeo(template, renderSeoHeadTags(meta), ""), status: 200 };
}

/** Serve the DB-driven sitemap: static registry routes + published article slugs. */
async function handleSitemap(_req: Request, res: Response) {
  try {
    const articles = await storage.getPublishedArticles();
    const items: SitemapArticle[] = articles.map((a) => {
      const dateValue = a.updatedAt ?? a.publishedAt ?? null;
      return {
        slug: a.slug,
        lastmod: dateValue ? new Date(dateValue as unknown as string).toISOString().slice(0, 10) : undefined,
      };
    });
    res
      .set("Content-Type", "application/xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .send(buildSitemapXml(items));
  } catch (err) {
    console.error("sitemap render error:", err);
    res.status(500).type("text/plain").send("sitemap error");
  }
}

export function registerSeoRoutes(app: Express) {
  app.get("/api/seo/render", async (req, res) => {
    try {
      const rawPath = typeof req.query.path === "string" && req.query.path ? req.query.path : "/";
      const origin = `${req.protocol}://${req.get("host")}`;
      const { html, status } = await renderSeoDocument(rawPath, origin);
      if (!html) {
        res.status(502).send("SEO render unavailable");
        return;
      }
      res
        .status(status)
        .set("Content-Type", "text/html; charset=utf-8")
        .set("Cache-Control", "public, max-age=300")
        .send(html);
    } catch (err) {
      console.error("SEO render error:", err);
      res.status(500).send("SEO render error");
    }
  });

  // Dynamic sitemap. Registered at the clean /sitemap.xml (served by Express in
  // dev, and on Vercel via the vercel.json "/sitemap.xml -> /api" rewrite which
  // preserves the path) and /api/sitemap.xml (the always-reachable /api form).
  app.get("/sitemap.xml", handleSitemap);
  app.get("/api/sitemap.xml", handleSitemap);

  // On Vercel the single serverless function is reached only via /api/* plus the
  // paths the vercel.json rewrites forward here with the original path preserved
  // (the bot-user-agent document rewrite). Render per-URL SEO for any such
  // non-API document GET. Gated to Vercel so it never shadows the dev/self-host
  // SPA catch-all (setupVite / serveStatic), which serve the real app to humans.
  if (process.env.VERCEL) {
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      void (async () => {
        try {
          const origin = `${req.protocol}://${req.get("host")}`;
          const { html, status } = await renderSeoDocument(req.path, origin);
          if (!html) {
            res.status(502).send("SEO render unavailable");
            return;
          }
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
    });
  }
}
