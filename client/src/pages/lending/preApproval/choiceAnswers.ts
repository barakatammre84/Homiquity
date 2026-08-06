// The answer-shape rules behind the funnel's `choice` steps, kept out of the
// markup so they can be tested without rendering the funnel.
//
// Most choice steps are a plain string field. `hasAdditionalIncome` is not: its
// two options ("yes"/"no") map onto a BOOLEAN field, and answering "no" has to
// clear any incomeSources the borrower already entered — otherwise a borrower
// who adds a source, backs up, and switches to "no" submits stale income the
// UI no longer shows them.
import { type PreApprovalFormData } from "@shared/schema";

const YES_NO_BOOLEAN_STEP = "hasAdditionalIncome";

export interface ChoiceFieldUpdate {
  field: keyof PreApprovalFormData;
  value: string | boolean | never[];
}

export function isChoiceOptionSelected(
  questionId: string,
  optionValue: string,
  currentValue: unknown,
): boolean {
  if (questionId === YES_NO_BOOLEAN_STEP) {
    return optionValue === "yes" ? currentValue === true : currentValue === false;
  }
  return currentValue === optionValue;
}

export function choiceSelectionUpdates(
  questionId: string,
  field: keyof PreApprovalFormData,
  optionValue: string,
): ChoiceFieldUpdate[] {
  if (questionId === YES_NO_BOOLEAN_STEP) {
    const updates: ChoiceFieldUpdate[] = [
      { field: "hasAdditionalIncome", value: optionValue === "yes" },
    ];
    if (optionValue === "no") {
      updates.push({ field: "incomeSources", value: [] });
    }
    return updates;
  }
  return [{ field, value: optionValue }];
}
