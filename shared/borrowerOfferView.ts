/**
 * Borrower-facing market-offer view — the masked read model behind
 * GET /api/loan-applications/:id/offers for client-role callers.
 *
 * Borrower transparency doctrine (2026-07-08): wholesale-lender identity is
 * NEVER exposed to borrowers. Borrowers see neutral option labels
 * ("Option A — 30-Year Fixed Conventional"); which lender is behind an option
 * is broker-side information (staff roles keep the full ComputedOffer).
 *
 * Every mapper here is a strict whitelist. The raw ComputedOffer carries
 * lenderName / lenderCode / lenderId, free-text product names off vendor rate
 * sheets, lender fee schedules, and eligibility overlays that must never reach
 * the borrower payload. A new field is exposed by adding it to the view
 * interface deliberately — never by spreading the offer.
 *
 * Lives in shared/ because it is pure and dependency-free at runtime: the
 * server maps offers through it, the client imports the view types, and the
 * unit suite exercises it without a database.
 */

/**
 * Structural subset of server ComputedOffer (services/pricingAdapter.ts) that
 * the mapper reads. Declared here rather than imported because shared/ must
 * not import from server/. lenderName/lenderCode are consumed only to scrub
 * free-text adjustment names, then dropped.
 */
export interface MaskableOffer {
  lenderName: string;
  lenderCode: string;
  productType: string;
  loanTerm: number;
  amortizationType: string | null;
  adjustedRate: number;
  lockTerm: number;
  pricingBreakdown: {
    baseRate: number;
    llpaAdjustment: number;
    lockTermAdjustment: number;
    lenderAdjustments: { name: string; value: number }[];
    totalAdjustments: number;
    finalRate: number;
  };
  estimatedMonthlyPI: number;
  estimatedMonthlyMI: number;
  estimatedMonthlyTotal: number;
  labels: string[];
}

export interface BorrowerOfferView {
  /** Stable key within one response ("A", "B", …) — carries no lender linkage. */
  optionId: string;
  /** "Option A" — the borrower-facing identity of this offer. */
  optionLabel: string;
  /** "30-Year Fixed Conventional" — derived from enums, never vendor free text. */
  productLabel: string;
  productType: string;
  loanTerm: number;
  adjustedRate: number;
  lockTerm: number;
  pricingBreakdown: {
    baseRate: number;
    llpaAdjustment: number;
    lockTermAdjustment: number;
    lenderAdjustments: { name: string; value: number }[];
    totalAdjustments: number;
    finalRate: number;
  };
  estimatedMonthlyPI: number;
  estimatedMonthlyMI: number;
  estimatedMonthlyTotal: number;
  labels: string[];
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  CONVENTIONAL: "Conventional",
  FHA: "FHA",
  VA: "VA",
  JUMBO: "Jumbo",
  ARM: "ARM",
  NON_QM: "Non-QM",
};

/** "SOME_TYPE" → "Some Type" — fallback for product types without curated copy. */
function humanizeProductType(productType: string): string {
  return productType
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** 0 → "A", 25 → "Z", 26 → "AA" — spreadsheet-column lettering. */
export function optionLetter(index: number): string {
  let s = "";
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Neutral product label from typed columns only. Vendor rate sheets set
 * productName free-text (which may embed lender branding), so the borrower
 * label is rebuilt from productType + loanTerm + amortizationType instead.
 */
export function productLabelFor(
  offer: Pick<MaskableOffer, "productType" | "loanTerm" | "amortizationType">,
): string {
  const termLabel =
    offer.loanTerm % 12 === 0 ? `${offer.loanTerm / 12}-Year` : `${offer.loanTerm}-Month`;
  const isArm = offer.amortizationType === "ARM" || offer.productType === "ARM";
  if (isArm) return `${termLabel} Adjustable-Rate (ARM)`;
  const typeLabel = PRODUCT_TYPE_LABELS[offer.productType] ?? humanizeProductType(offer.productType);
  return `${termLabel} Fixed ${typeLabel}`;
}

/**
 * Lender pricing-adjustment names are free text off the lender's sheet
 * ("SWL preferred-partner rate credit"). Replace any occurrence of the
 * lender's registered name or code with a neutral word before the string can
 * reach a borrower. Identifiers under 3 characters are skipped so a
 * degenerate code cannot mangle ordinary words.
 */
function scrubLenderIdentity(text: string, identifiers: readonly string[]): string {
  let out = text;
  for (const identifier of identifiers) {
    const trimmed = identifier?.trim();
    if (!trimmed || trimmed.length < 3) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "Lender");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Mask a priced offer set for a borrower. Offers arrive rate-sorted from
 * computeOffers, so letters follow rate order deterministically: the lowest
 * rate is always Option A.
 */
export function toBorrowerOfferViews(offers: readonly MaskableOffer[]): BorrowerOfferView[] {
  return offers.map((offer, index) => {
    const identifiers = [offer.lenderName, offer.lenderCode];
    const letter = optionLetter(index);
    return {
      optionId: letter,
      optionLabel: `Option ${letter}`,
      productLabel: productLabelFor(offer),
      productType: offer.productType,
      loanTerm: offer.loanTerm,
      adjustedRate: offer.adjustedRate,
      lockTerm: offer.lockTerm,
      pricingBreakdown: {
        baseRate: offer.pricingBreakdown.baseRate,
        llpaAdjustment: offer.pricingBreakdown.llpaAdjustment,
        lockTermAdjustment: offer.pricingBreakdown.lockTermAdjustment,
        lenderAdjustments: offer.pricingBreakdown.lenderAdjustments.map((a) => ({
          name: scrubLenderIdentity(a.name, identifiers),
          value: a.value,
        })),
        totalAdjustments: offer.pricingBreakdown.totalAdjustments,
        finalRate: offer.pricingBreakdown.finalRate,
      },
      estimatedMonthlyPI: offer.estimatedMonthlyPI,
      estimatedMonthlyMI: offer.estimatedMonthlyMI,
      estimatedMonthlyTotal: offer.estimatedMonthlyTotal,
      labels: [...offer.labels],
    };
  });
}
