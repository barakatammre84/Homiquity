/**
 * schema.org (JSON-LD) builders — pure, framework-free, dependency-light so BOTH
 * the client (SEOHead) and the server (Phase 2 head injection in server/seo) can
 * build the exact same structured data. No React, no DOM, no client-only imports.
 *
 * The global Organization + WebSite nodes live statically in client/index.html;
 * their @ids are mirrored here (ORG_ID / WEBSITE_ID) so per-page schemas link to
 * them instead of re-declaring the publisher — one connected graph.
 *
 * Compliance: descriptions are marketing copy on a public surface — keep them free
 * of Reg Z trigger terms (rates/payments/"as low as X%") and Reg N approval or
 * guarantee language. Never emit an NMLS identifier while it is PENDING.
 *
 * The glossary DefinedTermSet builder stays in client/src/lib/structuredData.ts
 * because it depends on the client-only glossary data module.
 */
import { COMPANY_IDENTITY } from "../companyIdentity";
import type { Article, ContentCategory, Faq } from "../schema";

export type JsonLd = Record<string, unknown>;

export const SITE_URL = COMPANY_IDENTITY.siteUrl;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

/** @id of the Organization/WebSite nodes declared statically in index.html. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Resolve a relative path against the canonical site URL; pass absolute through. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export interface Crumb {
  name: string;
  path: string;
}

/** BreadcrumbList for a page's position in the site hierarchy. */
export function breadcrumbSchema(crumbs: Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

/** BlogPosting schema for a single Learning Center article. */
export function articleSchema(article: Article, category: ContentCategory | undefined, path: string): JsonLd {
  const url = absoluteUrl(path);
  const published = toIso(article.publishedAt);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt || article.metaDescription || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: absoluteUrl(article.featuredImage || DEFAULT_OG_IMAGE),
    datePublished: published,
    dateModified: toIso(article.updatedAt) || published,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
    articleSection: category?.name || undefined,
    keywords: article.tags && article.tags.length ? article.tags.join(", ") : undefined,
  };
}

/**
 * FAQPage schema. Caller passes the already-published public FAQ list; returns
 * null when empty so nothing is emitted.
 */
export function faqPageSchema(faqs: Faq[]): JsonLd | null {
  if (!faqs || faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * WebApplication schema for a free interactive tool (calculator pages).
 *
 * `offers: $0` states the tool itself is free to use — it is not a credit
 * term, so it carries no Reg Z trigger exposure. Keep `name`/`description`
 * mirroring the page's SEOHead copy so the head and the graph agree.
 */
export function webApplicationSchema(opts: { name: string; description: string; path: string }): JsonLd {
  const url = absoluteUrl(opts.path);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${url}#webapp`,
    name: opts.name,
    description: opts.description,
    url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@id": ORG_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}
