/**
 * The seven URLA steps and their completion predicates.
 *
 * IMPORTANT: completion here is ADVISORY ONLY. It drives the progress bar and
 * the check marks in the step rail; it never gates navigation or saving (URLA
 * is save-as-you-go). The authoritative URLA section-completeness scoring that
 * gates GSE delivery lives server-side in server/services/mismoValidation.ts —
 * do not treat a green check here as evidence a section is deliverable, and do
 * not "align" these predicates with that scorer. They answer different
 * questions for different audiences.
 */
import type { LoanApplication, UrlaPropertyInfo } from "@shared/schema";
import { DECLARATION_QUESTIONS, type BorrowerSlice } from "./types";

export interface StepContext {
  slice: BorrowerSlice;
  propertyInfo: Partial<UrlaPropertyInfo>;
  app: LoanApplication;
}

export interface UrlaStep {
  id: string;
  label: string;
  estimate: string;
  intro: string;
  isComplete: (ctx: StepContext) => boolean;
}

export const STEPS: UrlaStep[] = [
  {
    id: "borrower",
    label: "About you",
    estimate: "~4 min",
    intro: "Let's start with you. Nothing here is graded — it's simply how your loan file gets opened.",
    // ssn OR ssnLast4: `ssn` is write-only (the server encrypts it and returns
    // only the last four), so on any reload a borrower who already gave it has
    // ssnLast4 and no ssn. Requiring `ssn` alone would leave this section
    // permanently unchecked for returning borrowers.
    isComplete: ({ slice }) =>
      !!(slice.personalInfo.firstName && slice.personalInfo.lastName &&
         slice.personalInfo.dateOfBirth && (slice.personalInfo.ssn || slice.personalInfo.ssnLast4)),
  },
  {
    id: "employment",
    label: "Work & income",
    estimate: "~5 min",
    intro: "Your work and income story. Two years of history is the underwriting standard.",
    isComplete: ({ slice }) =>
      slice.employmentRecords.some((e) => e.employerName || e.positionTitle),
  },
  {
    id: "assets",
    label: "Assets",
    estimate: "~2 min",
    intro: "Where your down payment and reserves will come from.",
    isComplete: ({ slice }) =>
      slice.assets.some((a) => a.accountType || a.financialInstitution),
  },
  {
    id: "liabilities",
    label: "Liabilities",
    estimate: "~2 min",
    intro: "Your monthly obligations. Listing everything now prevents surprises later.",
    isComplete: ({ slice }) =>
      slice.liabilities.some((l) => l.liabilityType || l.creditorName),
  },
  {
    id: "property",
    label: "Property & loan",
    estimate: "~2 min",
    intro: "The home and loan this application is for — much of it carries over from your pre-approval.",
    isComplete: ({ propertyInfo, app }) =>
      !!((propertyInfo.propertyStreet || app.propertyAddress) &&
         (propertyInfo.propertyValue || app.propertyValue || app.purchasePrice)),
  },
  {
    id: "declarations",
    label: "Declarations",
    estimate: "~2 min",
    intro: "Standard questions every lender must ask — answer honestly, there are no trick questions.",
    // Explicitly `typeof === "boolean"`: `false` is a real answer, so a
    // truthiness check would treat every "no" as unanswered.
    isComplete: ({ slice }) =>
      DECLARATION_QUESTIONS.every((q) => typeof slice.declarations[q.key] === "boolean"),
  },
  {
    id: "demographics",
    label: "Demographics",
    estimate: "~1 min",
    intro: "Optional federal monitoring questions. Declining to answer is always allowed.",
    // HMDA/Reg C: the applicant may decline any of the four categories, and
    // declining IS an answer — the "not provided" flags count as complete.
    isComplete: ({ slice }) => {
      const d = slice.demographics;
      const ethnicity = d.ethnicityHispanicLatino || d.ethnicityNotHispanicLatino || d.ethnicityNotProvided;
      const race = d.raceAmericanIndian || d.raceAsian || d.raceBlack || d.raceNativeHawaiian || d.raceWhite || d.raceNotProvided;
      const sex = d.sexFemale || d.sexMale || d.sexNotProvided;
      const age = !!d.age || d.ageNotProvided;
      return ethnicity && race && sex && age;
    },
  },
];
