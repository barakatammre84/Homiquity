// ---------------------------------------------------------------------------
// Commission payout rules — what payout a file may carry.
//
// `broker_commissions` records money leaving the company on a funded loan.
// The route that creates those rows computed `loanAmount × rate` and validated
// nothing but the rate's range, which left three holes (audit F-21):
//
//   1. It never read the compensation on the file. A payout that is
//      economically a SHARE OF REVENUE was computed as a PERCENTAGE OF LOAN
//      SIZE, and the two are only loosely related. At the seeded 200 bps
//      lender-paid plan on a $250,000 loan — $5,000 of revenue — the permitted
//      maximum rate of 10% creates a $25,000 payable. Five times the revenue
//      on the file, with nothing between an admin's keystroke and the row.
//
//   2. It never checked the loan funded. The basis was `purchasePrice −
//      downPayment` falling back to `preApprovalAmount`, neither of which is
//      what the lender actually funded, and the application's status was not
//      consulted at all — so a payable could be opened against a file still in
//      processing, or denied, or withdrawn.
//
//   3. It read the loan amount from the application rather than from
//      `lender_submissions.fundedLoanAmount`, which is the amount compensation
//      is actually paid on.
//
// The rules live here, pure, rather than inline in the route, for the same
// reason the QM floor moved into loanCosts.ts under F-18: a constraint that
// exists in exactly one endpoint is a constraint no other surface can consult,
// and a staff UI that cannot ask "what is the most I may pay on this file?"
// will discover the answer by tripping a 422.
//
// WHAT THIS MODULE DOES NOT DECIDE. Whether a per-file discretionary
// percentage is permitted compensation at all is a Reg Z §1026.36(d)(1) and
// RESPA §8 question that needs counsel, is recorded in the regulatory ledger
// under `regz-1026-36d1-referral-commission-payout`, and is NOT answered here.
// Bounding the arithmetic is correct whatever counsel says; it is not a
// substitute for asking.
// ---------------------------------------------------------------------------

/**
 * The route's existing rate ceiling, hoisted so the validator and the evaluator
 * cannot drift. This is a platform guardrail, not a regulatory figure.
 */
export const MAX_COMMISSION_RATE = 0.1;

export type CommissionPayoutVerdict =
  /** The payout is within every bound and may be created. */
  | "allowed"
  /** Rate is outside (0, MAX_COMMISSION_RATE]. */
  | "rate_out_of_range"
  /** No funded lender submission — nothing has been earned to share. */
  | "not_funded"
  /** Funded, but the amount compensation is paid on is missing or zero. */
  | "no_loan_basis"
  /**
   * Funded, but neither a remittance nor a snapshotted expectation exists, so
   * the payout cannot be bounded. Refused rather than paid blind.
   */
  | "no_revenue_basis"
  /** The payout would exceed the compensation it is a share of. */
  | "exceeds_compensation";

export interface CommissionPayoutInput {
  /**
   * The application's own status. Consulted only to distinguish "not funded"
   * from "funded but the submission record disagrees", which is a data problem
   * worth naming rather than reporting as a plain refusal.
   */
  applicationStatus?: string | null;
  /** Status of the lender submission this payout draws on. */
  submissionStatus?: string | null;
  /** Final loan amount at funding — the basis compensation is paid on. */
  fundedLoanAmount: number | string | null | undefined;
  /** The lender's actual remittance, when recorded. */
  compensationReceivedAmount: number | string | null | undefined;
  /** Snapshotted at submission from the elected comp plan. */
  compensationExpectedAmount: number | string | null | undefined;
  /** Decimal fraction, e.g. 0.025 = 2.5%. */
  rate: number;
}

export interface CommissionPayoutEvaluation {
  verdict: CommissionPayoutVerdict;
  allowed: boolean;
  /** `fundedLoanAmount × rate`. Null when there is no basis to compute it. */
  amount: number | null;
  /** The loan amount the payout was struck on. */
  loanAmount: number | null;
  /** The revenue the payout is drawn from. */
  revenueBasis: number | null;
  /**
   * Which figure `revenueBasis` came from. `received` is preferred — it is what
   * actually arrived; `expected` is the snapshot and is used only until a
   * remittance is recorded.
   */
  revenueBasisSource: "received" | "expected" | null;
  /** The largest payout this file may carry — i.e. `revenueBasis`. */
  maxAmount: number | null;
  /**
   * The highest rate that stays inside `maxAmount`, rounded DOWN to four
   * decimals to match the column's precision. Rounding down matters: rounding
   * up would hand back a rate that the very next evaluation refuses.
   */
  maxRate: number | null;
  message: string;
  remediation: string[];
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Floor to the column's 4-decimal precision — see `maxRate`. */
function floor4(n: number): number {
  return Math.floor(n * 10_000) / 10_000;
}

function refuse(
  verdict: CommissionPayoutVerdict,
  message: string,
  remediation: string[],
  partial: Partial<CommissionPayoutEvaluation> = {},
): CommissionPayoutEvaluation {
  return {
    verdict,
    allowed: false,
    amount: null,
    loanAmount: null,
    revenueBasis: null,
    revenueBasisSource: null,
    maxAmount: null,
    maxRate: null,
    message,
    remediation,
    ...partial,
  };
}

export function evaluateCommissionPayout(
  input: CommissionPayoutInput,
): CommissionPayoutEvaluation {
  if (!Number.isFinite(input.rate) || input.rate <= 0 || input.rate > MAX_COMMISSION_RATE) {
    return refuse(
      "rate_out_of_range",
      `Commission rate must be a number between 0 and ${MAX_COMMISSION_RATE} (0%–${MAX_COMMISSION_RATE * 100}%).`,
      ["Supply a decimal fraction — 0.025 is 2.5%."],
    );
  }

  if (input.submissionStatus !== "funded") {
    // A commission is a share of compensation, and compensation arrives at
    // funding. Naming the application/submission disagreement separately keeps
    // a data problem from reading as an ordinary refusal.
    const applicationClaimsFunded = input.applicationStatus === "funded";
    return refuse(
      "not_funded",
      applicationClaimsFunded
        ? "The application is marked funded but no lender submission on it is — the payout basis cannot be trusted."
        : "No funded lender submission on this file. Compensation arrives at funding, so there is nothing yet to share.",
      applicationClaimsFunded
        ? [
            "Reconcile the application status against its lender submissions before recording a payout.",
          ]
        : [
            "Record the funding and the lender's remittance on the submission first.",
          ],
    );
  }

  const loanAmount = toNumber(input.fundedLoanAmount);
  if (loanAmount === null || loanAmount <= 0) {
    return refuse(
      "no_loan_basis",
      "The funded submission carries no funded loan amount, which is the basis compensation is paid on.",
      ["Record `fundedLoanAmount` on the submission."],
    );
  }

  const received = toNumber(input.compensationReceivedAmount);
  const expected = toNumber(input.compensationExpectedAmount);
  const revenueBasis = received ?? expected;
  const revenueBasisSource: "received" | "expected" | null =
    received !== null ? "received" : expected !== null ? "expected" : null;

  if (revenueBasis === null || revenueBasisSource === null) {
    // Refusing here is the conservative direction and the deliberate one: an
    // unbounded payout is exactly the hole this module exists to close, and an
    // unknown must never be treated as "no limit".
    return refuse(
      "no_revenue_basis",
      "This file records neither a remittance nor a compensation expectation, so a payout cannot be bounded.",
      [
        "Record the lender's remittance on the submission — the payout is a share of it.",
      ],
      { loanAmount },
    );
  }

  const amount = round2(loanAmount * input.rate);
  const maxAmount = round2(revenueBasis);
  const maxRate = floor4(revenueBasis / loanAmount);

  const basisLabel =
    revenueBasisSource === "received"
      ? "the lender's recorded remittance"
      : "the compensation expected at submission (no remittance recorded yet)";

  if (amount > maxAmount) {
    return refuse(
      "exceeds_compensation",
      `A $${amount.toFixed(2)} payout exceeds $${maxAmount.toFixed(2)}, which is ${basisLabel} on this file. ` +
        `A payout larger than the compensation it is drawn from is an arithmetic error, whatever the business rule.`,
      [
        maxRate > 0
          ? `Use a rate of ${maxRate} or less (up to $${maxAmount.toFixed(2)}).`
          : "No positive rate fits — the compensation on this file is zero.",
      ],
      { loanAmount, revenueBasis: maxAmount, revenueBasisSource, maxAmount, maxRate },
    );
  }

  return {
    verdict: "allowed",
    allowed: true,
    amount,
    loanAmount,
    revenueBasis: maxAmount,
    revenueBasisSource,
    maxAmount,
    maxRate,
    message:
      `$${amount.toFixed(2)} on a $${loanAmount.toFixed(2)} funded loan — ` +
      `${((amount / maxAmount) * 100).toFixed(1)}% of $${maxAmount.toFixed(2)}, ${basisLabel}.`,
    remediation: [],
  };
}

/**
 * Pick the submission a payout draws on: the funded one. An application can
 * carry several submissions (it may have been shopped to more than one lender)
 * and at most one of them funds.
 */
export function fundedSubmissionOf<T extends { status?: string | null }>(
  submissions: T[],
): T | undefined {
  return submissions.find(s => s.status === "funded");
}
