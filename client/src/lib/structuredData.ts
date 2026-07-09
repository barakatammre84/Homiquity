/**
 * JSON-LD (schema.org) builders for public pages.
 *
 * Pure functions returning plain objects — no React, no DOM — so the same
 * builders can be reused server-side by the Phase 2 edge head-injection layer.
 * Injected on the client via <SEOHead jsonLd={...} />.
 *
 * The global Organization + WebSite nodes live statically in client/index.html
 * (so non-JS crawlers see the entity on every route). Their @id values are
 * mirrored here as ORG_ID / WEBSITE_ID so per-page schemas can reference them
 * instead of re-declaring the publisher — one connected graph.
 *
 * Compliance: descriptions here are marketing copy on a public surface. Keep
 * them free of Reg Z trigger terms (rates, payments, "as low as X%") and Reg N
 * approval/guarantee language. Never emit an NMLS identifier while it is PENDING.
 */
import { COMPANY_IDENTITY } from "@shared/companyIdentity";
import type { Article, ContentCategory, Faq } from "@shared/schema";
import { slugifyTerm, type GlossaryTerm } from "@/pages/education/glossaryData";

type JsonLd = Record<string, unknown>;

const SITE_URL = COMPANY_IDENTITY.siteUrl;
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

/** @id of the Organization/WebSite nodes declared statically in index.html. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

function abs(pathOrUrl: string): string {
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
      item: abs(c.path),
    })),
  };
}

/** BlogPosting schema for a single Learning Center article. */
export function articleSchema(article: Article, category: ContentCategory | undefined, path: string): JsonLd {
  const url = abs(path);
  const published = toIso(article.publishedAt);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt || article.metaDescription || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: abs(article.featuredImage || DEFAULT_IMAGE),
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

/** DefinedTermSet for the glossary. Skips pure cross-reference ("see X") entries. */
export function definedTermSetSchema(terms: GlossaryTerm[], path: string): JsonLd {
  const url = abs(path);
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": url,
    name: "Mortgage & Homeownership Glossary",
    url,
    hasDefinedTerm: terms
      .filter((t) => !t.see)
      .map((t) => ({
        "@type": "DefinedTerm",
        name: t.term,
        description: t.definition,
        inDefinedTermSet: url,
        url: `${url}#${slugifyTerm(t.term)}`,
      })),
  };
}
