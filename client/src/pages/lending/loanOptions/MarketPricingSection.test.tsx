import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { MarketPricingSection, type MarketOffersResponse } from "./MarketPricingSection";

// The offers endpoint answers with FOUR statuses, three of which mean "no live
// pricing, and here is why" (server/routes/lending/pricing.ts:482,510,529). The
// section used to `return null` on everything but PRICED, so the server's own
// borrower-facing `missingItems` copy had zero readers and the whole "Live
// Market Pricing" block vanished with no explanation.
//
// It bites the above-conforming borrower hardest: their entire market is one
// product (BRC-J30 in server/seedMarketPricing.ts) with minCreditScore 700 and
// maxLTV 89.99, so a jumbo file just outside that box prices to zero offers ->
// NO_ACTIVE_RATE_SHEETS -> a silently missing section.
// DESIGN_SYSTEM.md §13 (explanation, honesty).

const base: MarketOffersResponse = {
  status: "PRICED",
  qualifier: "PRELIMINARY",
  indicative: true,
  pricedAt: "2026-08-22T12:00:00.000Z",
  lockTermDays: 30,
  lenderCount: 0,
  assumptions: [],
  missingItems: [],
  offers: [],
};

describe("MarketPricingSection — the states that are not PRICED", () => {
  it("explains a profile no active rate sheet covers, instead of rendering nothing", () => {
    render(<MarketPricingSection market={{ ...base, status: "NO_ACTIVE_RATE_SHEETS" }} />);

    const block = screen.getByTestId("section-market-pricing-unavailable");
    expect(block).toBeTruthy();
    // Honest about what it is and what it is not: a statement about our sheets,
    // never a decision on the application.
    expect(block.textContent).toMatch(/rate sheets/i);
    expect(block.textContent).toMatch(/not a decision on your application/i);
    // And it never renders the priced header alongside the unavailable state.
    expect(screen.queryByTestId("section-market-pricing")).toBeNull();
  });

  it("surfaces the server's own reason for an unpriceable profile", () => {
    const reason = "Live pricing is not available for this loan profile yet — your loan team will quote it directly.";
    render(
      <MarketPricingSection
        market={{ ...base, status: "UNPRICEABLE_PROFILE", missingItems: [reason] }}
      />,
    );

    expect(screen.getByTestId("section-market-pricing-unavailable").textContent).toContain(reason);
  });

  it("lists every missing item when the profile is too thin to price", () => {
    render(
      <MarketPricingSection
        market={{
          ...base,
          status: "INSUFFICIENT_PROFILE",
          missingItems: ["Purchase price", "Credit score"],
        }}
      />,
    );

    const block = screen.getByTestId("section-market-pricing-unavailable");
    expect(block.textContent).toContain("Purchase price");
    expect(block.textContent).toContain("Credit score");
  });

  it("still renders priced offers, and no unavailable block, when pricing succeeded", () => {
    render(
      <MarketPricingSection
        market={{
          ...base,
          status: "PRICED",
          lenderCount: 1,
          offers: [
            {
              optionId: "A",
              optionLabel: "Option A",
              productLabel: "Jumbo 30-Year Fixed",
              productType: "JUMBO",
              loanTerm: 360,
              adjustedRate: 6.875,
              estimatedMonthlyPI: 5000,
              estimatedMonthlyMI: 0,
              estimatedMonthlyTotal: 5000,
              lockTerm: 30,
              labels: ["LOWEST_RATE"],
              pricingBreakdown: {
                baseRate: 6.875,
                llpaAdjustment: 0,
                lockTermAdjustment: 0,
                lenderAdjustments: [],
                totalAdjustments: 0,
                finalRate: 6.875,
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("section-market-pricing")).toBeTruthy();
    expect(screen.queryByTestId("section-market-pricing-unavailable")).toBeNull();
  });
});
