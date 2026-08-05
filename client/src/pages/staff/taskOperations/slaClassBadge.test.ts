import { describe, it, expect } from "vitest";
import { SLA_BADGE_CLASSES, slaBadgeClass } from "./slaClassBadge";

// The bug this replaces was invisible: interpolated Tailwind class names are
// never generated, so the badges rendered unstyled and nothing failed. These
// cases make the two ways it can regress loud instead.

// colorCode values seeded in server/seedData/taskEngineSla.ts (S0-S5).
const SEEDED_COLOR_CODES = ["red", "orange", "amber", "blue", "gray", "slate"];

// The design system's semantic families. Asserting the allow-list (rather than
// enumerating banned palette names) keeps this test from drifting out of sync
// with scripts/design-token-guard.cjs — and keeps palette literals, which that
// guard scans for, out of this file.
const SEMANTIC_FAMILIES = [
  "destructive",
  "warning",
  "info",
  "success",
  "muted",
  "primary",
  "secondary",
  "accent",
  "transparent",
];

function isSemantic(className: string): boolean {
  // e.g. "bg-destructive-subtle" -> family "destructive"
  const value = className.replace(
    /^(bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-/,
    "",
  );
  return SEMANTIC_FAMILIES.some((f) => value === f || value.startsWith(`${f}-`));
}

describe("slaBadgeClass", () => {
  it("covers every seeded SLA colorCode", () => {
    for (const code of SEEDED_COLOR_CODES) {
      expect(SLA_BADGE_CLASSES[code], `no badge class for colorCode "${code}"`).toBeTruthy();
    }
  });

  it("emits only design-system tokens, never raw palette classes", () => {
    for (const [code, cls] of Object.entries(SLA_BADGE_CLASSES)) {
      for (const token of cls.split(/\s+/)) {
        expect(isSemantic(token), `${code} uses non-semantic class "${token}"`).toBe(true);
      }
    }
  });

  it("falls back to the muted tier for an unknown or missing colorCode", () => {
    // colorCode is nullable in the schema and defaults to "gray".
    expect(slaBadgeClass(undefined)).toBe(SLA_BADGE_CLASSES.gray);
    expect(slaBadgeClass("chartreuse")).toBe(SLA_BADGE_CLASSES.gray);
  });

  it("keeps the file-blocking tiers visually distinct from the rest", () => {
    // S0/S1 block loan progress; S4/S5 do not. They must not collapse together.
    expect(slaBadgeClass("red")).not.toBe(slaBadgeClass("gray"));
    expect(slaBadgeClass("amber")).not.toBe(slaBadgeClass("blue"));
  });
});
