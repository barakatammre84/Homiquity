import { describe, it, expect } from "vitest";
import {
  declineAge,
  declineEthnicity,
  declineRace,
  setAge,
  setEthnicityOtherText,
  setEthnicitySubcategory,
  setEthnicityTopLevel,
  setRaceSubcategory,
  setRaceText,
  setRaceTopLevel,
  setSex,
} from "./hmdaSelections";
import {
  ASIAN_SUBCATEGORIES,
  emptyEthnicity,
  emptyRace,
  PACIFIC_SUBCATEGORIES,
  RACE_TOP_LEVEL,
} from "./types";

// Selection rules for a federal monitoring record. The failure mode that
// matters is a SAVED record that contradicts itself — e.g. one asserting both
// a race and "I do not wish to provide" — because the applicant cannot see or
// correct it once the sub-checkboxes stop rendering.

describe("ethnicity", () => {
  it("clears the decline when a category is chosen", () => {
    const declined = declineEthnicity(emptyEthnicity(), true);
    const next = setEthnicityTopLevel(declined, "hispanicLatino", true);
    expect(next.notProvided).toBe(false);
    expect(next.hispanicLatino).toBe(true);
  });

  it("clears every selection when the applicant declines", () => {
    let state = setEthnicityTopLevel(emptyEthnicity(), "hispanicLatino", true);
    state = setEthnicitySubcategory(state, "mexican", true);
    state = setEthnicitySubcategory(state, "cuban", true);
    state = declineEthnicity(state, true);

    expect(state.notProvided).toBe(true);
    expect(state.hispanicLatino).toBe(false);
    expect(state.notHispanicLatino).toBe(false);
    expect(state.mexican).toBe(false);
    expect(state.cuban).toBe(false);
    expect(state.puertoRican).toBe(false);
    expect(state.otherHispanicLatino).toBe(false);
  });

  it("allows both Hispanic and Not-Hispanic to be toggled independently", () => {
    // The form uses checkboxes, not a radio group — the page has always let
    // these coexist. Pinned so a later 'tidy' is a deliberate decision.
    let state = setEthnicityTopLevel(emptyEthnicity(), "hispanicLatino", true);
    state = setEthnicityTopLevel(state, "notHispanicLatino", true);
    expect(state.hispanicLatino && state.notHispanicLatino).toBe(true);
  });

  it("unchecking the decline leaves the categories untouched", () => {
    const state = declineEthnicity({ ...emptyEthnicity(), notProvided: true }, false);
    expect(state.notProvided).toBe(false);
  });

  it("drops the subcategories when Hispanic or Latino is unchecked", () => {
    // The sub-checkboxes stop rendering, so anything left set is invisible to
    // the applicant and uncorrectable — but still gets POSTed. That produced a
    // record asserting ethnicityHispanicLatino=false with ethnicityMexican=true.
    let state = setEthnicityTopLevel(emptyEthnicity(), "hispanicLatino", true);
    state = setEthnicitySubcategory(state, "mexican", true);
    state = setEthnicitySubcategory(state, "otherHispanicLatino", true);
    state = setEthnicityOtherText(state, "Salvadoran");

    state = setEthnicityTopLevel(state, "hispanicLatino", false);

    expect(state.mexican).toBe(false);
    expect(state.otherHispanicLatino).toBe(false);
    expect(state.otherText).toBe("");
  });

  it("drops the free text when Other Hispanic or Latino is unchecked", () => {
    let state = setEthnicityTopLevel(emptyEthnicity(), "hispanicLatino", true);
    state = setEthnicitySubcategory(state, "otherHispanicLatino", true);
    state = setEthnicityOtherText(state, "Salvadoran");

    state = setEthnicitySubcategory(state, "otherHispanicLatino", false);

    expect(state.otherText).toBe("");
  });

  it("clears the free text when the applicant declines", () => {
    let state = setEthnicityTopLevel(emptyEthnicity(), "hispanicLatino", true);
    state = setEthnicitySubcategory(state, "otherHispanicLatino", true);
    state = setEthnicityOtherText(state, "Salvadoran");

    state = declineEthnicity(state, true);

    expect(state.otherText).toBe("");
  });
});

describe("race", () => {
  it("clears the decline when a category is chosen", () => {
    const declined = declineRace(emptyRace(), true);
    expect(setRaceTopLevel(declined, "asian", true).notProvided).toBe(false);
  });

  it("clears every top-level and sub category when the applicant declines", () => {
    // The regression this guards: the decline handler used to enumerate
    // fifteen field names inline, so a newly added subcategory would survive
    // the clear and land on the filed record.
    let state = emptyRace();
    for (const key of RACE_TOP_LEVEL) state = setRaceTopLevel(state, key, true);
    for (const key of ASIAN_SUBCATEGORIES) state = setRaceSubcategory(state, key, true);
    for (const key of PACIFIC_SUBCATEGORIES) state = setRaceSubcategory(state, key, true);

    state = declineRace(state, true);

    expect(state.notProvided).toBe(true);
    for (const key of [...RACE_TOP_LEVEL, ...ASIAN_SUBCATEGORIES, ...PACIFIC_SUBCATEGORIES]) {
      expect(state[key], `${key} survived the decline`).toBe(false);
    }
  });

  it("supports selecting several races at once", () => {
    let state = setRaceTopLevel(emptyRace(), "black", true);
    state = setRaceTopLevel(state, "white", true);
    state = setRaceTopLevel(state, "americanIndian", true);
    expect(state.black && state.white && state.americanIndian).toBe(true);
  });

  it("drops the Asian subcategories when Asian is unchecked", () => {
    // Produced a record asserting raceAsian=false with raceChinese=true.
    let state = setRaceTopLevel(emptyRace(), "asian", true);
    state = setRaceSubcategory(state, "chinese", true);
    state = setRaceSubcategory(state, "otherAsian", true);
    state = setRaceText(state, "otherAsianText", "Hmong");

    state = setRaceTopLevel(state, "asian", false);

    expect(state.chinese).toBe(false);
    expect(state.otherAsian).toBe(false);
    expect(state.otherAsianText).toBe("");
  });

  it("drops the Pacific Islander subcategories when the parent is unchecked", () => {
    let state = setRaceTopLevel(emptyRace(), "nativeHawaiian", true);
    state = setRaceSubcategory(state, "samoan", true);
    state = setRaceSubcategory(state, "otherPacificIslander", true);
    state = setRaceText(state, "otherPacificIslanderText", "Tongan");

    state = setRaceTopLevel(state, "nativeHawaiian", false);

    expect(state.samoan).toBe(false);
    expect(state.otherPacificIslander).toBe(false);
    expect(state.otherPacificIslanderText).toBe("");
  });

  it("drops the tribe name when American Indian or Alaska Native is unchecked", () => {
    let state = setRaceTopLevel(emptyRace(), "americanIndian", true);
    state = setRaceText(state, "americanIndianTribe", "Cherokee Nation");

    state = setRaceTopLevel(state, "americanIndian", false);

    expect(state.americanIndianTribe).toBe("");
  });

  it("clears every free-text answer when the applicant declines", () => {
    // The most serious version: the applicant checks "I do not wish to provide
    // this information" and their tribe name was still submitted.
    let state = setRaceTopLevel(emptyRace(), "americanIndian", true);
    state = setRaceText(state, "americanIndianTribe", "Cherokee Nation");
    state = setRaceTopLevel(state, "asian", true);
    state = setRaceSubcategory(state, "otherAsian", true);
    state = setRaceText(state, "otherAsianText", "Hmong");

    state = declineRace(state, true);

    expect(state.notProvided).toBe(true);
    expect(state.americanIndianTribe).toBe("");
    expect(state.otherAsianText).toBe("");
    expect(state.otherPacificIslanderText).toBe("");
  });

  it("keeps a subcategory that still has its parent", () => {
    // The fix must not over-clear: unchecking one parent leaves the other alone.
    let state = setRaceTopLevel(emptyRace(), "asian", true);
    state = setRaceSubcategory(state, "chinese", true);
    state = setRaceTopLevel(state, "nativeHawaiian", true);
    state = setRaceSubcategory(state, "samoan", true);

    state = setRaceTopLevel(state, "nativeHawaiian", false);

    expect(state.chinese).toBe(true);
    expect(state.asian).toBe(true);
    expect(state.samoan).toBe(false);
  });
});

describe("sex", () => {
  it("is single-select — each option clears the others", () => {
    expect(setSex("female", true)).toEqual({ female: true, male: false, notProvided: false });
    expect(setSex("male", true)).toEqual({ female: false, male: true, notProvided: false });
    expect(setSex("notProvided", true)).toEqual({ female: false, male: false, notProvided: true });
  });

  it("unchecking the selected option leaves nothing selected", () => {
    expect(setSex("female", false)).toEqual({ female: false, male: false, notProvided: false });
  });
});

describe("age", () => {
  it("treats typing an age as an answer, clearing the decline", () => {
    expect(setAge("41")).toEqual({ age: "41", ageNotProvided: false });
  });

  it("clears a typed age when the applicant declines", () => {
    // Otherwise the payload would carry both a decline and a number.
    expect(declineAge(true, "41")).toEqual({ age: "", ageNotProvided: true });
  });

  it("keeps the typed age when the decline is unchecked", () => {
    expect(declineAge(false, "41")).toEqual({ age: "41", ageNotProvided: false });
  });
});
