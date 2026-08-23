import { monthlyPrincipalAndInterest } from "@shared/lib/amortization";

export interface CalculatorInputs {
  monthlyRent: number;
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  maintenanceRate: number;
  yearsToStay: number;
  annualRentIncrease: number;
  annualAppreciation: number;
}

export interface CalculatorResults {
  monthlyMortgage: number;
  totalMonthlyOwnership: number;
  totalRentCost: number;
  totalOwnershipCost: number;
  homeEquity: number;
  netCostRenting: number;
  netCostBuying: number;
  breakEvenYears: number;
  recommendation: "rent" | "buy" | "neutral";
}

export const defaultInputs: CalculatorInputs = {
  monthlyRent: 2000,
  homePrice: 400000,
  downPaymentPercent: 20,
  interestRate: 6.5,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  maintenanceRate: 1,
  yearsToStay: 5,
  annualRentIncrease: 3,
  annualAppreciation: 3,
};

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

  // Clamp before deriving money. The page's number inputs carry no `min`, so a
  // negative home price inverted every ownership figure — a -$225 monthly cost
  // and -$5,302 of "equity". Same guard as HomeEquityCalculator's
  // `Math.max(0, homeValue)`.
  const price = Math.max(0, homePrice);
  const rent = Math.max(0, monthlyRent);
  const downPayment = price * (downPaymentPercent / 100);
  const loanAmount = price - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = 30 * 12;

  const monthlyMortgage = monthlyPrincipalAndInterest(loanAmount, interestRate, numPayments);

  const monthlyPropertyTax = (price * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (price * (insuranceRate / 100)) / 12;
  const monthlyMaintenance = (price * (maintenanceRate / 100)) / 12;
  const totalMonthlyOwnership =
    monthlyMortgage + monthlyPropertyTax + monthlyInsurance + hoaMonthly + monthlyMaintenance;

  let totalRentCost = 0;
  let currentRent = rent;
  for (let year = 0; year < yearsToStay; year++) {
    totalRentCost += currentRent * 12;
    currentRent *= 1 + annualRentIncrease / 100;
  }

  const totalOwnershipCost = totalMonthlyOwnership * 12 * yearsToStay;

  const futureHomeValue = price * Math.pow(1 + annualAppreciation / 100, yearsToStay);

  let remainingBalance = loanAmount;
  for (let month = 0; month < yearsToStay * 12; month++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyMortgage - interestPayment;
    remainingBalance -= principalPayment;
  }
  const homeEquity = futureHomeValue - remainingBalance;

  const netCostRenting = totalRentCost;
  const netCostBuying = totalOwnershipCost + downPayment - homeEquity;

  let breakEvenYears = 0;
  let cumulativeRent = 0;
  let cumulativeOwnership = 0;
  let testRent = rent;
  let testBalance = loanAmount;

  for (let year = 1; year <= 30; year++) {
    cumulativeRent += testRent * 12;
    testRent *= 1 + annualRentIncrease / 100;

    cumulativeOwnership += totalMonthlyOwnership * 12;

    for (let month = 0; month < 12; month++) {
      const interest = testBalance * monthlyRate;
      testBalance -= monthlyMortgage - interest;
    }

    const testHomeValue = price * Math.pow(1 + annualAppreciation / 100, year);
    const testEquity = testHomeValue - Math.max(0, testBalance);
    const netOwnership = cumulativeOwnership + downPayment - testEquity;

    if (netOwnership < cumulativeRent && breakEvenYears === 0) {
      breakEvenYears = year;
      break;
    }
  }

  const recommendation: "rent" | "buy" | "neutral" =
    netCostBuying < netCostRenting * 0.9
      ? "buy"
      : netCostRenting < netCostBuying * 0.9
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
