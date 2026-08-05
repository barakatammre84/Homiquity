/**
 * Refinance comparison for the public /refinance page.
 *
 * Extracted verbatim from Refinance.tsx. Deterministic — no clock, no
 * randomness, no I/O.
 *
 * MODELLING NOTE. Both interest totals are `payment x months - balance`,
 * which assumes the borrower carries each loan to full term. That is the
 * conventional framing for this comparison, but it flatters a refinance that
 * resets a partly-paid loan back to 30 years: the new loan's lower payment is
 * compared against a shorter remaining term. The page surfaces that directly
 * — interestGoesUp is derived and shown — rather than hiding it, and
 * breakEvenMonths exists so a lower payment alone is never the whole story.
 */

/** Standard amortized principal-and-interest payment. */
export function monthlyPI(balance: number, annualRatePct: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export interface RefiInputs {
  balance: number;
  currentRate: number;
  yearsRemaining: number;
  newRate: number;
  newTermYears: number;
  closingCosts: number;
}

export interface RefiResults {
  currentPayment: number;
  newPayment: number;
  /** Positive when the new loan is cheaper per month. */
  monthlyDiff: number;
  currentInterest: number;
  newInterest: number;
  /** Months to recoup closing costs, or null when there is nothing to recoup. */
  breakEvenMonths: number | null;
}

export function calculateRefi({
  balance,
  currentRate,
  yearsRemaining,
  newRate,
  newTermYears,
  closingCosts,
}: RefiInputs): RefiResults {
  const currentMonths = yearsRemaining * 12;
  const newMonths = newTermYears * 12;
  const currentPayment = monthlyPI(balance, currentRate, currentMonths);
  const newPayment = monthlyPI(balance, newRate, newMonths);
  const monthlyDiff = currentPayment - newPayment;
  const currentInterest = currentPayment * currentMonths - balance;
  const newInterest = newPayment * newMonths - balance;
  // Null, not Infinity or 0: with no monthly saving there is nothing to
  // recoup, and "0 months to break even" would read as an instant win.
  const breakEvenMonths =
    monthlyDiff > 0 && closingCosts > 0 ? Math.ceil(closingCosts / monthlyDiff) : null;
  return { currentPayment, newPayment, monthlyDiff, currentInterest, newInterest, breakEvenMonths };
}
