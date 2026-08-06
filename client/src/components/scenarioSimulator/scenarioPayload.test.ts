import { describe, it, expect } from "vitest";
import {
  bestEstimateValue,
  buildScenarioPayload,
  gapHeadline,
  mapPropertyType,
  prefillFromProperty,
  scenarioValidity,
} from "./scenarioPayload";
import type { PropertyDetail, ScenarioFormState } from "./types";

const baseForm: ScenarioFormState = {
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

const form = (over: Partial<ScenarioFormState> = {}): ScenarioFormState => ({ ...baseForm, ...over });

describe("buildScenarioPayload", () => {
  it("sends the required fields and nothing optional when nothing optional is set", () => {
    expect(buildScenarioPayload(form())).toEqual({
      purchasePrice: 500000,
      downPaymentPercent: 20,
      occupancyType: "primary_residence",
      propertyType: "single_family",
      lockTermDays: 30,
    });
  });

  it("switches the down-payment field with the unit, never sending both", () => {
    // Sending both would leave the engine to pick, and the LO would have no way
    // to know which one priced the scenario.
    const pct = buildScenarioPayload(form({ downPaymentUnit: "percent", downPaymentValue: "10" }));
    expect(pct).toHaveProperty("downPaymentPercent", 10);
    expect(pct).not.toHaveProperty("downPaymentAmount");

    const amt = buildScenarioPayload(form({ downPaymentUnit: "amount", downPaymentValue: "50000" }));
    expect(amt).toHaveProperty("downPaymentAmount", 50000);
    expect(amt).not.toHaveProperty("downPaymentPercent");
  });

  it("sends productTypes only when a filter is chosen", () => {
    expect(buildScenarioPayload(form({ productFilter: "ALL" }))).not.toHaveProperty("productTypes");
    expect(buildScenarioPayload(form({ productFilter: "FHA" })).productTypes).toEqual(["FHA"]);
  });

  it("sends numberOfUnits only for multi-family", () => {
    expect(buildScenarioPayload(form({ numberOfUnits: "3" }))).not.toHaveProperty("numberOfUnits");
    const multi = buildScenarioPayload(form({ propertyType: "multi_family", numberOfUnits: "3" }));
    expect(multi.numberOfUnits).toBe(3);
  });

  it("omits blank optional numbers but keeps a deliberate zero", () => {
    // The distinction the trim() check exists for. `if (annualTaxes)` would
    // drop "0" — an LO zeroing out taxes on an exempt property would silently
    // get the platform estimate back instead, and the run recorded to the audit
    // trail would not be the scenario they ran.
    expect(buildScenarioPayload(form({ annualTaxes: "" }))).not.toHaveProperty("annualPropertyTaxes");
    expect(buildScenarioPayload(form({ annualTaxes: "   " }))).not.toHaveProperty("annualPropertyTaxes");
    expect(buildScenarioPayload(form({ annualTaxes: "0" })).annualPropertyTaxes).toBe(0);
    expect(buildScenarioPayload(form({ annualTaxes: "8400" })).annualPropertyTaxes).toBe(8400);
  });

  it("passes the FICO what-if through as a number when supplied", () => {
    expect(buildScenarioPayload(form())).not.toHaveProperty("ficoWhatIf");
    expect(buildScenarioPayload(form({ ficoWhatIf: "720" })).ficoWhatIf).toBe(720);
  });

  it("passes an overridden property value through", () => {
    expect(buildScenarioPayload(form({ propertyValue: "525000" })).propertyValue).toBe(525000);
  });

  it("derives propertyState only from a two-letter code", () => {
    const ctx = (stateCode: string) => ({
      line: "1 Main St", city: "Chicago", stateCode, zipcode: "60601",
      propertyId: "p1", source: "realty-us", observedPropertyType: "Single Family",
    });
    expect(buildScenarioPayload(form({ addressContext: ctx("IL") })).propertyState).toBe("IL");
    // A full name or an empty string must not be forwarded: the engine keys
    // state overlays off this field, so a malformed value selects real rules
    // from the wrong jurisdiction rather than failing.
    expect(buildScenarioPayload(form({ addressContext: ctx("Illinois") }))).not.toHaveProperty("propertyState");
    expect(buildScenarioPayload(form({ addressContext: ctx("") }))).not.toHaveProperty("propertyState");
  });

  it("always forwards the whole addressContext when one is present", () => {
    const ctx = { line: "1 Main St", city: "Chicago", stateCode: "IL", zipcode: "60601", propertyId: "p1", source: "realty-us", observedPropertyType: "Condo" };
    expect(buildScenarioPayload(form({ addressContext: ctx })).addressContext).toEqual(ctx);
  });
});

describe("scenarioValidity", () => {
  it("requires a positive price and a non-negative down payment", () => {
    expect(scenarioValidity({ purchasePrice: "500000", downPaymentValue: "20" }).valid).toBe(true);
    expect(scenarioValidity({ purchasePrice: "500000", downPaymentValue: "0" }).valid).toBe(true);
  });

  it("treats an emptied field as invalid rather than as zero", () => {
    // parseFloat("") is NaN; NaN >= 0 is false. Pinned because flipping this to
    // `|| 0` would enable the Run button on an empty form.
    expect(scenarioValidity({ purchasePrice: "", downPaymentValue: "20" })).toMatchObject({ valid: false, priceValid: false });
    expect(scenarioValidity({ purchasePrice: "500000", downPaymentValue: "" })).toMatchObject({ valid: false, downPaymentValid: false });
  });

  it("rejects a zero or negative price and a negative down payment", () => {
    expect(scenarioValidity({ purchasePrice: "0", downPaymentValue: "20" }).priceValid).toBe(false);
    expect(scenarioValidity({ purchasePrice: "-1", downPaymentValue: "20" }).priceValid).toBe(false);
    expect(scenarioValidity({ purchasePrice: "500000", downPaymentValue: "-5" }).downPaymentValid).toBe(false);
  });
});

describe("bestEstimateValue", () => {
  const wrap = (values: unknown, key: "current_values" | "currentValues" = "current_values") => ({ [key]: values });

  it("reads both the snake_case and camelCase payload shapes", () => {
    expect(bestEstimateValue(wrap([{ estimate: 400000 }]))).toBe(400000);
    expect(bestEstimateValue(wrap([{ estimate: 400000 }], "currentValues"))).toBe(400000);
  });

  it("prefers the flagged best value over the first one", () => {
    const values = [{ estimate: 380000 }, { estimate: 410000, isbest_homevalue: true }];
    expect(bestEstimateValue(wrap(values))).toBe(410000);
    expect(bestEstimateValue(wrap([{ estimate: 380000 }, { estimate: 410000, isBestHomeValue: true }]))).toBe(410000);
  });

  it("ignores zero, negative and non-numeric estimates", () => {
    expect(bestEstimateValue(wrap([{ estimate: 0 }, { estimate: 350000 }]))).toBe(350000);
    expect(bestEstimateValue(wrap([{ estimate: -5 }, { estimate: 350000 }]))).toBe(350000);
    expect(bestEstimateValue(wrap([{ estimate: "350000" }]))).toBeNull();
  });

  it("returns null rather than throwing on absent or malformed payloads", () => {
    expect(bestEstimateValue(null)).toBeNull();
    expect(bestEstimateValue(undefined)).toBeNull();
    expect(bestEstimateValue({})).toBeNull();
    expect(bestEstimateValue(wrap([]))).toBeNull();
    expect(bestEstimateValue(wrap("nonsense"))).toBeNull();
  });
});

describe("mapPropertyType", () => {
  it("maps the realty vocabulary onto the engine's four types", () => {
    expect(mapPropertyType("Condominium")).toBe("condo");
    expect(mapPropertyType("Townhome")).toBe("townhouse");
    expect(mapPropertyType("Duplex")).toBe("multi_family");
    expect(mapPropertyType("Triplex")).toBe("multi_family");
    expect(mapPropertyType("Fourplex")).toBe("multi_family");
    expect(mapPropertyType("Single Family Residence")).toBe("single_family");
  });

  it("falls back to single family for unknown and empty input", () => {
    expect(mapPropertyType("")).toBe("single_family");
    expect(mapPropertyType(undefined as never)).toBe("single_family");
    expect(mapPropertyType("Barndominium")).toBe("single_family");
  });

  it("matches on substrings, which is deliberate but worth knowing", () => {
    // The patterns are substring tests, so anything containing "condo" maps to
    // condo regardless of what it actually is. That is what makes the realty
    // vocabulary tractable ("Condominium", "Condo/Co-op", "Low-Rise Condo"),
    // and it is also the sharp edge — pinned so a future pattern change has to
    // confront it rather than discover it.
    expect(mapPropertyType("Low-Rise Condo")).toBe("condo");
    expect(mapPropertyType("Condo/Co-op")).toBe("condo");
    expect(mapPropertyType("Townhouse Condo")).toBe("condo"); // condo wins: checked first
  });
});

describe("prefillFromProperty", () => {
  const detail = (over: Partial<PropertyDetail> = {}): PropertyDetail => ({
    property_id: "p1",
    price: 500000,
    address: "1 Main St",
    city: "Chicago",
    stateCode: "IL",
    zipcode: "60601",
    propertyType: "Condominium",
    taxHistory: [{ year: 2025, tax: 8400 }],
    estimates: { current_values: [{ estimate: 512000, isbest_homevalue: true }] },
    hoa: null,
    ...over,
  });

  it("prefills price, value, taxes, type and the address context", () => {
    expect(prefillFromProperty(detail())).toEqual({
      purchasePrice: "500000",
      propertyValue: "512000",
      annualTaxes: "8400",
      propertyType: "condo",
      addressContext: {
        line: "1 Main St", city: "Chicago", stateCode: "IL", zipcode: "60601",
        propertyId: "p1", source: "realty-us", observedPropertyType: "Condominium",
      },
    });
  });

  it("falls back to the AVM estimate when the property has no listed price", () => {
    expect(prefillFromProperty(detail({ price: 0 })).purchasePrice).toBe("512000");
  });

  it("omits fields it has no value for, rather than writing a zero over the LO's entry", () => {
    const bare = prefillFromProperty(detail({ price: 0, estimates: null, taxHistory: [] }));
    expect(bare).not.toHaveProperty("purchasePrice");
    expect(bare).not.toHaveProperty("propertyValue");
    expect(bare).not.toHaveProperty("annualTaxes");
    expect(bare.propertyType).toBe("condo");
  });

  it("omits a zero tax rather than claiming the property is tax-exempt", () => {
    expect(prefillFromProperty(detail({ taxHistory: [{ year: 2025, tax: 0 }] }))).not.toHaveProperty("annualTaxes");
  });

  it("survives a missing tax history entirely", () => {
    expect(() => prefillFromProperty(detail({ taxHistory: undefined as never }))).not.toThrow();
  });

  it("rounds fractional values to whole dollars", () => {
    expect(prefillFromProperty(detail({ price: 499999.6 })).purchasePrice).toBe("500000");
  });
});

describe("gapHeadline", () => {
  it("names each non-OK status distinctly", () => {
    expect(gapHeadline("NEEDS_INCOME_EVALUATION")).toMatch(/persisted income/);
    expect(gapHeadline("NO_ELIGIBLE_PRODUCTS")).toMatch(/No products/);
    expect(gapHeadline("NEEDS_MORE_INFO")).toMatch(/More information/);
  });
});
