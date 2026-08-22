// The server-draft restore mapping, tested as a CLASS rather than as a bug.
//
// `draftToFormValues` is fed straight into `form.reset(...)`, so it is not an
// "update these fields" patch — it is the whole form. A funnel field missing
// from it is silently reset to blank while the restore banner tells the
// borrower their progress was loaded. That is how `householdFamilySize` and
// `homeSquareFootage` — the VA residual-income pair (38 CFR 36.4340(e)) —
// were dropped: collected, autosaved, stored, and then thrown away on the way
// back in.
//
// The completeness test below is the guard. It pins the field list against
// PRE_APPROVAL_DEFAULTS, so adding a question to the funnel fails here until
// the mapping and this fixture are both updated — which is the only point at
// which anyone is looking.
import { describe, expect, it } from "vitest";
import type { LoanApplication } from "@shared/schema";
import { PRE_APPROVAL_DEFAULTS } from "@/funnel/preApprovalMachine";
import { draftToFormValues } from "./useDraftRestore";

/**
 * Funnel answers that PRE_APPROVAL_DEFAULTS carries and the draft row
 * persists, so the restore must carry them too. `hasAdditionalIncome` is the
 * one deliberate exclusion: it has no column and is derived from
 * `incomeSources.length` (it is the funnel's yes/no routing helper, not an
 * answer of its own).
 */
const UI_ONLY_FIELDS = ["hasAdditionalIncome"] as const;

/** A draft with every persisted funnel answer filled, all distinct from the defaults. */
const FULL_DRAFT = {
  id: "draft-1",
  annualIncome: "120000",
  employmentType: "self_employed",
  employmentYears: 7,
  monthlyDebts: "1500",
  creditScore: 720,
  loanPurpose: "refinance",
  propertyType: "condo",
  purchasePrice: "500000",
  downPayment: "100000",
  isVeteran: true,
  isFirstTimeBuyer: true,
  avoidsInterestFinancing: true,
  propertyState: "IL",
  householdFamilySize: 4,
  homeSquareFootage: 2200,
  incomeSources: [{ type: "rental", annualAmount: "24000" }],
} as unknown as LoanApplication;

describe("draftToFormValues", () => {
  it("carries the VA residual-income pair back out of the draft", () => {
    const restored = draftToFormValues(FULL_DRAFT, PRE_APPROVAL_DEFAULTS);

    expect(restored.householdFamilySize).toBe("4");
    expect(restored.homeSquareFootage).toBe("2200");
  });

  it("leaves the VA pair blank when the draft never held one", () => {
    const draft = {
      ...FULL_DRAFT,
      householdFamilySize: null,
      homeSquareFootage: null,
    } as unknown as LoanApplication;

    const restored = draftToFormValues(draft, PRE_APPROVAL_DEFAULTS);

    expect(restored.householdFamilySize).toBe("");
    expect(restored.homeSquareFootage).toBe("");
  });

  it("keeps a stored 0 out of the form — the schema's floors are 1 and 100", () => {
    const draft = {
      ...FULL_DRAFT,
      householdFamilySize: 0,
      homeSquareFootage: 0,
    } as unknown as LoanApplication;

    const restored = draftToFormValues(draft, PRE_APPROVAL_DEFAULTS);

    expect(restored.householdFamilySize).toBe("");
    expect(restored.homeSquareFootage).toBe("");
  });

  // The class guard: no funnel answer may survive the restore still equal to
  // its blank default when the draft held a value for it.
  it("restores EVERY persisted funnel answer, not just the ones someone remembered", () => {
    const restored = draftToFormValues(FULL_DRAFT, PRE_APPROVAL_DEFAULTS);

    const dropped = (Object.keys(PRE_APPROVAL_DEFAULTS) as (keyof typeof PRE_APPROVAL_DEFAULTS)[])
      .filter((key) => !(UI_ONLY_FIELDS as readonly string[]).includes(key))
      .filter((key) => {
        const value = restored[key];
        const blank = PRE_APPROVAL_DEFAULTS[key];
        return JSON.stringify(value) === JSON.stringify(blank);
      });

    expect(dropped).toEqual([]);
  });

  // avoidsInterestFinancing is a real persisted answer (UAL P7 routing) that
  // PRE_APPROVAL_DEFAULTS does not carry, so the sweep above cannot see it.
  it("restores avoidsInterestFinancing, which the defaults object omits", () => {
    expect(draftToFormValues(FULL_DRAFT, PRE_APPROVAL_DEFAULTS).avoidsInterestFinancing).toBe(true);
  });

  it("derives hasAdditionalIncome from the restored sources rather than a column", () => {
    expect(draftToFormValues(FULL_DRAFT, PRE_APPROVAL_DEFAULTS).hasAdditionalIncome).toBe(true);

    const noSources = { ...FULL_DRAFT, incomeSources: [] } as unknown as LoanApplication;
    expect(draftToFormValues(noSources, PRE_APPROVAL_DEFAULTS).hasAdditionalIncome).toBe(false);
  });
});
