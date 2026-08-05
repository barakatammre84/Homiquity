export interface CalculatorInputs {
  monthlyRent: number;
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  /** No UI control — a fixed assumption. See calculate.ts. */
  propertyTaxRate: number;
  /** No UI control — a fixed assumption. See calculate.ts. */
  insuranceRate: number;
  hoaMonthly: number;
  /** No UI control — a fixed assumption. See calculate.ts. */
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
  /** Years until buying overtakes renting; 0 means "not within 30 years". */
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
