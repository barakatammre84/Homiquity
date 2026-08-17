import type { LoanProductFamily, TransactionPurpose } from "@shared/loanProducts";

export interface PersonaRoute {
  href: string;
  label: string;
  testid: string;
}

/**
 * Persona conversion pages an article's product-affinity classification maps
 * to. This is the article→persona half of the content↔conversion wiring; the
 * persona→article half already ships via `RelatedGuides`.
 *
 * Deliberately narrower than the classification vocabulary: `conventional` /
 * `fha` + `purchase` would match nearly every article (almost all purchase
 * content is conventional), so only the affinities that identify a specific
 * persona route are mapped. An unmapped classification renders nothing.
 */
const REFI_PURPOSES: readonly TransactionPurpose[] = [
  "rate_term_refi",
  "cash_out_refi",
  "streamline_refi",
];

export function personaRoutesForArticle(
  families: readonly string[] | null | undefined,
  purposes: readonly string[] | null | undefined,
): PersonaRoute[] {
  const routes: PersonaRoute[] = [];
  if (families?.includes("va" satisfies LoanProductFamily)) {
    routes.push({ href: "/va-loans", label: "Explore VA loans", testid: "button-persona-va" });
  }
  if (families?.includes("non_qm" satisfies LoanProductFamily)) {
    routes.push({
      href: "/self-employed",
      label: "Self-employed mortgage options",
      testid: "button-persona-self-employed",
    });
  }
  if (purposes?.some((p) => (REFI_PURPOSES as readonly string[]).includes(p))) {
    routes.push({ href: "/refinance", label: "Explore refinancing", testid: "button-persona-refinance" });
  }
  return routes;
}
