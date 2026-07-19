import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoanDetails } from "./LoanDetails";
import { CollapsibleActivity } from "./CollapsibleActivity";
import type { LoanApplication, DealActivity } from "@shared/schema";

const app = (over?: Partial<LoanApplication>): LoanApplication =>
  ({ id: "a-1", status: "pre_approved", preApprovalAmount: "400000", downPayment: "80000", preferredLoanType: "conventional", ...over }) as unknown as LoanApplication;

describe("LoanDetails", () => {
  it("collapsed by default with an item-count badge; expands on toggle", async () => {
    const user = userEvent.setup();
    render(
      <LoanDetails
        application={app()}
        hasOffers={true}
        offerCount={3}
        rateRange="6.1%–6.6%"
        hmdaCompleted={false}
        expirationInfo={{ label: "Aug 18, 2026", daysLeft: 21, urgency: "normal" }}
        isPreApproved={true}
      />,
    );
    expect(screen.queryByTestId("card-loan-details")).toBeNull();
    expect(screen.getByTestId("badge-detail-count").textContent).toBe("6");
    await user.click(screen.getByTestId("button-toggle-details"));
    expect(screen.getByTestId("detail-offers").textContent).toContain("3 available (6.1%–6.6%)");
    expect(screen.getByTestId("detail-expiration").textContent).toContain("Aug 18, 2026");
    expect(screen.getByTestId("detail-hmda").textContent).toContain("Not yet completed");
  });

  it("hides the expiration row once expired — the next-action card owns that state", async () => {
    const user = userEvent.setup();
    render(
      <LoanDetails
        application={app()}
        hasOffers={false}
        offerCount={0}
        rateRange={null}
        hmdaCompleted={true}
        expirationInfo={{ label: "Jul 1, 2026", daysLeft: -5, urgency: "expired" }}
        isPreApproved={true}
      />,
    );
    await user.click(screen.getByTestId("button-toggle-details"));
    expect(screen.queryByTestId("detail-expiration")).toBeNull();
  });
});

describe("CollapsibleActivity", () => {
  it("renders nothing with no activity, and expands to show the newest five", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CollapsibleActivity activities={[]} />);
    expect(screen.queryByTestId("section-activity")).toBeNull();
    const acts = Array.from({ length: 7 }, (_, i) =>
      ({ id: `act-${i}`, title: `Event ${i}`, description: null, performedBy: i % 2 ? "u-1" : null, createdAt: new Date().toISOString() }) as unknown as DealActivity);
    rerender(<CollapsibleActivity activities={acts} />);
    expect(screen.getByTestId("badge-activity-count").textContent).toBe("5");
    await user.click(screen.getByTestId("button-toggle-activity"));
    expect(screen.getByTestId("row-activity-0")).toBeTruthy();
    expect(screen.getByTestId("row-activity-4")).toBeTruthy();
    expect(screen.queryByTestId("row-activity-5")).toBeNull();
  });
});
