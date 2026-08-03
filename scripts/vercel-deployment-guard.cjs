#!/usr/bin/env node
/**
 * Fail the gate when this PR's Vercel deployment failed to build.
 *
 * Why this exists: a build can break in Vercel and be completely invisible.
 * Vercel keeps the last good deployment serving, so the site stays up, every
 * GitHub check stays green, and `main` quietly stops shipping. That is exactly
 * #268 → #279: the TypeScript 7 bump broke Vercel's builder, three merges
 * (#268, #278, #277) sat unshipped for half an hour, and nothing surfaced it.
 *
 * Why not just require the "Vercel" status check instead: it reports `pending`
 * on every PR head and only ever resolves on `main` — verified across nine
 * commits, including ones days old and one whose deployment was READY while the
 * status still said pending. Requiring it deadlocks every PR (and
 * enforce_admins=true means nobody could bypass). The Vercel *API* carries the
 * true state, so we read that instead. It was correct the whole time: it showed
 * ERROR on #268's previews BEFORE that PR was merged.
 *
 * Why this cannot be `pnpm vercel-build` (already a gate step): our build is not
 * the thing that breaks. On TypeScript 7 vite and esbuild both finish — the
 * production log shows `api/_app.mjs 2.4mb`, `Done in 180ms` — and only then
 * Vercel's own post-build step dies loading the user-provided compiler. Only the
 * real deployment's state can catch that class.
 *
 * Env:
 *   VERCEL_TOKEN      (required) — Vercel API token. ABSENT => the guard SKIPS
 *                     with a warning and exits 0, so the gate keeps working
 *                     before the secret is added. Scope it read-only.
 *   COMMIT_SHA        (required) — the commit whose deployment to check. In CI
 *                     this must be the PR HEAD sha, not github.sha (which is the
 *                     synthetic merge commit Vercel never builds).
 *   VERCEL_PROJECT_ID (optional) — defaults to VERCEL_PROJECT_FALLBACK below.
 *   VERCEL_TEAM_ID    (optional) — team id or slug.
 *   VERCEL_GUARD_TIMEOUT_MS / VERCEL_GUARD_POLL_MS (optional) — override waits.
 *   VERCEL_GUARD_SOFT (optional) — "1" downgrades *absent/timeout* to a warning.
 *                     An ERROR deployment always fails, soft or not.
 *
 * API: GET https://api.vercel.com/v6/deployments?projectId=&teamId=&limit=
 *      Deployment states: QUEUED | INITIALIZING | BUILDING | READY | ERROR |
 *      CANCELED. READY/ERROR/CANCELED are terminal.
 */

const VERCEL_PROJECT_FALLBACK = "mortgage-stream";
const VERCEL_TEAM_FALLBACK = "ammre-4309s-projects";

const TERMINAL_OK = new Set(["READY"]);
const TERMINAL_BAD = new Set(["ERROR", "CANCELED"]);

/**
 * Decide from a deployments page alone — no network, so the interesting cases
 * are unit-testable. Returns one of:
 *   { verdict: "pass"    } deployment built
 *   { verdict: "fail"    } deployment errored/canceled  -> block the merge
 *   { verdict: "wait"    } still building               -> caller polls again
 *   { verdict: "absent"  } no deployment for this sha   -> caller polls, then decides
 */
function decideDeploymentVerdict(deployments, sha) {
  const mine = (deployments || [])
    .filter((d) => d && d.meta && d.meta.githubCommitSha === sha)
    // Newest first: a retried deployment supersedes the earlier attempt.
    .sort((a, b) => (b.created || 0) - (a.created || 0));

  if (mine.length === 0) return { verdict: "absent" };

  const latest = mine[0];
  const state = String(latest.state || "").toUpperCase();
  const info = {
    id: latest.uid || latest.id,
    state,
    url: latest.url,
    inspectorUrl: latest.inspectorUrl,
  };

  if (TERMINAL_BAD.has(state)) return { verdict: "fail", deployment: info };
  if (TERMINAL_OK.has(state)) return { verdict: "pass", deployment: info };
  return { verdict: "wait", deployment: info };
}

async function fetchDeployments({ token, projectId, teamId }) {
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("limit", "40");
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.deployments || [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    // Deliberately not a failure: this lands before the secret exists, and a
    // guard that reds the gate on arrival would block every PR.
    console.warn(
      "vercel-deployment-guard: VERCEL_TOKEN not set — SKIPPING.\n" +
        "  Until it is added, a build that breaks Vercel (not our build) can still\n" +
        "  reach main green and silently freeze prod. See scripts/vercel-deployment-guard.cjs.",
    );
    return;
  }

  const sha = process.env.COMMIT_SHA;
  if (!sha) throw new Error("COMMIT_SHA is required (use the PR HEAD sha, not github.sha)");

  const projectId = process.env.VERCEL_PROJECT_ID || VERCEL_PROJECT_FALLBACK;
  const teamId = process.env.VERCEL_TEAM_ID || VERCEL_TEAM_FALLBACK;
  const timeoutMs = Number(process.env.VERCEL_GUARD_TIMEOUT_MS || 12 * 60 * 1000);
  const pollMs = Number(process.env.VERCEL_GUARD_POLL_MS || 20_000);
  const soft = process.env.VERCEL_GUARD_SOFT === "1";

  const deadline = Date.now() + timeoutMs;
  let last = { verdict: "absent" };

  while (Date.now() < deadline) {
    const deployments = await fetchDeployments({ token, projectId, teamId });
    last = decideDeploymentVerdict(deployments, sha);

    if (last.verdict === "pass") {
      console.log(`vercel-deployment-guard: deployment READY (${last.deployment.id}) ✅`);
      return;
    }
    if (last.verdict === "fail") {
      console.error(
        `vercel-deployment-guard: deployment ${last.deployment.state} ✗\n` +
          `  ${last.deployment.inspectorUrl || last.deployment.id}\n` +
          "  This PR does not build on Vercel. Merging it freezes prod on the last\n" +
          "  good deployment while the site stays up and every other check stays green.",
      );
      process.exit(1);
    }

    const waitingFor = last.verdict === "wait" ? last.deployment.state : "no deployment yet";
    console.log(`vercel-deployment-guard: waiting (${waitingFor})…`);
    await sleep(pollMs);
  }

  // Timed out. Never a silent pass: not knowing is not the same as fine.
  const msg =
    `vercel-deployment-guard: no terminal deployment for ${sha} within ` +
    `${Math.round(timeoutMs / 60000)}m (last: ${last.verdict}).`;
  if (soft) {
    console.warn(`${msg} VERCEL_GUARD_SOFT=1 — continuing.`);
    return;
  }
  console.error(
    `${msg}\n` +
      "  Deployability was NOT verified. Re-run once Vercel finishes, or set\n" +
      "  VERCEL_GUARD_SOFT=1 to downgrade this to a warning (an ERROR still fails).",
  );
  process.exit(1);
}

module.exports = { decideDeploymentVerdict };

if (require.main === module) {
  main().catch((err) => {
    console.error(`vercel-deployment-guard: ${err.message}`);
    process.exit(1);
  });
}
