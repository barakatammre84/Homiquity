import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeedHelpCard } from "./LoanSummarySection";

// The pipeline page's help card is the borrower's last resort on the surface
// they land on when their file is stuck. Both of its controls shipped inert —
// leaf <Button>s with no handler and no wrapping trigger — so these assertions
// are about REACHABILITY, not styling: press it, and something happens.
describe("NeedHelpCard", () => {
  it("routes the borrower to their loan-team thread", () => {
    render(<NeedHelpCard />);
    const cta = screen.getByTestId("button-message-lo");
    // asChild renders the Link itself, so the control IS the anchor — the
    // DESIGN_SYSTEM §12.4 spelling, and the only one that actually navigates.
    const anchor = cta.tagName === "A" ? cta : cta.closest("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe("/messages");
  });

  it("offers no control that does nothing", () => {
    const { container } = render(<NeedHelpCard />);
    // A <button> here would be a leaf control with no handler: every action
    // this card can honestly offer is a navigation.
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("does not promise a scheduled call — the product has no scheduling", () => {
    render(<NeedHelpCard />);
    expect(screen.queryByTestId("button-schedule-call")).toBeNull();
    expect(screen.getByTestId("card-need-help").textContent ?? "").not.toMatch(/schedule/i);
  });
});
