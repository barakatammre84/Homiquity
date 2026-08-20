import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The buying-power estimator, and the one rule that binds it: it may never put a
 * dollar figure on screen without the line saying what that figure is not.
 *
 * The estimator sits on the public home page, which is a soliciting surface. The
 * figure it produces is a purchase-price range the visitor's own inputs generated
 * — not a Reg Z §1026.24(d) trigger term (those are a down-payment amount or
 * percentage, a number of payments, a repayment period, a payment amount, or a
 * finance-charge amount). What it must never do is read as an offer or an
 * approval (Reg N), and the qualifier is the only thing standing between a large
 * bold dollar range and exactly that reading. It had no test at all.
 */

vi.mock("wouter", () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/", vi.fn()],
}));

import { BuyingPowerEstimator } from "./BuyingPowerEstimator";

/**
 * Walk goal -> numbers -> estimate with inputs that clear the affordability floor
 * (default income $100k, no debts, $100k down). Both step transitions run behind
 * a setTimeout, so each one is awaited by finding the next step's control rather
 * than assumed.
 */
async function runToEstimate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("chip-goal-first"));
  await user.click(await screen.findByTestId("chip-debts-0"));
  await user.click(screen.getByTestId("chip-down-100000"));
  await user.click(screen.getByTestId("button-estimator-continue"));
  return screen.findByTestId("text-estimator-result");
}

describe("BuyingPowerEstimator", () => {
  it("shows no figure until the visitor has actually answered", () => {
    render(<BuyingPowerEstimator />);
    expect(screen.queryByTestId("text-estimator-result")).toBeNull();
  });

  it("never renders the figure without the line saying it is not an offer", async () => {
    const user = userEvent.setup();
    render(<BuyingPowerEstimator />);

    const result = await runToEstimate(user);
    expect(result.textContent).toMatch(/\$[\d,]+/);

    // The qualifier travels with the figure — same card, same step.
    expect(screen.getByTestId("card-buying-power-estimator").textContent).toMatch(
      /not an offer, rate quote, or approval/i,
    );
  });

  it("quotes no rate, APR, monthly payment or loan term alongside the range", async () => {
    const user = userEvent.setup();
    render(<BuyingPowerEstimator />);

    await runToEstimate(user);

    const copy = screen.getByTestId("card-buying-power-estimator").textContent ?? "";
    expect(copy).not.toMatch(/\d+(\.\d+)?\s*%/); // a rate or APR
    expect(copy).not.toMatch(/\bper month\b|\/mo\b|monthly payment of/i);
    expect(copy).not.toMatch(/\b(30|20|15|10)[-\s]year\b/i);
  });

  it("asks for no contact details — the whole point of the no-signup path", () => {
    const { container } = render(<BuyingPowerEstimator />);

    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(container.querySelector('input[type="tel"]')).toBeNull();
    expect(screen.getByTestId("card-buying-power-estimator").textContent).toMatch(
      /no contact info/i,
    );
  });
});
