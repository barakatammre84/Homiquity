import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The reduced-motion guarantee, which is the whole reason this module is allowed
 * to exist.
 *
 * `index.css` zeroes CSS animation under `prefers-reduced-motion`, but CSS cannot
 * reach JS-driven animation — framer-motion writes inline transforms and opacity,
 * so the CSS floor does nothing here. `useReducedMotion()` is the only thing
 * between these primitives and a visitor who asked for less motion getting it
 * anyway. If that branch regresses, the CSS floor will NOT catch it, and nothing
 * else in the suite would notice.
 */

let reduced = false;
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: () => reduced };
});

import { Reveal, Stagger, StaggerItem } from "./index";

beforeEach(() => { reduced = false; });

/** framer-motion animates via inline style; a static render has none of it. */
function inlineMotion(el: HTMLElement | null): string {
  return el?.getAttribute("style") ?? "";
}

describe("motion primitives — reduced motion", () => {
  it("renders Reveal with no inline transform or opacity when motion is reduced", () => {
    reduced = true;
    render(<Reveal className="probe">visible content</Reveal>);
    const el = document.querySelector(".probe") as HTMLElement | null;

    expect(screen.getByText("visible content")).toBeTruthy();
    expect(inlineMotion(el)).not.toMatch(/transform|opacity/);
  });

  it("renders Stagger and StaggerItem static when motion is reduced", () => {
    reduced = true;
    render(
      <Stagger className="parent">
        <StaggerItem className="child">one</StaggerItem>
        <StaggerItem className="child">two</StaggerItem>
      </Stagger>,
    );
    expect(inlineMotion(document.querySelector(".parent") as HTMLElement)).not.toMatch(/transform|opacity/);
    document.querySelectorAll<HTMLElement>(".child").forEach((c) => {
      expect(inlineMotion(c)).not.toMatch(/transform|opacity/);
    });
  });

  it("never hides content behind the reduced branch", () => {
    // The failure that would matter most: a visitor who asked for less motion
    // getting a blank page because the "hidden" variant leaked into the static
    // render. Content must be present and unstyled, not merely un-animated.
    reduced = true;
    render(
      <Stagger>
        <StaggerItem>door one</StaggerItem>
        <StaggerItem>door two</StaggerItem>
      </Stagger>,
    );
    expect(screen.getByText("door one")).toBeTruthy();
    expect(screen.getByText("door two")).toBeTruthy();
  });

  it("still renders its children when motion is allowed", () => {
    reduced = false;
    render(<Reveal>animated content</Reveal>);
    expect(screen.getByText("animated content")).toBeTruthy();
  });
});
