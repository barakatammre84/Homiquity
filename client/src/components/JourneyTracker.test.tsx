import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneyTracker } from "./JourneyTracker";

// Borrower Clarity PR 6: the vertical tracker can render per-step detail
// lines derived from data the borrower already sees (milestone dates,
// doc/condition counters, the closing-prep transparency line). Details are
// optional — a tracker without them renders exactly as before.

describe("JourneyTracker — detail lines (vertical)", () => {
  const details = {
    submitted: ["Received Aug 1"],
    underwriting: ["Started Aug 5", "Conditions cleared: 1 of 4"],
  };

  it("renders detail lines under their steps", () => {
    render(<JourneyTracker status="underwriting" variant="vertical" details={details} />);
    expect(screen.getByTestId("journey-detail-submitted").textContent).toContain("Received Aug 1");
    const uw = screen.getByTestId("journey-detail-underwriting");
    expect(uw.textContent).toContain("Started Aug 5");
    expect(uw.textContent).toContain("Conditions cleared: 1 of 4");
  });

  it("renders no detail node for steps without lines", () => {
    render(<JourneyTracker status="underwriting" variant="vertical" details={details} />);
    expect(screen.queryByTestId("journey-detail-funded")).toBeNull();
  });

  it("renders unchanged without the details prop", () => {
    render(<JourneyTracker status="underwriting" variant="vertical" />);
    expect(screen.getByTestId("journey-step-underwriting")).toBeTruthy();
    expect(screen.queryByTestId("journey-detail-underwriting")).toBeNull();
  });
});
