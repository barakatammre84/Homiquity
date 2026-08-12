import { describe, it, expect } from "vitest";
import {
  bestEstimateValue,
  buildScenarioPayload,
  derivePropertyPrefill,
  mapPropertyType,
  type PropertyDetail,
  type ScenarioFormInputs,
} from "./scenarioRequest";

// Unit vectors for the logic extracted from ScenarioSimulatorDialog (RR-004).
// The dialog-level characterization suite pins the end-to-end behavior; these
// pin each function's edges so a future change fails here with a named cause.

const DEFAULTS: ScenarioFormInputs = {
  purchasePrice: "500000",
  downPaymentValue: "20",
  downPaymentUnit: "percent",
  productFilter: "ALL",
  occupancyType: "primary_residence",
  propertyType: "single_family",
  numberOfUnits: "2",
  ficoWhatIf: "",
  lockTermDays: "30",
  annualTaxes: "",
  propertyValue: "",
  addressContext: null,
};

describe("bestEstimateValue", () => {
  it("prefers the best-flagged value in either casing", () => {
    expect(
      bestEstimateValue({
        current_values: [
          { estimate: 100, isbest_homevalue: false },
          { estimate: 200, isBestHomeValue: true },
        ],
      }),
    ).toBe(200);
    expect(
      bestEstimateValue({
        currentValues: [
          { estimate: 300, isbest_homevalue: true },
          { estimate: 400 },
        ],
      }),
    ).toBe(300);
  });

  it("falls back to the first usable value and filters non-positive entries", () => {
    expect(
      bestEstimateValue({ current_values: [{ estimate: 0 }, { estimate: -5 }, { estimate: 250 }] }),
    ).toBe(250);
  });

  it("returns null for empty, missing, or unusable payloads", () => {
    expect(bestEstimateValue(null)).toBeNull();
    expect(bestEstimateValue({})).toBeNull();
    expect(bestEstimateValue({ current_values: [] })).toBeNull();
    expect(bestEstimateValue({ current_values: [{ estimate: 0 }] })).toBeNull();
  });
});

describe("mapPropertyType", () => {
  it("maps raw realty labels onto the scenario enum", () => {
    expect(mapPropertyType("Condominium")).toBe("condo");
    expect(mapPropertyType("Townhouse")).toBe("townhouse");
    expect(mapPropertyType("Multi-Family")).toBe("multi_family");
    expect(mapPropertyType("Duplex")).toBe("multi_family");
    expect(mapPropertyType("Single Family Residence")).toBe("single_family");
    expect(mapPropertyType("")).toBe("single_family");
  });
});

describe("buildScenarioPayload", () => {
  it("builds the default percent-unit scenario with no optional keys", () => {
    expect(buildScenarioPayload(DEFAULTS)).toEqual({
      purchasePrice: 500000,
      downPaymentPercent: 20,
      occupancyType: "primary_residence",
      propertyType: "single_family",
      lockTermDays: 30,
    });
  });

  it("switches to downPaymentAmount for the dollar unit", () => {
    expect(
      buildScenarioPayload({ ...DEFAULTS, downPaymentUnit: "amount", downPaymentValue: "50000" }),
    ).toMatchObject({ downPaymentAmount: 50000 });
  });

  it("adds each optional key only when its input is set", () => {
    expect(
      buildScenarioPayload({
        ...DEFAULTS,
        purchasePrice: "450000",
        productFilter: "FHA",
        propertyType: "multi_family",
        numberOfUnits: "3",
        ficoWhatIf: "700",
        lockTermDays: "45",
        annualTaxes: "4800",
        propertyValue: "501235",
      }),
    ).toEqual({
      purchasePrice: 450000,
      downPaymentPercent: 20,
      occupancyType: "primary_residence",
      propertyType: "multi_family",
      lockTermDays: 45,
      productTypes: ["FHA"],
      numberOfUnits: 3,
      ficoWhatIf: 700,
      annualPropertyTaxes: 4800,
      propertyValue: 501235,
    });
  });

  it("treats whitespace-only optional inputs as unset", () => {
    const scenario = buildScenarioPayload({ ...DEFAULTS, ficoWhatIf: "   ", annualTaxes: " " });
    expect(scenario).not.toHaveProperty("ficoWhatIf");
    expect(scenario).not.toHaveProperty("annualPropertyTaxes");
  });

  it("passes the address context through and derives propertyState only from a 2-char stateCode", () => {
    const addressContext = { line: "1 Elm", city: "Aurora", stateCode: "IL", zipcode: "60505" };
    expect(buildScenarioPayload({ ...DEFAULTS, addressContext })).toMatchObject({
      addressContext,
      propertyState: "IL",
    });
    expect(
      buildScenarioPayload({ ...DEFAULTS, addressContext: { ...addressContext, stateCode: "Illinois" } }),
    ).not.toHaveProperty("propertyState");
  });
});

describe("derivePropertyPrefill", () => {
  const DETAIL: PropertyDetail = {
    property_id: "prop-123",
    price: 512345.67,
    address: "123 Main St",
    city: "Naperville",
    stateCode: "IL",
    zipcode: "60540",
    propertyType: "Condominium",
    taxHistory: [{ year: 2025, tax: 8123.45 }],
    estimates: { current_values: [{ estimate: 501234.56, isbest_homevalue: true }] },
    hoa: null,
  };

  it("rounds price, best estimate, and latest tax into input strings", () => {
    expect(derivePropertyPrefill(DETAIL)).toEqual({
      purchasePrice: "512346",
      propertyValue: "501235",
      annualTaxes: "8123",
      propertyType: "condo",
      addressContext: {
        line: "123 Main St",
        city: "Naperville",
        stateCode: "IL",
        zipcode: "60540",
        propertyId: "prop-123",
        source: "realty-us",
        observedPropertyType: "Condominium",
      },
    });
  });

  it("falls back to the AVM estimate when the listing price is not positive", () => {
    const prefill = derivePropertyPrefill({ ...DETAIL, price: 0 });
    expect(prefill.purchasePrice).toBe("501235");
    expect(prefill.propertyValue).toBe("501235");
  });

  it("omits fields whose sources are absent instead of writing zeros", () => {
    const prefill = derivePropertyPrefill({ ...DETAIL, price: 0, estimates: null, taxHistory: [] });
    expect(prefill).not.toHaveProperty("purchasePrice");
    expect(prefill).not.toHaveProperty("propertyValue");
    expect(prefill).not.toHaveProperty("annualTaxes");
    expect(prefill.propertyType).toBe("condo");
  });

  it("skips a zero latest tax", () => {
    const prefill = derivePropertyPrefill({ ...DETAIL, taxHistory: [{ year: 2025, tax: 0 }] });
    expect(prefill).not.toHaveProperty("annualTaxes");
  });
});
