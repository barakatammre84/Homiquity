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
import type { Express } from "express";

import { storage } from "../storage";
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  type JsonLd,
} from "@shared/seo/schema";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  injectSeo,
  normalizePath,
  renderJsonLdScript,
  renderSeoHeadTags,
  resolveStaticMeta,
  STATIC_ROUTE_META,
  type ResolvedMeta,
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
}
