import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";
import { COMPANY_IDENTITY, contactPhoneTel } from "@shared/companyIdentity";

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
