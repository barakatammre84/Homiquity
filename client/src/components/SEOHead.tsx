import { useEffect } from "react";
import { COMPANY_IDENTITY } from "@shared/companyIdentity";
import { DEFAULT_OG_IMAGE } from "@shared/seo/schema";

// Keep DEFAULT_TITLE in sync with the static <title> in client/index.html so the
// title the crawler sees before hydration matches what SEOHead resets to.
const SITE_NAME = "Homiquity";
const DEFAULT_TITLE = "Homiquity - Clarity for Every Stage of Homeownership";
const SITE_URL = COMPANY_IDENTITY.siteUrl;
// DEFAULT_OG_IMAGE is IMPORTED, not redeclared. It used to be a second, independent
// `${SITE_URL}/og-default.png` here — the client and the server-side prerenderer
// each holding their own copy of the same constant, free to drift. Nothing tests
// that they agree (tests/canonicalHost.test.ts pins the HOST, not the filename),
// so the drift would have shipped silently: crawlers unfurling one card and
// client-rendered pages another.

type JsonLd = Record<string, unknown>;

interface SEOHeadProps {
  title: string;
  description: string;
  /** Absolute URL or site-relative path ("/foo.png"). Defaults to the brand card. */
  ogImage?: string;
  ogType?: string;
  /**
   * Absolute URL or site-relative path ("/learn"). When omitted, SEOHead emits a
   * self-referencing canonical from the current path — so every page gets an
   * absolute canonical, not just the two that pass one explicitly.
   */
  canonical?: string;
  /**
   * JSON-LD structured data for the page (schema.org). A single node or an array;
   * null entries are dropped so callers can pass conditional builders inline.
   * The global Organization/WebSite nodes live statically in index.html.
   */
  jsonLd?: JsonLd | Array<JsonLd | null> | null;
}

/** Resolve a relative path against the canonical site URL; pass absolute through. */
function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Serialize page JSON-LD, escaping "<" so an article body can never break out of the script tag. */
function serializeJsonLd(jsonLd: SEOHeadProps["jsonLd"]): string {
  const items = (Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []).filter(Boolean) as JsonLd[];
  if (items.length === 0) return "";
  return JSON.stringify(items.length === 1 ? items[0] : items).replace(/</g, "\\u003c");
}

export function SEOHead({ title, description, ogImage, ogType = "website", canonical, jsonLd }: SEOHeadProps) {
  // Serialize once per render and depend on the string, so inline-built schema
  // objects (new identity each render) don't re-run the effect on every render.
  const jsonLdString = serializeJsonLd(jsonLd);

  useEffect(() => {
    const fullTitle = title.includes("Homiquity") ? title : `${title} | Homiquity`;
    document.title = fullTitle;

    const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
    const canonicalUrl = absoluteUrl(canonical ?? currentPath);
    const imageUrl = absoluteUrl(ogImage ?? DEFAULT_OG_IMAGE);

    const setMeta = (key: string, content: string) => {
      const isProperty = key.startsWith("og:");
      const selector = isProperty ? `meta[property="${key}"]` : `meta[name="${key}"]`;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(isProperty ? "property" : "name", key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);

    // Open Graph
    setMeta("og:title", fullTitle);
    setMeta("og:description", description);
    setMeta("og:type", ogType);
    setMeta("og:url", canonicalUrl);
    setMeta("og:site_name", SITE_NAME);
    setMeta("og:image", imageUrl);

    // Twitter Card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", imageUrl);

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalUrl;

    // JSON-LD (page-scoped; global Organization/WebSite are static in index.html)
    const existing = document.querySelector("script[data-page-jsonld]");
    if (jsonLdString) {
      let script = existing as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-page-jsonld", "");
        document.head.appendChild(script);
      }
      script.textContent = jsonLdString;
    } else if (existing) {
      existing.remove();
    }

    return () => {
      document.title = DEFAULT_TITLE;
      document.querySelector("script[data-page-jsonld]")?.remove();
    };
  }, [title, description, ogImage, ogType, canonical, jsonLdString]);

  return null;
}
