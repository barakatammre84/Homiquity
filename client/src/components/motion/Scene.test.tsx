import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Scene's two guarantees, both of which fail silently if they regress.
 *
 * 1. The poster is the BASE layer, not a fallback. If the video ever became the
 *    only thing rendered, a blocked autoplay, a codec miss or a slow connection
 *    would leave a hole in the page — and nothing would error.
 * 2. Reduced motion omits the video ELEMENT. Merely pausing it would still
 *    download the file and still paint a first frame that differs from the
 *    poster, so "paused" is not the same promise as "no motion".
 */

let reduced = false;
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: () => reduced };
});

// happy-dom has no IntersectionObserver.
class IO {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IO);

import { Scene } from "./Scene";

beforeEach(() => { reduced = false; });

describe("Scene", () => {
  it("always renders the poster, even with a video present", () => {
    render(<Scene poster="/p.avif" video="/v.webm" alt="A house" />);
    const img = screen.getByAltText("A house") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/p.avif");
  });

  it("omits the video element entirely under reduced motion", () => {
    reduced = true;
    const { container } = render(<Scene poster="/p.avif" video="/v.webm" alt="A house" />);
    expect(container.querySelector("video")).toBeNull();
    // and the picture is still there — no motion must never mean no content
    expect(screen.getByAltText("A house")).toBeTruthy();
  });

  it("mounts the video muted, looping and inline so it can autoplay at all", () => {
    const { container } = render(<Scene poster="/p.avif" video="/v.webm" alt="A house" />);
    const v = container.querySelector("video") as HTMLVideoElement;
    // Browsers refuse to autoplay anything with sound; without muted+playsInline
    // this silently never starts on mobile.
    expect(v.muted).toBe(true);
    expect(v.hasAttribute("loop")).toBe(true);
    expect(v.hasAttribute("playsinline")).toBe(true);
    expect(v.getAttribute("preload")).toBe("none");
  });

  it("hides the decorative video from assistive tech", () => {
    const { container } = render(<Scene poster="/p.avif" video="/v.webm" alt="A house" />);
    const v = container.querySelector("video") as HTMLVideoElement;
    expect(v.getAttribute("aria-hidden")).toBe("true");
    expect(v.getAttribute("tabindex")).toBe("-1");
  });

  it("is just a picture when no video is supplied", () => {
    const { container } = render(<Scene poster="/p.avif" alt="A house" />);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByAltText("A house")).toBeTruthy();
  });

  it("loads eagerly only when marked priority", () => {
    const { rerender } = render(<Scene poster="/p.avif" alt="hero" priority />);
    expect((screen.getByAltText("hero") as HTMLImageElement).getAttribute("loading")).toBe("eager");
    rerender(<Scene poster="/p.avif" alt="hero" />);
    expect((screen.getByAltText("hero") as HTMLImageElement).getAttribute("loading")).toBe("lazy");
  });
});
