import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The public home page, pinned on the two things that are easy to undo by
 * accident when someone adds "just one more section".
 *
 * 1. It stays a front door, not a sitemap. The page it replaced stacked eight
 *    sections; the coach bar is meant to be the first thing a visitor deals
 *    with, and a re-added estimator/rates/persona-grid band would bury it.
 * 2. The advertising rails hold. This is a soliciting surface, so a stray rate,
 *    payment or APR figure is a Reg Z §1026.24 trigger-term problem with no
 *    disclosure attached, and approval language is a Reg N problem. Both have
 *    been re-introduced by well-meaning copy edits before.
 */

// Keep every prop — a Link mock that drops className/data-testid silently hides
// the very elements these assertions look for.
vi.mock("wouter", () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/", vi.fn()],
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/hooks/useActivityTracker", () => ({ usePageView: () => {} }));

// Chrome the page renders but this test is not about.
vi.mock("@/components/Navigation", () => ({ Navigation: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/SEOHead", () => ({ SEOHead: () => null }));
vi.mock("@/components/SkipLink", () => ({ SkipLink: () => null }));
vi.mock("@/components/VeteranFoundedBadge", () => ({ VeteranFoundedBadge: () => null }));

import Landing from "./Landing";

describe("Landing", () => {
  it("leads with the AI Coach, above the three paths", () => {
    render(<Landing />);

    const hero = screen.getByTestId("section-hero");
    expect(hero.contains(screen.getByTestId("coach-prompt-bar"))).toBe(true);

    // Document order: the coach comes before the path cards.
    const paths = screen.getByTestId("section-paths");
    expect(hero.compareDocumentPosition(paths) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps a no-account route to buying power, pointing at the band on this page", () => {
    render(<Landing />);
    // An in-page anchor, not /afford: the no-signup answer lives here now, and a
    // hero link that leaves the page to find it is a step for nothing.
    expect(screen.getByTestId("link-hero-afford").getAttribute("href")).toBe("#buying-power");
    expect(screen.getByTestId("section-estimator").id).toBe("buying-power");
  });

  it("gives the estimator its own band — the only surface here that answers without an account", () => {
    render(<Landing />);
    const estimator = screen.getByTestId("section-estimator");
    expect(estimator.contains(screen.getByTestId("card-buying-power-estimator"))).toBe(true);
  });

  it("stays short — three path cards, one trust row, and no re-added sections", () => {
    render(<Landing />);

    expect(screen.getAllByTestId(/^card-path-/)).toHaveLength(3);
    expect(screen.getByTestId("section-trust")).toBeTruthy();
    // The bands that made the old page a sitemap. If one comes back, it belongs
    // on its own route, not here. (The estimator is deliberately NOT in this
    // list — it is a working tool, not another block of marketing copy.)
    expect(screen.queryByTestId("section-rates-teaser")).toBeNull();
    expect(screen.queryByTestId("section-audience-paths")).toBeNull();
  });

  it("carries no Reg Z trigger term in the page's own marketing copy", () => {
    render(<Landing />);

    // Scoped to what the PAGE asserts, not to the estimator, which is an
    // interactive tool rendering figures the visitor chose. §1026.24(d) trigger
    // terms are a down-payment amount/percentage, a number of payments, a
    // repayment period, a payment amount, or a finance-charge amount — a
    // purchase-price range the visitor generated is none of those, and the tool
    // carries its own non-offer line (asserted below).
    const marketing = [
      screen.getByTestId("section-hero"),
      screen.getByTestId("section-paths"),
      screen.getByTestId("section-trust"),
    ]
      .map((el) => el.textContent ?? "")
      .join(" ");

    expect(marketing).not.toMatch(/\d+(\.\d+)?\s*%/); // a rate or APR
    expect(marketing).not.toMatch(/\$\s?[\d,]+/); // a payment or dollar amount
    expect(marketing).not.toMatch(/\b(30|20|15|10)[-\s]year\b/i); // a repayment term
    expect(marketing).not.toMatch(/as low as/i);
  });

  it("opens the estimator with no figure on screen and no ask for contact details", () => {
    render(<Landing />);
    const band = screen.getByTestId("section-estimator").textContent ?? "";

    // At rest the band states its terms and shows nothing numeric. The figure
    // and the qualifier that must accompany it are pinned together in
    // BuyingPowerEstimator.test.tsx, where the flow can be driven to step 3.
    expect(screen.queryByTestId("text-estimator-result")).toBeNull();
    expect(band).toMatch(/no credit check/i);
    expect(band).toMatch(/no sign-up/i);
  });

  it("never presents anything on the page as an approval or a commitment", () => {
    const { container } = render(<Landing />);
    const copy = container.textContent ?? "";

    // "Start your pre-approval" is an action the visitor takes, not a promise
    // the page makes — that phrasing is allowed and is what the nav uses. What
    // must never appear is the page asserting an outcome.
    expect(copy).not.toMatch(/you(?:'re| are) (?:pre-?)?approved/i);
    expect(copy).not.toMatch(/guaranteed (?:approval|rate)/i);
    expect(screen.getByTestId("text-coach-disclaimer").textContent).toMatch(
      /not a loan approval, offer, or commitment/i,
    );
  });
});
