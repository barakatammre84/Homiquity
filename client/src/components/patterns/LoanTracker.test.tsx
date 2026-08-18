import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoanTracker } from "./LoanTracker";

// Pins §6: the whole road stays visible — future steps render greyed with
// their actor-naming descriptions, one step carries aria-current.

describe("LoanTracker", () => {
  it("keeps future steps visible with actor-named descriptions", () => {
    render(
      <LoanTracker
        label="Your loan, start to close"
        steps={[
          {
            id: "questions",
            title: "Answer a few questions",
            description: "You tell us about your income, debts, and goals.",
            status: "done",
            completedOn: "Aug 12, 2026",
          },
          {
            id: "documents",
            title: "Upload your documents",
            description: "You provide the documents we list — nothing extra.",
            status: "current",
          },
          {
            id: "review",
            title: "Get your answer",
            description: "We review and verify your financial information.",
            status: "future",
          },
        ]}
      />,
    );

    expect(
      screen.getByText("We review and verify your financial information."),
    ).toBeTruthy();

    const current = screen.getByTestId("loan-tracker-step-documents");
    expect(current.getAttribute("aria-current")).toBe("step");
    expect(screen.getByTestId("loan-tracker-documents-required").textContent).toBe(
      "Required",
    );
    expect(screen.getByTestId("loan-tracker-questions-done").textContent).toBe(
      "Done · Aug 12, 2026",
    );
  });
});
