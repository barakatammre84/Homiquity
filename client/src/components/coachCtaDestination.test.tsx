import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Every PUBLIC "talk to Homi" control must route by auth state.
 *
 * `/ai-coach` is an `<AnyAuthPage>` route, and the guard bounces a signed-out
 * visitor with a hard load to `/login` — whose heading is "Welcome back. Sign in
 * to your account to continue." A first-time visitor has no account to sign back
 * in to, so a bare `href="/ai-coach"` on a marketing surface is a dead end aimed
 * at exactly the people that surface exists to convert.
 *
 * `CoachPromptBar` already had this right (see its own test, which spells the
 * hazard out). The Footer — on every public page — and `ConversionCTA` — on six
 * public calculators — did not: both shipped the bare literal, and a browse of
 * the live site landed on the login wall from each. These assertions pin the
 * rule for the whole public chrome so the next Homi link cannot reintroduce it.
 */

let authed = false;
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: authed }),
}));

vi.mock("@/hooks/useActivityTracker", () => ({
  useTrackCta: () => vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Footer } from "./Footer";
import { ConversionCTA } from "./ConversionCTA";

/**
 * `<Button asChild>` merges its props onto the child, so `button-cta-coach`
 * lands on the anchor itself rather than a wrapper around one. Resolve either
 * shape so the assertion pins the destination, not the DOM nesting.
 */
function coachCtaHref(): string | null | undefined {
  const el = screen.getByTestId("button-cta-coach");
  const anchor = el.tagName === "A" ? el : el.querySelector("a");
  return anchor?.getAttribute("href");
}

beforeEach(() => {
  authed = false;
});

describe("public Homi CTAs route by auth state", () => {
  it("sends a signed-out visitor from the footer to signup, not the login wall", () => {
    render(<Footer />);
    expect(screen.getByTestId("link-footer-coach").getAttribute("href")).toBe("/signup");
  });

  it("sends a signed-in visitor from the footer straight to Homi", () => {
    authed = true;
    render(<Footer />);
    expect(screen.getByTestId("link-footer-coach").getAttribute("href")).toBe("/ai-coach");
  });

  it("sends a signed-out visitor from a public calculator CTA to signup", () => {
    render(<ConversionCTA context="calculator" />);
    expect(coachCtaHref()).toBe("/signup");
  });

  it("sends a signed-in visitor from a calculator CTA straight to Homi", () => {
    authed = true;
    render(<ConversionCTA context="calculator" />);
    expect(coachCtaHref()).toBe("/ai-coach");
  });

  it("calls the assistant Homi, never 'Coach' — the #595 rename reached the copy beside it but not the button", () => {
    render(<ConversionCTA context="calculator" />);
    const cta = screen.getByTestId("button-cta-coach");
    expect(cta.textContent).toContain("Talk to Homi");
    expect(cta.textContent).not.toContain("Coach");
  });
});
