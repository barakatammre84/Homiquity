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

  it("keeps a no-account route to buying power for visitors who won't sign up yet", () => {
    render(<Landing />);
    expect(screen.getByTestId("link-hero-afford").getAttribute("href")).toBe("/afford");
  });

  it("stays short — three path cards, one trust row, and no re-added sections", () => {
    render(<Landing />);

    expect(screen.getAllByTestId(/^card-path-/)).toHaveLength(3);
    expect(screen.getByTestId("section-trust")).toBeTruthy();
    // The bands that made the old page a sitemap. If one comes back, it belongs
    // on its own route, not here.
    expect(screen.queryByTestId("section-estimator")).toBeNull();
    expect(screen.queryByTestId("section-rates-teaser")).toBeNull();
    expect(screen.queryByTestId("section-audience-paths")).toBeNull();
  });

  it("carries no Reg Z trigger term — no rate, APR, payment or term figure", () => {
    const { container } = render(<Landing />);
    const copy = container.textContent ?? "";

    expect(copy).not.toMatch(/\d+(\.\d+)?\s*%/); // a rate or APR
    expect(copy).not.toMatch(/\$\s?[\d,]+/); // a payment or dollar amount
    expect(copy).not.toMatch(/\b(30|20|15|10)[-\s]year\b/i); // a repayment term
    expect(copy).not.toMatch(/as low as/i);
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
