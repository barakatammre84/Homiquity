/**
 * The selection rules for the HMDA demographic categories.
 *
 * Extracted verbatim from the inline onCheckedChange handlers in
 * HmdaDemographics.tsx. Two invariants run through all of it:
 *
 *  - Choosing any category clears "I do not wish to provide" for that
 *    category, and checking "do not wish to provide" clears the selections.
 *    A record asserting both is contradictory.
 *  - Sex is single-select; ethnicity and race are multi-select, which Reg C
 *    requires (an applicant may report more than one race).
 */
import {
  ASIAN_SUBCATEGORIES,
  ETHNICITY_SUBCATEGORIES,
  ETHNICITY_TOP_LEVEL,
  PACIFIC_SUBCATEGORIES,
  RACE_TOP_LEVEL,
  type EthnicityState,
  type EthnicitySubcategory,
  type EthnicityTopLevel,
  type RaceState,
  type RaceSubcategory,
  type RaceTopLevel,
  type SexState,
} from "./types";

const clearAll = <T extends string>(keys: readonly T[]) =>
  Object.fromEntries(keys.map((k) => [k, false]));

// ----------------------------------------------------------------- ethnicity

export function setEthnicityTopLevel(
  prev: EthnicityState,
  key: EthnicityTopLevel,
  checked: boolean,
): EthnicityState {
  return { ...prev, [key]: checked, notProvided: false };
}

export function setEthnicitySubcategory(
  prev: EthnicityState,
  key: EthnicitySubcategory,
  checked: boolean,
): EthnicityState {
  return { ...prev, [key]: checked };
}

export function setEthnicityOtherText(prev: EthnicityState, otherText: string): EthnicityState {
  return { ...prev, otherText };
}

export function declineEthnicity(prev: EthnicityState, checked: boolean): EthnicityState {
  if (!checked) return { ...prev, notProvided: false };
  return {
    ...prev,
    ...clearAll(ETHNICITY_TOP_LEVEL),
    ...clearAll(ETHNICITY_SUBCATEGORIES),
    notProvided: true,
  };
}

// ---------------------------------------------------------------------- race

export function setRaceTopLevel(
  prev: RaceState,
  key: RaceTopLevel,
  checked: boolean,
): RaceState {
  return { ...prev, [key]: checked, notProvided: false };
}

export function setRaceSubcategory(
  prev: RaceState,
  key: RaceSubcategory,
  checked: boolean,
): RaceState {
  return { ...prev, [key]: checked };
}

export function setRaceText(
  prev: RaceState,
  key: "americanIndianTribe" | "otherAsianText" | "otherPacificIslanderText",
  value: string,
): RaceState {
  return { ...prev, [key]: value };
}

export function declineRace(prev: RaceState, checked: boolean): RaceState {
  if (!checked) return { ...prev, notProvided: false };
  return {
    ...prev,
    ...clearAll(RACE_TOP_LEVEL),
    ...clearAll(ASIAN_SUBCATEGORIES),
    ...clearAll(PACIFIC_SUBCATEGORIES),
    notProvided: true,
  };
}

// ----------------------------------------------------------------------- sex

/** Single-select: picking one option clears the others, including the decline. */
export function setSex(key: keyof SexState, checked: boolean): SexState {
  return {
    female: key === "female" ? checked : false,
    male: key === "male" ? checked : false,
    notProvided: key === "notProvided" ? checked : false,
  };
}

// ----------------------------------------------------------------------- age

export interface AgeState {
  age: string;
  ageNotProvided: boolean;
}

/** Typing an age is itself an answer, so it clears the decline. */
export function setAge(age: string): AgeState {
  return { age, ageNotProvided: false };
}

/** Declining clears any age already typed — the payload must not carry both. */
export function declineAge(checked: boolean, currentAge: string): AgeState {
  return { age: checked ? "" : currentAge, ageNotProvided: checked };
}
