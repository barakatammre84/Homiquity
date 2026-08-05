import { describe, it, expect } from "vitest";
import { buildSlice, buildBorrowerData, detectCoBorrower, seqOf, type UrlaSliceSource } from "./borrowerSlices";

// Splitting the flat URLA response by borrowerSequenceNumber. Getting this
// wrong moves one borrower's employment, assets or declarations onto the
// other — on a 1003 that is a materially wrong loan file, so the sequence
// rules are pinned rather than assumed.

describe("seqOf", () => {
  it("defaults a missing or null sequence number to the primary borrower", () => {
    // Legacy rows predate the column. Defaulting them to 2 would hand the
    // primary's data to a co-borrower who may not even exist.
    expect(seqOf({})).toBe(1);
    expect(seqOf({ borrowerSequenceNumber: null })).toBe(1);
    expect(seqOf({ borrowerSequenceNumber: 1 })).toBe(1);
    expect(seqOf({ borrowerSequenceNumber: 2 })).toBe(2);
  });
});

const SOURCE = {
  allPersonalInfo: [
    { borrowerSequenceNumber: 1, firstName: "Ada" },
    { borrowerSequenceNumber: 2, firstName: "Grace" },
  ],
  employmentHistory: [
    { borrowerSequenceNumber: 1, employerName: "Acme" },
    { borrowerSequenceNumber: 2, employerName: "Globex" },
    { borrowerSequenceNumber: 2, employerName: "Initech" },
  ],
  assets: [{ borrowerSequenceNumber: 1, financialInstitution: "First Bank" }],
  liabilities: [{ borrowerSequenceNumber: 2, creditorName: "Card Co" }],
  allDeclarations: [{ borrowerSequenceNumber: 1, hasDeclaredBankruptcy: false }],
  hmdaDemographics: [{ borrowerSequenceNumber: 2, raceNotProvided: true }],
} as unknown as UrlaSliceSource;

describe("buildSlice", () => {
  it("gives each borrower only their own rows", () => {
    const primary = buildSlice(SOURCE, 1);
    const co = buildSlice(SOURCE, 2);

    expect(primary.personalInfo.firstName).toBe("Ada");
    expect(co.personalInfo.firstName).toBe("Grace");
    expect(primary.employmentRecords.map((e) => e.employerName)).toEqual(["Acme"]);
    expect(co.employmentRecords.map((e) => e.employerName)).toEqual(["Globex", "Initech"]);
    expect(primary.assets.map((a) => a.financialInstitution)).toEqual(["First Bank"]);
    expect(co.liabilities.map((l) => l.creditorName)).toEqual(["Card Co"]);
  });

  it("seeds one blank row for a section with no data so the form still renders", () => {
    const co = buildSlice(SOURCE, 2);
    expect(co.assets).toEqual([{}]);
    const primary = buildSlice(SOURCE, 1);
    expect(primary.liabilities).toEqual([{}]);
  });

  it("does not seed a blank row over real data", () => {
    expect(buildSlice(SOURCE, 1).employmentRecords).toHaveLength(1);
    expect(buildSlice(SOURCE, 2).employmentRecords).toHaveLength(2);
  });

  it("converts stored HMDA rows to form state, and defaults to blank without one", () => {
    expect(buildSlice(SOURCE, 2).demographics.raceNotProvided).toBe(true);
    expect(buildSlice(SOURCE, 1).demographics.raceNotProvided).toBe(false);
  });

  it("copes with a completely empty response", () => {
    const slice = buildSlice({}, 1);
    expect(slice.personalInfo).toEqual({});
    expect(slice.employmentRecords).toEqual([{}]);
    expect(slice.declarations).toEqual({});
  });

  it("routes a row with no sequence number to the primary", () => {
    const legacy = { employmentHistory: [{ employerName: "Old Corp" }] } as unknown as UrlaSliceSource;
    expect(buildSlice(legacy, 1).employmentRecords.map((e) => e.employerName)).toEqual(["Old Corp"]);
    expect(buildSlice(legacy, 2).employmentRecords).toEqual([{}]);
  });
});

describe("buildBorrowerData", () => {
  it("always returns both slots so the co-borrower toggle has something to edit", () => {
    const data = buildBorrowerData({});
    expect(Object.keys(data).sort()).toEqual(["1", "2"]);
  });
});

describe("detectCoBorrower", () => {
  it("is false for a solo application", () => {
    expect(detectCoBorrower({
      allPersonalInfo: [{ borrowerSequenceNumber: 1 }],
      employmentHistory: [{ borrowerSequenceNumber: 1 }],
    } as unknown as UrlaSliceSource)).toBe(false);
    expect(detectCoBorrower({})).toBe(false);
  });

  it.each([
    "allPersonalInfo",
    "employmentHistory",
    "assets",
    "liabilities",
    "allDeclarations",
    "hmdaDemographics",
  ])("detects a co-borrower present only in %s", (collection) => {
    // A co-borrower can exist with just one section filled in. Missing them
    // hides their data behind a toggle the borrower never sees — and the next
    // save would omit coApplicants entirely, dropping them from the file.
    const source = { [collection]: [{ borrowerSequenceNumber: 2 }] } as unknown as UrlaSliceSource;
    expect(detectCoBorrower(source)).toBe(true);
  });
});
