import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * The radius scale is a PRESENCE RATCHET, like tests/reducedMotion.test.ts.
 *
 * `borderRadius` sits under `theme.extend`, so any rung NOT declared there
 * silently falls through to Tailwind's own default. That is not hypothetical:
 * `xl` was undeclared for the life of the project, Tailwind's default `xl` is
 * `0.75rem`, `--radius` is also .75rem, and so `rounded-xl` and `rounded-lg`
 * rendered at an identical 12px. Forty files asked for a softer container and
 * got nothing. It never went red because a silent no-op is not an error.
 *
 * So this asserts the two things the config cannot assert about itself: that
 * every rung is DECLARED, and that the resulting values are DISTINCT.
 */

const CONFIG = readFileSync(resolve(__dirname, "../tailwind.config.ts"), "utf8");

/** `--radius` in px, read from index.css so the two files cannot drift apart. */
function baseRadiusPx(): number {
  const css = readFileSync(resolve(__dirname, "../client/src/index.css"), "utf8");
  const m = css.match(/--radius:\s*([\d.]+)rem/);
  if (!m) throw new Error("--radius not found in index.css");
  return parseFloat(m[1]) * 16;
}

/** Resolve `var(--radius)` / `calc(var(--radius) +|- Npx)` to a number. */
function resolveRung(expr: string, base: number): number {
  if (/^var\(--radius\)$/.test(expr)) return base;
  const m = expr.match(/^calc\(var\(--radius\)\s*([+-])\s*(\d+)px\)$/);
  if (!m) throw new Error(`rung is not derived from --radius: ${expr}`);
  return m[1] === "+" ? base + Number(m[2]) : base - Number(m[2]);
}

function declaredRungs(): Record<string, string> {
  const block = CONFIG.match(/borderRadius:\s*\{([\s\S]*?)\n\s{6}\}/);
  if (!block) throw new Error("borderRadius block not found in tailwind.config.ts");
  const out: Record<string, string> = {};
  for (const line of block[1].split("\n")) {
    const m = line.match(/^\s*"?([a-z0-9]+)"?:\s*"([^"]+)"/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const RUNGS = ["sm", "md", "lg", "xl", "2xl", "3xl"] as const;

describe("radius scale", () => {
  const declared = declaredRungs();
  const base = baseRadiusPx();

  it.each(RUNGS)("declares %s rather than inheriting Tailwind's default", (rung) => {
    expect(Object.keys(declared)).toContain(rung);
  });

  it("derives every rung from --radius so they move together", () => {
    for (const rung of RUNGS) expect(() => resolveRung(declared[rung], base)).not.toThrow();
  });

  it("gives every rung a DISTINCT value — the xl/lg collision must not return", () => {
    const values = RUNGS.map((r) => resolveRung(declared[r], base));
    expect(new Set(values).size).toBe(RUNGS.length);
  });

  it("increases monotonically, so radius encodes container size", () => {
    const values = RUNGS.map((r) => resolveRung(declared[r], base));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });

  it("still resolves to the documented 4/8/12/16/24/32 scale", () => {
    expect(RUNGS.map((r) => resolveRung(declared[r], base))).toEqual([4, 8, 12, 16, 24, 32]);
  });
});
