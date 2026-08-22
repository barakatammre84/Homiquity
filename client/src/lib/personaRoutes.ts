/**
 * Education → persona-funnel wiring.
 *
 * Migration 0052 gave articles a real loan-product taxonomy
 * (shared/loanProducts.ts) precisely so education content could be joined to
 * the conversion funnel — but until this module, every education CTA still
 * pointed at the generic /apply. This maps a piece of content's taxonomy to
 * the persona landing page that actually matches the reader's intent, so a
 * VA-loan article routes to /va-loans rather than discarding the strongest
 * intent signal the funnel gets for free.
 *
 * Persona pages are conversion surfaces and sit behind the pre-license gate
 * (see App.tsx / lib/prelaunch.ts) — callers must keep persona CTAs behind
 * the same `!PRELAUNCH_GATED` conditional they already use for /apply.
 */

import {
  parseDocMethods,
  parseProductFamilies,
  parseTransactionPurposes,
} from "@shared/loanProducts";

export type PersonaKey = "va" | "self-employed" | "refinance" | "first-time-buyer";

export interface PersonaRoute {
  href: string;
  /** CTA label — action-framed, no rate/approval language (Reg Z / Reg N). */
  ctaLabel: string;
}

export const PERSONA_ROUTES: Record<PersonaKey, PersonaRoute> = {
  va: { href: "/va-loans", ctaLabel: "Explore VA loan options" },
  "self-employed": { href: "/self-employed", ctaLabel: "Explore self-employed options" },
  refinance: { href: "/refinance", ctaLabel: "Explore refinance options" },
  "first-time-buyer": { href: "/first-time-buyer", ctaLabel: "Explore first-time buyer options" },
};

/** The taxonomy slice of an Article that persona routing reads. */
export interface ArticleTaxonomy {
  loanProductFamilies?: readonly string[] | null;
  transactionPurposes?: readonly string[] | null;
  docMethods?: readonly string[] | null;
}

/**
 * Pick the persona landing page for an article's classification, or null when
 * no persona page fits (the caller falls back to the generic /apply CTA).
 *
 * Priority is most-specific intent first — an article can legitimately span
 * axes (a VA cash-out guide is both "va" and a refi), and the narrower
 * audience wins because its landing page carries the more relevant trust
 * signals:
 *
 *   1. VA family → /va-loans (eligibility-defined audience, most specific)
 *   2. Non-QM family or any alternative-doc method → /self-employed
 *   3. Any refinance purpose → /refinance
 *   4. Purchase purpose or FHA family → /first-time-buyer, unless the
 *      families include jumbo/home_equity, which have no persona page
 *   5. Otherwise null — unclassified content stays on the generic CTA;
 *      guessing a persona is worse than admitting there isn't one
 */
export function personaForArticle(article: ArticleTaxonomy): PersonaKey | null {
  const families = parseProductFamilies(article.loanProductFamilies);
  const methods = parseDocMethods(article.docMethods);
  const purposes = parseTransactionPurposes(article.transactionPurposes);

  if (families.includes("va")) return "va";
  if (families.includes("non_qm") || methods.some((m) => m !== "full_doc")) {
    return "self-employed";
  }
  // Every non-purchase transaction purpose is a refinance variant.
  if (purposes.some((p) => p !== "purchase")) return "refinance";
  // Jumbo / home-equity purchase content has no matching persona page.
  if (families.includes("jumbo") || families.includes("home_equity")) return null;
  if (purposes.includes("purchase") || families.includes("fha")) {
    return "first-time-buyer";
  }
  return null;
}
