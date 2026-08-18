import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MilestoneBar } from "./MilestoneBar";

// Pins §9's type-encoded decision: `label` is required and used as the
// accessible name — every progress tier says what it measures.

describe("MilestoneBar", () => {
  it("names what it measures, visibly and accessibly, and marks the current tier", () => {
    render(
      <MilestoneBar
        label="Your journey to keys"
        milestones={[
          { id: "preapproval", name: "Pre-approval", status: "done" },
          { id: "underwriting", name: "Underwriting", status: "current" },
          { id: "closing", name: "Closing", status: "future" },
        ]}
      />,
    );

    expect(screen.getByText("Your journey to keys")).toBeTruthy();
    expect(
      screen.getByTestId("milestone-bar").getAttribute("aria-label"),
    ).toBe("Your journey to keys");
    expect(
      screen.getByTestId("milestone-bar-underwriting").getAttribute("aria-current"),
    ).toBe("step");
    expect(screen.getByText("Closing")).toBeTruthy();
  });
});
