import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// -----------------------------------------------------------------------------
// Pins the Dependabot grouping that #301 cost us.
//
// Dependabot opened "bump react, react-dom and @types/react" for the 18 -> 19
// major and left @types/react-dom at ^18.3.7. @types/react-dom@18 peers on
// @types/react@^18, so the tree was internally inconsistent the moment it landed —
// and nothing caught it: pnpm resolved it and `tsc` passed, because skipLibCheck
// hides exactly this mismatch. It took a hand-authored bump to repair.
//
// The config that prevents a repeat has a subtle ordering dependency, so it is
// worth pinning rather than trusting a reviewer to notice a reorder.
// -----------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const CONFIG = readFileSync(path.join(ROOT, ".github/dependabot.yml"), "utf8");
const PKG = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

/** The patterns listed under a named group, without needing a YAML parser. */
function groupPatterns(name: string): string[] {
  const lines = CONFIG.split("\n");
  const start = lines.findIndex((l) => l.trim() === `${name}:`);
  if (start === -1) return [];
  const indent = lines[start].search(/\S/);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === "") continue;
    if (l.search(/\S/) <= indent) break; // dedent ends the group
    const m = /^\s*-\s*"(.+)"\s*$/.exec(l);
    if (m) out.push(m[1]);
  }
  return out;
}

/** react, react-dom, @types/react, @types/react-dom — whichever are installed. */
function reactFamilyInPackageJson(): string[] {
  const all = [...Object.keys(PKG.dependencies ?? {}), ...Object.keys(PKG.devDependencies ?? {})];
  return all.filter((n) => /^(@types\/)?react(-dom)?$/.test(n)).sort();
}

describe("dependabot React grouping", () => {
  it("groups every installed React-family package together", () => {
    const patterns = groupPatterns("react");
    const family = reactFamilyInPackageJson();
    expect(family.length).toBeGreaterThan(0);
    for (const dep of family) {
      expect(patterns).toContain(dep);
    }
  });

  it("keeps @types/react and @types/react-dom in the SAME group — the #301 split", () => {
    const patterns = groupPatterns("react");
    expect(patterns).toContain("@types/react");
    expect(patterns).toContain("@types/react-dom");
  });

  it("does not filter the react group by update-type, so it catches majors", () => {
    // A major is the case that broke: minor/patch already rode together in the
    // combined PR. Narrowing this group to minor/patch would silently re-open #301.
    const lines = CONFIG.split("\n");
    const start = lines.findIndex((l) => l.trim() === "react:");
    const indent = lines[start].search(/\S/);
    const body: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      if (lines[i].search(/\S/) <= indent) break;
      body.push(lines[i]);
    }
    expect(body.join("\n")).not.toMatch(/update-types/);
  });

  it("orders minor-and-patch BEFORE react — the ordering is load-bearing", () => {
    // Dependabot assigns a dependency to the first group whose patterns AND
    // update-types match. minor-and-patch is pattern-less, so putting react first
    // would capture React minor/patch updates out of the combined PR.
    const idxCombined = CONFIG.indexOf("minor-and-patch:");
    const idxReact = CONFIG.indexOf("\n      react:");
    expect(idxCombined).toBeGreaterThan(-1);
    expect(idxReact).toBeGreaterThan(-1);
    expect(idxCombined).toBeLessThan(idxReact);
  });
});
