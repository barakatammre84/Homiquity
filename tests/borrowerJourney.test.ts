import { describe, expect, it } from "vitest";
import { deriveJourneyStepDetails } from "@shared/borrowerJourney";
import { lintOutboundText } from "@shared/compliance/loCommsLint";

/**
 * Borrower Clarity PR 6 (kb log 2026-08-04 §4): journey detail lines are a
 * pure derivation over already-authorized payloads. Pinned here: the honest
 * grain (no invented milestones), UTC date determinism, and the two
 * adjudicated absences — "Income Audit Complete" (MR-2) and "CD Issued"
 * (cdIssuedDate has no writer).
 */

describe("deriveJourneyStepDetails", () => {
  it("derives dated lines from the milestone row", () => {
    const details = deriveJourneyStepDetails({
      milestones: {
        submittedAt: "2026-08-01T14:30:00.000Z",
        preApprovedAt: "2026-08-02T09:00:00.000Z",
        underwritingStartedAt: new Date("2026-08-05T00:00:00.000Z"),
        clearToCloseAt: null,
      },
    });
    expect(details.submitted).toEqual(["Received Aug 1"]);
    expect(details.pre_approved).toEqual(["Pre-approved Aug 2"]);
    expect(details.underwriting).toEqual(["Started Aug 5"]);
    expect(details.clear_to_close).toBeUndefined();
  });

  it("adds document and condition counters only when totals exist", () => {
    const details = deriveJourneyStepDetails({
      documents: { complete: 3, total: 5 },
      conditions: { cleared: 1, total: 4 },
    });
    expect(details.processing).toEqual(["Documents: 3 of 5 complete"]);
    expect(details.underwriting).toEqual(["Conditions cleared: 1 of 4"]);

    const empty = deriveJourneyStepDetails({
      documents: { complete: 0, total: 0 },
      conditions: { cleared: 0, total: 0 },
    });
    expect(empty.processing).toBeUndefined();
    expect(empty.underwriting).toBeUndefined();
  });

  it("processing start prefers processingStartedAt, falls back to docCollectionStartedAt", () => {
    expect(
      deriveJourneyStepDetails({
        milestones: {
          processingStartedAt: "2026-08-04T00:00:00.000Z",
          docCollectionStartedAt: "2026-08-03T00:00:00.000Z",
        },
      }).processing,
    ).toEqual(["Started Aug 4"]);
    expect(
      deriveJourneyStepDetails({
        milestones: { docCollectionStartedAt: "2026-08-03T00:00:00.000Z" },
      }).processing,
    ).toEqual(["Started Aug 3"]);
  });

  it("surfaces the closing-prep transparency line only while the task is in flight", () => {
    expect(
      deriveJourneyStepDetails({ closingPrepInProgress: true }).clear_to_close,
    ).toEqual(["We're preparing your closing paperwork"]);
    expect(deriveJourneyStepDetails({ closingPrepInProgress: false }).clear_to_close).toBeUndefined();
  });

  it("dates are UTC-deterministic (a 23:30Z timestamp stays on its UTC day)", () => {
    const details = deriveJourneyStepDetails({
      milestones: { fundedAt: "2026-08-15T23:30:00.000Z" },
    });
    expect(details.funded).toEqual(["Funded Aug 15"]);
  });

  it('never invents "Income Audit" or "CD Issued" lines and stays Reg N clean', () => {
    const details = deriveJourneyStepDetails({
      milestones: {
        submittedAt: "2026-08-01T00:00:00.000Z",
        preApprovedAt: "2026-08-02T00:00:00.000Z",
        docCollectionStartedAt: "2026-08-03T00:00:00.000Z",
        processingStartedAt: "2026-08-03T00:00:00.000Z",
        underwritingStartedAt: "2026-08-05T00:00:00.000Z",
        conditionalApprovedAt: "2026-08-06T00:00:00.000Z",
        clearToCloseAt: "2026-08-08T00:00:00.000Z",
        closingScheduledAt: "2026-08-12T00:00:00.000Z",
        fundedAt: "2026-08-15T00:00:00.000Z",
      },
      documents: { complete: 5, total: 5 },
      conditions: { cleared: 4, total: 4 },
      closingPrepInProgress: true,
    });
    const allLines = Object.values(details).flat().join(" | ");
    expect(allLines.toLowerCase()).not.toContain("income audit");
    expect(allLines.toLowerCase()).not.toContain("cd issued");
    expect(allLines.toLowerCase()).not.toContain("closing disclosure");
    const lint = lintOutboundText(allLines);
    expect([...lint.triggerMatches, ...lint.hardBlockMatches]).toHaveLength(0);
  });
});
