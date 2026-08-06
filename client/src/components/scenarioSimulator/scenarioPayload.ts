import type {
  PropertyDetail,
  PropertyType,
  ScenarioFormState,
} from "./types";

// -----------------------------------------------------------------------------
// Pure logic behind the What-If simulator: what gets prefilled from licensed
// property data, and exactly what body is POSTed to /api/scenarios/simulate.
//
// Lifted out of the dialog because this is the part that can be wrong in a way
// nobody sees. The request builder decides whether the LO's typed override
// reaches the engine at all — an optional field that is silently dropped means
// the LO adjusts taxes or a FICO what-if, sees a number change or not, and has
// no way to tell which scenario the engine actually ran. The run is persisted
// to the file's audit trail under that same body, so "what was sent" is a
// record, not a detail.
// -----------------------------------------------------------------------------

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

export function mapPropertyType(raw: string): PropertyType {
  const t = (raw || "").toLowerCase();
  if (/condo/.test(t)) return "condo";
  if (/town/.test(t)) return "townhouse";
  if (/multi|duplex|triplex|fourplex/.test(t)) return "multi_family";
  return "single_family";
}

export interface ScenarioPrefill {
  purchasePrice?: string;
  propertyValue?: string;
  annualTaxes?: string;
  propertyType: PropertyType;
  addressContext: Record<string, string>;
}

/**
 * What a loaded property detail contributes to the form.
 *
 * Only fields with a real value are returned, so an absent tax history or a
 * property with no listed price leaves the LO's own entry untouched rather than
 * overwriting it with a zero.
 */
export function prefillFromProperty(detail: PropertyDetail): ScenarioPrefill {
  const estimate = bestEstimateValue(detail.estimates);
  const price = detail.price > 0 ? detail.price : estimate;
  const latestTax = detail.taxHistory?.[0]?.tax;

  const prefill: ScenarioPrefill = {
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
  if (latestTax && latestTax > 0) prefill.annualTaxes = String(Math.round(latestTax));
  return prefill;
}

/** The Run button's enablement, and the reason when it is off. */
export function scenarioValidity(form: Pick<ScenarioFormState, "purchasePrice" | "downPaymentValue">): {
  valid: boolean;
  priceValid: boolean;
  downPaymentValid: boolean;
} {
  const priceValid = parseFloat(form.purchasePrice) > 0;
  // parseFloat("") is NaN and NaN >= 0 is false, so an emptied field correctly
  // reads as invalid rather than as zero down.
  const downPaymentValid = parseFloat(form.downPaymentValue) >= 0;
  return { valid: priceValid && downPaymentValid, priceValid, downPaymentValid };
}

/**
 * The exact `scenario` object POSTed to /api/scenarios/simulate.
 *
 * Optional inputs are omitted when blank so the engine applies its own
 * platform estimate, and included whenever the LO typed something — including
 * a deliberate 0, which "if (value)" would have dropped.
 */
export function buildScenarioPayload(form: ScenarioFormState): Record<string, unknown> {
  const dpValue = parseFloat(form.downPaymentValue);
  const scenario: Record<string, unknown> = {
    purchasePrice: parseFloat(form.purchasePrice),
    ...(form.downPaymentUnit === "percent"
      ? { downPaymentPercent: dpValue }
      : { downPaymentAmount: dpValue }),
    occupancyType: form.occupancyType,
    propertyType: form.propertyType,
    lockTermDays: Number(form.lockTermDays),
  };

  if (form.productFilter !== "ALL") scenario.productTypes = [form.productFilter];
  if (form.propertyType === "multi_family") scenario.numberOfUnits = Number(form.numberOfUnits);
  if (form.ficoWhatIf.trim() !== "") scenario.ficoWhatIf = Number(form.ficoWhatIf);
  if (form.annualTaxes.trim() !== "") scenario.annualPropertyTaxes = parseFloat(form.annualTaxes);
  if (form.propertyValue.trim() !== "") scenario.propertyValue = parseFloat(form.propertyValue);

  if (form.addressContext) {
    scenario.addressContext = form.addressContext;
    // Two-letter check, not truthiness: the engine keys state overlays off this
    // and a malformed value would silently select the wrong state's rules.
    if (form.addressContext.stateCode?.length === 2) {
      scenario.propertyState = form.addressContext.stateCode;
    }
  }
  return scenario;
}

/** Headline for a non-OK simulator result. */
export function gapHeadline(status: Exclude<ScenarioStatus, "OK">): string {
  switch (status) {
    case "NEEDS_INCOME_EVALUATION":
      return "No persisted income evaluation";
    case "NO_ELIGIBLE_PRODUCTS":
      return "No products in the catalog match this scenario";
    default:
      return "More information needed";
  }
}

type ScenarioStatus = "OK" | "NO_ELIGIBLE_PRODUCTS" | "NEEDS_MORE_INFO" | "NEEDS_INCOME_EVALUATION";
