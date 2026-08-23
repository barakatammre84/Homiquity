/**
 * Fannie Mae Selling Guide B3-5.3-07, Significant Derogatory Credit Events —
 * Waiting Periods and Re-establishing Credit (08/07/2019).
 *
 *   Bankruptcy Ch 7/11 ................ 4 years (2 with extenuating circumstances)
 *   Bankruptcy Ch 13 .................. 2 years from discharge, 4 from dismissal
 *   Multiple filings in past 7 years .. 5 years (3 with extenuating circumstances)
 *   Foreclosure ....................... 7 years (3, with =<90% LTV and limits)
 *   Deed-in-lieu / preforeclosure sale
 *   / charge-off of a mortgage ........ 4 years (2 with extenuating circumstances)
 *
 * THE DEFECT. borrower_declarations carries 33 columns — bankruptcy, foreclosure,
 * short sale, deed-in-lieu, outstanding judgments, delinquency on federal debt —
 * and reached exactly two consumers: document generation and MISMO completeness
 * scoring. ZERO of it reached the decision path, and no engine file mentioned
 * bankruptcy or foreclosure at all. A borrower could declare a foreclosure and be
 * decisioned as though they had not.
 *
 * Every waiting period above is measured from a discharge / dismissal /
 * completion DATE, and the table stores booleans with no dates. So the period is
 * uncomputable from captured data — but being unable to CLEAR an event is not a
 * reason to IGNORE it. It routes to a human.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { summarizeDeclaredDerogatoryEvents } from "../server/services/decisionEngine";

const ENGINE = fs.readFileSync("server/underwritingEngine.ts", "utf-8");
const DECISION = fs.readFileSync("server/services/decisionEngine.ts", "utf-8");

describe("B3-5.3-07 declared events are collected", () => {
  it("names each event type", () => {
    const events = summarizeDeclaredDerogatoryEvents([
      {
        hasDeclaredBankruptcy: true,
        bankruptcyTypes: "Chapter 7",
        hasBeenForeclosed: true,
        hasConveyedTitleInLieuOfForeclosure: true,
        hasCompletedShortSale: true,
        hasOutstandingJudgments: true,
        isDelinquentOnFederalDebt: true,
      },
    ]);
    expect(events).toContain("bankruptcy (Chapter 7)");
    expect(events).toContain("foreclosure");
    expect(events).toContain("deed-in-lieu of foreclosure");
    expect(events).toContain("preforeclosure / short sale");
    expect(events).toContain("outstanding judgments");
    expect(events).toContain("delinquency on federal debt");
  });

  it("returns nothing for a clean file", () => {
    expect(summarizeDeclaredDerogatoryEvents([{ hasDeclaredBankruptcy: false }])).toEqual([]);
    expect(summarizeDeclaredDerogatoryEvents([])).toEqual([]);
  });

  // G-15 is the asymmetry where a co-borrower's income counts and their credit
  // does not. Scoping declarations to the primary would repeat it exactly.
  it("sees a CO-BORROWER's foreclosure, not just the primary's", () => {
    const events = summarizeDeclaredDerogatoryEvents([
      { hasBeenForeclosed: false },
      { hasBeenForeclosed: true },
    ]);
    expect(events, "a co-borrower's foreclosure must not be invisible").toContain("foreclosure");
  });

  it("does not repeat an event both borrowers declare", () => {
    const events = summarizeDeclaredDerogatoryEvents([
      { hasBeenForeclosed: true },
      { hasBeenForeclosed: true },
    ]);
    expect(events.filter((e) => e === "foreclosure")).toHaveLength(1);
  });
});

describe("B3-5.3-07 declared events reach the decision", () => {
  it("the engine accepts them", () => {
    expect(ENGINE).toMatch(/declaredDerogatoryEvents\?: string\[\]/);
  });

  it("the decision engine populates them — the whole defect was a table nothing read", () => {
    expect(DECISION).toMatch(/declaredDerogatoryEvents:\s*fin\.declaredDerogatoryEvents/);
    expect(DECISION).toMatch(/getAllBorrowerDeclarations/);
  });

  it("routes a declared event to review, citing the topic", () => {
    expect(ENGINE).toMatch(/declaredDerogatoryEvents\.length > 0/);
    expect(ENGINE).toContain("B3-5.3-07");
  });

  it("does not invent a waiting period", () => {
    // The dates the periods run from are not captured. A hardcoded "4 years"
    // here would be a rule applied to data that cannot support it.
    const block = ENGINE.slice(
      ENGINE.indexOf("B3-5.3-07, Significant Derogatory Credit Events."),
      ENGINE.indexOf("Subject-property reconciliation"),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/\b[2-7] years\b/);
  });
});
