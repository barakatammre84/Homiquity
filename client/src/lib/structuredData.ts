/**
 * Client entry point for JSON-LD builders.
 *
 * The framework-free builders (Article, BreadcrumbList, FAQPage) live in
 * @shared/seo/schema so the server can reuse them for Phase 2 head injection.
 * Only the glossary DefinedTermSet builder lives here, because it depends on the
 * client-only glossary data module.
 */
export * from "@shared/seo/schema";

import { absoluteUrl, type JsonLd } from "@shared/seo/schema";
import { slugifyTerm, type GlossaryTerm } from "@/pages/education/glossaryData";

/** DefinedTermSet for the glossary. Skips pure cross-reference ("see X") entries. */
export function definedTermSetSchema(terms: GlossaryTerm[], path: string): JsonLd {
  const url = absoluteUrl(path);
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
