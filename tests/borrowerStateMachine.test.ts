import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getAvailableTransitions,
  getStateMetadata,
} from "../server/services/borrowerStateMachine";
import { BORROWER_STATES } from "@shared/schema";

// Pure transition-rule coverage for the borrower lifecycle state machine.
// (getCurrentState/transitionState hit the DB and are exercised by integration
// paths; these tests lock the deterministic rule matrix that governs which
// lifecycle moves are legal.)

describe("borrowerStateMachine: isValidTransition", () => {
  it("allows a defined transition on any of its triggers", () => {
    expect(isValidTransition("lead", "exploring", "account_created")).toBe(true);
    expect(isValidTransition("lead", "exploring", "goal_set")).toBe(true);
    expect(isValidTransition("pre_qualification", "pre_approval", "documents_uploaded")).toBe(true);
    expect(isValidTransition("closing", "funded", "funded")).toBe(true);
  });

  it("rejects a transition to a state with no matching rule", () => {
    expect(isValidTransition("lead", "funded", "funded")).toBe(false);
    expect(isValidTransition("lead", "underwriting", "underwriting_submitted")).toBe(false);
  });

  it("rejects a defined transition reached with the wrong trigger", () => {
    // lead -> exploring is only triggered by account_created / goal_set.
    expect(isValidTransition("lead", "exploring", "profile_completed")).toBe(false);
  });

  it("manual_override bypasses the rule matrix entirely", () => {
    expect(isValidTransition("lead", "funded", "manual_override")).toBe(true);
    expect(isValidTransition("denied", "closing", "manual_override")).toBe(true);
  });

  it("honors multi-source rules (withdrawn / denied) and their source lists", () => {
    // withdrawn is reachable from exploring..underwriting, but not from lead.
    expect(isValidTransition("underwriting", "withdrawn", "borrower_withdrew")).toBe(true);
    expect(isValidTransition("lead", "withdrawn", "borrower_withdrew")).toBe(false);
    // denied is reachable from pre_approval, not from exploring.
    expect(isValidTransition("pre_approval", "denied", "application_denied")).toBe(true);
    expect(isValidTransition("exploring", "denied", "application_denied")).toBe(false);
  });
});

describe("borrowerStateMachine: getAvailableTransitions", () => {
  it("returns exactly the lead's single onward transition", () => {
    const avail = getAvailableTransitions("lead");
    expect(avail).toHaveLength(1);
    expect(avail[0].toState).toBe("exploring");
    expect(avail[0].triggers).toEqual(expect.arrayContaining(["account_created", "goal_set"]));
  });

  it("surfaces the fork options available from pre_approval", () => {
    const targets = getAvailableTransitions("pre_approval").map((t) => t.toState);
    expect(targets).toEqual(expect.arrayContaining(["property_search", "withdrawn", "denied", "expired"]));
  });

  it("returns no onward transitions for a terminal state", () => {
    expect(getAvailableTransitions("homeowner")).toHaveLength(0);
    expect(getAvailableTransitions("denied")).toHaveLength(0);
  });
});

describe("borrowerStateMachine: getStateMetadata", () => {
  it("returns coherent metadata for boundary states", () => {
    expect(getStateMetadata("lead")).toMatchObject({ progressPercent: 0, phase: "pre_application" });
    expect(getStateMetadata("pre_approval")).toMatchObject({ progressPercent: 35, phase: "application" });
    expect(getStateMetadata("funded")).toMatchObject({ progressPercent: 100, phase: "post_closing" });
    expect(getStateMetadata("denied")).toMatchObject({ progressPercent: 0, phase: "terminal" });
  });

  it("returns complete metadata for every declared borrower state", () => {
    for (const state of BORROWER_STATES) {
      const meta = getStateMetadata(state);
      expect(typeof meta.label).toBe("string");
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.progressPercent).toBeGreaterThanOrEqual(0);
      expect(meta.progressPercent).toBeLessThanOrEqual(100);
    }
  });
});
