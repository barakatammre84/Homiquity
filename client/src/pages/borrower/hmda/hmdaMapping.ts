/**
 * Mapping between the stored HmdaDemographics record and this page's form state.
 *
 * Every key below is an existing HmdaDemographics column from shared/schema —
 * copied, never invented. A dropped key here silently loses a demographic
 * answer the applicant gave, so hmdaMapping.test.ts round-trips the whole
 * record rather than spot-checking fields.
 */
import type { HmdaDemographics } from "@shared/schema";
import {
  emptyEthnicity,
  emptyRace,
  emptySex,
  type EthnicityState,
  type RaceState,
  type SexState,
} from "./types";

export interface HmdaFormState {
  ethnicity: EthnicityState;
  race: RaceState;
  sex: SexState;
  age: string;
  ageNotProvided: boolean;
}

export const emptyHmdaForm = (): HmdaFormState => ({
  ethnicity: emptyEthnicity(),
  race: emptyRace(),
  sex: emptySex(),
  age: "",
  ageNotProvided: false,
});

export function hmdaToForm(d: HmdaDemographics | null | undefined): HmdaFormState {
  if (!d) return emptyHmdaForm();
  return {
    ethnicity: {
      hispanicLatino: d.ethnicityHispanicLatino ?? false,
      mexican: d.ethnicityMexican ?? false,
      cuban: d.ethnicityCuban ?? false,
      puertoRican: d.ethnicityPuertoRican ?? false,
      otherHispanicLatino: d.ethnicityOtherHispanicLatino ?? false,
      otherText: d.ethnicityOtherText ?? "",
      notHispanicLatino: d.ethnicityNotHispanicLatino ?? false,
      notProvided: d.ethnicityNotProvided ?? false,
    },
    race: {
      americanIndian: d.raceAmericanIndian ?? false,
      americanIndianTribe: d.raceAmericanIndianTribe ?? "",
      asian: d.raceAsian ?? false,
      asianIndian: d.raceAsianIndian ?? false,
      chinese: d.raceChinese ?? false,
      filipino: d.raceFilipino ?? false,
      japanese: d.raceJapanese ?? false,
      korean: d.raceKorean ?? false,
      vietnamese: d.raceVietnamese ?? false,
      otherAsian: d.raceOtherAsian ?? false,
      otherAsianText: d.raceOtherAsianText ?? "",
      black: d.raceBlack ?? false,
      nativeHawaiian: d.raceNativeHawaiian ?? false,
      guamanian: d.raceGuamanian ?? false,
      samoan: d.raceSamoan ?? false,
      otherPacificIslander: d.raceOtherPacificIslander ?? false,
      otherPacificIslanderText: d.raceOtherPacificIslanderText ?? "",
      white: d.raceWhite ?? false,
      notProvided: d.raceNotProvided ?? false,
    },
    sex: {
      female: d.sexFemale ?? false,
      male: d.sexMale ?? false,
      notProvided: d.sexNotProvided ?? false,
    },
    age: d.age ? String(d.age) : "",
    ageNotProvided: d.ageNotProvided ?? false,
  };
}

/** The exact body POSTed to /api/loan-applications/:id/hmda. */
export function formToPayload(form: HmdaFormState): Record<string, unknown> {
  const { ethnicity, race, sex, age, ageNotProvided } = form;
  return {
    ethnicityHispanicLatino: ethnicity.hispanicLatino,
    ethnicityMexican: ethnicity.mexican,
    ethnicityCuban: ethnicity.cuban,
    ethnicityPuertoRican: ethnicity.puertoRican,
    ethnicityOtherHispanicLatino: ethnicity.otherHispanicLatino,
    // Empty free-text is stored as NULL, not "" — an absent answer and a blank
    // string are different statements on a monitoring record.
    ethnicityOtherText: ethnicity.otherText || null,
    ethnicityNotHispanicLatino: ethnicity.notHispanicLatino,
    ethnicityNotProvided: ethnicity.notProvided,

    raceAmericanIndian: race.americanIndian,
    raceAmericanIndianTribe: race.americanIndianTribe || null,
    raceAsian: race.asian,
    raceAsianIndian: race.asianIndian,
    raceChinese: race.chinese,
    raceFilipino: race.filipino,
    raceJapanese: race.japanese,
    raceKorean: race.korean,
    raceVietnamese: race.vietnamese,
    raceOtherAsian: race.otherAsian,
    raceOtherAsianText: race.otherAsianText || null,
    raceBlack: race.black,
    raceNativeHawaiian: race.nativeHawaiian,
    raceGuamanian: race.guamanian,
    raceSamoan: race.samoan,
    raceOtherPacificIslander: race.otherPacificIslander,
    raceOtherPacificIslanderText: race.otherPacificIslanderText || null,
    raceWhite: race.white,
    raceNotProvided: race.notProvided,

    sexFemale: sex.female,
    sexMale: sex.male,
    sexNotProvided: sex.notProvided,

    age: ageNotProvided ? null : (age ? parseInt(age) : null),
    ageNotProvided,
  };
}
