import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { isAdmin } from "@shared/roles";

// ---------------------------------------------------------------------------
// Roadmap CH-4: object-level admin checks go through the ONE shared predicate.
// Fifty hand-rolled `role === "admin"` string comparisons were consolidated;
// this guard keeps new ones from accumulating — a typo'd literal in a
// hand-rolled check fails open or closed silently, while the predicate can't.
// Route-level gating stays requireRole("admin") (untouched by CH-4).
// ---------------------------------------------------------------------------

describe("isAdmin predicate", () => {
  it("matches exactly the admin role, and no user is never an admin", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
    expect(isAdmin({ role: "underwriter" })).toBe(false);
    expect(isAdmin({ role: "" })).toBe(false);
    expect(isAdmin({ role: null })).toBe(false);
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("no hand-rolled admin comparisons in server code", () => {
  it("every server .ts file uses the predicate instead of a raw string compare", () => {
    const repoRoot = resolve(__dirname, "..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === "node_modules") continue;
          walk(p);
        } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
          const content = readFileSync(p, "utf8");
          for (const [idx, line] of content.split("\n").entries()) {
            if (/\.role\s*(===|!==)\s*["'`]admin["'`]/.test(line)) {
              offenders.push(`${p}:${idx + 1}: ${line.trim()}`);
            }
          }
        }
      }
    };
    walk(resolve(repoRoot, "server"));
    expect(offenders).toEqual([]);
  });
});
