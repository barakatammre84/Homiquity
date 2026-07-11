// ---------------------------------------------------------------------------
// Alternative-structure translation math (UAL P7 — Contract Translation Engine,
// funder-agnostic slice).
//
// Maps the monthly cash flows of the three alternative financing structures
// (diminishing Musharaka, Ijara lease-to-own, Murabaha cost-plus) into the
// conventional quantities the rest of the platform already consumes: an
// equivalent note rate and a month-by-month payment vector compatible with
// buildMortgagePaymentStream / calculateMortgageAPR (services/apr.ts) and the
// P3 income-path envelope's "dti_income" obligation side.
//
// Authority — no-citation-no-implementation:
//  - knowledge-base/research/islamic-finance/UNIVERSAL_ADAPTATION_LAYER.md §3
//    ("The three structures — and how their cash flows would map"): each
//    structure decomposes into an acquisition/principal-like component (A_t)
//    and a return/rent-like component (R_t). The mapping is ARITHMETIC only;
//    asserting legal/tax/disclosure equivalence is §5 counsel territory and is
//    NOT done here.
//  - Reg Z §1026.22 / Appendix J: the equivalent rate is solved with the SAME
//    cited actuarial solver as every other APR on the platform
//    (solveAPRFromStream) — forked regulated math is itself a violation
//    (see tests/complianceInvariants.test.ts).
//
// Boundaries (binding):
//  - TRANSLATION ONLY. Every economic input (rental yield, markup, term,
//    schedule shape) comes from the FUNDER's term sheet. This module never
//    prices, never sets a profit rate, and contains no Shariah-compliance
//    judgment — structure certification stays with the funder
//    (research doc §5.10 / SHARIAH_GOVERNANCE.md).
//  - Deterministic and pure: same inputs, same outputs. No IO, no vendor
//    calls, no AI (Reg B).
// ---------------------------------------------------------------------------

import { monthlyPrincipalAndInterest, solveAPRFromStream } from "./apr";

export type AlternativeStructure = "musharaka" | "ijara" | "murabaha";

/**
 * How the acquisition (share buy-down) schedule is shaped. Both appear in
 * diminishing-Musharaka / Ijara term sheets (research doc §3):
 *  - "level_total": the combined monthly payment (rent + acquisition) is
 *    level; the acquisition portion grows as the financier share shrinks.
 *    Cash-flow-identical to a conventional amortizing loan at the rental
 *    yield — the anchor identity the tests pin.
 *  - "level_acquisition": the acquisition portion is constant (share/term);
 *    rent declines linearly, so the total payment declines month over month.
 */
export type AcquisitionSchedule = "level_total" | "level_acquisition";

export interface StructureTranslationCitation {
  doc: string;
  section: string;
}

export const STRUCTURE_TRANSLATION_CITATIONS: StructureTranslationCitation[] = [
  {
    doc: "knowledge-base/research/islamic-finance/UNIVERSAL_ADAPTATION_LAYER.md",
    section: "§3 payment-decomposition table (A_t / R_t mapping)",
  },
  {
    doc: "server/services/apr.ts",
    section: "Reg Z §1026.22 / Appendix J actuarial solver (shared, not forked)",
  },
];

export interface MusharakaIjaraParams {
  structure: "musharaka" | "ijara";
  /** Property acquisition price agreed with the funder. */
  propertyPrice: number;
  /** Borrower's initial contribution (their starting equity share). */
  downPayment: number;
  /**
   * Annual rental yield the funder charges on its OUTSTANDING share, as a
   * percent (from the funder's term sheet / rent schedule).
   */
  annualRentalYieldPct: number;
  termMonths: number;
  acquisitionSchedule: AcquisitionSchedule;
}

export interface MurabahaParams {
  structure: "murabaha";
  /** Funder's cost being financed (price minus borrower down payment). */
  financedCost: number;
  /** Fixed markup declared upfront in the purchase contract (dollars). */
  declaredMarkup: number;
  termMonths: number;
}

export type StructureParams = MusharakaIjaraParams | MurabahaParams;

export interface StructurePaymentStream {
  structure: AlternativeStructure;
  /** Amount the funder finances (its initial share / financed cost). */
  financedAmount: number;
  /** Total monthly payment vector, month 1..term. */
  payments: number[];
  /** A_t — acquisition / principal-like component per month. */
  acquisitionComponents: number[];
  /** R_t — rent / return-like component per month. */
  returnComponents: number[];
  citations: StructureTranslationCitation[];
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`structureTranslation: ${name} must be a positive finite number`);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Builds the month-by-month payment stream for an alternative structure,
 * decomposed into acquisition (A_t) and return (R_t) components per the
 * research doc §3 table.
 */
export function structureToPaymentStream(params: StructureParams): StructurePaymentStream {
  if (params.structure === "murabaha") {
    const { financedCost, declaredMarkup, termMonths } = params;
    assertPositive(financedCost, "financedCost");
    assertPositive(termMonths, "termMonths");
    if (!Number.isFinite(declaredMarkup) || declaredMarkup < 0) {
      throw new Error("structureTranslation: declaredMarkup must be a non-negative finite number");
    }
    // §3: "fixed installment on a marked-up price declared upfront" — equal
    // installments over the term; the markup is the return component, spread
    // pro-rata the way the contract spreads it (equal installments).
    const installment = (financedCost + declaredMarkup) / termMonths;
    const acquisition = financedCost / termMonths;
    const rtn = declaredMarkup / termMonths;
    return {
      structure: "murabaha",
      financedAmount: financedCost,
      payments: new Array(termMonths).fill(installment),
      acquisitionComponents: new Array(termMonths).fill(acquisition),
      returnComponents: new Array(termMonths).fill(rtn),
      citations: STRUCTURE_TRANSLATION_CITATIONS,
    };
  }

  const { propertyPrice, downPayment, annualRentalYieldPct, termMonths, acquisitionSchedule } = params;
  assertPositive(propertyPrice, "propertyPrice");
  assertPositive(termMonths, "termMonths");
  if (!Number.isFinite(downPayment) || downPayment < 0) {
    throw new Error("structureTranslation: downPayment must be a non-negative finite number");
  }
  if (downPayment >= propertyPrice) {
    throw new Error("structureTranslation: downPayment must be below propertyPrice (nothing to finance)");
  }
  if (!Number.isFinite(annualRentalYieldPct) || annualRentalYieldPct < 0) {
    throw new Error("structureTranslation: annualRentalYieldPct must be a non-negative finite number");
  }

  // §3: Musharaka/Ijara share one decomposition — rent accrues on the
  // financier's OUTSTANDING share; acquisition payments buy that share down.
  const financedAmount = propertyPrice - downPayment;
  const monthlyYield = annualRentalYieldPct / 100 / 12;

  const payments: number[] = new Array(termMonths);
  const acquisitionComponents: number[] = new Array(termMonths);
  const returnComponents: number[] = new Array(termMonths);

  let outstandingShare = financedAmount;

  if (acquisitionSchedule === "level_total") {
    // Level combined payment: identical arithmetic to a conventional
    // amortizing loan at note rate = the rental yield (the §3 insight; the
    // anchor identity pinned in tests).
    const total = monthlyPrincipalAndInterest(financedAmount, annualRentalYieldPct, termMonths);
    for (let t = 0; t < termMonths; t++) {
      const rent = outstandingShare * monthlyYield;
      const acquisition = total - rent;
      payments[t] = total;
      returnComponents[t] = rent;
      acquisitionComponents[t] = acquisition;
      outstandingShare -= acquisition;
    }
  } else {
    // Level acquisition: constant share buy-down; rent declines with the
    // outstanding share, so the total payment declines month over month.
    const acquisition = financedAmount / termMonths;
    for (let t = 0; t < termMonths; t++) {
      const rent = outstandingShare * monthlyYield;
      payments[t] = acquisition + rent;
      acquisitionComponents[t] = acquisition;
      returnComponents[t] = rent;
      outstandingShare -= acquisition;
    }
  }

  return {
    structure: params.structure,
    financedAmount,
    payments,
    acquisitionComponents,
    returnComponents,
    citations: STRUCTURE_TRANSLATION_CITATIONS,
  };
}

export interface EquivalentRateResult {
  structure: AlternativeStructure;
  financedAmount: number;
  /**
   * The note rate (%) whose conventional amortizing stream has the same
   * present value as this structure's payment stream — solved with the cited
   * Reg Z Appendix J solver. A translation quantity for lender packaging and
   * internal comparison; NOT a disclosed APR (consumer disclosures are the
   * funding lender's obligation — research doc §4.1/§5.1).
   */
  equivalentNoteRatePct: number;
  /**
   * The monthly obligation to carry into DTI (the P3 "dti_income" envelope's
   * obligation side). Level schedules: the level payment. Declining
   * schedules: the FIRST (highest) month's payment — deterministic and
   * conservative; qualifying on a lower later payment would overstate
   * capacity.
   */
  monthlyQualifyingPayment: number;
  paymentStream: StructurePaymentStream;
  citations: StructureTranslationCitation[];
}

/**
 * Translates an alternative structure's terms into an equivalent note rate +
 * qualifying monthly obligation. Pure and deterministic — same term sheet,
 * same translation.
 */
export function rentalYieldToEquivalentRate(params: StructureParams): EquivalentRateResult {
  const stream = structureToPaymentStream(params);
  const equivalentNoteRatePct = solveAPRFromStream(stream.financedAmount, stream.payments);
  const monthlyQualifyingPayment = round2(
    stream.payments.length > 0 ? Math.max(stream.payments[0], stream.payments[stream.payments.length - 1]) : 0,
  );
  return {
    structure: stream.structure,
    financedAmount: stream.financedAmount,
    equivalentNoteRatePct,
    monthlyQualifyingPayment,
    paymentStream: stream,
    citations: STRUCTURE_TRANSLATION_CITATIONS,
  };
}
