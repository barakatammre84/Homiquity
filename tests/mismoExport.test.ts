import { describe, it, expect } from "vitest";
import {
  generateMISMO34XML,
  validateULDDCompliance,
  type MISMOLoanDTO,
} from "../server/mismo";

// ---------------------------------------------------------------------------
// Regression coverage for the MISMO 3.4 export-content fixes:
//   - ConstructionMethodType maps to a valid enum, not the raw propertyType
//   - EmploymentStatusType keys off the end date, not the free-text category
//   - NoteAmount distinguishes a real $0 down payment from a missing one
//   - formatters strip currency formatting and never emit "NaN" / RangeError
//   - the dangling xlink RELATIONSHIPS block is omitted
// ---------------------------------------------------------------------------

function baseDto(overrides: Partial<MISMOLoanDTO> = {}): MISMOLoanDTO {
  return {
    application: {
      id: "3f8a-9c2d-11ee-8c90-0242ac120002",
      status: "pre_approved",
      loanPurpose: "purchase",
      preferredLoanType: "conventional",
      propertyType: "single_family",
      propertyAddress: "123 Main St",
      propertyCity: "Austin",
      propertyState: "TX",
      propertyZip: "78701",
      propertyValue: "500000",
      purchasePrice: "500000",
      downPayment: "100000",
      createdAt: new Date("2026-01-01"),
      ...(overrides.application ?? {}),
    } as any,
    user: { id: "user-abc123", email: "b@example.com" } as any,
    personalInfo: { firstName: "Jane", lastName: "Doe", ssn: "123-45-6789" } as any,
    employment: overrides.employment ?? [],
    assets: overrides.assets ?? [],
    liabilities: overrides.liabilities ?? [],
    propertyInfo: overrides.propertyInfo ?? null,
    declarations: null,
    loanOptions: overrides.loanOptions ?? [],
    documents: [],
  };
}

describe("ConstructionMethodType (Fix 5)", () => {
  it("emits SiteBuilt for a standard property, never the raw propertyType", () => {
    const xml = generateMISMO34XML(baseDto());
    expect(xml).toContain("<ConstructionMethodType>SiteBuilt</ConstructionMethodType>");
    expect(xml).not.toContain("single_family");
  });

  it("emits Manufactured when the URLA flags a manufactured home", () => {
    const xml = generateMISMO34XML(
      baseDto({ propertyInfo: { isManufacturedHome: true, occupancyType: "primary_residence" } as any }),
    );
    expect(xml).toContain("<ConstructionMethodType>Manufactured</ConstructionMethodType>");
  });
});

describe("EmploymentStatusType (Fix 6)", () => {
  it("marks an open-ended job (no end date) as Current", () => {
    const xml = generateMISMO34XML(
      baseDto({ employment: [{ employerName: "Acme", employmentType: "employed", startDate: "2020-01-01" } as any] }),
    );
    expect(xml).toContain("<EmploymentStatusType>Current</EmploymentStatusType>");
    expect(xml).not.toContain("<EmploymentStatusType>Previous</EmploymentStatusType>");
  });

  it("marks a job with an end date as Previous", () => {
    const xml = generateMISMO34XML(
      baseDto({
        employment: [
          { employerName: "OldCo", employmentType: "employed", startDate: "2015-01-01", endDate: "2019-12-31" } as any,
        ],
      }),
    );
    expect(xml).toContain("<EmploymentStatusType>Previous</EmploymentStatusType>");
  });
});

describe("NoteAmount / down payment handling (Fix 8)", () => {
  it("computes NoteAmount = price for a genuine $0 down payment", () => {
    const xml = generateMISMO34XML(baseDto({ application: { downPayment: "0", purchasePrice: "400000" } as any }));
    expect(xml).toContain("<NoteAmount>400000.00</NoteAmount>");
  });

  it("omits NoteAmount when the down payment is missing (does not inflate to full price)", () => {
    const dto = baseDto();
    dto.application.downPayment = null as any;
    const xml = generateMISMO34XML(dto);
    expect(xml).not.toContain("<NoteAmount>");
  });

  it("validateULDDCompliance accepts a valid $0-down loan", () => {
    const result = validateULDDCompliance(
      baseDto({ application: { downPayment: "0", purchasePrice: "400000" } as any }),
    );
    expect(result.errors).not.toContain("NoteAmount is required and must be greater than 0");
  });
});

describe("formatter robustness (Fix 9)", () => {
  it("strips currency formatting instead of emitting NaN or a truncated value", () => {
    const xml = generateMISMO34XML(
      baseDto({ assets: [{ accountType: "checking", cashOrMarketValue: "1,234.56" } as any] }),
    );
    expect(xml).toContain("<AssetCashOrMarketValueAmount>1234.56</AssetCashOrMarketValueAmount>");
    expect(xml).not.toContain("NaN");
  });

  it("does not throw on a malformed date", () => {
    const dto = baseDto();
    dto.application.createdAt = "not-a-date" as any;
    expect(() => generateMISMO34XML(dto)).not.toThrow();
  });
});

describe("dangling xlink relationships removed (Fix 7)", () => {
  it("does not emit a RELATIONSHIPS block or dangling xlink refs", () => {
    const xml = generateMISMO34XML(
      baseDto({
        assets: [{ accountType: "checking", cashOrMarketValue: "5000" } as any],
        liabilities: [{ liabilityType: "credit_card", monthlyPayment: "50" } as any],
        employment: [{ employerName: "Acme", employmentType: "employed", startDate: "2020-01-01" } as any],
      }),
    );
    expect(xml).not.toContain("RELATIONSHIPS");
    expect(xml).not.toContain("xlink:href");
    expect(xml).not.toContain("RelationshipType");
  });
});
