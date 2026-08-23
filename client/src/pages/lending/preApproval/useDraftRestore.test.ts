import { describe, expect, it } from "vitest";
import { draftToFormValues } from "./useDraftRestore";
import { defaultPreApprovalFormValues, type PreApprovalFormData } from "@shared/preApprovalForm";
import type { LoanApplication } from "@shared/schema";

// `draftToFormValues` feeds `form.reset`, so a field it omits is not "left
// alone" — it is reset to its default. The two VA residual-income inputs were
// omitted until 2026-08-22, which re-asked every veteran for household size
// and square footage on every resume (2026-08-19 wiring audit, break 2).

const draft = (overrides: Partial<LoanApplication>): LoanApplication =>
  ({ id: "app-1", annualIncome: "85000", ...overrides }) as unknown as LoanApplication;

const current: PreApprovalFormData = { ...defaultPreApprovalFormValues };

describe("draftToFormValues — the three answers the server draft used to lose", () => {
  it("restores the VA residual-income inputs as the form's digit strings", () => {
    const values = draftToFormValues(
      draft({ isVeteran: true, householdFamilySize: 4, homeSquareFootage: 1800 }),
      current,
    );
    expect(values.householdFamilySize).toBe("4");
    expect(values.homeSquareFootage).toBe("1800");
    expect(values.isVeteran).toBe(true);
  });

  it("restores the UAL routing opt-in as a real true", () => {
    expect(draftToFormValues(draft({ avoidsInterestFinancing: true }), current).avoidsInterestFinancing).toBe(true);
    expect(draftToFormValues(draft({ avoidsInterestFinancing: false }), current).avoidsInterestFinancing).toBe(false);
  });

  it("maps an unanswered VA input to the untouched form state, not to a stale value", () => {
    // The draft is the source of truth once adopted: a field it does not carry
    // comes back as "" — the same shape every other text field uses here.
    const values = draftToFormValues(
      draft({ householdFamilySize: null, homeSquareFootage: null }),
      { ...current, householdFamilySize: "7", homeSquareFootage: "3000" },
    );
    expect(values.householdFamilySize).toBe("");
    expect(values.homeSquareFootage).toBe("");
  });
});
