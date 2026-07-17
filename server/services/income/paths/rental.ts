import type { RentalPropertyEntry } from "@shared/schema";
import type { DtiIncomePathResult } from "@shared/incomePaths";
import { roundCents } from "@shared/incomePaths";
import { calculateRentalIncomeOffsets } from "../../underwritingNuance";

/**
 * Rental income path (UAL P3) — wraps the cited rental offset calculator
 * (server/services/underwritingNuance.ts, Fannie B3-3.8-01 — formerly
 * B3-3.1-08: 75% of gross rent net of the property's PITIA).
 *
 * APPLIED TO DTI (non-W2 plan §3.1, ledger fnma-b3-3-8-01-rental-offset-dti):
 * a positive net offset is added to qualifying income; a negative net offset
 * (a rental loss) is added to monthly obligations by the decision engine. The
 * application gate is asymmetric platform policy (ledger
 * platform-rental-preliminary-asymmetry): positive offsets apply only when
 * the file's financial data is decision-grade verified; a loss applies
 * always — declared-but-unverified rent must never inflate a PRELIMINARY
 * decision, while a declared loss can only under-state one.
 *
 * Double-count guard: B3-3.8-01 folds the property's PITIA into the net and
 * bars counting it separately. When the file also carries mortgage-type URLA
 * liability rows (which sumOpenMonthlyLiabilities counts in full), the same
 * payment may be counted twice — conservative, but wrong — so an applied
 * offset in that situation flags manual review instead of staying silent.
 */

const RENTAL_CITATIONS = [
  {
    doc: "docs/fannie-mae/rental-income-reference.md",
    section: "B3-3.8-01 Rental Income (formerly B3-3.1-08)",
  },
];

export interface RentalPathContext {
  /** Decision-grade provenance gate for POSITIVE offsets (platform policy). */
  applyPositiveToDti: boolean;
  /** True when URLA liabilities include mortgage-type rows (double-count risk). */
  hasMortgageLiabilityRows: boolean;
  /** True when the entries include the S-07 departing residence at PROJECTED
   *  market rent — always manual review until appraisal/lease evidence. */
  departingResidenceIncluded?: boolean;
}

/**
 * B3-3.8-01 is applied PER PROPERTY: each property whose 75%-of-rent net of
 * its own PITIA is positive adds to income; each negative one adds its loss
 * to monthly obligations. Positives and losses are never netted across
 * properties (splitting is also strictly conservative: a loss in the DTI
 * numerator weighs more than the same loss subtracted from income).
 */
export interface RentalOffsetSplit {
  /** Σ positive per-property offsets (income side, provenance-gated). */
  positiveTotal: number;
  /** Σ |negative| per-property offsets (obligation side, always applied). */
  negativeTotal: number;
  /** positiveTotal − negativeTotal (informational net). */
  net: number;
  count: number;
}

export function splitRentalOffsets(
  rentalProperties: RentalPropertyEntry[] | null | undefined,
): RentalOffsetSplit {
  const offsets = calculateRentalIncomeOffsets(rentalProperties);
  let positiveTotal = 0;
  let negativeTotal = 0;
  for (const o of offsets) {
    if (o.netOffset >= 0) positiveTotal += o.netOffset;
    else negativeTotal += -o.netOffset;
  }
  return {
    positiveTotal: roundCents(positiveTotal),
    negativeTotal: roundCents(negativeTotal),
    net: roundCents(positiveTotal - negativeTotal),
    count: offsets.length,
  };
}

export function computeRentalPath(
  rentalProperties: RentalPropertyEntry[] | null | undefined,
  ctx: RentalPathContext,
): DtiIncomePathResult {
  const split = splitRentalOffsets(rentalProperties);
  if (split.count === 0) {
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

  // Losses always apply (conservative); gains only on verified provenance.
  const applied = split.negativeTotal > 0 || ctx.applyPositiveToDti;
  const doubleCountRisk = applied && ctx.hasMortgageLiabilityRows;

  const notes = [
    `${split.count} rental propert${split.count === 1 ? "y" : "ies"} (per-property B3-3.8-01 treatment): ` +
      `+${split.positiveTotal} qualifying income from positive offsets` +
      (ctx.applyPositiveToDti
        ? " (applied)"
        : " (withheld until income, assets, and credit are verified — decision-grade provenance)") +
      `; ${split.negativeTotal} rental losses to monthly obligations` +
      (split.negativeTotal > 0 ? " (applied)" : "") +
      ". 75% of gross rent net of each property's own PITIA.",
  ];
  if (ctx.departingResidenceIncluded) {
    notes.push(
      "Includes the departing residence at PROJECTED market rent (S-07 conversion): a rental appraisal or executed lease plus the most recent Schedule E (confirming the property is newly placed in service) is required before this figure is verified-final — flagged for manual review.",
    );
  }
  if (doubleCountRisk) {
    notes.push(
      "URLA liabilities include mortgage-type rows: a rental property's PITIA may be counted both inside its net offset and as a listed liability. B3-3.8-01 bars counting the PITIA separately — flagged for manual review to resolve which entry carries the payment.",
    );
  }

  return {
    pathId: "rental",
    kind: "dti_income",
    role: "component",
    status: "applicable",
    monthlyQualifyingIncome: split.net,
    appliedToDti: applied,
    citations: RENTAL_CITATIONS,
    requiresManualReview:
      split.negativeTotal > 0 || doubleCountRisk || ctx.departingResidenceIncluded === true,
    notes,
  };
}
