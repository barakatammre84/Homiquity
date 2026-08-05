import { describe, it, expect } from "vitest";
import {
  declineAge,
  declineEthnicity,
  declineRace,
  setAge,
  setEthnicitySubcategory,
  setEthnicityTopLevel,
  setRaceSubcategory,
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
