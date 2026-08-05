/**
 * Form state for the HMDA / Reg C government monitoring page.
 *
 * The field names in the API payload (see hmdaMapping.ts) are the
 * HmdaDemographics columns in shared/schema — they are NOT invented here and
 * must not be renamed to match this local state shape.
 */

export interface EthnicityState {
  hispanicLatino: boolean;
  mexican: boolean;
  cuban: boolean;
  puertoRican: boolean;
  otherHispanicLatino: boolean;
  otherText: string;
  notHispanicLatino: boolean;
  notProvided: boolean;
}

export interface RaceState {
  americanIndian: boolean;
  americanIndianTribe: string;
  asian: boolean;
  asianIndian: boolean;
  chinese: boolean;
  filipino: boolean;
  japanese: boolean;
  korean: boolean;
  vietnamese: boolean;
  otherAsian: boolean;
  otherAsianText: string;
  black: boolean;
  nativeHawaiian: boolean;
  guamanian: boolean;
  samoan: boolean;
  otherPacificIslander: boolean;
  otherPacificIslanderText: string;
  white: boolean;
  notProvided: boolean;
}

export interface SexState {
  female: boolean;
  male: boolean;
  notProvided: boolean;
}

/**
 * Category groupings, declared once.
 *
 * Every "I do not wish to provide" handler clears its category by iterating
 * these lists rather than naming fields inline. That matters: the race decline
 * handler previously enumerated fifteen fields by hand, so adding a
 * subcategory without remembering to extend that list would leave a stale
 * selection on a filed HMDA record.
 */
export const ETHNICITY_TOP_LEVEL = ["hispanicLatino", "notHispanicLatino"] as const;
export const ETHNICITY_SUBCATEGORIES = ["mexican", "puertoRican", "cuban", "otherHispanicLatino"] as const;

export const RACE_TOP_LEVEL = ["americanIndian", "asian", "black", "nativeHawaiian", "white"] as const;
export const ASIAN_SUBCATEGORIES = ["asianIndian", "chinese", "filipino", "japanese", "korean", "vietnamese", "otherAsian"] as const;
export const PACIFIC_SUBCATEGORIES = ["guamanian", "samoan", "otherPacificIslander"] as const;

export type EthnicityTopLevel = (typeof ETHNICITY_TOP_LEVEL)[number];
export type EthnicitySubcategory = (typeof ETHNICITY_SUBCATEGORIES)[number];
export type RaceTopLevel = (typeof RACE_TOP_LEVEL)[number];
export type AsianSubcategory = (typeof ASIAN_SUBCATEGORIES)[number];
export type PacificSubcategory = (typeof PACIFIC_SUBCATEGORIES)[number];
export type RaceSubcategory = AsianSubcategory | PacificSubcategory;

export const emptyEthnicity = (): EthnicityState => ({
  hispanicLatino: false,
  mexican: false,
  cuban: false,
  puertoRican: false,
  otherHispanicLatino: false,
  otherText: "",
  notHispanicLatino: false,
  notProvided: false,
});

export const emptyRace = (): RaceState => ({
  americanIndian: false,
  americanIndianTribe: "",
  asian: false,
  asianIndian: false,
  chinese: false,
  filipino: false,
  japanese: false,
  korean: false,
  vietnamese: false,
  otherAsian: false,
  otherAsianText: "",
  black: false,
  nativeHawaiian: false,
  guamanian: false,
  samoan: false,
  otherPacificIslander: false,
  otherPacificIslanderText: "",
  white: false,
  notProvided: false,
});

export const emptySex = (): SexState => ({
  female: false,
  male: false,
  notProvided: false,
});
