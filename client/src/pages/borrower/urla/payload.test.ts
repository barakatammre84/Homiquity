import { describe, it, expect } from "vitest";
import { buildPayload, buildSectionsPayload } from "./payload";
import { emptySlice, type BorrowerSlice } from "./types";

// What reaches POST /api/urla/:id/save. The filters decide what lands on the
// 1003, so both directions matter: blank scaffolding rows must not persist,
// and real answers must not be dropped.

const slice = (over: Partial<BorrowerSlice>): BorrowerSlice => ({ ...emptySlice(), ...over });

describe("buildSectionsPayload", () => {
  it("drops the blank placeholder rows every section starts with", () => {
    const payload = buildSectionsPayload(emptySlice());
    expect(payload.employmentHistory).toEqual([]);
    expect(payload.assets).toEqual([]);
    expect(payload.liabilities).toEqual([]);
  });

  it("keeps rows carrying either identifying field", () => {
    const payload = buildSectionsPayload(slice({
      employmentRecords: [{}, { employerName: "Acme" }, { positionTitle: "Engineer" }],
      assets: [{}, { accountType: "Checking" }, { financialInstitution: "First Bank" }],
      liabilities: [{}, { liabilityType: "Revolving" }, { creditorName: "Card Co" }],
    }));
    expect(payload.employmentHistory).toHaveLength(2);
    expect(payload.assets).toHaveLength(2);
    expect(payload.liabilities).toHaveLength(2);
  });

  it("defaults employmentType to 'current' without overwriting a stated one", () => {
    const payload = buildSectionsPayload(slice({
      employmentRecords: [{ employerName: "Acme" }, { employerName: "Old Corp", employmentType: "previous" }],
    }));
    expect(payload.employmentHistory[0].employmentType).toBe("current");
    expect(payload.employmentHistory[1].employmentType).toBe("previous");
  });

  it("preserves a declaration answered 'false'", () => {
    // false is a real answer; anything that treats it as absent would drop a
    // borrower's "no" from the loan file.
    const payload = buildSectionsPayload(slice({ declarations: { hasDeclaredBankruptcy: false } }));
    expect(payload.declarations).toEqual({ hasDeclaredBankruptcy: false });
  });
});

describe("buildPayload", () => {
  const base = {
    borrowerData: { 1: emptySlice(), 2: emptySlice() },
    otherIncomes: [],
    propertyInfo: {},
    hasCoBorrower: false,
  };

  it("omits coApplicants entirely for a solo application", () => {
    // Not an empty array — the server reads its presence as the co-borrower
    // roster, so sending [] and omitting it are different statements.
    const payload = buildPayload(base);
    expect("coApplicants" in payload).toBe(false);
  });

  it("includes the co-borrower's sections when one is present", () => {
    const payload = buildPayload({
      ...base,
      hasCoBorrower: true,
      borrowerData: {
        1: emptySlice(),
        2: { ...emptySlice(), personalInfo: { firstName: "Grace" } },
      },
    });
    expect(payload.coApplicants).toHaveLength(1);
    expect(payload.coApplicants?.[0].personalInfo.firstName).toBe("Grace");
  });

  it("keeps only other-income rows that have both a source and an amount", () => {
    const payload = buildPayload({
      ...base,
      otherIncomes: [
        {},
        { incomeSource: "Rental" },
        { monthlyAmount: "500" },
        { incomeSource: "Rental", monthlyAmount: "500" },
      ],
    });
    expect(payload.otherIncomeSources).toEqual([{ incomeSource: "Rental", monthlyAmount: "500" }]);
  });

  it("sends the primary's sections at the top level", () => {
    const payload = buildPayload({
      ...base,
      borrowerData: { 1: { ...emptySlice(), personalInfo: { firstName: "Ada" } }, 2: emptySlice() },
    });
    expect(payload.personalInfo.firstName).toBe("Ada");
  });

  it("tolerates a missing borrower slot rather than throwing", () => {
    const payload = buildPayload({ ...base, borrowerData: {}, hasCoBorrower: true });
    expect(payload.personalInfo).toEqual({});
    expect(payload.coApplicants).toHaveLength(1);
  });
});
