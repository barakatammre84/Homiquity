import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

// Pins the scope rule (§6): the heading is DERIVED from the scope the
// component actually knows, so a local surface can never claim a global
// "you're all caught up".

describe("patterns/EmptyState", () => {
  it("derives its heading from the required scope", () => {
    render(
      <EmptyState
        scope="documents for this loan"
        description="Anything your loan team requests will show up here."
      />,
    );
    expect(screen.getByTestId("empty-state").textContent).toContain(
      "No documents for this loan yet",
    );
  });
});
