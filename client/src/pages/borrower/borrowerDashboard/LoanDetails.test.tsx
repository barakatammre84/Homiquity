import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { LoanDetails } from "./LoanDetails";
import type { LoanApplication } from "@shared/schema";

// ux-30. The Loan Estimate is the borrower's TRID disclosure, and retrieving it
// behind e_disclosure consent is the ONLY act that stamps `leIssuedDate`
// (server/routes/underwriting/delivery.ts:95 — borrower-only by design; staff
// previews deliberately don't count). The page shipped behind a staff route
// gate and was linked from nowhere, so that writer had never fired from a UI
// click and a TRID-triggered file went permanently unadvanceable on day 4.
//
// These pin the link's two preconditions, because linking unconditionally is
// worse than not linking: `generateLoanEstimate` fails closed without a
// §1026.36(d)(2) compensation election (services/loanEstimate.ts:511-514), so
// an unelected file would show the borrower an error instead of a disclosure.

const app = (over: Partial<LoanApplication> = {}) =>
  ({
    id: "app-1",
    purchasePrice: "400000",
    downPayment: "40000",
    preApprovalAmount: "360000",
    preferredLoanType: "Conventional",
    tridTriggeredAt: new Date("2026-08-10T14:00:00Z"),
    loCompensationModel: "lender_paid",
    leIssuedDate: null,
    ...over,
  }) as unknown as LoanApplication;

// The card is collapsed by default, so EVERY test must expand it first —
// otherwise the negative cases below pass vacuously (nothing is in the DOM
// either way) and would stay green if the link were wired unconditionally.
async function expand() {
  await userEvent.setup().click(screen.getByTestId("button-toggle-details"));
}

function renderDetails(over: Partial<LoanApplication> = {}) {
  const { hook } = memoryLocation({ path: "/dashboard" });
  return render(
    <Router hook={hook}>
      <LoanDetails
        application={app(over)}
        hasOffers={false}
        offerCount={0}
        rateRange={null}
        hmdaCompleted
        expirationInfo={null}
        isPreApproved
      />
    </Router>,
  );
}

describe("LoanDetails — the borrower's route to their Loan Estimate (ux-30)", async () => {
  it("links the borrower to their LE once TRID has triggered and compensation is elected", async () => {
    renderDetails();
    await expand();
    const link = screen.getByTestId("link-detail-loan-estimate") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/loan-estimate/app-1");
    expect(screen.getByTestId("detail-loan-estimate").textContent).toContain("Loan Estimate");
  });

  it("does NOT link before the six-piece TRID trigger — there is no disclosure to make yet", async () => {
    renderDetails({ tridTriggeredAt: null });
    await expand();
    expect(screen.queryByTestId("detail-loan-estimate")).toBeNull();
  });

  it("does NOT link without a compensation election — the generator fails closed, so the link would be an error page", async () => {
    renderDetails({ loCompensationModel: null });
    await expand();
    expect(screen.queryByTestId("detail-loan-estimate")).toBeNull();
  });

  it("reports the delivery date once the LE has been issued, rather than re-prompting", async () => {
    renderDetails({ leIssuedDate: "2026-08-12" });
    await expand();
    expect(screen.getByTestId("detail-loan-estimate").textContent).toContain("2026-08-12");
  });
});
