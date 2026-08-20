import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DATA_PROVENANCE } from "@shared/dataProvenance";
import { SummarySection, UnderwritingRule } from "./SummarySection";

// Pins §9's type-encoded decision: a financial section cannot render without
// declaring its source, and an intrusive ask ships with its explanation.

describe("SummarySection", () => {
  it("renders the required source badge and why-we-ask explainer", () => {
    render(
      <SummarySection
        title="Income"
        source={{ provenance: DATA_PROVENANCE.SELF_REPORTED }}
        whyWeAsk="Your income determines your debt-to-income ratio, and we verify it with documents like paystubs and W-2s."
      >
        <p>$84,000 / year</p>
      </SummarySection>,
    );

    expect(screen.getByTestId("summary-section-provenance").textContent).toBe(
      "You told us",
    );
    const why = screen.getByTestId("summary-section-why-we-ask").textContent!;
    expect(why).toContain("Why we ask:");
    expect(why).toContain("debt-to-income");
  });
});

describe("UnderwritingRule", () => {
  it("prints the rule as a note beside the field it governs", () => {
    render(<UnderwritingRule rule="This must be consistent for a 2-year period." />);
    const note = screen.getByTestId("underwriting-rule");
    expect(note.getAttribute("role")).toBe("note");
    expect(note.textContent).toContain("2-year period");
  });
});
