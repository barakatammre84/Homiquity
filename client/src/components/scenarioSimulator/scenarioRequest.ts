// -----------------------------------------------------------------------------
// Scenario-simulator request logic (refactor-radar RR-004) — the pure,
// render-free half of ScenarioSimulatorDialog: the server-response projections,
// the licensed-property prefill derivation, and the POST /api/scenarios/simulate
// payload assembly. Extracted verbatim from the dialog; behavior is pinned by
// ScenarioSimulatorDialog.test.tsx (end-to-end) and scenarioRequest.test.ts
// (vectors). The engines stay server-side — nothing here computes a payment,
// rate, or qualification.
// -----------------------------------------------------------------------------

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

/** The dialog's form state, as strings exactly as the inputs hold them. */
export interface ScenarioFormInputs {
  purchasePrice: string;
  downPaymentValue: string;
  downPaymentUnit: "percent" | "amount";
  productFilter: (typeof PRODUCT_FILTERS)[number];
  occupancyType: "primary_residence" | "second_home" | "investment";
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family";
  numberOfUnits: string;
  ficoWhatIf: string;
  lockTermDays: string;
  annualTaxes: string;
  propertyValue: string;
  addressContext: Record<string, string> | null;
}

/** The `scenario` body for POST /api/scenarios/simulate — optional keys appear only when set. */
export function buildScenarioPayload(inputs: ScenarioFormInputs): Record<string, unknown> {
  const price = parseFloat(inputs.purchasePrice);
  const dpValue = parseFloat(inputs.downPaymentValue);
  const scenario: Record<string, unknown> = {
    purchasePrice: price,
    ...(inputs.downPaymentUnit === "percent"
      ? { downPaymentPercent: dpValue }
      : { downPaymentAmount: dpValue }),
    occupancyType: inputs.occupancyType,
    propertyType: inputs.propertyType,
    lockTermDays: Number(inputs.lockTermDays),
  };
  if (inputs.productFilter !== "ALL") scenario.productTypes = [inputs.productFilter];
  if (inputs.propertyType === "multi_family") scenario.numberOfUnits = Number(inputs.numberOfUnits);
  if (inputs.ficoWhatIf.trim() !== "") scenario.ficoWhatIf = Number(inputs.ficoWhatIf);
  if (inputs.annualTaxes.trim() !== "") scenario.annualPropertyTaxes = parseFloat(inputs.annualTaxes);
  if (inputs.propertyValue.trim() !== "") scenario.propertyValue = parseFloat(inputs.propertyValue);
  if (inputs.addressContext) {
    scenario.addressContext = inputs.addressContext;
    if (inputs.addressContext.stateCode?.length === 2) scenario.propertyState = inputs.addressContext.stateCode;
  }
  return scenario;
}

export interface PropertyPrefill {
  purchasePrice?: string;
  propertyValue?: string;
  annualTaxes?: string;
  propertyType: ScenarioFormInputs["propertyType"];
  addressContext: Record<string, string>;
}

/** Prefill derivation from licensed property detail (never scraped). Absent keys mean "leave the field alone". */
export function derivePropertyPrefill(detail: PropertyDetail): PropertyPrefill {
  const estimate = bestEstimateValue(detail.estimates);
  const price = detail.price > 0 ? detail.price : estimate;
  const prefill: PropertyPrefill = {
    propertyType: mapPropertyType(detail.propertyType),
    addressContext: {
      line: detail.address,
      city: detail.city,
      stateCode: detail.stateCode,
      zipcode: detail.zipcode,
      propertyId: detail.property_id,
      source: "realty-us",
      observedPropertyType: detail.propertyType,
    },
  };
  if (price) prefill.purchasePrice = String(Math.round(price));
  if (estimate) prefill.propertyValue = String(Math.round(estimate));
  const latestTax = detail.taxHistory?.[0]?.tax;
  if (latestTax && latestTax > 0) prefill.annualTaxes = String(Math.round(latestTax));
  return prefill;
}
