/**
 * Fully-amortizing mortgage payment math — the single canonical helper.
 *
 * Replaces ~24 independent re-derivations of the standard amortization formula
 * that were scattered across the public calculators, the borrower/realtor
 * surfaces, and the server pricing/underwriting/letter paths. Those copies had
 * drifted in three ways: the algebraic form (`r(1+r)^n/((1+r)^n-1)` vs its
 * reciprocal), the zero-rate guard (`=== 0`, `<= 0`, `> 0 ?`, or absent), and —
 * most dangerously — the RATE UNIT.
 *
 * ── THE RATE UNIT IS THE TRAP ────────────────────────────────────────────────
 * Call sites in this repo use BOTH conventions, and both are correct locally:
 *   - percent   `6.5`    →  monthlyRate = pct / 100 / 12   (most calculators)
 *   - fraction  `0.065`  →  monthlyRate = rate / 12        (letters.ts,
 *                                                           preUnderwriting,
 *                                                           PropertyDetail, …)
 * Passing one where the other is expected is off by 100x and produces a
 * plausible-looking number, not a crash. That is why there is no single
 * `annualRate` parameter here: pick the function whose NAME states the unit.
 *
 * CONTRACT — do not change without auditing every call site:
 *   - principal <= 0, or termMonths <= 0        →  0
 *   - monthlyRate <= 0 (incl. a 0% loan)        →  principal / termMonths
 *   - otherwise  principal·r(1+r)^n / ((1+r)^n − 1)
 *   - NO rounding. Callers round at their own presentation/storage boundary;
 *     `apr.ts` and the TRID Loan Estimate path depend on full precision.
 *
 * These figures reach regulated documents (pre-approval letters, the TRID Loan
 * Estimate, APR). Any change to the arithmetic above is a compliance-relevant
 * change, not a refactor — see knowledge-base/compliance/ and the equivalence
 * tests in tests/amortization.test.ts, which pin this against every historical
 * call-site variant.
 */

/**
 * The primitive: monthly periodic rate already computed.
 * Use when a call site legitimately holds a monthly rate (e.g. from a rate sheet).
 */
export function paymentAtMonthlyRate(
  principal: number,
  monthlyRate: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (monthlyRate <= 0) return principal / termMonths;
  const growth = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * growth) / (growth - 1);
}

/**
 * Monthly principal & interest from an annual rate expressed as a PERCENT.
 * `annualRatePct: 6.5` means 6.5%.
 */
export function monthlyPrincipalAndInterest(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  return paymentAtMonthlyRate(principal, annualRatePct / 100 / 12, termMonths);
}

/**
 * Monthly principal & interest from an annual rate expressed as a FRACTION.
 * `annualRateFraction: 0.065` means 6.5%.
 */
export function monthlyPrincipalAndInterestFromFraction(
  principal: number,
  annualRateFraction: number,
  termMonths: number,
): number {
  return paymentAtMonthlyRate(principal, annualRateFraction / 12, termMonths);
}

/**
 * Monthly P&I per $1 of loan — the "payment factor" several affordability
 * surfaces compute inline. Equivalent to `monthlyPrincipalAndInterest(1, …)`.
 */
export function paymentFactor(annualRatePct: number, termMonths: number): number {
  return monthlyPrincipalAndInterest(1, annualRatePct, termMonths);
}

/**
 * Inverse of `monthlyPrincipalAndInterest`: the loan principal that a given
 * monthly P&I payment supports (present value of an annuity).
 *
 * CONTRACT: at a 0% rate this is `payment · termMonths`, the exact inverse of
 * the zero-rate branch above.
 */
export function loanSupportedByPayment(
  monthlyPI: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (monthlyPI <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return monthlyPI * termMonths;
  const growth = Math.pow(1 + r, termMonths);
  return (monthlyPI * (growth - 1)) / (r * growth);
}

/**
 * Annuity factor: loan principal supported per $1 of monthly payment.
 * Equivalent to `loanSupportedByPayment(1, …)`; the reciprocal of
 * `paymentFactor`. Several affordability engines compute this inline as
 * `((1+r)^n − 1) / (r(1+r)^n)`.
 */
export function annuityFactor(annualRatePct: number, termMonths: number): number {
  return loanSupportedByPayment(1, annualRatePct, termMonths);
}
