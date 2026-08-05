export interface ValueEstimate {
  value: number;
  low: number | null;
  high: number | null;
  date: string | null;
  source: string | null;
  sources: { name: string | null; value: number }[];
}

export interface PropertyData {
  propertyId: string;
  price: number;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  zipcode: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  photo: string | null;
  photos: string[];
  status: string;
  propertyTaxRate: number;
  hoaMonthly: number;
  mortgage: { monthlyPayment: number; rate: number | null } | null;
  neighborhoods: { name: string; medianPrice: number | null }[];
  coordinate?: { lat: number; lon?: number; lng?: number } | null;
  valueEstimate?: ValueEstimate | null;
}

export interface FinancialInputs {
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
  creditScore: number;
  interestRate: number;
}

export type AffordabilityStatus = "affordable" | "stretch" | "over_budget";

export interface AffordabilityResult {
  monthlyPayment: number;
  principalInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  loanAmount: number;
  downPaymentPercent: number;
  frontEndDTI: number;
  backEndDTI: number;
  status: AffordabilityStatus;
  maxBackEndDTI: number;
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhomes: "Townhouse",
  multi_family: "Multi-Family",
  apartment: "Apartment",
};
