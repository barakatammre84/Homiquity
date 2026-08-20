import { describe, it, expect, beforeEach } from "vitest";
import {
  PENDING_COACH_QUESTION_KEY,
  setPendingCoachQuestion,
  hasPendingCoachQuestion,
  readPendingCoachQuestion,
  clearPendingCoachQuestion,
} from "./pendingCoachQuestion";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("landing-hero coach question", () => {
  it("stashes durably, so it survives the new tab the signup email opens", () => {
    setPendingCoachQuestion("Can I afford a $450k house?");
    sessionStorage.clear();

    expect(hasPendingCoachQuestion()).toBe(true);
    expect(readPendingCoachQuestion()).toBe("Can I afford a $450k house?");
  });

  it("reads WITHOUT consuming — a send the coach refuses must not lose the question", () => {
    setPendingCoachQuestion("Should I refinance?");

    // Two reads in a row, as happens when the first attempt lands while the
    // coach is rate-limited or mid-stream and declines to send.
    expect(readPendingCoachQuestion()).toBe("Should I refinance?");
    expect(readPendingCoachQuestion()).toBe("Should I refinance?");

    clearPendingCoachQuestion();
    expect(readPendingCoachQuestion()).toBeNull();
    expect(hasPendingCoachQuestion()).toBe(false);
  });

  it("ignores a blank or whitespace-only question rather than routing to an empty coach", () => {
    setPendingCoachQuestion("   ");
    expect(hasPendingCoachQuestion()).toBe(false);
    expect(localStorage.getItem(PENDING_COACH_QUESTION_KEY)).toBeNull();
  });

  it("trims surrounding whitespace and caps the length it will carry", () => {
    setPendingCoachQuestion("  what about a VA loan?  ");
    expect(readPendingCoachQuestion()).toBe("what about a VA loan?");

    setPendingCoachQuestion("x".repeat(5000));
    expect(readPendingCoachQuestion()?.length).toBe(2000);
  });
});
