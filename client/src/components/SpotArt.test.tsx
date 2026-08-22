import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpotArt } from "./SpotArt";
import { Icons } from "@/lib/icons";
import { spotArtAssets } from "@/lib/spotArt";

/**
 * These pin the FALLBACK, which is the whole reason the tier ships before the
 * artwork does. No spot art is committed yet, so every case below currently
 * exercises the glyph path — and that is the state the site is actually in.
 *
 * Assertions are plain DOM on purpose: this lane has no setupFiles, so jest-dom
 * matchers do not exist here (`toBeInTheDocument` silently is not a function).
 */
describe("SpotArt", () => {
  it("renders the registry glyph when no bespoke drawing exists", () => {
    render(<SpotArt name="home" />);
    expect(screen.getByTestId("spot-glyph-home")).toBeTruthy();
    expect(screen.queryByTestId("spot-art-home")).toBe(null);
  });

  it("hides a decorative glyph from screen readers", () => {
    render(<SpotArt name="home" />);
    expect(screen.getByTestId("spot-glyph-home").getAttribute("aria-hidden")).toBe("true");
  });

  it("exposes the glyph as an image when given alt text", () => {
    render(<SpotArt name="home" alt="A house with keys" />);
    const el = screen.getByTestId("spot-glyph-home");
    expect(el.getAttribute("role")).toBe("img");
    expect(el.getAttribute("aria-label")).toBe("A house with keys");
    expect(el.getAttribute("aria-hidden")).toBe(null);
  });

  it("applies the requested size rung", () => {
    render(<SpotArt name="home" size="feature" />);
    expect(screen.getByTestId("spot-glyph-home").getAttribute("class")).toContain("h-6");
  });

  it("only ever keys spot art by a real registry concept", () => {
    // Guards the ignore-unknown-filename branch: an illustrator naming a file
    // `piggy-bank.svg` must not create a key that no glyph can fall back to.
    for (const key of Object.keys(spotArtAssets)) {
      expect(Object.prototype.hasOwnProperty.call(Icons, key)).toBe(true);
    }
  });
});
