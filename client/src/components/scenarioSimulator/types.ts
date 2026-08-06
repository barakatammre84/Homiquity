// Shared types and display maps for the LO-2 What-If Scenario Simulator.
// Split out of ScenarioSimulatorDialog.tsx so the request-building logic in
// scenarioPayload.ts can be tested without mounting a dialog.

export interface AddressSuggestion {
  id: string;
  type: string;
  label: string;
  city: string | null;
  stateCode: string | null;
}

/** Mirrors server/routes/property.ts detail-live (fields used here only). */
export interface PropertyDetail {
  property_id: string;
  price: number;
  address: string;
  city: string;
  stateCode: string;
  zipcode: string;
  propertyType: string;
  taxHistory: { year: number; tax: number }[];
  estimates: unknown;
  hoa: { fee: number; frequency: string } | null;
}

/** Mirrors server/services/scenarioSimulator.ts (client-side projection). */
export interface OfferQualification {
  decision: "APPROVED" | "REJECTED" | "MANUAL_REVIEW";
  dti: number | null;
  ltv: number | null;
  reasons: string[];
}

export interface EvaluatedOffer {
  lenderId: string;
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  loanTerm: number;
  lockTerm: number;
  adjustedRate: number;
  payment: {
    principalAndInterest: number;
    mortgageInsurance: number;
    escrow: number;
    totalPiti: number;
  };
  apr: number;
  costs: { totalClosingCosts: number; cashToClose: number; pointsAndFeesDollars: number };
  qualification: OfferQualification;
}

export interface AntiSteeringOption {
  key: "lowest_rate" | "lowest_rate_no_risky_features" | "lowest_points_and_fees";
  lenderId: string;
  productId: string;
}

export interface ScenarioResponse {
  runId: string | null;
  serverMs: number;
  status: "OK" | "NO_ELIGIBLE_PRODUCTS" | "NEEDS_MORE_INFO" | "NEEDS_INCOME_EVALUATION";
  simulated: boolean;
  missingItems: string[];
  income: {
    primaryMonthlyQualifyingIncome: number;
    incomeBasis: string;
    requiresManualReview: boolean;
  } | null;
  monthlyDebts: number | null;
  offers: EvaluatedOffer[];
  excludedProducts: string[];
  antiSteering: {
    citation: string;
    creditorsQuoted: number;
    options: AntiSteeringOption[];
  } | null;
}

export type OccupancyType = "primary_residence" | "second_home" | "investment";
export type PropertyType = "single_family" | "condo" | "townhouse" | "multi_family";
export type DownPaymentUnit = "percent" | "amount";

export const PRODUCT_FILTERS = ["ALL", "CONVENTIONAL", "FHA", "VA", "JUMBO", "ARM"] as const;
export type ProductFilter = (typeof PRODUCT_FILTERS)[number];

export const OPTION_LABELS: Record<AntiSteeringOption["key"], string> = {
  lowest_rate: "Lowest rate",
  lowest_rate_no_risky_features: "Lowest rate, no risky features",
  lowest_points_and_fees: "Lowest points & fees",
};

export const DECISION_BADGE: Record<
  OfferQualification["decision"],
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  APPROVED: { label: "Qualifies", variant: "success" },
  MANUAL_REVIEW: { label: "Manual review", variant: "warning" },
  REJECTED: { label: "Does not qualify", variant: "destructive" },
};

/** Every field the LO can dial, as held in component state (all strings). */
export interface ScenarioFormState {
  purchasePrice: string;
  downPaymentValue: string;
  downPaymentUnit: DownPaymentUnit;
  productFilter: ProductFilter;
  occupancyType: OccupancyType;
  propertyType: PropertyType;
  numberOfUnits: string;
  ficoWhatIf: string;
  lockTermDays: string;
  annualTaxes: string;
  propertyValue: string;
  addressContext: Record<string, string> | null;
}
