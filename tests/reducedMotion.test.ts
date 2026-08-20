import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The reduced-motion floor exists.
 *
 * 🚨 This is a PRESENCE ratchet, not proof of behaviour. It cannot tell you the
 * rule wins the cascade or that motion actually stops — only a browser with
 * `prefers-reduced-motion: reduce` can, and that check belongs in the design
 * routine's per-run verification. What it does catch is the realistic failure:
 * someone deleting or weakening the block during a refactor of index.css, which
 * would silently re-break accessibility for the people who asked for less motion.
 *
 * Stated plainly because a guard that overstates itself is worse than none —
 * this repo has shipped several of those.
 */

const css = readFileSync("client/src/index.css", "utf8");

describe("reduced-motion floor", () => {
  it("declares a global prefers-reduced-motion block", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("uses 0.01ms rather than 0, so completion events still fire", () => {
    // A zero-length animation may never dispatch animationend/transitionend, and
    // Radix unmounts plus framer-motion's AnimatePresence both complete on those.
    // `0s`/`none` here would stop motion by hanging state machines instead.
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(block).not.toMatch(/animation:\s*none/);
  });

  it("applies globally, not per-component", () => {
    // An opt-in rule is one every future author must remember — the same failure
    // as the icon registry (38 concepts, 323 files bypassing it).
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
  });
});
