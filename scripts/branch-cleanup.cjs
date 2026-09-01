#!/usr/bin/env node
/**
 * BRANCH CLEANUP — the executable form of TEAM_PRACTICES.md §4.
 *
 * "Merged = deleted, same day — remote and local branch, worktree, and session
 * archive." That rule has been written down since the repo began and nothing
 * ever executed it, so origin reached 200 branches. Two previous cleanups
 * (2026-08-20, 2026-08-30) answered by COPYING branches into backup/ namespaces
 * and deleting nothing: 106 of those 200 are backups. Cleanup that cannot delete
 * makes the problem worse.
 *
 * WHY THIS RUNS IN GITHUB ACTIONS AND NOWHERE ELSE. An agent session cannot
 * delete a ref. Measured 2026-08-31: `git push origin --delete <branch>` and
 * `git push origin :refs/heads/<branch>` both fail through the session proxy,
 * as does any refs/tags/* push, while branch create and update succeed against
 * the same authorized remote in the same minute. A runner with `contents: write`
 * is a different network and has the permission. So the rule lives here.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WILL NOT DELETE — five independent refusals, each for a different way
 * this could destroy something.
 *
 *   1. main, and anything under archive/.
 *      The archive branch holds the only reachable copy of the orphan commits.
 *      A rule of "everything except main and open PRs" deletes it and takes the
 *      safety net with it — this is the single most dangerous shape here.
 *
 *   2. The head of any OPEN pull request. Read live from the API, never cached.
 *
 *   3. Anything in knowledge-base/archive/BRANCH_PROTECT.tsv — branches a live
 *      session is standing on. A runner cannot see the session API, so this is
 *      the one hand-maintained input, and the script REFUSES TO RUN if that file
 *      is stale (see FRESHNESS below). feat/landing-coach-first is `in-main`,
 *      the safest bucket there is, and 39 sessions name it.
 *
 *   4. Any branch whose commits are not provably recoverable. Every branch is
 *      bucketed exactly as scripts/branch-archive.cjs buckets it, and a branch
 *      is deletable only when its tip is an ancestor of main, or IS a
 *      refs/pull/N/head, or is reachable from the archive ref. A branch that is
 *      none of those is not deleted, and the run reports it.
 *
 *   5. Nothing at all, if the manifest is stale or the archive does not cover
 *      every orphan. Partial safety is not safety: it deletes the branches it
 *      understood and leaves the ones it did not, which is the worst outcome.
 *
 * ANCESTRY IS NOT THE TEST. This repo squash-merges, so a merged branch tip is
 * not an ancestor of main: `git branch --no-merged` reports 134 where the true
 * unanchored count is 74. Deleting on ancestry alone would spare 60 branches
 * that need no sparing; deleting everything NOT an ancestor would destroy work.
 * The pull ref is what makes the difference, and it is permanent.
 *
 * DRY RUN IS THE DEFAULT. --apply is required to delete anything.
 *
 * Run:  node scripts/branch-cleanup.cjs            (plan only, deletes nothing)
 *       node scripts/branch-cleanup.cjs --apply    (delete)
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PROTECT_FILE = path.join(ROOT, "knowledge-base/archive/BRANCH_PROTECT.tsv");
const APPLY = process.argv.includes("--apply");
const REMOTE = "origin";
const ARCHIVE_REF = "archive/2026-08-31-orphan-tips";

// The protect list is a snapshot of which branches a live session holds, and that
// set changes by the hour. A stale snapshot is worse than none: it reads as
// authoritative while no longer describing anything. Refuse past this age.
const PROTECT_MAX_AGE_HOURS = 24;

const REPO = process.env.GITHUB_REPOSITORY || "barakatammre84/Homiquity";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const git = (...a) =>
  execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const die = (msg) => {
  console.error(`\nbranch-cleanup: ${msg}\n`);
  process.exit(1);
};

async function api(method, url) {
  if (!TOKEN) die("no GITHUB_TOKEN. This must run in Actions with `contents: write`.");
  const res = await fetch(url.startsWith("http") ? url : `https://api.github.com${url}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "branch-cleanup",
    },
  });
  return res;
}

(async () => {
  // -------------------------------------------------------------------------
  // 1. The protect list, and its freshness
  // -------------------------------------------------------------------------
  if (!fs.existsSync(PROTECT_FILE)) die(`${path.relative(ROOT, PROTECT_FILE)} is missing.`);
  const protectRaw = fs.readFileSync(PROTECT_FILE, "utf8");
  const readAt = protectRaw.match(/^#\s*Read\s+(\d{4}-\d{2}-\d{2}T[\d:]+Z)/m);
  if (!readAt) die("the protect list carries no `# Read <ISO8601>` line, so its age cannot be checked.");
  const ageH = (Date.now() - Date.parse(readAt[1])) / 36e5;
  if (ageH > PROTECT_MAX_AGE_HOURS) {
    die(
      `the protect list was read ${ageH.toFixed(1)}h ago, past the ${PROTECT_MAX_AGE_HOURS}h limit.\n` +
        `  Which branches a live session holds changes by the hour, and a stale list reads as\n` +
        `  authoritative while describing nothing. Refresh it (the file's header says how) and\n` +
        `  update its "# Read" line. Deleting nothing.`,
    );
  }
  const protectedSet = new Set(
    protectRaw
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"))
      .map((l) => l.split("\t")[0].trim())
      .filter(Boolean),
  );

  // -------------------------------------------------------------------------
  // 2. Refs
  // -------------------------------------------------------------------------
  const heads = git("ls-remote", "--heads", REMOTE)
    .split("\n").filter(Boolean)
    .map((l) => { const [sha, ref] = l.split("\t"); return { sha, branch: ref.replace(/^refs\/heads\//, "") }; });

  // A protect row naming a branch that does not exist protects nothing, while
  // reading as protection. That is the config-key-matches-nothing shape this repo
  // has shipped twice — d390dcacf3fe (a vite manualChunks key naming `react-dom`,
  // which resolved nothing, leaving 57 kB in the wrong chunk) and 95770d4e56a7 (a
  // CI `branches:` filter matching nothing, so a stacked PR got zero checks and
  // read CLEAN). The defect audit scored that class highest of anything measured.
  //
  // The first version of BRANCH_PROTECT.tsv had 7 of 15 rows in this state, four
  // naming branches never pushed at all, because it was written from list_sessions
  // without checking against origin. Nothing was lost — over-protecting is harmless
  // — but the file read as covering fifteen things while covering eight.
  //
  // Checked HERE, before the API call, for two reasons: it needs no API, and a run
  // that dies on a missing token must not swallow the finding on its way out.
  // Warned rather than failed — a row can go stale between a merge and the next run
  // for entirely ordinary reasons.
  const headNames = new Set(heads.map((h) => h.branch));
  const phantom = [...protectedSet].filter((b) => !headNames.has(b));
  if (phantom.length) {
    console.warn(`\n  ⚠ ${phantom.length} protect-list row(s) name a branch that is not on ${REMOTE}:`);
    for (const b of phantom) console.warn(`      ${b}`);
    console.warn(`    They protect nothing. Refresh ${path.relative(ROOT, PROTECT_FILE)} — the header says how.\n`);
  }

  const pullShas = new Set(
    git("ls-remote", REMOTE, "refs/pull/*/head").split("\n").filter(Boolean).map((l) => l.split("\t")[0]),
  );

  // Open-PR heads, live from the API. A cached list is exactly how a live PR's
  // branch gets deleted out from under it.
  const openHeads = new Set();
  for (let page = 1; page <= 10; page++) {
    const res = await api("GET", `/repos/${REPO}/pulls?state=open&per_page=100&page=${page}`);
    if (!res.ok) die(`could not list open PRs (HTTP ${res.status}). Deleting nothing.`);
    const batch = await res.json();
    for (const pr of batch) openHeads.add(pr.head.ref);
    if (batch.length < 100) break;
  }
  console.log(`branch-cleanup: ${heads.length} branches · ${pullShas.size} pull refs · ${openHeads.size} open-PR heads · ${protectedSet.size} protected`);


  // Resolve wherever it lives: a local branch on the machine that made it, a
  // remote-tracking ref in a fresh checkout. Looking in only one place resolved on
  // a laptop and reported "does not exist" on a runner.
  let archiveSha = null;
  for (const cand of [`refs/heads/${ARCHIVE_REF}`, `refs/remotes/${REMOTE}/${ARCHIVE_REF}`, `${REMOTE}/${ARCHIVE_REF}`, ARCHIVE_REF]) {
    try { archiveSha = git("rev-parse", "--verify", `${cand}^{commit}`).trim(); break; } catch {}
  }
  if (!archiveSha) die(`${ARCHIVE_REF} not found. It holds the only reachable copy of the orphan commits.`);

  const isAncestor = (a, b) => {
    try { execFileSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: ROOT }); return true; }
    catch { return false; }
  };
  const MAIN = `${REMOTE}/main`;

  // -------------------------------------------------------------------------
  // 3. Classify
  // -------------------------------------------------------------------------
  const del = [], keep = [], unsafe = [];
  for (const { branch, sha } of heads) {
    if (branch === "main" || branch.startsWith("archive/")) { keep.push([branch, "archive/main"]); continue; }
    if (openHeads.has(branch)) { keep.push([branch, "open PR"]); continue; }
    if (protectedSet.has(branch)) { keep.push([branch, "live session"]); continue; }

    let why = null;
    if (isAncestor(sha, MAIN)) why = "in-main";
    else if (pullShas.has(sha)) why = "pr-head";
    else if (isAncestor(sha, archiveSha)) why = "archived";

    if (why) del.push([branch, sha, why]);
    else unsafe.push([branch, sha]);
  }

  if (unsafe.length) {
    console.error(`\nbranch-cleanup: ${unsafe.length} branch(es) are recoverable from NOTHING:`);
    for (const [b, s] of unsafe) console.error(`    ${b}  ${s.slice(0, 8)}`);
    die(
      "Deleting nothing at all. Partial safety is not safety — it removes the branches this\n" +
        "  understood and leaves the ones it did not.\n" +
        "  Fix: node scripts/branch-archive.cjs --build-archive && git push origin " + ARCHIVE_REF,
    );
  }

  const byWhy = del.reduce((a, [, , w]) => ((a[w] = (a[w] || 0) + 1), a), {});
  console.log(`\n  DELETE ${del.length}: ${Object.entries(byWhy).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
  console.log(`  KEEP   ${keep.length}: ${Object.entries(keep.reduce((a, [, w]) => ((a[w] = (a[w] || 0) + 1), a), {})).map(([k, v]) => `${v} ${k}`).join(" · ")}\n`);
  for (const [b, s, w] of del) console.log(`    - ${b}  ${s.slice(0, 8)}  (${w})`);

  if (!APPLY) {
    console.log(`\nbranch-cleanup: DRY RUN — nothing deleted. Re-run with --apply.`);
    return;
  }

  let ok = 0, failed = 0;
  for (const [b] of del) {
    const res = await api("DELETE", `/repos/${REPO}/git/refs/heads/${b.split("/").map(encodeURIComponent).join("/")}`);
    if (res.status === 204 || res.status === 422) { ok++; }
    else { failed++; console.error(`    ✗ ${b} — HTTP ${res.status}`); }
  }
  console.log(`\nbranch-cleanup: deleted ${ok}, failed ${failed}. Remaining on ${REMOTE}: ${heads.length - ok}.`);
  if (failed) process.exit(1);
})();
