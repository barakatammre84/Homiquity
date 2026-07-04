import { describe, it, expect } from "vitest";
import { determineDocumentRequirements } from "../server/pipelineEngine";

const baseProfile = {
  employmentYears: 3,
  annualIncome: 90000,
  creditScore: 720,
  ltvRatio: 90,
  loanPurpose: "purchase",
  propertyType: "single_family",
  isVeteran: false,
  isFirstTimeBuyer: false,
  isSelfEmployed: false,
};

describe("determineDocumentRequirements - employmentType 'other'", () => {
  it("does not silently ask an 'other' borrower for a W-2 (the 'employed' bucket)", () => {
    const requirements = determineDocumentRequirements({
      ...baseProfile,
      employmentType: "other",
    });
    const documentTypes = requirements.map((r) => r.documentType);
    expect(documentTypes).not.toContain("w2");
  });

  it("asks an 'other' borrower for 2 years of tax returns instead", () => {
    const requirements = determineDocumentRequirements({
      ...baseProfile,
      employmentType: "other",
    });
    const taxReturn = requirements.find((r) => r.documentType === "tax_return");
    expect(taxReturn).toBeDefined();
    expect(taxReturn?.yearsRequired).toEqual([
      new Date().getFullYear() - 1,
      new Date().getFullYear() - 2,
    ]);
  });

  it("still asks 'employed' borrowers for a W-2 (no regression)", () => {
    const requirements = determineDocumentRequirements({
      ...baseProfile,
      employmentType: "employed",
    });
    const documentTypes = requirements.map((r) => r.documentType);
    expect(documentTypes).toContain("w2");
  });
});
