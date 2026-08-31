#!/usr/bin/env node
/**
 * BRANCH ARCHIVE (zero-dep).
 *
 * Writes knowledge-base/archive/BRANCH_ARCHIVE.tsv — one row per branch on
 * origin, recording where that branch's commits survive if the branch itself is
 * deleted.
 *
 * WHY THIS EXISTS. origin carries 198 branches. TEAM_PRACTICES.md §4 already
 * says "Merged = deleted, same day — remote and local branch, worktree, and
 * session archive", and nothing executes it. Two previous cleanups (2026-08-20,
 * 2026-08-30) responded by COPYING branches into backup/ namespaces and deleting
 * nothing, so 106 of the 198 branches are backups: cleanup more than doubled the
 * ref count. This file is the record that makes deletion safe, so the next
 * cleanup can remove instead of duplicate.
 *
 * ---------------------------------------------------------------------------
 * THE THREE BUCKETS, and what each one guarantees
 *
 *   in-main   the tip is an ancestor of origin/main. The commits ARE main's
 *             history. Deleting the branch removes a name, nothing else.
 *
 *   pr-head   the tip is a refs/pull/N/head. GitHub retains those refs
 *             permanently, for closed and merged PRs alike, and they stay
 *             fetchable by number whether or not the branch exists.
 *
 *   orphan    neither. The commits are held by the branch name ALONE. These are
 *             the only ones where deletion could lose anything, and they are
 *             what --create-tags protects.
 *
 * ANCESTRY IS NOT THE TEST, AND SAYING SO MATTERS. This repo squash-merges (222
 * of the last 300 commits on main are squashes), so a squash-merged branch tip
 * is NOT an ancestor of main and `git branch --no-merged` reports it unmerged.
 * On 2026-08-31 that reads 134 where the true orphan count is 74. Bucketing on
 * the pull ref rather than on ancestry is what closes that 60-branch gap — an
 * archive built on --no-merged would tag 60 branches that never needed it and
 * still be no safer.
 *
 * DERIVED, NEVER HAND-LISTED. Scope comes from `git ls-remote`, so a branch
 * pushed after this was written is still covered. A hand-listed scope is the
 * defect in 75ea2762d0ea (#606) and the reason scripts/gating-reality-guard.cjs
 * discovers its own subjects.
 *
 * IT FAILS RATHER THAN WRITING A SHORT FILE. If the buckets do not sum to the
 * branch count, this exits non-zero and writes nothing. A manifest that quietly
 * omits a branch would assert safety it had not checked — the repo's signature
 * defect ("the operation does not happen and nothing says so"), inside the
 * artifact whose whole job is to be trustworthy.
 *
 * Run:  node scripts/branch-archive.cjs               (write the manifest)
 *       node scripts/branch-archive.cjs --check       (verify current, write nothing)
 *       node scripts/branch-archive.cjs --create-tags (annotate + tag every orphan, local only)
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "knowledge-base/archive/BRANCH_ARCHIVE.tsv");
const CHECK = process.argv.includes("--check");
const CREATE_TAGS = process.argv.includes("--create-tags");
const REMOTE = "origin";

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// --------------------------------------------------------------------------
// 1. Authoritative refs, straight from the remote.
// --------------------------------------------------------------------------
// ls-remote rather than refs/remotes/*: this repo fetches branches by name
// (TEAM_PRACTICES / session convention), so the local remote-tracking set runs
// stale — 145 against origin's 198 on 2026-08-31. Planning a deletion from a
// stale mirror is how a branch gets deleted that the mirror never saw.
function lsRemote(pattern) {
  return git("ls-remote", REMOTE, pattern)
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, ref] = l.split("\t");
      return { sha, ref };
    });
}

const heads = lsRemote("refs/heads/*").map((r) => ({
  sha: r.sha,
  branch: r.ref.replace(/^refs\/heads\//, ""),
}));

// sha -> [PR numbers]. A sha can head more than one PR (a branch reused across
// PRs, which this repo does).
const prBySha = new Map();
for (const { sha, ref } of lsRemote("refs/pull/*/head")) {
  const n = ref.match(/^refs\/pull\/(\d+)\/head$/);
  if (!n) continue;
  if (!prBySha.has(sha)) prBySha.set(sha, []);
  prBySha.get(sha).push(Number(n[1]));
}

// --------------------------------------------------------------------------
// 2. Existing archive tags — the convention already in this repo.
// --------------------------------------------------------------------------
// Seventeen archive/<branch-with-dashes> tags already exist (2026-08-05..11).
// Reuse the naming, and reuse the TAG where one already points at the same
// commit; only fall back to a dated suffix when the name is taken by a
// different commit. Inventing a parallel scheme would leave two archives and
// no way to know which is authoritative.
const tagAtCommit = new Map(); // commit sha -> tag name
const tagNames = new Set();
for (const line of git("for-each-ref", "--format=%(refname:short) %(objectname)", "refs/tags")
  .split("\n")
  .filter(Boolean)) {
  const [name, obj] = line.split(" ");
  tagNames.add(name);
  let commit;
  try {
    commit = git("rev-parse", `${obj}^{commit}`).trim();
  } catch {
    continue;
  }
  if (!tagAtCommit.has(commit)) tagAtCommit.set(commit, name);
}

const slug = (branch) => `archive/${branch.replace(/\//g, "-")}`;

// --------------------------------------------------------------------------
// 3. Bucket every branch.
// --------------------------------------------------------------------------
const have = (sha) => {
  try {
    git("cat-file", "-e", `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

const isAncestor = (sha, of) => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, of], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
};

const clean = (s) => (s || "").replace(/[\t\r\n]+/g, " ").trim();

const MAIN = `${REMOTE}/main`;
const rows = [];
const missing = [];

for (const { branch, sha } of heads) {
  if (branch === "main") continue;
  if (!have(sha)) {
    // A fetch --prune ran before this; anything still absent is a branch the
    // remote grew mid-run. Recorded, never silently dropped.
    missing.push(branch);
    continue;
  }
  const prs = prBySha.get(sha) || [];
  const bucket = isAncestor(sha, MAIN) ? "in-main" : prs.length ? "pr-head" : "orphan";
  const tipDate = clean(git("log", "-1", "--format=%cs", sha));
  const subject = clean(git("log", "-1", "--format=%s", sha)).slice(0, 160);

  rows.push({ branch, sha, tipDate, bucket, prs, tag: "", subject });
}

rows.sort((a, b) => a.branch.localeCompare(b.branch));

// --------------------------------------------------------------------------
// 3b. One tag per COMMIT, not per branch name.
// --------------------------------------------------------------------------
// 74 orphan branches hold only 66 distinct commits: backup/2026-08-20/* is a
// copy of branches that still exist, so eight commits are named twice. Tagging
// per branch would archive the same commit under two names and re-enact in the
// tag space exactly the duplication this cleanup exists to undo. The archive is
// OF COMMITS; a branch name is how you look one up.
//
// Where two branches share a commit the tag takes the name that is not a backup
// copy — `rescue/wire-four-buttons` over its backup/2026-08-20/ twin — and both
// rows point at the one tag.
const preferred = (a, b) => {
  const ab = a.branch.startsWith("backup/");
  const bb = b.branch.startsWith("backup/");
  if (ab !== bb) return ab ? b : a;
  return a.branch.length <= b.branch.length ? a : b;
};

const namerForSha = new Map();
for (const r of rows) {
  if (r.bucket !== "orphan") continue;
  const held = namerForSha.get(r.sha);
  namerForSha.set(r.sha, held ? preferred(held, r) : r);
}
const tagForSha = new Map();
for (const [sha, namer] of namerForSha) {
  let tag = tagAtCommit.get(sha);
  if (!tag) {
    tag = slug(namer.branch);
    if (tagNames.has(tag)) tag = `${tag}-${namer.tipDate}`;
  }
  tagForSha.set(sha, tag);
}
for (const r of rows) if (r.bucket === "orphan") r.tag = tagForSha.get(r.sha);

// --------------------------------------------------------------------------
// 4. Refuse to write a short file.
// --------------------------------------------------------------------------
const expected = heads.length - 1; // minus main
if (rows.length + missing.length !== expected) {
  console.error("branch-archive: bucket counts do not reconcile with the branch list.");
  console.error(`  branches on ${REMOTE} (excluding main): ${expected}`);
  console.error(`  rows built: ${rows.length}   unreadable: ${missing.length}`);
  console.error("  Writing nothing. A manifest that omits a branch asserts a safety it never checked.");
  process.exit(1);
}
if (missing.length) {
  console.error(`branch-archive: ${missing.length} branch(es) on ${REMOTE} are not fetched locally:`);
  for (const b of missing) console.error(`    ${b}`);
  console.error("  Run: git fetch --prune --tags origin   then re-run.");
  process.exit(1);
}

const counts = rows.reduce((a, r) => ((a[r.bucket] = (a[r.bucket] || 0) + 1), a), {});
const orphans = rows.filter((r) => r.bucket === "orphan");

const body =
  `# GENERATED by scripts/branch-archive.cjs — do not hand-edit.\n` +
  `# Every branch on ${REMOTE}, and where its commits survive if the branch is deleted.\n` +
  `#\n` +
  `# Generated against ${MAIN} = ${git("rev-parse", "--short", MAIN).trim()}\n` +
  `# ${expected} branches (excluding main) · ${counts["in-main"] || 0} in-main · ` +
  `${counts["pr-head"] || 0} pr-head · ${counts.orphan || 0} orphan\n` +
  `#\n` +
  `# WHAT EACH BUCKET GUARANTEES\n` +
  `#   in-main  the tip is an ancestor of main. Deleting the branch removes a name, not a commit.\n` +
  `#   pr-head  the tip is a refs/pull/N/head. GitHub keeps those permanently, merged or closed.\n` +
  `#   orphan   held by the branch name alone. These carry an archive tag; nothing else holds them.\n` +
  `#\n` +
  `# TO RECOVER ANY ROW — both verified on 2026-08-31 before this file was committed:\n` +
  `#   orphan   git fetch origin refs/tags/<archiveTag>:refs/tags/<archiveTag> && git log FETCH_HEAD\n` +
  `#   pr-head  git fetch origin refs/pull/<pr>/head && git log FETCH_HEAD\n` +
  `#   in-main  already in main; git show <sha>\n` +
  `#\n` +
  `# Ancestry alone is NOT the test: this repo squash-merges, so a merged branch tip is not an\n` +
  `# ancestor of main. git branch --no-merged reported 134 where the true orphan count was 74.\n` +
  `#\n` +
  `branch\tsha\ttipDate\tbucket\tpr\tarchiveTag\tsubject\n` +
  rows
    .map((r) =>
      [r.branch, r.sha, r.tipDate, r.bucket, r.prs.join(" ") || "-", r.tag || "-", r.subject].join("\t"),
    )
    .join("\n") +
  "\n";

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== body) {
    console.error("branch-archive: the tracked manifest is STALE.");
    console.error(`  run: node scripts/branch-archive.cjs   (and commit ${path.relative(ROOT, OUT)})`);
    process.exit(1);
  }
  console.log(`branch-archive: manifest current — ${rows.length} branches, ${orphans.length} orphan. ✅`);
  process.exit(0);
}

if (CREATE_TAGS) {
  let made = 0;
  let reused = 0;
  const seen = new Set();
  for (const r of orphans) {
    if (seen.has(r.sha)) continue; // one tag per commit, not per name
    seen.add(r.sha);
    if (tagNames.has(r.tag)) {
      reused++;
      continue;
    }
    // Name the tag's message after the branch the TAG is named for, not after
    // whichever row sorted first — alphabetically that is the backup/ copy, so
    // the message would credit a branch the tag name does not mention.
    const sharing = orphans.filter((o) => o.sha === r.sha);
    const namer = sharing.find((o) => slug(o.branch) === r.tag) || r;
    const alsoNamed = sharing.filter((o) => o.branch !== namer.branch);
    git(
      "tag",
      "-a",
      r.tag,
      r.sha,
      "-m",
      `Archive of branch ${namer.branch} at ${r.sha.slice(0, 8)} (${r.tipDate}).\n\n` +
        `${r.subject}\n\n` +
        `Tagged 2026-08-31 so the branch can be deleted without losing its commits. This tip is\n` +
        `not an ancestor of main and heads no pull request, so before this tag the branch name\n` +
        `was the only thing holding it. Recorded in knowledge-base/archive/BRANCH_ARCHIVE.tsv.` +
        (alsoNamed.length ? `\n\nAlso reachable as: ${alsoNamed.map((o) => o.branch).join(", ")}.` : ""),
    );
    tagNames.add(r.tag);
    made++;
  }
  console.log(`branch-archive: ${made} tag(s) created, ${reused} already existed.`);
  console.log("  Local only. Push with: git push origin --tags");
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body);
console.log(
  `branch-archive: wrote ${path.relative(ROOT, OUT)} — ${rows.length} branches ` +
    `(${counts["in-main"] || 0} in-main, ${counts["pr-head"] || 0} pr-head, ${counts.orphan || 0} orphan).`,
);
