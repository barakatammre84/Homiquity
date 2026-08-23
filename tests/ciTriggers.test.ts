import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * The CI workflow's trigger surface, pinned.
 *
 * WHY THIS FILE EXISTS. `on.pull_request.branches: [main]` meant a PR based on
 * another feature branch matched nothing and got ZERO check-runs for its whole life.
 * It ran for the first time only when someone retargeted it to main — the moment
 * they were about to merge, i.e. the latest and most expensive moment to discover a
 * red gate.
 *
 * And a zero-check PR does not look unchecked: `gh pr view` reports
 * `mergeStateStatus: CLEAN`, which means "no merge conflicts" and says nothing about
 * CI. On a stacked PR the two are indistinguishable at a glance. #517 and #518
 * (2026-08-13) both reported CLEAN with no run ever scheduled; #425 (2026-08-06) was
 * the same shape with auto-merge armed.
 *
 * Removing a trigger produces no error anywhere — it just stops firing. Same class as
 * tests/cronSchedules.test.ts, for the same reason.
 *
 * Pure in-process: reads the workflow file as text. No HTTP, no database.
 */

const CI = readFileSync(join(__dirname, "../.github/workflows/ci.yml"), "utf8");

/** The `on:` block, up to the first top-level key that follows it. */
const onBlock = (() => {
  const start = CI.indexOf("\non:");
  const rest = CI.slice(start + 1);
  const next = rest.search(/\npermissions:|\njobs:/);
  return next === -1 ? rest : rest.slice(0, next);
})();

const pullRequestBlock = (() => {
  const start = onBlock.indexOf("  pull_request:");
  const rest = onBlock.slice(start);
  // Ends at the next sibling key at two-space indent (`  push:` / `  workflow_dispatch:`).
  const next = rest.slice(1).search(/\n {2}\w[\w-]*:/);
  return next === -1 ? rest : rest.slice(0, next + 1);
})();

describe("every PR is gated, whatever its base", () => {
  it("the pull_request trigger carries NO branches filter", () => {
    expect(
      pullRequestBlock,
      "`branches:` under pull_request means a stacked PR gets zero check-runs and " +
        "still reports mergeStateStatus CLEAN — see this file's header",
    ).not.toMatch(/^\s{4}branches:/m);
  });

  it("still fires on the event types the repo depends on", () => {
    // `edited` covers a base retarget AND a body edit — guard:security reads the PR
    // body from the event payload, so re-running an old run replays the OLD body.
    for (const type of ["opened", "synchronize", "reopened", "edited", "ready_for_review"]) {
      expect(pullRequestBlock, `pull_request type '${type}' dropped`).toMatch(
        new RegExp(`\\b${type}\\b`),
      );
    }
  });
});

describe("widening the PR trigger cannot reach a deploy job", () => {
  // The safety argument for dropping the branches filter: only `gate` can run on a
  // pull_request. If either condition below is ever relaxed, a PR from any branch
  // could apply migrations to prod.
  const jobCondition = (job: string) => {
    const start = CI.indexOf(`\n  ${job}:`);
    expect(start, `job ${job} not found`).toBeGreaterThan(-1);
    // Bound to the NEXT job rather than a fixed window: `gate`'s `if:` sits below a
    // ~12-line comment about the required-check name, which a fixed slice truncated.
    const rest = CI.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
    const body = next === -1 ? rest : rest.slice(0, next + 1);
    // An `if:` may be a single line OR a folded block scalar (`if: >-` followed
    // by indented continuation lines). Reading only the first form returned the
    // literal ">-", which does not match any assertion below — so the FIRST
    // multi-line condition anyone wrote turned this whole file red for the wrong
    // reason. (Red, at least: had the assertions been negative — `not.toMatch` —
    // the same bug would have made them vacuously PASS instead, which is the
    // version of this that ships a broken trigger.)
    const m = body.match(/^\s{4}if:\s*(.+)$/m);
    if (!m) return "";
    if (!/^[>|][-+]?$/.test(m[1].trim())) return m[1];
    const after = body.slice(body.indexOf(m[0]) + m[0].length);
    const lines: string[] = [];
    for (const line of after.split("\n").slice(1)) {
      if (!/^\s{6,}\S/.test(line)) break;
      lines.push(line.trim());
    }
    return lines.join(" ");
  };

  // PAUSED STATE, 2026-08-19. Development is local-only and the Railway production
  // service is being taken down, so both deploy jobs are switched off (see their `if:`
  // comments in ci.yml for the restore procedure). These two tests therefore accept the
  // live wiring OR the exact paused wiring — and nothing else. They are deliberately NOT
  // relaxed to a wildcard: any third value still fails, so the jobs cannot drift to some
  // other trigger unnoticed while nobody is looking at them.
  //
  // The assertion this file exists for — that a pull_request can never reach a deploy
  // job — stays unconditional in both states. Widening `on.pull_request` must never be
  // able to fire a deploy, paused or not.
  const LIVE_MIGRATE = "github.event_name == 'push' || github.event_name == 'workflow_dispatch'";
  const PAUSED_MIGRATE = "github.event_name == 'workflow_dispatch'";
  const LIVE_VERIFY = "github.event_name == 'push'";
  const PAUSED_VERIFY = "false";

  it("migrate-prod is wired for push+dispatch, or explicitly paused to dispatch only", () => {
    const cond = jobCondition("migrate-prod").trim();
    expect([LIVE_MIGRATE, PAUSED_MIGRATE]).toContain(cond);
  });

  it("verify-deploy is wired for push, or explicitly paused off", () => {
    const cond = jobCondition("verify-deploy").trim();
    expect([LIVE_VERIFY, PAUSED_VERIFY]).toContain(cond);
  });

  it("no pull_request event can reach a deploy job, paused or live", () => {
    // The security property. Unconditional, and the reason this describe block exists.
    for (const job of ["migrate-prod", "verify-deploy"]) {
      expect(jobCondition(job), `${job} must never fire on a pull_request`).not.toMatch(
        /pull_request/,
      );
    }
  });

  it("gate runs only on pull_request", () => {
    expect(jobCondition("gate")).toMatch(/github\.event_name == 'pull_request'/);
  });

  // Cost control (KTLO-2), continuing #620. These two remove whole classes of
  // run that could never have changed a verdict.
  it("gate skips draft PRs — a draft cannot merge, so gating each push buys nothing", () => {
    expect(jobCondition("gate")).toMatch(/github\.event\.pull_request\.draft == false/);
  });

  it("gate skips a TITLE-only edit, but never a body edit or a base retarget", () => {
    const cond = jobCondition("gate");
    expect(cond).toMatch(/github\.event\.action == 'edited'/);
    // `edited` stays in `types` because guard:security reads the PR BODY from the
    // event payload — a security review added after the fact MUST re-gate.
    expect(cond, "a body edit must still re-gate — guard:security reads it").toMatch(
      /!github\.event\.changes\.body/,
    );
    // A retarget also arrives as `edited`, and a new base is a real re-gate.
    expect(cond, "a base retarget must still re-gate — it is a new base").toMatch(
      /!github\.event\.changes\.base/,
    );
  });

  it("verify-deploy probes the Railway origin, never www", () => {
    // `www.homiquity.com` answers through Squarespace DNS, where a stale record,
    // a redirect, or a cached edge response can answer for something other than
    // the Railway service this workflow just deployed to. A false GREEN here is
    // precisely the silent-stale-prod condition the job exists to catch.
    expect(CI).toMatch(/curl [^\n]*homiquity-production\.up\.railway\.app\/api\/health/);
    expect(CI, "a `www` probe would let the verifier read the wrong origin").not.toMatch(
      /curl [^\n]*www\.homiquity\.com/,
    );
  });
});

describe("a superseded gate run is cancelled, and only a gate run", () => {
  // Cost control (KTLO-2): the repo is private, so Actions minutes are metered.
  // Without a concurrency group, every push to a branch started a fresh ~5-minute
  // run while the superseded one ran to completion for a commit nobody would merge.
  //
  // The DANGER this pins is the other direction. `cancel-in-progress` is only safe
  // on `gate` because `gate` runs on pull_request ONLY — see the "gate runs only on
  // pull_request" case above. A cancelled `migrate-prod` is a half-applied migration,
  // which is the 2026-07-13 outage. So both halves are pinned here, together.
  const jobBlock = (job: string) => {
    const start = CI.indexOf(`\n  ${job}:`);
    expect(start, `job ${job} not found`).toBeGreaterThan(-1);
    const rest = CI.slice(start + 1);
    const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  };

  it("gate cancels its own superseded runs, keyed per PR", () => {
    const gate = jobBlock("gate");
    expect(gate, "gate lost its concurrency group — superseded runs burn metered minutes").toMatch(
      /^\s{4}concurrency:\s*$/m,
    );
    expect(gate).toMatch(/^\s{6}group:\s*gate-pr-\$\{\{\s*github\.event\.pull_request\.number\s*\}\}\s*$/m);
    expect(gate).toMatch(/^\s{6}cancel-in-progress:\s*true\s*$/m);
  });

  it("migrate-prod is NEVER cancellable", () => {
    // A cancelled migration leaves prod's schema half-applied. This has always been
    // false; it is pinned because the gate change above makes `cancel-in-progress:
    // true` a familiar line to copy downward into the wrong job.
    const migrate = jobBlock("migrate-prod");
    expect(migrate).toMatch(/^\s{6}cancel-in-progress:\s*false\s*$/m);
    expect(migrate).not.toMatch(/^\s{6}cancel-in-progress:\s*true\s*$/m);
  });

  it("verify-deploy has no concurrency group at all", () => {
    // It proves prod is serving a specific commit. Cancelling or de-duplicating it
    // would silently drop the only check that catches a failed Railway build.
    expect(jobBlock("verify-deploy")).not.toMatch(/^\s{4}concurrency:/m);
  });
});

describe("the §9 guard diffs the PR's real base", () => {
  it("uses pull_request.base.sha, not a hardcoded main", () => {
    // This is what makes a stacked PR check its OWN changes rather than its parent's.
    expect(CI).toMatch(/BASE_SHA:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\}\}/);
    expect(CI).not.toMatch(/BASE_SHA:\s*origin\/main/);
  });
});

describe("push still drives deploy from main only", () => {
  it("the push trigger stays pinned to main", () => {
    expect(onBlock).toMatch(/push:\s*\n\s{4}branches:\s*\[main\]/);
  });
});

describe("the docs-only fast path cannot skip a gate that matters", () => {
  // The `scope` step turns the expensive half of `gate` off when a PR changes
  // nothing but inert prose (KTLO-2: 36 of 137 commits to main in the 14 days to
  // 2026-08-20 were prose-only, each paying a full ~4-minute billed run).
  //
  // The whole safety argument is that "inert" is decided correctly. These tests
  // pin the two ways it could rot.

  const scopeStep = (() => {
    const start = CI.indexOf("      - name: Change scope (inert docs vs code)");
    expect(start, "the scope step was removed or renamed").toBeGreaterThan(-1);
    const rest = CI.slice(start + 1);
    const next = rest.search(/\n {6}- name: /);
    return next === -1 ? rest : rest.slice(0, next);
  })();

  it("fails closed — every unclassifiable diff resolves to code", () => {
    // An empty diff, a missing sha, or a git failure must all mean "run everything".
    // The cost of a wrong `code=false` is a COMPLETELY ungated PR.
    expect(scopeStep).toMatch(/code=true.*cannot classify/s);
    expect(scopeStep, "a missing base/head sha must resolve to code").toMatch(
      /if \[ -z "\$\{BASE_SHA:-\}" \] \|\| \[ -z "\$\{HEAD_SHA:-\}" \]/,
    );
    expect(scopeStep, "an empty/failed diff must resolve to code").toMatch(
      /if \[ -z "\$changed" \]/,
    );
    // The only path to `code=false` is the affirmative all-prose branch.
    expect(scopeStep.match(/decide false/g) ?? []).toHaveLength(1);
  });

  it("every doc a test reads from disk is on the code path", () => {
    // THE ROT THIS PREVENTS: someone adds a test that reads a .md file, a later PR
    // edits only that .md, the scope step calls it inert, the unit tests never run,
    // and a red suite lands on main. The coupling is invisible in both files —
    // so it is asserted here instead of remembered.
    const testDir = join(__dirname);
    const testFiles = readdirSync(testDir)
      .filter((f) => f.endsWith(".test.ts"))
      // This file is the detector; its own explanatory examples are prose, not reads.
      // Scanning it registered `<path>.md` and then `x.md` as corpus files on the
      // first two runs of this test — the detector detecting its own documentation.
      .filter((f) => f !== "ciTriggers.test.ts");

    const docsRead = new Set<string>();
    for (const f of testFiles) {
      const src = readFileSync(join(testDir, f), "utf8");
      // A real read call, not a mention: `readFileSync(join(__dirname, "../x.md")`.
      // Requiring the reader is what keeps this file's own explanatory prose from
      // registering as a corpus read (it did, on the first run of this test).
      for (const m of src.matchAll(
        /readFileSync?\(\s*join\(__dirname,\s*"\.\.\/([^"]+\.md)"/g,
      )) {
        docsRead.add(m[1]);
      }
    }

    // Sanity: if this finds nothing the regex has drifted and the test is vacuous.
    expect(
      docsRead.size,
      "found no .md reads in tests/ — the detector regex has drifted, so this test " +
        "would pass no matter what the scope step allowed",
    ).toBeGreaterThan(0);

    for (const doc of docsRead) {
      expect(
        scopeStep,
        `tests/ reads ${doc} from disk, so editing it can red the unit tests — but ` +
          `TEST_BEARING_RE in ci.yml's scope step does not cover it. A prose-only PR ` +
          `touching that file would skip the very suite it can break. Add it to ` +
          `TEST_BEARING_RE.`,
      ).toContain(doc.replace(/\./g, "\\."));
    }
  });
});

describe("the Selling Guide corpus steps outrun the scope classifier", () => {
  // The scope step's DOCS_RE includes `^docs/`, so a PR touching only
  // docs/fannie-mae/selling-guide/** classifies as code=false. The corpus steps
  // exist to gate exactly those PRs — so a well-meaning "optimization" that puts
  // them behind `steps.scope.outputs.code` would skip them on every PR that
  // matters while still showing a green gate. Pin the property, not the hope.
  const CORPUS_STEPS = [
    "Selling Guide corpus coherence",
    "Selling Guide coverage map current",
    "Selling Guide extraction proof (recover → extract → verify)",
  ];

  /** The YAML block of one gate step: from its `- name:` to the next `- name:`. */
  const stepBlock = (name: string) => {
    const start = CI.indexOf(`- name: ${name}`);
    expect(start, `gate step '${name}' missing from ci.yml`).toBeGreaterThan(-1);
    const rest = CI.slice(start + 1);
    const next = rest.search(/\n\s+- name: /);
    return next === -1 ? rest : rest.slice(0, next);
  };

  it("all three steps exist in the gate", () => {
    for (const name of CORPUS_STEPS) stepBlock(name);
  });

  it("none of them is gated on the scope step's code classification", () => {
    for (const name of CORPUS_STEPS) {
      expect(
        stepBlock(name),
        `'${name}' is behind steps.scope.outputs.code — a corpus-only PR classifies ` +
          `as inert docs, so this condition skips the step on exactly the PRs it gates`,
      ).not.toContain("steps.scope.outputs.code");
    }
  });

  it("the extraction proof derives the pymupdf pin instead of restating it", () => {
    expect(stepBlock("Selling Guide extraction proof (recover → extract → verify)")).toContain(
      "PYMUPDF_PINNED",
    );
  });
});
