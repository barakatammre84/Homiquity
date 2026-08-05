/**
 * The tier caption shown under the credit score on the file summary card.
 *
 * Display only — pricing tiers live in the LLPA/pricing engine, not here.
 * Extracted from BorrowerFile.tsx unchanged, including the quirk that a score
 * below 620 falls through to "Pending" (see creditScoreBand.test.ts).
 */
export function creditScoreBand(creditScore: number | null | undefined): string {
  if (creditScore && creditScore >= 740) return "740+";
  if (creditScore && creditScore >= 680) return "680-739";
  if (creditScore && creditScore >= 620) return "620-679";
  return "Pending";
}
