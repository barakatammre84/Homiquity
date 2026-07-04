import { describe, it, expect } from "vitest";
import {
  generateLuhnCheckDigit,
  generateMERSMIN,
  validateMERSMIN,
  generateMISMO34XML,
  type MISMOLoanDTO,
} from "../server/mismo";

// ---------------------------------------------------------------------------
// Regression coverage for the MERS MIN generation bug: a UUID-derived loan
// number is hex, so Number() on its letters produced a NaN check digit and
// every exported MIN ("…NaN") failed downstream Luhn validation. The org id is
// also "PENDING" until configured, which must NOT yield a placeholder MIN.
// ---------------------------------------------------------------------------

describe("generateLuhnCheckDigit", () => {
  it("throws on non-numeric input instead of silently producing NaN", () => {
    expect(() => generateLuhnCheckDigit("100abc123")).toThrow(/numeric/i);
  });

  it("computes a valid check digit for numeric input", () => {
    const digit = generateLuhnCheckDigit("100100012312345 67".replace(/\s/g, ""));
    expect(Number.isInteger(digit)).toBe(true);
    expect(digit).toBeGreaterThanOrEqual(0);
    expect(digit).toBeLessThanOrEqual(9);
  });
});

describe("generateMERSMIN", () => {
  it("produces an 18-digit, Luhn-valid MIN from a numeric org + loan number", () => {
    const min = generateMERSMIN("1000123", "1234567");
    expect(min).toHaveLength(18);
    expect(min).toMatch(/^\d{18}$/);
    expect(validateMERSMIN(min)).toBe(true);
  });

  it("strips non-digits from a UUID-derived loan number and stays valid", () => {
    const loanNumber = "a3f8b21".replace(/\D/g, "").padStart(7, "0");
    const min = generateMERSMIN("1000123", loanNumber);
    expect(min).toMatch(/^\d{18}$/);
    expect(min).not.toContain("NaN");
    expect(validateMERSMIN(min)).toBe(true);
  });

  it("rejects a non-numeric org id rather than emitting a garbage MIN", () => {
    expect(() => generateMERSMIN("PENDING", "1234567")).toThrow(/Org ID/i);
  });
});

function baseDto(id: string): MISMOLoanDTO {
  return {
    application: {
      id,
      status: "pre_approved",
      loanPurpose: "purchase",
      preferredLoanType: "conventional",
      purchasePrice: "500000",
      downPayment: "100000",
      createdAt: new Date("2026-01-01"),
    } as any,
    user: { id: "user-abc123", email: "b@example.com" } as any,
    personalInfo: { firstName: "Jane", lastName: "Doe", ssn: "123-45-6789" } as any,
    employment: [],
    assets: [],
    liabilities: [],
    propertyInfo: null,
    declarations: null,
    loanOptions: [],
    documents: [],
  };
}

describe("generateMISMO34XML MERS handling", () => {
  it("omits MERS_REGISTRATION and emits no NaN when org id is unconfigured (PENDING)", () => {
    // Default company config carries mersOrgId "PENDING".
    const xml = generateMISMO34XML(baseDto("3f8a-9c2d-11ee-8c90-0242ac120002"));
    expect(xml).not.toContain("NaN");
    expect(xml).not.toContain("MERS_REGISTRATION");
    expect(xml).not.toContain("MERSMINIdentifier");
  });

  it("emits a valid MERS MIN when a numeric org id is supplied", () => {
    const xml = generateMISMO34XML(baseDto("3f8a-9c2d-11ee-8c90-0242ac120002"), {
      mersOrgId: "1000123",
    });
    expect(xml).not.toContain("NaN");
    expect(xml).toContain("MERSMINIdentifier");
    const match = xml.match(/<MERSMINIdentifier>(\d{18})<\/MERSMINIdentifier>/);
    expect(match).not.toBeNull();
    expect(validateMERSMIN(match![1])).toBe(true);
  });
});
