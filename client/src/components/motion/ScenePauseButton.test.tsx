import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The WCAG 2.2.2 control (Pause, Stop, Hide — Level A).
 *
 * A `Scene` loops, and a loop by definition runs past the five-second threshold
 * that triggers 2.2.2. `prefers-reduced-motion` does NOT discharge it: that only
 * serves people who already set an OS preference, while 2.2.2 asks for an in-page
 * mechanism for everyone else. This button is that mechanism, so its contract is
 * tested rather than assumed.
 */

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: () => false };
});

import { ScenePauseButton } from "./index";

describe("ScenePauseButton", () => {
  it("says what it will do, not what state it is in", () => {
    // "Pause animations" tells you the outcome of pressing. A control labelled
    // with its current state leaves you guessing what the press does.
    render(<ScenePauseButton paused={false} onToggle={() => {}} />);
    expect(screen.getByTestId("button-scene-pause").textContent).toBe("Pause animations");
  });

  it("offers to resume once paused", () => {
    render(<ScenePauseButton paused onToggle={() => {}} />);
    expect(screen.getByTestId("button-scene-pause").textContent).toBe("Play animations");
  });

  it("exposes its state to assistive tech via aria-pressed", () => {
    const { rerender } = render(<ScenePauseButton paused={false} onToggle={() => {}} />);
    expect(screen.getByTestId("button-scene-pause").getAttribute("aria-pressed")).toBe("false");
    rerender(<ScenePauseButton paused onToggle={() => {}} />);
    expect(screen.getByTestId("button-scene-pause").getAttribute("aria-pressed")).toBe("true");
  });

  it("is reachable and operable by keyboard", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ScenePauseButton paused={false} onToggle={onToggle} />);

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("button-scene-pause"));
    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("meets the 44px touch floor", () => {
    render(<ScenePauseButton paused={false} onToggle={() => {}} />);
    expect(screen.getByTestId("button-scene-pause").className).toMatch(/min-h-11/);
  });
});
