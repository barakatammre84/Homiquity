/**
 * Rent-vs-buy comparison.
 *
 * Extracted verbatim from RentVsBuyCalculator.tsx. Deterministic: no clock, no
 * randomness, no I/O — same inputs, same result.
 *
 * MODELLING ASSUMPTIONS. This is a public-facing calculator whose output is a
 * "buy" / "rent" recommendation, so the simplifications below are stated here
 * rather than left implicit in the arithmetic. All three lean the same way —
 * toward buying — and none is currently disclosed to the visitor:
 *
 *  1. Rent escalates annually (annualRentIncrease); ownership costs do NOT.
 *     Property tax, insurance and maintenance are charged at a flat monthly
 *     rate derived from the ORIGINAL purchase price for the whole term, even
 *     though the model simultaneously appreciates the home. Over a 30-year
 *     horizon that understates ownership cost substantially.
 *  2. propertyTaxRate (1.2%), insuranceRate (0.5%) and maintenanceRate (1%)
 *     have no UI control. Together they add ~2.7% of the home price per year
 *     to "Monthly Ownership" — a figure the visitor can neither see nor change.
 *  3. netCostBuying excludes selling costs (agent commission, transfer taxes)
 *     and the opportunity cost of the down payment.
 *
 * Changing any of these moves the recommendation and is a product decision,
 * not a refactor's to make. calculate.test.ts pins the current behaviour,
 * including the asymmetry in (1), so a future change is deliberate.
 */
import type { CalculatorInputs, CalculatorResults } from "./types";

const TERM_MONTHS = 30 * 12;
/** How far ahead break-even is searched before giving up. */
const BREAK_EVEN_HORIZON_YEARS = 30;
/** A side must be >10% cheaper to earn a recommendation; otherwise "neutral". */
const DECISIVE_MARGIN = 0.9;

export function calculateResults(inputs: CalculatorInputs): CalculatorResults {
  const {
    monthlyRent,
    homePrice,
    downPaymentPercent,
    interestRate,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    maintenanceRate,
    yearsToStay,
    annualRentIncrease,
    annualAppreciation,
  } = inputs;

  const downPayment = homePrice * (downPaymentPercent / 100);
  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = TERM_MONTHS;

  const monthlyMortgage =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyPropertyTax = (homePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (homePrice * (insuranceRate / 100)) / 12;
  const monthlyMaintenance = (homePrice * (maintenanceRate / 100)) / 12;
  const totalMonthlyOwnership =
    monthlyMortgage + monthlyPropertyTax + monthlyInsurance + hoaMonthly + monthlyMaintenance;

  // Rent compounds each year...
  let totalRentCost = 0;
  let currentRent = monthlyRent;
  for (let year = 0; year < yearsToStay; year++) {
    totalRentCost += currentRent * 12;
    currentRent *= 1 + annualRentIncrease / 100;
  }

  // ...ownership does not (assumption 1 above).
  const totalOwnershipCost = totalMonthlyOwnership * 12 * yearsToStay;

  const futureHomeValue = homePrice * Math.pow(1 + annualAppreciation / 100, yearsToStay);

  let remainingBalance = loanAmount;
  for (let month = 0; month < yearsToStay * 12; month++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyMortgage - interestPayment;
    remainingBalance -= principalPayment;
  }
  const homeEquity = futureHomeValue - remainingBalance;

  const netCostRenting = totalRentCost;
  const netCostBuying = totalOwnershipCost + downPayment - homeEquity;

  // 0 is the sentinel for "never breaks even inside the horizon" — the UI
  // hides the row rather than printing a year.
  let breakEvenYears = 0;
  let cumulativeRent = 0;
  let cumulativeOwnership = 0;
  let testRent = monthlyRent;
  let testBalance = loanAmount;

  for (let year = 1; year <= BREAK_EVEN_HORIZON_YEARS; year++) {
    cumulativeRent += testRent * 12;
    testRent *= 1 + annualRentIncrease / 100;

    cumulativeOwnership += totalMonthlyOwnership * 12;

    for (let month = 0; month < 12; month++) {
      const interest = testBalance * monthlyRate;
      testBalance -= monthlyMortgage - interest;
    }

    const testHomeValue = homePrice * Math.pow(1 + annualAppreciation / 100, year);
    const testEquity = testHomeValue - Math.max(0, testBalance);
    const netOwnership = cumulativeOwnership + downPayment - testEquity;

    if (netOwnership < cumulativeRent && breakEvenYears === 0) {
      breakEvenYears = year;
      break;
    }
  }

  const recommendation: "rent" | "buy" | "neutral" =
    netCostBuying < netCostRenting * DECISIVE_MARGIN
      ? "buy"
      : netCostRenting < netCostBuying * DECISIVE_MARGIN
      ? "rent"
      : "neutral";

  return {
    monthlyMortgage,
    totalMonthlyOwnership,
    totalRentCost,
    totalOwnershipCost,
    homeEquity,
    netCostRenting,
    netCostBuying,
    breakEvenYears,
    recommendation,
  };
}
