import { describe, it, expect } from "vitest";
import { emptyHmdaForm, formToPayload, hmdaToForm } from "./hmdaMapping";
import type { HmdaDemographics } from "@shared/schema";

// A dropped field here silently loses a demographic answer from a federal
// monitoring record, so the round-trip is asserted over the whole payload
// rather than a handful of sampled fields.

const STORED = {
  ethnicityHispanicLatino: true,
  ethnicityMexican: true,
  ethnicityCuban: false,
  ethnicityPuertoRican: true,
  ethnicityOtherHispanicLatino: true,
  ethnicityOtherText: "Salvadoran",
  ethnicityNotHispanicLatino: false,
  ethnicityNotProvided: false,
  raceAmericanIndian: true,
  raceAmericanIndianTribe: "Cherokee Nation",
  raceAsian: true,
  raceAsianIndian: false,
  raceChinese: true,
  raceFilipino: false,
  raceJapanese: false,
  raceKorean: false,
  raceVietnamese: true,
  raceOtherAsian: true,
  raceOtherAsianText: "Hmong",
  raceBlack: false,
  raceNativeHawaiian: true,
  raceGuamanian: false,
  raceSamoan: true,
  raceOtherPacificIslander: true,
  raceOtherPacificIslanderText: "Tongan",
  raceWhite: true,
  raceNotProvided: false,
  sexFemale: true,
  sexMale: false,
  sexNotProvided: false,
  age: 41,
  ageNotProvided: false,
} as unknown as HmdaDemographics;

describe("hmdaToForm / formToPayload round-trip", () => {
  it("preserves every stored field through load then save", () => {
    const payload = formToPayload(hmdaToForm(STORED));
    for (const [key, value] of Object.entries(STORED)) {
      expect(payload[key], `field "${key}" did not survive the round-trip`).toEqual(value);
    }
  });

  it("covers every payload key — nothing is written that wasn't read", () => {
    const payload = formToPayload(hmdaToForm(STORED));
    expect(Object.keys(payload).sort()).toEqual(Object.keys(STORED).sort());
  });

  it("preserves a multi-race, multi-ethnicity selection", () => {
    // Reg C permits reporting more than one race and more than one Hispanic
    // or Latino subcategory; collapsing to a single value would misreport.
    const form = hmdaToForm(STORED);
    expect(form.race.americanIndian && form.race.asian && form.race.nativeHawaiian && form.race.white).toBe(true);
    expect(form.ethnicity.mexican && form.ethnicity.puertoRican && form.ethnicity.otherHispanicLatino).toBe(true);
  });
});

describe("hmdaToForm", () => {
  it("returns a blank form when nothing has been saved yet", () => {
    expect(hmdaToForm(null)).toEqual(emptyHmdaForm());
    expect(hmdaToForm(undefined)).toEqual(emptyHmdaForm());
  });

  it("treats null columns as unanswered rather than throwing", () => {
    const sparse = { ethnicityHispanicLatino: null, age: null, raceOtherAsianText: null } as unknown as HmdaDemographics;
    const form = hmdaToForm(sparse);
    expect(form.ethnicity.hispanicLatino).toBe(false);
    expect(form.age).toBe("");
    expect(form.race.otherAsianText).toBe("");
  });

  it("renders a stored age as a string for the number input", () => {
    expect(hmdaToForm({ age: 41 } as unknown as HmdaDemographics).age).toBe("41");
  });
});

describe("formToPayload", () => {
  it("stores empty free-text as null, not an empty string", () => {
    const payload = formToPayload(emptyHmdaForm());
    expect(payload.ethnicityOtherText).toBeNull();
    expect(payload.raceAmericanIndianTribe).toBeNull();
    expect(payload.raceOtherAsianText).toBeNull();
    expect(payload.raceOtherPacificIslanderText).toBeNull();
  });

  it("sends a null age when the applicant declined", () => {
    // Declining and reporting an age are different facts; a declined record
    // must not carry a number.
    const form = { ...emptyHmdaForm(), age: "41", ageNotProvided: true };
    const payload = formToPayload(form);
    expect(payload.age).toBeNull();
    expect(payload.ageNotProvided).toBe(true);
  });

  it("sends a null age when the field is simply blank", () => {
    expect(formToPayload(emptyHmdaForm()).age).toBeNull();
  });

  it("parses a typed age to a number", () => {
    expect(formToPayload({ ...emptyHmdaForm(), age: "41" }).age).toBe(41);
  });
});
