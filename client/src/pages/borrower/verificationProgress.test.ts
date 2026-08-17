import { describe, it, expect } from "vitest";
import { countCompletedRequired, REQUIRED_VERIFICATION_TYPES } from "./Verification";

// Recovered from the xyq4f8 archive tag (#487) and verified still live on main
// before porting.
//
// The Verification Center counted EVERY verified record against a total that
// only ever meant the REQUIRED ones:
//
//   const completedCount = verifications?.filter(v => v.status === "verified").length
//   ...
//   {completedCount} of {totalRequired} required verifications complete
//   {completedCount >= totalRequired ? <AllRequiredComplete/> : ...}
//
// employment and identity are required; income and assets are optional. So a
// borrower who connected their bank (assets) and payroll (income) — and had
// done NEITHER required check — was told "2 of 2 required verifications
// complete" under an "All Required Complete" badge.
//
// That is a false completion claim on a loan file, and it points the wrong way:
// it tells someone they are done when they are not, on the surface whose whole
// job is to say what is outstanding.

const v = (verificationType: string, status: string) => ({ verificationType, status });

describe("countCompletedRequired", () => {
  it("knows which verifications are actually required", () => {
    expect([...REQUIRED_VERIFICATION_TYPES].sort()).toEqual(["employment", "identity"]);
  });

  it("does NOT let two optional verifications satisfy two required ones", () => {
    // The exact reported case.
    const completed = countCompletedRequired([
      v("income", "verified"),
      v("assets", "verified"),
    ]);
    expect(completed).toBe(0);
  });

  it("counts only verified REQUIRED types", () => {
    expect(countCompletedRequired([v("employment", "verified")])).toBe(1);
    expect(countCompletedRequired([
      v("employment", "verified"),
      v("identity", "verified"),
      v("income", "verified"),
      v("assets", "verified"),
    ])).toBe(2);
  });

  it("ignores required types that are not verified", () => {
    expect(countCompletedRequired([
      v("employment", "pending"),
      v("identity", "in_progress"),
      v("employment", "failed"),
    ])).toBe(0);
  });

  it("handles no verifications at all", () => {
    expect(countCompletedRequired(undefined)).toBe(0);
    expect(countCompletedRequired(null)).toBe(0);
    expect(countCompletedRequired([])).toBe(0);
  });

  it("counts DISTINCT types, so duplicate records cannot clear the gate", () => {
    // Found while writing this suite: verifications are a log, so a borrower can
    // hold more than one record for the same check (a retry after a failure, or
    // a re-run). Counting ROWS reopens the same hole from the other side — two
    // verified employment records would report "2 of 2 required complete" with
    // identity untouched.
    expect(countCompletedRequired([
      v("employment", "verified"),
      v("employment", "verified"),
    ])).toBe(1);

    expect(countCompletedRequired([
      v("employment", "failed"),
      v("employment", "verified"),
      v("employment", "verified"),
    ])).toBe(1);
  });

  it("never reports more complete than there are required checks", () => {
    const everything = [
      v("employment", "verified"), v("employment", "verified"),
      v("identity", "verified"), v("identity", "verified"),
      v("income", "verified"), v("assets", "verified"),
    ];
    expect(countCompletedRequired(everything)).toBe(REQUIRED_VERIFICATION_TYPES.size);
  });
});
