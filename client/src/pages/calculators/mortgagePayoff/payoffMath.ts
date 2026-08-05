/**
 * Payoff-acceleration maths for the public /calculators/payoff page.
 *
 * Extracted verbatim from MortgagePayoffCalculator.tsx. Deterministic — no
 * clock, no randomness, no I/O.
 */

export interface PayoffInputs {
  currentBalance: number;
  interestRate: number;
  remainingTermYears: number;
  extraMonthly: number;
  oneTimeExtra: number;
  biweekly: boolean;
}

export interface PayoffResults {
  basePayment: number;
  baselineMonths: number;
  baselineInterest: number;
  acceleratedMonths: number;
  acceleratedInterest: number;
  monthsSaved: number;
  interestSaved: number;
}

export const defaultInputs: PayoffInputs = {
  currentBalance: 280000,
  interestRate: 6.5,
  remainingTermYears: 27,
  extraMonthly: 200,
  oneTimeExtra: 0,
  biweekly: false,
};

/** Runaway guard on the simulation loop: 100 years of months. */
export const MAX_SIMULATED_MONTHS = 1200;

/** Standard fully-amortizing monthly principal-and-interest payment. */
export function monthlyPI(loan: number, annualRatePct: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return loan / months;
  return (loan * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/**
 * Simulate payoff month-by-month.
 * - basePayment: the scheduled monthly P&I.
 * - extraMonthly: applied to every month's principal.
 * - oneTimeExtra: applied once, in month 1.
 * - biweekly: pay half the monthly payment every two weeks (26 half-payments =
 *   13 full payments a year), approximated as one extra scheduled payment spread
 *   across the year (basePayment / 12 added each month).
 *
 * Returns Infinity for both figures when the payment never covers the interest
 * — reporting a finite month count there would mean promising a payoff date
 * that never arrives.
 */
export function simulate(
  balanceStart: number,
  annualRatePct: number,
  basePayment: number,
  extraMonthly: number,
  oneTimeExtra: number,
  biweekly: boolean,
): { months: number; interest: number } {
  const r = annualRatePct / 100 / 12;
  let balance = balanceStart;
  let totalInterest = 0;
  let months = 0;
  const biweeklyExtra = biweekly ? basePayment / 12 : 0;

  while (balance > 0.01 && months < MAX_SIMULATED_MONTHS) {
    const interest = balance * r;
    let principal = basePayment + extraMonthly + biweeklyExtra - interest;
    if (months === 0) principal += oneTimeExtra;
    if (principal <= 0) return { months: Infinity, interest: Infinity };
    principal = Math.min(principal, balance);
    balance -= principal;
    totalInterest += interest;
    months += 1;
  }
  return { months, interest: totalInterest };
}

export function calculate(inputs: PayoffInputs): PayoffResults {
  const { currentBalance, interestRate, remainingTermYears, extraMonthly, oneTimeExtra, biweekly } = inputs;
  const scheduledMonths = Math.max(1, Math.round(remainingTermYears * 12));
  const basePayment = monthlyPI(currentBalance, interestRate, scheduledMonths);

  const baseline = simulate(currentBalance, interestRate, basePayment, 0, 0, false);
  const accelerated = simulate(currentBalance, interestRate, basePayment, extraMonthly, oneTimeExtra, biweekly);

  const baselineMonths = baseline.months === Infinity ? scheduledMonths : baseline.months;
  const baselineInterest = baseline.interest === Infinity ? 0 : baseline.interest;
  const acceleratedMonths = accelerated.months === Infinity ? baselineMonths : accelerated.months;
  const acceleratedInterest = accelerated.interest === Infinity ? baselineInterest : accelerated.interest;

  return {
    basePayment,
    baselineMonths,
    baselineInterest,
    acceleratedMonths,
    acceleratedInterest,
    // Clamped at 0 so a non-accelerating strategy reads as "no saving" rather
    // than as a negative one.
    monthsSaved: Math.max(0, baselineMonths - acceleratedMonths),
    interestSaved: Math.max(0, baselineInterest - acceleratedInterest),
  };
}

/**
 * Width of the accelerated bar as a percentage of the baseline bar, which is
 * always drawn at 100%. Capped so the accelerated plan can never render longer
 * than the plan it is being compared against.
 */
export function payoffProgressPercent(results: PayoffResults): number {
  return results.baselineMonths > 0
    ? Math.min(100, (results.acceleratedMonths / results.baselineMonths) * 100)
    : 100;
}
