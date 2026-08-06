import { describe, it, expect } from "vitest";
import { isChoiceOptionSelected, choiceSelectionUpdates } from "./choiceAnswers";

// The funnel's choice steps are almost all "set this string field", except
// hasAdditionalIncome, which is a boolean rendered as yes/no AND owns a
// clearing rule. These tests pin the exception, because getting it wrong is
// silent: the borrower sees "No, this is my only income" selected while
// incomeSources still carries entries into the submitted application.

describe("isChoiceOptionSelected", () => {
  it("compares a plain choice field by value", () => {
    expect(isChoiceOptionSelected("loanPurpose", "purchase", "purchase")).toBe(true);
    expect(isChoiceOptionSelected("loanPurpose", "purchase", "refinance")).toBe(false);
  });

  it("maps hasAdditionalIncome's yes/no options onto the boolean field", () => {
    expect(isChoiceOptionSelected("hasAdditionalIncome", "yes", true)).toBe(true);
    expect(isChoiceOptionSelected("hasAdditionalIncome", "no", true)).toBe(false);
    expect(isChoiceOptionSelected("hasAdditionalIncome", "no", false)).toBe(true);
    expect(isChoiceOptionSelected("hasAdditionalIncome", "yes", false)).toBe(false);
  });

  it("shows neither option selected while hasAdditionalIncome is unanswered", () => {
    expect(isChoiceOptionSelected("hasAdditionalIncome", "yes", undefined)).toBe(false);
    expect(isChoiceOptionSelected("hasAdditionalIncome", "no", undefined)).toBe(false);
  });
});

describe("choiceSelectionUpdates", () => {
  it("writes the option value straight to a plain choice field", () => {
    expect(choiceSelectionUpdates("creditScore", "creditScore", "760")).toEqual([
      { field: "creditScore", value: "760" },
    ]);
  });

  it("writes a boolean for hasAdditionalIncome", () => {
    expect(choiceSelectionUpdates("hasAdditionalIncome", "hasAdditionalIncome", "yes")).toEqual([
      { field: "hasAdditionalIncome", value: true },
    ]);
  });

  it('answering "no" also clears any income sources already entered', () => {
    expect(choiceSelectionUpdates("hasAdditionalIncome", "hasAdditionalIncome", "no")).toEqual([
      { field: "hasAdditionalIncome", value: false },
      { field: "incomeSources", value: [] },
    ]);
  });

  it('answering "yes" does NOT clear income sources — backing up and re-confirming keeps the work', () => {
    const updates = choiceSelectionUpdates("hasAdditionalIncome", "hasAdditionalIncome", "yes");
    expect(updates.some((u) => u.field === "incomeSources")).toBe(false);
  });
});
