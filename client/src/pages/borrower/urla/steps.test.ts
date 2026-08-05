import { describe, it, expect } from "vitest";
import { STEPS, type StepContext } from "./steps";
import { DECLARATION_QUESTIONS, emptyDemographics, emptySlice, type BorrowerSlice } from "./types";
import type { LoanApplication } from "@shared/schema";

// These predicates drive the progress bar and the step-rail check marks. They
// are advisory — server/services/mismoValidation.ts does the real GSE-delivery
// scoring — but a wrong answer here still misleads a borrower about whether
// they are done, so the edge cases are pinned.

const step = (id: string) => {
  const found = STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};

const APP = {} as LoanApplication;

function ctx(over: { slice?: Partial<BorrowerSlice>; propertyInfo?: StepContext["propertyInfo"]; app?: LoanApplication }): StepContext {
  return {
    slice: { ...emptySlice(), ...over.slice },
    propertyInfo: over.propertyInfo ?? {},
    app: over.app ?? APP,
  };
}

const allDeclarationsAnswered = (value: boolean) =>
  Object.fromEntries(DECLARATION_QUESTIONS.map((q) => [q.key, value]));

describe("URLA step definitions", () => {
  it("has seven steps with stable ids and no duplicates", () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      "borrower", "employment", "assets", "liabilities", "property", "declarations", "demographics",
    ]);
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
  });

  it("reports nothing complete for a brand-new application", () => {
    const empty = ctx({});
    expect(STEPS.filter((s) => s.isComplete(empty))).toHaveLength(0);
  });
});

describe("borrower step", () => {
  const base = { firstName: "Ada", lastName: "Lovelace", dateOfBirth: "1990-01-01" };

  it("accepts ssnLast4 alone — ssn is write-only and never comes back", () => {
    // The regression this guards: requiring `ssn` leaves the section
    // permanently unchecked for every returning borrower, because the server
    // encrypts the SSN and returns only the last four.
    expect(step("borrower").isComplete(ctx({ slice: { personalInfo: { ...base, ssnLast4: "1234" } } }))).toBe(true);
    expect(step("borrower").isComplete(ctx({ slice: { personalInfo: { ...base, ssn: "123-45-6789" } } }))).toBe(true);
  });

  it("is incomplete with no SSN of either form", () => {
    expect(step("borrower").isComplete(ctx({ slice: { personalInfo: base } }))).toBe(false);
  });

  it("is incomplete when a name or date of birth is missing", () => {
    expect(step("borrower").isComplete(ctx({ slice: { personalInfo: { ...base, firstName: undefined, ssnLast4: "1234" } } }))).toBe(false);
    expect(step("borrower").isComplete(ctx({ slice: { personalInfo: { ...base, dateOfBirth: undefined, ssnLast4: "1234" } } }))).toBe(false);
  });
});

describe("employment / assets / liabilities steps", () => {
  it("ignores the blank placeholder row each section starts with", () => {
    // emptySlice() seeds [{}] so the form renders; that must not read as data.
    const empty = ctx({});
    expect(step("employment").isComplete(empty)).toBe(false);
    expect(step("assets").isComplete(empty)).toBe(false);
    expect(step("liabilities").isComplete(empty)).toBe(false);
  });

  it("counts a row carrying either of its identifying fields", () => {
    expect(step("employment").isComplete(ctx({ slice: { employmentRecords: [{}, { employerName: "Acme" }] } }))).toBe(true);
    expect(step("employment").isComplete(ctx({ slice: { employmentRecords: [{ positionTitle: "Engineer" }] } }))).toBe(true);
    expect(step("assets").isComplete(ctx({ slice: { assets: [{ financialInstitution: "First Bank" }] } }))).toBe(true);
    expect(step("liabilities").isComplete(ctx({ slice: { liabilities: [{ creditorName: "Card Co" }] } }))).toBe(true);
  });
});

describe("property step", () => {
  it("accepts the address and value from either the URLA section or the application", () => {
    // Much of this carries over from pre-approval, so either source counts.
    expect(step("property").isComplete(ctx({
      propertyInfo: { propertyStreet: "1 Test St", propertyValue: "400000" },
    }))).toBe(true);
    expect(step("property").isComplete(ctx({
      app: { propertyAddress: "1 Test St", propertyValue: "400000" } as LoanApplication,
    }))).toBe(true);
    expect(step("property").isComplete(ctx({
      app: { propertyAddress: "1 Test St", purchasePrice: "400000" } as LoanApplication,
    }))).toBe(true);
  });

  it("is incomplete with an address but no value", () => {
    expect(step("property").isComplete(ctx({ propertyInfo: { propertyStreet: "1 Test St" } }))).toBe(false);
  });
});

describe("declarations step", () => {
  it("treats an explicit 'no' as answered", () => {
    // The bug a truthiness check would introduce: a borrower who answers "no"
    // to all eleven questions would see the section as untouched.
    expect(step("declarations").isComplete(ctx({ slice: { declarations: allDeclarationsAnswered(false) } }))).toBe(true);
    expect(step("declarations").isComplete(ctx({ slice: { declarations: allDeclarationsAnswered(true) } }))).toBe(true);
  });

  it("is incomplete while any single question is unanswered", () => {
    const allButOne = allDeclarationsAnswered(false);
    delete allButOne[DECLARATION_QUESTIONS[4].key];
    expect(step("declarations").isComplete(ctx({ slice: { declarations: allButOne } }))).toBe(false);
  });
});

describe("demographics step", () => {
  it("counts declining every category as complete (HMDA allows it)", () => {
    const declined = {
      ...emptyDemographics(),
      ethnicityNotProvided: true,
      raceNotProvided: true,
      sexNotProvided: true,
      ageNotProvided: true,
    };
    expect(step("demographics").isComplete(ctx({ slice: { demographics: declined } }))).toBe(true);
  });

  it("counts a fully answered set as complete", () => {
    const answered = {
      ...emptyDemographics(),
      ethnicityNotHispanicLatino: true,
      raceWhite: true,
      sexFemale: true,
      age: "35",
    };
    expect(step("demographics").isComplete(ctx({ slice: { demographics: answered } }))).toBe(true);
  });

  it("requires all four categories — three is not enough", () => {
    const missingSex = {
      ...emptyDemographics(),
      ethnicityNotProvided: true,
      raceNotProvided: true,
      ageNotProvided: true,
    };
    expect(step("demographics").isComplete(ctx({ slice: { demographics: missingSex } }))).toBe(false);
  });

  it("accepts multi-select race, which HMDA permits", () => {
    const multi = {
      ...emptyDemographics(),
      ethnicityHispanicLatino: true,
      raceAsian: true,
      raceWhite: true,
      sexMale: true,
      age: "42",
    };
    expect(step("demographics").isComplete(ctx({ slice: { demographics: multi } }))).toBe(true);
  });
});
