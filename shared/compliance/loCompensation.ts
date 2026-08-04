// ---------------------------------------------------------------------------
// Loan-originator compensation model + Reg Z points-and-fees floor.
//
// Two regulatory rails live here because they share one input — how the loan
// originator is paid on THIS transaction:
//
//   1. Dual compensation, 12 CFR §1026.36(d)(2). A loan originator may not
//      receive compensation from the consumer AND from any other person on the
//      same transaction. Practically, for a broker: if the wholesale lender
//      pays the compensation, the borrower may not also be charged an
//      origination fee. `borrowerPaidOriginationAllowed()` is the single gate
//      the fee schedule consults (services/loanCosts.ts).
//
//   2. Points-and-fees / QM cap, 12 CFR §1026.43(e)(2)(iii), evaluated against
//      the note-date tables in shared/fannieMae/qmThresholds.ts. Compensation
//      paid by a creditor to a mortgage broker counts toward points and fees
//      even though the consumer never sees it as a charge — which is why the
//      lender-paid model does NOT make the cap easier to satisfy, it makes it
//      harder.
//
// ---------------------------------------------------------------------------
// WHY THIS COMPUTES A FLOOR AND NOT "THE" POINTS-AND-FEES FIGURE
// ---------------------------------------------------------------------------
// The complete §1026.32(b)(1) inclusion list could NOT be verified verbatim
// when this module was written (see the ledger entries below), so this file
// deliberately does not claim to produce the Regulation Z Total Points and
// Fees Amount. It produces a LOWER BOUND from the charges the platform itself
// levies and controls, plus originator compensation.
//
// The correctness argument is monotonicity, not completeness: every item the
// real definition adds can only INCREASE the total. Therefore
//
//   floor > cap        ⇒ the true figure also exceeds the cap  ⇒ DEFINITIVE FAIL
//   floor ≤ cap        ⇒ says NOTHING about the true figure    ⇒ NOT CLEARED
//
// The evaluation below is three-valued for exactly that reason and never
// returns "compliant" off the floor alone. The authoritative figure arrives at
// closing as `loan_delivery_data.regulationZTotalPointsAndFeesAmount`, which
// the delivery edits already hard-require (shared/fannieMae/loanDeliveryEdits.ts
// edit 3128). This module's job is to stop an over-cap structure from ever
// being quoted — months before the delivery edit would catch it.
// ---------------------------------------------------------------------------

import { evaluateCoveredPointsAndFees } from "../fannieMae/qmThresholds";

export const COMPENSATION_MODELS = ["lender_paid", "borrower_paid"] as const;
export type CompensationModel = (typeof COMPENSATION_MODELS)[number];

export function isCompensationModel(value: unknown): value is CompensationModel {
  return typeof value === "string" && (COMPENSATION_MODELS as readonly string[]).includes(value);
}

/**
 * How the loan originator is paid on one transaction. Both fields are
 * required: a model without a rate cannot be scored against the QM cap, and a
 * rate without a model cannot be checked for dual compensation.
 */
export interface OriginatorCompensation {
  model: CompensationModel;
  /** Compensation as basis points of the loan amount, per the elected plan. */
  bps: number;
}

/** Compensation in dollars for a loan amount. Pure. */
export function compensationAmount(loanAmount: number, comp: OriginatorCompensation): number {
  return (loanAmount * comp.bps) / 10_000;
}

/**
 * §1026.36(d)(2): the borrower may be charged origination compensation ONLY
 * when the originator takes no compensation from anyone else. The fee schedule
 * calls this before charging the origination fee; when it returns false the
 * fee is zero, not merely disclosed differently.
 */
export function borrowerPaidOriginationAllowed(model: CompensationModel): boolean {
  return model === "borrower_paid";
}

/**
 * Parse a persisted (model, bps) pair off a loan application. Returns null
 * when either half is missing or malformed — callers MUST fail closed on null
 * rather than defaulting to a model, because guessing the model is precisely
 * the §1026.36(d)(2) mistake this module exists to prevent.
 */
export function resolveCompensation(
  model: unknown,
  bps: unknown,
): OriginatorCompensation | null {
  if (!isCompensationModel(model)) return null;
  // Number(null) is 0 and Number("") is 0 — both would resolve a file with no
  // rate on it to a silent 0 bps. Reject the empty forms before coercing.
  if (bps === null || bps === undefined || bps === "") return null;
  const parsed = typeof bps === "number" ? bps : Number(bps);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return { model, bps: parsed };
}

// ---------------------------------------------------------------------------
// Points-and-fees floor
// ---------------------------------------------------------------------------

/**
 * Platform charges that feed the floor. These are the charges Homiquity sets
 * and controls; third-party charges are deliberately excluded (see the header
 * — excluding them keeps the result a lower bound).
 */
export interface PointsAndFeesFloorInput {
  loanAmount: number;
  /** Borrower-paid origination fee, in dollars (0 under a lender-paid model). */
  originationFee: number;
  /** Discount/origination points, in dollars. */
  points: number;
  applicationFee: number;
  underwritingFee: number;
  compensation: OriginatorCompensation;
}

export interface PointsAndFeesComponent {
  name: string;
  amount: number;
}

export interface PointsAndFeesFloor {
  /** Lower bound on the Regulation Z Total Points and Fees Amount. */
  amount: number;
  components: PointsAndFeesComponent[];
  /**
   * Always true, and structural: this figure is a bound, never the complete
   * §1026.32(b)(1) total. Consumers must not present it as the delivered
   * Regulation Z figure.
   */
  isLowerBound: true;
}

/**
 * Lower bound on points and fees for one transaction.
 *
 * Under a lender-paid model the origination fee is already zero (the fee
 * schedule enforces that), and the compensation the lender pays is added
 * instead — so switching models moves the charge between components without
 * making it disappear, which is the behavior the QM cap cares about.
 */
export function pointsAndFeesFloor(input: PointsAndFeesFloorInput): PointsAndFeesFloor {
  const comp = compensationAmount(input.loanAmount, input.compensation);

  const components: PointsAndFeesComponent[] = [
    { name: "Origination fee (borrower-paid)", amount: input.originationFee },
    { name: "Points", amount: input.points },
    { name: "Application fee", amount: input.applicationFee },
    { name: "Underwriting fee", amount: input.underwritingFee },
    {
      name:
        input.compensation.model === "lender_paid"
          ? "Originator compensation (lender-paid)"
          : "Originator compensation (borrower-paid)",
      amount: comp,
    },
  ].filter(c => c.amount > 0);

  // Under a borrower-paid model the origination fee IS the compensation —
  // counting both would double-count the same dollars. The fee schedule
  // derives one from the other, so the floor takes the larger and says so.
  const borrowerPaidDouble =
    input.compensation.model === "borrower_paid" && input.originationFee > 0 && comp > 0;

  const amount = borrowerPaidDouble
    ? Math.max(input.originationFee, comp) + input.points + input.applicationFee + input.underwritingFee
    : components.reduce((sum, c) => sum + c.amount, 0);

  return {
    amount: Math.round(amount * 100) / 100,
    components,
    isLowerBound: true,
  };
}

// ---------------------------------------------------------------------------
// Three-valued QM evaluation
// ---------------------------------------------------------------------------

export type QmFloorVerdict =
  /** The floor alone exceeds the cap — the true figure does too. Definitive. */
  | "over_cap"
  /** Floor fits, but the complete figure is unknown. NOT a pass. */
  | "not_cleared"
  /** No note-date table, or inputs missing — nothing was evaluated. */
  | "not_evaluated";

export interface QmFloorEvaluation {
  verdict: QmFloorVerdict;
  floor: PointsAndFeesFloor | null;
  maxAllowableAmount?: number;
  tierDescription?: string;
  /** Human-readable explanation, suitable for a staff-facing issue list. */
  message: string;
}

/**
 * Evaluate the floor against the QM points-and-fees cap for a note date.
 *
 * `regulationZTotalLoanAmount` should be the Reg Z Total Loan Amount when it
 * is known. Callers that only have the note amount must pass it knowingly:
 * the Reg Z figure is LOWER, so the note amount overstates the cap and makes
 * this check more permissive, never less.
 */
export function evaluatePointsAndFeesFloor(
  noteDate: Date | string,
  originalLoanAmount: number,
  regulationZTotalLoanAmount: number,
  input: PointsAndFeesFloorInput,
): QmFloorEvaluation {
  if (!(originalLoanAmount > 0)) {
    return { verdict: "not_evaluated", floor: null, message: "Loan amount is required to evaluate the QM points-and-fees cap" };
  }

  const floor = pointsAndFeesFloor(input);
  const evaluation = evaluateCoveredPointsAndFees(
    noteDate,
    originalLoanAmount,
    regulationZTotalLoanAmount,
    floor.amount,
  );

  if (!evaluation.evaluated) {
    return {
      verdict: "not_evaluated",
      floor,
      message: evaluation.reason ?? "QM points-and-fees cap could not be evaluated",
    };
  }

  if (!evaluation.compliant) {
    return {
      verdict: "over_cap",
      floor,
      maxAllowableAmount: evaluation.maxAllowableAmount,
      tierDescription: evaluation.tierDescription,
      message:
        `Points and fees exceed the QM cap on the platform's own charges alone: ` +
        `$${floor.amount.toFixed(2)} against a $${evaluation.maxAllowableAmount?.toFixed(2)} cap ` +
        `(${evaluation.tierDescription}). Components: ` +
        floor.components.map(c => `${c.name} $${c.amount.toFixed(2)}`).join(", ") +
        `. Third-party charges are not included in this figure, so the true total is higher.`,
    };
  }

  return {
    verdict: "not_cleared",
    floor,
    maxAllowableAmount: evaluation.maxAllowableAmount,
    tierDescription: evaluation.tierDescription,
    message:
      `Platform charges and originator compensation total $${floor.amount.toFixed(2)} against a ` +
      `$${evaluation.maxAllowableAmount?.toFixed(2)} QM cap (${evaluation.tierDescription}). ` +
      `This is a lower bound — the Regulation Z Total Points and Fees Amount is required before delivery.`,
  };
}
