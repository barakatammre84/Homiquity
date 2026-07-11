import type { RentalPropertyEntry } from "@shared/schema";
import type { DtiIncomePathResult } from "@shared/incomePaths";
import { roundCents } from "@shared/incomePaths";
import { calculateRentalIncomeOffsets } from "../../underwritingNuance";

/**
 * Rental income path (UAL P3) — wraps the cited rental offset calculator
 * (server/services/underwritingNuance.ts, Fannie B3-3.1-08: 75% of gross rent
 * net of the property's PITIA).
 *
 * SURFACED, NOT AUTO-APPLIED. The net rental offset is computed and shown, but
 * `appliedToDti` is false: the live instant-decision path has never folded
 * rental offsets into DTI, and doing so is an underwriting-policy change that
 * warrants its own review (the standing DTI-wiring gap). Keeping it advisory
 * preserves exact parity for wage/SE decisions in this PR while still giving
 * the LO the number.
 */

const RENTAL_CITATIONS = [
  { doc: "docs/fannie-mae (Selling Guide)", section: "B3-3.1-08 Rental Income" },
];

export function computeRentalPath(
  rentalProperties: RentalPropertyEntry[] | null | undefined,
): DtiIncomePathResult {
  const offsets = calculateRentalIncomeOffsets(rentalProperties);
  if (offsets.length === 0) {
    return {
      pathId: "rental",
      kind: "dti_income",
      role: "component",
      status: "not_indicated",
      monthlyQualifyingIncome: 0,
      appliedToDti: false,
      citations: RENTAL_CITATIONS,
      requiresManualReview: false,
      notes: [],
    };
  }

  const netOffset = roundCents(offsets.reduce((sum, o) => sum + o.netOffset, 0));
  const notes = [
    `${offsets.length} rental propert${offsets.length === 1 ? "y" : "ies"}: net qualifying offset ${netOffset >= 0 ? "+" : ""}${netOffset} (75% of gross rent, net of PITIA). Advisory — not yet folded into the DTI income figure.`,
  ];

  return {
    pathId: "rental",
    kind: "dti_income",
    role: "component",
    status: "applicable",
    monthlyQualifyingIncome: netOffset,
    appliedToDti: false,
    citations: RENTAL_CITATIONS,
    requiresManualReview: netOffset < 0,
    notes,
  };
}
