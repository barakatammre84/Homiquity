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
}

export function computeRentalPath(
  rentalProperties: RentalPropertyEntry[] | null | undefined,
  ctx: RentalPathContext,
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
  // A loss is always applied (conservative); a gain only on verified provenance.
  const applied = netOffset < 0 ? true : ctx.applyPositiveToDti;
  const doubleCountRisk = applied && ctx.hasMortgageLiabilityRows;

  const notes = [
    `${offsets.length} rental propert${offsets.length === 1 ? "y" : "ies"}: net qualifying offset ${netOffset >= 0 ? "+" : ""}${netOffset} (75% of gross rent, net of PITIA — B3-3.8-01).` +
      (applied
        ? netOffset >= 0
          ? " Applied to qualifying income."
          : " Applied to monthly obligations (net rental loss)."
        : " Not applied yet — positive rental offsets count toward the decision once income, assets, and credit are verified (decision-grade provenance)."),
  ];
  if (doubleCountRisk) {
    notes.push(
      "URLA liabilities include mortgage-type rows: the rental property's PITIA may be counted both inside this net offset and as a listed liability. B3-3.8-01 bars counting the PITIA separately — flagged for manual review to resolve which entry carries the payment.",
    );
  }

  return {
    pathId: "rental",
    kind: "dti_income",
    role: "component",
    status: "applicable",
    monthlyQualifyingIncome: netOffset,
    appliedToDti: applied,
    citations: RENTAL_CITATIONS,
    requiresManualReview: netOffset < 0 || doubleCountRisk,
    notes,
  };
}
