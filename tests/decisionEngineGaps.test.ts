import { describe, expect, it } from "vitest";
import { describeEngineGap, isSystemFault } from "../server/services/decisionEngine";

// 2026-08-05 pre-flight regression pins (WF1-002 / WF1-005): the pricing
// catch must (1) name the §1026.36(d)(2) compensation election as a staff
// task instead of the generic unactionable gap that made every fresh intake
// read as the borrower's fault, and (2) rethrow infrastructure faults
// instead of translating them into borrower "missing info" (a missing table
// once surfaced as "additional information required").
describe("describeEngineGap", () => {
  it("maps the compensation-election throw to a staff-side, borrower-safe gap", () => {
    const gap = describeEngineGap(
      new Error(
        "Loan originator compensation model and rate are required to generate a loan estimate (12 CFR 1026.36(d)(2))",
      ),
    );
    expect(gap).toEqual(["Loan pricing setup by our team — no action needed from you"]);
  });

  it("keeps the generic fallback for unrecognized gaps", () => {
    expect(describeEngineGap(new Error("something unrecognizable"))).toEqual([
      "Additional information required to complete the decision",
    ]);
  });
});

describe("isSystemFault", () => {
  it("recognizes SQLSTATE-carrying pg errors", () => {
    const err = Object.assign(new Error('column "borrower_description" does not exist'), {
      code: "42703",
    });
    expect(isSystemFault(err)).toBe(true);
  });

  it("does not flag plain domain errors or non-errors", () => {
    expect(isSystemFault(new Error("VALUE INPUT: property value missing"))).toBe(false);
    expect(isSystemFault(null)).toBe(false);
    expect(isSystemFault({ code: 42 })).toBe(false);
  });
});
