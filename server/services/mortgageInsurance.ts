// ---------------------------------------------------------------------------
// Monthly mortgage insurance for a priced offer, by product type (F-087).
//
// The wholesale pricing adapter used to charge a flat 0.6%/yr above 80 LTV on
// EVERY product — a VA offer at 92% LTV showed $184/mo of MI that does not
// exist, an FHA offer at 79% LTV showed $0 while MIP is charged, and the
// CONVENTIONAL_PMI matrix figure the same function had already resolved was
// discarded. This module is the one product-aware answer.
//
// Figures:
//   - Conventional-style products (CONVENTIONAL / JUMBO / ARM, and the
//     default for unrecognized types): the caller passes the matrix-resolved
//     monthly PMI from calculateLLPA (server/pricing.ts lookupPMIRate —
//     CONVENTIONAL_PMI matrix; 0 at or below the 80-LTV trigger, loud failure
//     on a missing band). No rate constant lives here.
//   - VA / HELOC: no monthly MI, at any LTV.
//   - FHA: annual MIP at ALL LTVs — 0.85%/yr above 95 LTV, 0.80%/yr at or
//     below. ⚠️ These mirror the borrower scenario surface
//     (loanAnalysis.buildScenario), which carries the same branch inline —
//     one figure on both borrower surfaces. HUD sets MIP by mortgagee letter
//     and docs/ holds no authoritative copy, so this mirrors the platform's
//     existing figure rather than asserting current HUD policy (flagged in
//     the regulatory ledger's spirit: verify against the ML before the first
//     real FHA delivery). Migrate loanAnalysis's inline copy here once the
//     in-flight loan-options PRs land (kept separate to avoid cross-PR
//     conflicts on that file).
// ---------------------------------------------------------------------------

/** FHA annual MIP, monthly — same tiering as the borrower scenario cards. */
export function fhaMonthlyMIP(loanAmount: number, ltvPct: number): number {
  return (loanAmount * (ltvPct > 95 ? 0.0085 : 0.008)) / 12;
}

export interface OfferMIInputs {
  /** Rate-sheet product type: CONVENTIONAL | FHA | VA | JUMBO | ARM | HELOC … */
  productType: string;
  loanAmount: number;
  ltvPct: number;
  /** Matrix-resolved conventional monthly PMI (calculateLLPA's pricing.pmiMonthlyPayment). */
  conventionalMonthlyPMI: number;
}

/** Monthly MI for one wholesale offer, by product. */
export function offerMonthlyMI(inputs: OfferMIInputs): number {
  const product = inputs.productType.toUpperCase();
  if (product === "VA" || product === "HELOC") return 0;
  if (product === "FHA") return fhaMonthlyMIP(inputs.loanAmount, inputs.ltvPct);
  // Conventional, jumbo, ARM, and anything unrecognized: the matrix figure,
  // which is already 0 at or below the 80-LTV trigger.
  return inputs.conventionalMonthlyPMI;
}
