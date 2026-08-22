import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OffsetBlock } from "./OffsetBlock";

/**
 * The contract worth pinning is the COLLAPSE, not the offset. An offset that
 * fails to collapse is a cramped column on every laptop, and it is invisible
 * until someone opens one — so every case below checks that the unprefixed
 * (mobile) rendering stays centred.
 *
 * Plain DOM assertions: this lane has no setupFiles, so jest-dom matchers do
 * not exist here.
 */
describe("OffsetBlock", () => {
  const cls = (testId: string) => screen.getByTestId(testId).getAttribute("class") ?? "";

  it("is centred by default — the current behaviour, unchanged", () => {
    render(<OffsetBlock data-testid="b">x</OffsetBlock>);
    expect(cls("b")).toContain("mx-auto");
    expect(cls("b")).not.toContain("lg:ml-16");
    expect(cls("b")).not.toContain("lg:mr-16");
  });

  it("anchors left only at lg and above", () => {
    render(<OffsetBlock side="left" data-testid="b">x</OffsetBlock>);
    expect(cls("b")).toContain("lg:ml-16");
    expect(cls("b")).toContain("lg:mr-auto");
  });

  it("anchors right only at lg and above", () => {
    render(<OffsetBlock side="right" data-testid="b">x</OffsetBlock>);
    expect(cls("b")).toContain("lg:mr-16");
    expect(cls("b")).toContain("lg:ml-auto");
  });

  it.each(["left", "right", "center"] as const)(
    "collapses to centred below lg for side=%s",
    (side) => {
      render(<OffsetBlock side={side} data-testid="b">x</OffsetBlock>);
      // Every offset rule is lg:-prefixed, so nothing applies on a small screen.
      const unprefixed = cls("b")
        .split(/\s+/)
        .filter((c) => c && !c.startsWith("lg:"));
      expect(unprefixed).toContain("mx-auto");
      expect(unprefixed.some((c) => /^m[lr]-/.test(c))).toBe(false);
    },
  );

  it("does not impose a width — the caller keeps its own measure", () => {
    render(<OffsetBlock side="left" className="max-w-3xl" data-testid="b">x</OffsetBlock>);
    const c = cls("b");
    expect(c).toContain("max-w-3xl");
    expect(/max-w-(5xl|6xl)/.test(c)).toBe(false);
  });

  it("renders its children", () => {
    render(<OffsetBlock data-testid="b"><p>hello</p></OffsetBlock>);
    expect(screen.getByText("hello")).toBeTruthy();
  });
});
