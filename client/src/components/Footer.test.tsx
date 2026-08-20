import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";
import { COMPANY_IDENTITY, contactPhoneTel } from "@shared/companyIdentity";

// PRELAUNCH_GATED is a build-time const (false in the test environment), so
// mock the module with a getter over a mutable flag — the component reads it
// at render time, which lets one file exercise both states of the gate.
let prelaunchGated = false;
vi.mock("@/lib/prelaunch", () => ({
  get PRELAUNCH_GATED() {
    return prelaunchGated;
  },
}));

// The footer's contact channels are legally operative surfaces — Terms cites
// the phone as the TCPA STOP fallback and Privacy cites the email for
// privacy-rights requests. They must render from COMPANY_IDENTITY (the single
// source), never hardcoded strings: the "1-800-HOMIQTY" vanity number this
// pins against was a placeholder that shipped to production as if real.
describe("Footer contact channels", () => {
  it("renders the canonical support email as both text and mailto target", () => {
    render(<Footer />);
    const email = screen.getByTestId("link-footer-email");
    expect(email.getAttribute("href")).toBe(`mailto:${COMPANY_IDENTITY.contactEmail}`);
    expect(email.textContent).toContain(COMPANY_IDENTITY.contactEmail);
  });

  it("renders the canonical phone as both text and tel target", () => {
    render(<Footer />);
    const phone = screen.getByTestId("link-footer-phone");
    expect(phone.getAttribute("href")).toBe(contactPhoneTel());
    expect(phone.textContent).toContain(COMPANY_IDENTITY.contactPhone);
  });

  it("never renders the retired vanity placeholder number", () => {
    render(<Footer />);
    expect(screen.queryByText(/1-800-HOMIQTY/i)).toBeNull();
  });
});

// The footer mounts on every public page, so while the prelaunch gate is
// armed it must not keep advertising a funnel that <Gated> bare-redirects
// away from — it was the one /apply entry point the gating pass never
// reached (Navigation hides its CTA, ConversionCTA relabels). Relabel, not
// hide, matching ConversionCTA: a product-list item silently vanishing would
// itself read as a regression.
describe("Footer 'Homiquity Lend' link respects the prelaunch gate", () => {
  it("links into the funnel while applications are open", () => {
    prelaunchGated = false;
    render(<Footer />);
    const lend = screen.getByTestId("link-footer-lend");
    expect(lend.getAttribute("href")).toBe("/apply");
    expect(lend.textContent?.trim()).toBe("Homiquity Lend");
  });

  it("relabels to the waitlist when the gate is armed", () => {
    prelaunchGated = true;
    try {
      render(<Footer />);
      const lend = screen.getByTestId("link-footer-lend");
      expect(lend.getAttribute("href")).toBe("/");
      expect(lend.textContent?.trim()).toBe("Join the Waitlist");
    } finally {
      prelaunchGated = false;
    }
  });
});
