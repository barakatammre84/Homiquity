import { describe, it, expect } from "vitest";
import { formatInputCurrency, parseCurrencyInput, maskCurrencyDigits } from "./formatters";

// Two currency-input contracts live in formatters.ts and they are NOT
// interchangeable. They agree on every non-empty value and disagree on exactly
// one case — the emptied field — which is why the pre-approval funnel cannot be
// migrated onto the number-state pair. These tests exist to make a future
// "let's just consolidate these" go red instead of shipping.

describe("currency input masks", () => {
  describe("maskCurrencyDigits (string state — the pre-approval funnel)", () => {
    it("groups typed digits without a currency symbol", () => {
      expect(maskCurrencyDigits("1250")).toBe("1,250");
      expect(maskCurrencyDigits("125000")).toBe("125,000");
      expect(maskCurrencyDigits("1234567")).toBe("1,234,567");
    });

    it("strips everything that is not a digit, including a re-typed mask", () => {
      expect(maskCurrencyDigits("$1,250.00")).toBe("125,000");
      expect(maskCurrencyDigits("12a3")).toBe("123");
    });

    it("keeps an emptied field empty — placeholder shows, required-field validation still fires", () => {
      expect(maskCurrencyDigits("")).toBe("");
      expect(maskCurrencyDigits("$")).toBe("");
    });

    it("preserves a deliberately typed zero", () => {
      expect(maskCurrencyDigits("0")).toBe("0");
    });
  });

  describe("formatInputCurrency / parseCurrencyInput (number state — the calculators)", () => {
    it("round-trips a grouped value", () => {
      expect(formatInputCurrency(parseCurrencyInput("125,000"))).toBe("125,000");
    });

    it("collapses an emptied field to zero — an absent input is a zero input", () => {
      expect(parseCurrencyInput("")).toBe(0);
      expect(formatInputCurrency(parseCurrencyInput(""))).toBe("0");
    });
  });

  it("the two masks agree on every non-empty amount", () => {
    for (const typed of ["1", "999", "1000", "125000", "1234567"]) {
      expect(maskCurrencyDigits(typed)).toBe(formatInputCurrency(parseCurrencyInput(typed)));
    }
  });

  it("and diverge only on the emptied field — the reason both exist", () => {
    expect(maskCurrencyDigits("")).toBe("");
    expect(formatInputCurrency(parseCurrencyInput(""))).toBe("0");
  });
});
