import { describe, it, expect } from "vitest";
import { hasBorrowerContent, urlaRowSaveState, isUrlaRowSaveable } from "@shared/lib/urlaRowContent";

// ---------------------------------------------------------------------------
// #451 — the URLA save dropped rows the borrower had filled in, then reported
// "Everything is safely stored — you can pick this up anytime."
//
// Client and server each carried their own copy of the filters. They disagreed
// with each other AND with the database. The rule is not a preference: it is
// the NOT NULL columns in shared/schema/lendingUrla.ts.
//
//   employment_history    employer_name / position_title NULLABLE
//                         (employment_type NOT NULL but defaulted by the route)
//   urla_assets           account_type NOT NULL
//   urla_liabilities      liability_type NOT NULL
//   other_income_sources  income_source AND monthly_amount NOT NULL
//
// The old predicates were wrong in BOTH directions, which is why this suite
// tests both: they dropped employment rows the database would have accepted,
// and they ADMITTED asset/liability rows the database rejects.
// ---------------------------------------------------------------------------

describe("hasBorrowerContent — untouched rows only", () => {
  it("treats the blank row the form seeds as empty", () => {
    expect(hasBorrowerContent({})).toBe(false);
    expect(hasBorrowerContent(null)).toBe(false);
    expect(hasBorrowerContent(undefined)).toBe(false);
    expect(hasBorrowerContent({ employerName: "" })).toBe(false);
    expect(hasBorrowerContent({ employerName: "   " })).toBe(false);
    expect(hasBorrowerContent({ employerName: null })).toBe(false);
  });

  it("counts false and 0 as answers", () => {
    // A cleared checkbox and a zero balance are things the borrower said.
    expect(hasBorrowerContent({ toBePaidOff: false })).toBe(true);
    expect(hasBorrowerContent({ cashOrMarketValue: 0 })).toBe(true);
  });

  it("ignores row metadata, so a hydrated row cleared of every answer is empty", () => {
    expect(hasBorrowerContent({
      id: "a1", applicationId: "app-1", borrowerSequenceNumber: 1,
      createdAt: "2026-08-01", updatedAt: "2026-08-02",
    })).toBe(false);
    expect(hasBorrowerContent({ id: "a1", cashOrMarketValue: "500" })).toBe(true);
  });
});

describe("employment — the data loss that was reported", () => {
  it("saves a row with dates and income but no employer name yet", () => {
    // employer_name and position_title are NULLABLE, so the database would have
    // taken this row all along. The client filter (employerName || positionTitle)
    // discarded it, income included, and the borrower was told it was stored.
    expect(isUrlaRowSaveable("employment", {
      startDate: "2023-01-01",
      monthlyIncome: "6200",
    })).toBe(true);
  });

  it("still drops an untouched employment row", () => {
    expect(isUrlaRowSaveable("employment", {})).toBe(false);
    expect(urlaRowSaveState("employment", {}).state).toBe("empty");
  });

  it("keeps everything the old predicate kept", () => {
    expect(isUrlaRowSaveable("employment", { employerName: "Acme" })).toBe(true);
    expect(isUrlaRowSaveable("employment", { positionTitle: "Engineer" })).toBe(true);
    expect(isUrlaRowSaveable("employment", { baseIncome: "5000" })).toBe(true);
  });
});

describe("assets and liabilities — the latent NOT NULL violation", () => {
  it("does NOT admit an asset with only an institution", () => {
    // The old filter was `accountType || financialInstitution`, so this row
    // passed the guard and then violated account_type NOT NULL on insert —
    // turning a silent drop into a failed save.
    const state = urlaRowSaveState("asset", { financialInstitution: "Chase" });
    expect(state.state).toBe("incomplete");
    expect(state).toMatchObject({ missing: ["an account type"] });
    expect(isUrlaRowSaveable("asset", { financialInstitution: "Chase" })).toBe(false);
  });

  it("does NOT admit a liability with only a creditor", () => {
    const state = urlaRowSaveState("liability", { creditorName: "Visa" });
    expect(state.state).toBe("incomplete");
    expect(state).toMatchObject({ missing: ["a liability type"] });
  });

  it("saves them once the NOT NULL field is present", () => {
    expect(isUrlaRowSaveable("asset", { accountType: "Checking" })).toBe(true);
    expect(isUrlaRowSaveable("liability", { liabilityType: "Revolving (Credit Card)" })).toBe(true);
  });

  it("reports a balance-only asset as incomplete rather than silently dropping it", () => {
    // This is the row the issue described: a balance typed before the account
    // type is picked. It genuinely cannot be saved — but the borrower is now
    // told which detail is missing instead of being shown a success message.
    const state = urlaRowSaveState("asset", { cashOrMarketValue: "18400" });
    expect(state.state).toBe("incomplete");
  });
});

describe("other income — the `&&` was correct, not an asymmetry bug", () => {
  it("requires both fields, because both columns are NOT NULL", () => {
    expect(urlaRowSaveState("otherIncome", { incomeSource: "Social Security" }))
      .toMatchObject({ state: "incomplete", missing: ["a monthly amount"] });
    expect(urlaRowSaveState("otherIncome", { monthlyAmount: "1150" }))
      .toMatchObject({ state: "incomplete", missing: ["an income source"] });
    expect(isUrlaRowSaveable("otherIncome", { incomeSource: "Trust", monthlyAmount: "900" })).toBe(true);
  });

  it("names both missing fields when neither is present but something else is", () => {
    const state = urlaRowSaveState("otherIncome", { notes: "from my aunt" });
    expect(state).toMatchObject({ missing: ["an income source", "a monthly amount"] });
  });
});

describe("the three states are exhaustive and distinct", () => {
  it("separates never-filled-in from cannot-be-saved", () => {
    // This distinction is the whole fix: "empty" is silent and correct,
    // "incomplete" must be surfaced to the borrower.
    expect(urlaRowSaveState("asset", {}).state).toBe("empty");
    expect(urlaRowSaveState("asset", { financialInstitution: "Chase" }).state).toBe("incomplete");
    expect(urlaRowSaveState("asset", { accountType: "Savings" }).state).toBe("saveable");
  });
});
