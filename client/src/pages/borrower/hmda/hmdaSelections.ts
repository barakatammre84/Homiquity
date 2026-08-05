/**
 * The selection rules for the HMDA demographic categories.
 *
 * Every setter routes its result through normalizeEthnicity / normalizeRace,
 * which enforce the invariants the saved record must satisfy. Doing it in one
 * pass rather than inside each handler is deliberate: the sub-checkboxes and
 * free-text inputs only RENDER while their parent is checked, so any state
 * they leave behind is invisible to the applicant and uncorrectable by them —
 * it just gets POSTed. The invariants:
 *
 *  1. Choosing a category clears "I do not wish to provide" for that category,
 *     and declining clears every selection AND every free-text answer.
 *  2. A subcategory cannot outlive its parent (no "Chinese" without "Asian").
 *  3. Free text cannot outlive the checkbox that reveals it.
 *
 * Ethnicity and race are multi-select, which Reg C requires (an applicant may
 * report more than one race). Sex is single-select.
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

const clearBools = <T extends string>(keys: readonly T[]) =>
  Object.fromEntries(keys.map((k) => [k, false]));

// ----------------------------------------------------------------- ethnicity

/** Drops anything that can no longer be true given the current selections. */
export function normalizeEthnicity(s: EthnicityState): EthnicityState {
  if (s.notProvided) {
    return {
      ...s,
      ...clearBools(ETHNICITY_TOP_LEVEL),
      ...clearBools(ETHNICITY_SUBCATEGORIES),
      otherText: "",
      notProvided: true,
    } as EthnicityState;
  }
  const next = s.hispanicLatino
    ? s
    : ({ ...s, ...clearBools(ETHNICITY_SUBCATEGORIES) } as EthnicityState);
  return next.otherHispanicLatino ? next : { ...next, otherText: "" };
}

export function setEthnicityTopLevel(
  prev: EthnicityState,
  key: EthnicityTopLevel,
  checked: boolean,
): EthnicityState {
  return normalizeEthnicity({ ...prev, [key]: checked, notProvided: false });
}

export function setEthnicitySubcategory(
  prev: EthnicityState,
  key: EthnicitySubcategory,
  checked: boolean,
): EthnicityState {
  return normalizeEthnicity({ ...prev, [key]: checked });
}

export function setEthnicityOtherText(prev: EthnicityState, otherText: string): EthnicityState {
  return { ...prev, otherText };
}

export function declineEthnicity(prev: EthnicityState, checked: boolean): EthnicityState {
  return normalizeEthnicity({ ...prev, notProvided: checked });
}

// ---------------------------------------------------------------------- race

const RACE_TEXT_OWNERS = [
  { text: "americanIndianTribe", owner: "americanIndian" },
  { text: "otherAsianText", owner: "otherAsian" },
  { text: "otherPacificIslanderText", owner: "otherPacificIslander" },
] as const;

export function normalizeRace(s: RaceState): RaceState {
  if (s.notProvided) {
    return {
      ...s,
      ...clearBools(RACE_TOP_LEVEL),
      ...clearBools(ASIAN_SUBCATEGORIES),
      ...clearBools(PACIFIC_SUBCATEGORIES),
      americanIndianTribe: "",
      otherAsianText: "",
      otherPacificIslanderText: "",
      notProvided: true,
    } as RaceState;
  }
  let next = s;
  if (!next.asian) next = { ...next, ...clearBools(ASIAN_SUBCATEGORIES) } as RaceState;
  if (!next.nativeHawaiian) next = { ...next, ...clearBools(PACIFIC_SUBCATEGORIES) } as RaceState;
  for (const { text, owner } of RACE_TEXT_OWNERS) {
    if (!next[owner]) next = { ...next, [text]: "" };
  }
  return next;
}

export function setRaceTopLevel(
  prev: RaceState,
  key: RaceTopLevel,
  checked: boolean,
): RaceState {
  return normalizeRace({ ...prev, [key]: checked, notProvided: false });
}

export function setRaceSubcategory(
  prev: RaceState,
  key: RaceSubcategory,
  checked: boolean,
): RaceState {
  return normalizeRace({ ...prev, [key]: checked });
}

export function setRaceText(
  prev: RaceState,
  key: "americanIndianTribe" | "otherAsianText" | "otherPacificIslanderText",
  value: string,
): RaceState {
  return { ...prev, [key]: value };
}

export function declineRace(prev: RaceState, checked: boolean): RaceState {
  return normalizeRace({ ...prev, notProvided: checked });
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
