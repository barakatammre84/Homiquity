import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// -----------------------------------------------------------------------------
// LO-2 — What-If Scenario Simulator data layer, extracted from
// ScenarioSimulatorDialog.tsx so the component stays render-only.
//
// Address-first intake (licensed realty adapter, never scraped), scenario
// input state, and the POST /api/scenarios/simulate mutation all live here.
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
function bestEstimateValue(estimates: unknown): number | null {
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

function mapPropertyType(raw: string): "single_family" | "condo" | "townhouse" | "multi_family" {
  const t = (raw || "").toLowerCase();
  if (/condo/.test(t)) return "condo";
  if (/town/.test(t)) return "townhouse";
  if (/multi|duplex|triplex|fourplex/.test(t)) return "multi_family";
  return "single_family";
}

export function useScenarioSimulator({ applicationId, open }: { applicationId: string; open: boolean }) {
  const { toast } = useToast();

  // --- Address-first intake -------------------------------------------------
  const [addressInput, setAddressInput] = useState("");
  const [debouncedAddress, setDebouncedAddress] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [addressContext, setAddressContext] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAddress(addressInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [addressInput]);

  const { data: suggestions } = useQuery<AddressSuggestion[]>({
    queryKey: [`/api/properties/auto-complete?input=${encodeURIComponent(debouncedAddress)}`],
    enabled: open && debouncedAddress.length >= 3 && !selectedPropertyId,
    staleTime: 60_000,
  });

  const { data: propertyDetail, isLoading: detailLoading } = useQuery<PropertyDetail>({
    queryKey: [`/api/properties/detail-live?propertyId=${selectedPropertyId}`],
    enabled: open && !!selectedPropertyId,
    staleTime: 60_000,
    retry: false,
  });

  // --- Scenario inputs ------------------------------------------------------
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPaymentValue, setDownPaymentValue] = useState("20");
  const [downPaymentUnit, setDownPaymentUnit] = useState<"percent" | "amount">("percent");
  const [productFilter, setProductFilter] = useState<(typeof PRODUCT_FILTERS)[number]>("ALL");
  const [occupancyType, setOccupancyType] = useState<"primary_residence" | "second_home" | "investment">("primary_residence");
  const [propertyType, setPropertyType] = useState<"single_family" | "condo" | "townhouse" | "multi_family">("single_family");
  const [numberOfUnits, setNumberOfUnits] = useState("2");
  const [ficoWhatIf, setFicoWhatIf] = useState("");
  const [lockTermDays, setLockTermDays] = useState("30");
  const [annualTaxes, setAnnualTaxes] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [result, setResult] = useState<ScenarioResponse | null>(null);

  // Prefill once per loaded property detail (licensed data, never scraped).
  useEffect(() => {
    if (!propertyDetail) return;
    const estimate = bestEstimateValue(propertyDetail.estimates);
    const price = propertyDetail.price > 0 ? propertyDetail.price : estimate;
    if (price) setPurchasePrice(String(Math.round(price)));
    if (estimate) setPropertyValue(String(Math.round(estimate)));
    const latestTax = propertyDetail.taxHistory?.[0]?.tax;
    if (latestTax && latestTax > 0) setAnnualTaxes(String(Math.round(latestTax)));
    setPropertyType(mapPropertyType(propertyDetail.propertyType));
    setAddressContext({
      line: propertyDetail.address,
      city: propertyDetail.city,
      stateCode: propertyDetail.stateCode,
      zipcode: propertyDetail.zipcode,
      propertyId: propertyDetail.property_id,
      source: "realty-us",
      observedPropertyType: propertyDetail.propertyType,
    });
  }, [propertyDetail]);

  const simulate = useMutation({
    mutationFn: async (): Promise<ScenarioResponse> => {
      const price = parseFloat(purchasePrice);
      const dpValue = parseFloat(downPaymentValue);
      const scenario: Record<string, unknown> = {
        purchasePrice: price,
        ...(downPaymentUnit === "percent"
          ? { downPaymentPercent: dpValue }
          : { downPaymentAmount: dpValue }),
        occupancyType,
        propertyType,
        lockTermDays: Number(lockTermDays),
      };
      if (productFilter !== "ALL") scenario.productTypes = [productFilter];
      if (propertyType === "multi_family") scenario.numberOfUnits = Number(numberOfUnits);
      if (ficoWhatIf.trim() !== "") scenario.ficoWhatIf = Number(ficoWhatIf);
      if (annualTaxes.trim() !== "") scenario.annualPropertyTaxes = parseFloat(annualTaxes);
      if (propertyValue.trim() !== "") scenario.propertyValue = parseFloat(propertyValue);
      if (addressContext) {
        scenario.addressContext = addressContext;
        if (addressContext.stateCode?.length === 2) scenario.propertyState = addressContext.stateCode;
      }
      const res = await apiRequest("POST", "/api/scenarios/simulate", { applicationId, scenario });
      return res.json();
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => {
      toast({ title: "Scenario failed", description: error.message, variant: "destructive" });
    },
  });

  const offersById = useMemo(() => {
    const map = new Map<string, EvaluatedOffer>();
    for (const offer of result?.offers ?? []) map.set(`${offer.lenderId}:${offer.productId}`, offer);
    return map;
  }, [result]);

  const priceValid = parseFloat(purchasePrice) > 0;
  const dpValid = parseFloat(downPaymentValue) >= 0;

  return {
    addressInput,
    setAddressInput,
    selectedPropertyId,
    setSelectedPropertyId,
    addressContext,
    suggestions,
    detailLoading,
    purchasePrice,
    setPurchasePrice,
    downPaymentValue,
    setDownPaymentValue,
    downPaymentUnit,
    setDownPaymentUnit,
    productFilter,
    setProductFilter,
    occupancyType,
    setOccupancyType,
    propertyType,
    setPropertyType,
    numberOfUnits,
    setNumberOfUnits,
    ficoWhatIf,
    setFicoWhatIf,
    lockTermDays,
    setLockTermDays,
    annualTaxes,
    setAnnualTaxes,
    result,
    simulate,
    offersById,
    priceValid,
    dpValid,
  };
}
