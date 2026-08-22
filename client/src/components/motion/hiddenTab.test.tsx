import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal, Stagger, StaggerItem } from "./index";

/**
 * These primitives set `opacity: 0` and rely on JS to bring the content back.
 * That is safe only while the animation is guaranteed to finish — and in a
 * BACKGROUND TAB it is not: browsers throttle requestAnimationFrame, which is
 * what framer-motion drives on.
 *
 * Caught on the live home page: two journey cards at opacity 0 and two at 0.27
 * and 0.78, IDENTICAL readings at 6s and 10s. Stalled, not slow. Content that
 * hides itself and never comes back is the worst failure this module can have,
 * so a hidden document renders plainly — no observer, no ramp, no inline
 * opacity to get stuck at.
 */
function setHidden(value: boolean) {
  Object.defineProperty(document, "hidden", { value, configurable: true });
}

afterEach(() => {
  setHidden(false);
  vi.restoreAllMocks();
});

describe("motion primitives in a hidden tab", () => {
  it("Stagger renders its children with no inline opacity when the tab is hidden", () => {
    setHidden(true);
    render(
      <Stagger>
        <StaggerItem>
          <p data-testid="child">visible</p>
        </StaggerItem>
      </Stagger>,
    );
    const child = screen.getByTestId("child");
    expect(child).toBeTruthy();
    // Walk up: nothing between the child and the root may carry opacity:0.
    let el: HTMLElement | null = child;
    while (el) {
      expect(el.style.opacity === "0").toBe(false);
      el = el.parentElement;
    }
  });

  it("Reveal renders its children with no inline opacity when the tab is hidden", () => {
    setHidden(true);
    render(
      <Reveal>
        <p data-testid="child">visible</p>
      </Reveal>,
    );
    let el: HTMLElement | null = screen.getByTestId("child");
    while (el) {
      expect(el.style.opacity === "0").toBe(false);
      el = el.parentElement;
    }
  });

  it("still renders content when the tab is visible", () => {
    setHidden(false);
    render(
      <Stagger>
        <StaggerItem>
          <p data-testid="child">visible</p>
        </StaggerItem>
      </Stagger>,
    );
    expect(screen.getByTestId("child").textContent).toBe("visible");
  });
});
