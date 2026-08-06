// Extracted verbatim from ScenarioSimulatorDialog.tsx: the response-shape
// mirrors of the server engines, the display constants, and the two pure
// derivations (best AVM estimate, property-type mapping) — business logic
// with no JSX, kept separate from the dialog's rendering.

export interface AddressSuggestion {
  id: string;
  type: string;
  label: string;
  city: string | null;
  stateCode: string | null;
}

// Mirrors server/routes/property.ts detail-live (fields used here only).
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

// Mirrors server/services/scenarioSimulator.ts (client-side projection).
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

export const PRODUCT_FILTERS = ["ALL", "CONVENTIONAL", "FHA", "VA", "JUMBO", "ARM"] as const;

/** Best AVM value from the raw realty `estimates` payload (both casings). */
export function bestEstimateValue(estimates: unknown): number | null {
  const e = estimates as { current_values?: unknown; currentValues?: unknown } | null;
  const values = (e?.current_values ?? e?.currentValues) as
    | { estimate?: number; isbest_homevalue?: boolean; isBestHomeValue?: boolean }[]
    | undefined;
  if (!Array.isArray(values) || values.length === 0) return null;
  const usable = values.filter((v) => typeof v?.estimate === "number" && v.estimate! > 0);
  if (usable.length === 0) return null;
  const best = usable.find((v) => v.isbest_homevalue || v.isBestHomeValue) ?? usable[0];
  return best.estimate ?? null;
}

export function mapPropertyType(raw: string): "single_family" | "condo" | "townhouse" | "multi_family" {
  const t = (raw || "").toLowerCase();
  if (/condo/.test(t)) return "condo";
  if (/town/.test(t)) return "townhouse";
  if (/multi|duplex|triplex|fourplex/.test(t)) return "multi_family";
  return "single_family";
}
