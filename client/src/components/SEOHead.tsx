import { useEffect } from "react";
import { COMPANY_IDENTITY } from "@shared/companyIdentity";

// Keep DEFAULT_TITLE in sync with the static <title> in client/index.html so the
// title the crawler sees before hydration matches what SEOHead resets to.
const SITE_NAME = "Homiquity";
const DEFAULT_TITLE = "Homiquity - Clarity for Every Stage of Homeownership";
const SITE_URL = COMPANY_IDENTITY.siteUrl;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

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
}

/** Resolve a relative path against the canonical site URL; pass absolute through. */
function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export function SEOHead({ title, description, ogImage, ogType = "website", canonical }: SEOHeadProps) {
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

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, ogImage, ogType, canonical]);

  return null;
}
