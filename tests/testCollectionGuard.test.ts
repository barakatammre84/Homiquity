import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  globToRegExp,
  staticPrefix,
  walkLoud,
  expectedFor,
  compareCollection,
  loadInclude,
  LANES,
  COVERAGE_ONLY,
} = require("../scripts/test-collection-guard.cjs");

// -----------------------------------------------------------------------------
// The collected-count floor on `pnpm test`.
//
// The headline fixture is the real 2026-08-20/21 incident: `pnpm test` collected
// 111 of 118 client test files, passed them all, and exited 0 three times under
// load. Vitest discovers files through tinyglobby -> fdir, which defaults to
// suppressErrors and hands the caller `entries = []` for a directory whose
// readdir FAILED — so a directory that could not be read is indistinguishable
// from an empty one. The gate reported success on a run that proved nothing.
//
// These tests reintroduce that shortfall as data and assert the guard catches
// it, and they pin the one property that makes the guard trustworthy at all:
// its OWN enumeration of the disk must throw on a readdir error rather than
// quietly return fewer files. A guard that shrinks alongside the bug it watches
// for is not a guard.
// -----------------------------------------------------------------------------

describe("globToRegExp", () => {
  const re = () => globToRegExp("client/src/**/*.test.{ts,tsx}");

  it("matches the client lane's real files at every depth", () => {
    expect(re().test("client/src/App.test.tsx")).toBe(true);
    expect(re().test("client/src/components/AddressInput.test.tsx")).toBe(true);
    expect(re().test("client/src/pages/borrower/deep/Nested.test.ts")).toBe(true);
  });

  it("does not match non-tests, other trees, or the wrong extension", () => {
    expect(re().test("client/src/components/AddressInput.tsx")).toBe(false);
    expect(re().test("tests/apr.test.ts")).toBe(false);
    expect(re().test("client/src/thing.test.js")).toBe(false);
    // `*` must not cross a path separator.
    expect(globToRegExp("client/src/*.test.ts").test("client/src/a/b.test.ts")).toBe(false);
  });

  it("throws on a construct it does not understand, rather than guessing", () => {
    // A mini-glob that silently mis-expands an unfamiliar pattern produces a
    // wrong expected count — and a wrong count is worse than no count, because
    // it is wrong in whichever direction happens to be quiet.
    for (const bad of ["src/?.test.ts", "src/[a-z].test.ts", "!src/x.test.ts", "src/+(a|b).test.ts"]) {
      expect(() => globToRegExp(bad)).toThrow(/unsupported glob construct/);
    }
  });
});

describe("staticPrefix", () => {
  it("finds the directory a glob is rooted at", () => {
    expect(staticPrefix("client/src/**/*.test.{ts,tsx}")).toBe("client/src");
    expect(staticPrefix("tests/apr.test.ts")).toBe("tests");
    expect(staticPrefix("**/*.test.ts")).toBe("");
  });
});

describe("walkLoud — the guard's own enumeration", () => {
  it("enumerates a tree, skipping node_modules, dist and .claude/worktrees", () => {
    const root = mkdtempSync(join(tmpdir(), "hq-walk-"));
    mkdirSync(join(root, "src", "deep"), { recursive: true });
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(root, "dist"), { recursive: true });
    // One full checkout per session lives here. Walking into it from the primary
    // checkout would report every sibling branch's tests as orphans of this one.
    mkdirSync(join(root, ".claude", "worktrees", "other", "tests"), { recursive: true });
    writeFileSync(join(root, "src", "a.test.ts"), "");
    writeFileSync(join(root, "src", "deep", "b.test.ts"), "");
    writeFileSync(join(root, "node_modules", "pkg", "c.test.ts"), "");
    writeFileSync(join(root, "dist", "d.test.ts"), "");
    writeFileSync(join(root, ".claude", "worktrees", "other", "tests", "e.test.ts"), "");

    const found = walkLoud(root, []).map((p: string) => p.slice(root.length + 1));
    expect(found.sort()).toEqual(["src/a.test.ts", "src/deep/b.test.ts"].map((p) => p.replace(/\//g, require("path").sep)));
  });

  it("THROWS when a readdir fails — it must never silently return fewer files", () => {
    // This is the exact failure that produced the incident, injected into the
    // guard instead of into vitest. fdir swallows it and reports an empty
    // directory; the guard must do the opposite, because both sides of the
    // comparison shrinking together is how a floor silently passes.
    const realFs = require("fs");
    const root = mkdtempSync(join(tmpdir(), "hq-walk-loud-"));
    mkdirSync(join(root, "components"), { recursive: true });
    writeFileSync(join(root, "components", "a.test.ts"), "");

    const failingFs = {
      readdirSync(p: string, opts: unknown) {
        if (String(p).includes("components")) {
          const e: NodeJS.ErrnoException = new Error("EMFILE: too many open files, scandir");
          e.code = "EMFILE";
          throw e;
        }
        return realFs.readdirSync(p, opts);
      },
    };

    expect(() => walkLoud(root, [], failingFs)).toThrow(/EMFILE/);
  });
});

describe("compareCollection", () => {
  const files = (n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => `client/src/c${i + from}.test.tsx`);

  it("passes when vitest ran every file on disk", () => {
    expect(compareCollection(files(118), files(118))).toEqual({ missing: [], surplus: [] });
  });

  it("catches the 2026-08-20 shortfall — 111 collected of 118 — and names the gap", () => {
    const expected = files(118);
    const collected = expected.slice(0, 111); // what the runner actually ran, exit 0
    const { missing, surplus } = compareCollection(expected, collected);

    expect(missing).toHaveLength(7);
    expect(missing).toContain("client/src/c111.test.tsx");
    expect(surplus).toEqual([]);
  });

  it("catches the whole-directory drop, which is the real shape of the bug", () => {
    // fdir reports a failed directory as an EMPTY one, so files vanish in
    // contiguous subtrees, not one at a time.
    const expected = [
      "client/src/App.test.tsx",
      "client/src/components/A.test.tsx",
      "client/src/components/B.test.tsx",
      "client/src/pages/P.test.tsx",
    ];
    const collected = expected.filter((f) => !f.includes("/components/"));
    expect(compareCollection(expected, collected).missing).toEqual([
      "client/src/components/A.test.tsx",
      "client/src/components/B.test.tsx",
    ]);
  });

  it("reports a surplus — the guard doubting its own derivation", () => {
    const { missing, surplus } = compareCollection(files(3), files(4));
    expect(missing).toEqual([]);
    expect(surplus).toEqual(["client/src/c3.test.tsx"]);
  });
});

describe("expectedFor", () => {
  it("expands globs and literals against a real tree", () => {
    const root = mkdtempSync(join(tmpdir(), "hq-expected-"));
    mkdirSync(join(root, "client", "src", "components"), { recursive: true });
    mkdirSync(join(root, "tests"), { recursive: true });
    writeFileSync(join(root, "client", "src", "components", "A.test.tsx"), "");
    writeFileSync(join(root, "client", "src", "components", "A.tsx"), "");
    writeFileSync(join(root, "tests", "real.test.ts"), "");

    const { files, missingLiterals } = expectedFor(
      ["client/src/**/*.test.{ts,tsx}", "tests/real.test.ts", "tests/deleted.test.ts"],
      root,
    );
    expect(files).toEqual(["client/src/components/A.test.tsx", "tests/real.test.ts"]);
    // A listed file that is not on disk is coverage the config CLAIMS but does
    // not have — reported, never quietly dropped from the expectation.
    expect(missingLiterals).toEqual(["tests/deleted.test.ts"]);
  });
});

// -----------------------------------------------------------------------------
// Defence in depth against the PERMANENT form of the same defect: a test file
// that no lane's `include` matches never runs at all, and nothing says so.
// scripts/test-collection-guard.cjs checks this at gate time; asserting it here
// too means the floor survives someone unwiring the guard from `pnpm test`.
// Both floors are ZERO and derived from disk — there is no baseline to bump.
// -----------------------------------------------------------------------------
describe("every test file on disk belongs to a lane", () => {
  it("has no orphans and no stale allowlist entries", async () => {
    const configs = [...LANES.map((l: { config: string }) => l.config), ...COVERAGE_ONLY];
    const covered = new Set<string>();
    const stale: string[] = [];

    for (const config of configs) {
      const include = await loadInclude(config);
      const { files, missingLiterals } = expectedFor(include);
      for (const f of files) covered.add(f);
      for (const m of missingLiterals) stale.push(`${config}: ${m}`);
    }

    expect(stale).toEqual([]);

    const path = require("path");
    const repoRoot = path.resolve(__dirname, "..");
    const orphans = walkLoud(repoRoot, [])
      .map((abs: string) => path.relative(repoRoot, abs).split(path.sep).join("/"))
      .filter((rel: string) => /\.test\.tsx?$/.test(rel))
      .filter((rel: string) => !covered.has(rel))
      .sort();

    expect(orphans).toEqual([]);
  });
});
