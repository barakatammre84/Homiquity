import type { RentalPropertyEntry } from "@shared/schema";
import type { CoverageRatioPathResult } from "@shared/incomePaths";
import { parseFinancialNumber } from "@shared/incomePaths";

/**
 * DSCR path — Angel Oak Investor Cash Flow (UAL P4).
 *
 * AUTHORITY: docs/lender-programs/angel-oak/dscr-program-reference.md
 * (transcribed 2026-07-11 from Angel Oak's public program + calculator pages;
 * the TPO portal matrix controls on conflict). Ledger:
 * data/regulatory/regulatory-ledger.json `aoms-dscr-rent-divided-pitia`.
 *
 * The operative formula is Angel Oak's own statement: "Rent Divided PITIA =
 * DSCR" — expected rent ÷ PITIA (principal, interest, taxes, insurance,
 * association dues), computed here on matching monthly periods.
 *
 * WHAT THIS PATH DELIBERATELY DOES NOT DO: declare pass/fail. The qualifying
 * MINIMUM DSCR by LTV/FICO tier is portal-gated (not in-repo), so every
 * computed ratio carries requiresManualReview and an AE-matrix note. Adding a
 * threshold requires transcribing the AE matrix into the reference doc first
 * (no citation, no implementation).
 */

export const DSCR_PROGRAM = {
  enabled: true as boolean,
  citationFiles: [
    "docs/lender-programs/angel-oak/dscr-program-reference.md",
    "docs/lender-programs/angel-oak/README.md",
  ],
};

const DSCR_CITATIONS = [
  {
    doc: "docs/lender-programs/angel-oak/dscr-program-reference.md",
    section: "Ratio formula (Rent Divided PITIA = DSCR)",
  },
];

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export interface DscrPropertyRatio {
  address: string | null;
  monthlyRent: number;
  monthlyPitia: number;
  /** rent ÷ PITIA, 4dp; null when PITIA is 0/unparseable (ratio undefined). */
  ratio: number | null;
}

/**
 * The cited program formula on one property: monthly rent ÷ monthly PITIA.
 * Returns null when the denominator is not a positive number — an undefined
 * ratio is reported as such, never coerced.
 */
export function computeDscrRatio(monthlyRent: number, monthlyPitia: number): number | null {
  if (!Number.isFinite(monthlyRent) || !Number.isFinite(monthlyPitia) || monthlyPitia <= 0) {
    return null;
  }
  return round4(monthlyRent / monthlyPitia);
}

/**
 * Portfolio view over the borrower's declared rental properties: per-property
 * ratios plus the aggregate (total rent ÷ total PITIA). The intake's
 * monthlyDebtPayment field is the property's full housing obligation (PITIA),
 * matching the rental-offset calculator's usage.
 */
export function computeDscrForProperties(
  rentalProperties: RentalPropertyEntry[] | null | undefined,
): { perProperty: DscrPropertyRatio[]; aggregate: number | null } {
  const perProperty: DscrPropertyRatio[] = (rentalProperties ?? []).map((p) => {
    const rent = parseFinancialNumber(p.monthlyRentalIncome);
    const pitia = parseFinancialNumber(p.monthlyDebtPayment);
    const monthlyRent = Number.isFinite(rent) ? rent : 0;
    const monthlyPitia = Number.isFinite(pitia) ? pitia : 0;
    return {
      address: p.address ?? null,
      monthlyRent,
      monthlyPitia,
      ratio: computeDscrRatio(monthlyRent, monthlyPitia),
    };
  });
  const totalRent = perProperty.reduce((s, p) => s + p.monthlyRent, 0);
  const totalPitia = perProperty.reduce((s, p) => s + p.monthlyPitia, 0);
  return { perProperty, aggregate: computeDscrRatio(totalRent, totalPitia) };
}

export function computeDscrPath(
  rentalProperties: RentalPropertyEntry[] | null | undefined,
): CoverageRatioPathResult {
  const hasRental = (rentalProperties ?? []).length > 0;

  if (!DSCR_PROGRAM.enabled) {
    // Defensive branch: enabled is compile-time true as of P4, and the fs test
    // asserts the citation files exist whenever it is.
    return {
      pathId: "dscr",
      kind: "coverage_ratio",
      role: "alternative",
      status: hasRental ? "unavailable" : "not_indicated",
      coverageRatio: null,
      citations: [],
      requiresManualReview: false,
      unavailableReason: hasRental ? "PROGRAM_REFERENCE_NOT_IN_REPO" : undefined,
      notes: [],
    };
  }

  if (!hasRental) {
    return {
      pathId: "dscr",
      kind: "coverage_ratio",
      role: "alternative",
      status: "not_indicated",
      coverageRatio: null,
      citations: DSCR_CITATIONS,
      requiresManualReview: false,
      notes: ["No rental properties declared — nothing to underwrite on a coverage-ratio basis."],
    };
  }

  const { perProperty, aggregate } = computeDscrForProperties(rentalProperties);
  const notes: string[] = perProperty.map((p) =>
    p.ratio !== null
      ? `${p.address ?? "Rental property"}: DSCR ${p.ratio} (rent ${p.monthlyRent} ÷ PITIA ${p.monthlyPitia}, per the cited Rent-Divided-PITIA formula).`
      : `${p.address ?? "Rental property"}: DSCR undefined — the property's PITIA is missing or zero; capture it before a ratio can be computed.`,
  );
  notes.push(
    "The qualifying minimum DSCR by LTV/FICO tier is portal-gated (AE matrix, not yet in-repo) — this path reports the ratio and never declares pass/fail. Subject-property DSCR for a purchase additionally needs the expected market rent, which intake does not capture yet.",
  );

  return {
    pathId: "dscr",
    kind: "coverage_ratio",
    role: "alternative",
    status: "applicable",
    coverageRatio: aggregate,
    citations: DSCR_CITATIONS,
    // Always: no in-repo qualifying threshold exists to clear it automatically.
    requiresManualReview: true,
    notes,
  };
}
