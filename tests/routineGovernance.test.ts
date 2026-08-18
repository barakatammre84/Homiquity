import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { decide } = require("../.claude/hooks/charter-rails.cjs");

// -----------------------------------------------------------------------------
// The suite's own governance layer: CHARTER §8's hard-nevers as an enforced rail,
// and the routine registry as a checked inventory.
//
// Why these two are tested together: both exist because a rule with no mechanism
// behind it is a preference. §8 says no session pushes to `main`, merges a PR, arms
// auto-merge, `db:push`es a shared database or applies a migration to prod — and
// until 2026-08-18 the only thing between any of those and production was a session
// remembering to have read it.
//
// THE HALF THAT ROTS IS THE ALLOW LIST. A blocklist that also blocks ordinary work
// gets switched off, and a switched-off rail protects nothing. This hook's very
// first test run blocked its own test harness — because the harness *mentioned* a
// forbidden command — so every innocent command below is a regression test for that
// class, not padding.
// -----------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");

/** §8's list, in the words of the thing each one would have caused. */
const MUST_BLOCK: Array<[string, string]> = [
  ["git push origin main", "a push straight to the branch that deploys"],
  ["git push origin HEAD:main", "the same push, spelled as a refspec"],
  ["gh pr merge 123 --squash", "a merge — L3, the founder's click"],
  ["gh pr merge --auto 5", "auto-merge, which fires the moment Actions recovers"],
  ["pnpm db:push", "a column drop on the shared dev database"],
  ["npx drizzle-kit push", "the same, one layer down"],
  ["pnpm db:migrate:prod", "a hand-applied prod migration"],
  ["node scripts/migrate-prod.cjs", "the same, invoked directly"],
  ["git add -A", "sweeping up a peer's uncommitted work"],
  ["git add .", "the same, spelled shorter"],
  ["git commit -am fixup", "the same, via commit"],
  ["git push --force origin somebody-elses-branch", "destroying another session's checkout"],
  ["git checkout origin/main -- .", "overwriting the whole working tree to read one file"],
  ["railway variables --set INTAKE_PAUSED=true", "a production variable flipped by a machine"],
  ["pnpm check && git push origin main", "the forbidden half of a compound command"],
];

/** Ordinary work. Every one of these must survive, or the rail gets turned off. */
const MUST_ALLOW = [
  "git push -u origin claude/some-branch",
  "git push --force-with-lease origin my-own-branch",
  "git add knowledge-base/routines/CHARTER.md",
  "git add .claude/settings.json",
  'git commit -m "docs: add all the things"',
  "git show origin/main:package.json",
  "git log --oneline -- .",
  "git checkout -b feature",
  "git worktree remove .claude/worktrees/x",
  "pnpm db:migrate",
  "pnpm test && pnpm build",
  "pnpm guard:routines --strict",
  "gh pr list --state open",
  "grep -n db:push package.json",
  "echo 'git push origin main'",
  'node -e "console.log(1)"',
];

describe("CHARTER §8 rails (.claude/hooks/charter-rails.cjs)", () => {
  it.each(MUST_BLOCK)("blocks `%s` — %s", (command) => {
    const hit = decide(command, "claude/some-branch");
    expect(hit, `expected a rail to fire on: ${command}`).toBeTruthy();
    // A block that does not say why teaches nothing and gets worked around.
    expect(hit.why).toMatch(/CHARTER|LESSONS|CLAUDE\.md/);
    expect(hit.instead).toBeTruthy();
  });

  it.each(MUST_ALLOW)("allows `%s`", (command) => {
    expect(decide(command, "claude/some-branch"), `false positive on: ${command}`).toBeNull();
  });

  it("blocks a bare `git push` only when the current branch IS main", () => {
    expect(decide("git push", "main")).toBeTruthy();
    expect(decide("git push", "claude/some-branch")).toBeNull();
  });

  it("reads a quoted blocked command as text, not as an action", () => {
    // The false-positive class that blocked this file's own harness. Documented in
    // the hook header as an accepted limit: `bash -c "<blocked>"` is not caught.
    expect(decide('git commit -m "revert the git push origin main mistake"', "x")).toBeNull();
  });
});

describe("routine registry (scripts/routine-registry-guard.cjs)", () => {
  // Structural mode only — the same mode the required CI gate runs. `--strict` adds
  // waiver expiry, which is a calendar fact and would make this test start failing
  // on a date nobody's diff caused (the reason doc-freshness lives in its own
  // weekly workflow rather than the gate).
  it("passes on the repo as committed", () => {
    const out = execFileSync("node", ["scripts/routine-registry-guard.cjs"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(out).toMatch(/Routine registry OK/);
  });
});
