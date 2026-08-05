/**
 * Display math for the borrower offer comparison. Pure and deterministic —
 * same inputs, same output — so the rate string and the break-even month
 * count a borrower sees are reproducible.
 */

export function formatRate(rate: number): string {
  return rate.toFixed(3) + "%";
}

/**
 * Months to recoup an upfront points cost from the monthly payment it buys
 * down. Returns Infinity when the buy-down saves nothing (or costs more), so
 * callers render "N/A" rather than a negative or divide-by-zero month count.
 */
export function calculateBreakeven(pointsCost: number, monthlySavings: number): number {
  if (monthlySavings <= 0) return Infinity;
  return Math.ceil(pointsCost / monthlySavings);
}
