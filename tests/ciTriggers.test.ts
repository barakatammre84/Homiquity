import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
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
    const m = body.match(/^\s{4}if:\s*(.+)$/m);
    return m?.[1] ?? "";
  };

  it("migrate-prod runs only on push or manual dispatch", () => {
    const cond = jobCondition("migrate-prod");
    expect(cond).toMatch(/github\.event_name == 'push'/);
    expect(cond).toMatch(/workflow_dispatch/);
    expect(cond).not.toMatch(/pull_request/);
  });

  it("verify-deploy runs only on push", () => {
    const cond = jobCondition("verify-deploy");
    expect(cond).toMatch(/github\.event_name == 'push'/);
    expect(cond).not.toMatch(/pull_request/);
  });

  it("gate runs only on pull_request", () => {
    expect(jobCondition("gate")).toMatch(/github\.event_name == 'pull_request'/);
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
