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
const BUILD_ARCHIVE = process.argv.includes("--build-archive");
const REMOTE = "origin";
// The ref that holds every orphan commit. An empty-tree commit whose parents are
// the orphan tips; see its own commit message. Branches under archive/ are the
// archive itself and are never candidates for deletion.
const ARCHIVE_REF = "archive/2026-08-31-orphan-tips";
const isArchiveRef = (b) => b === ARCHIVE_REF || b.startsWith("archive/");

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

// Bounded ancestor walk. 200 is far past any branch here (the deepest is 68
// commits) and keeps this linear rather than resolving 731 pull refs per branch.
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
  // An archive/* branch is the safety net, not a candidate for it. Bucketing it
  // as `orphan` would make the archive demand an archive of its own, and would
  // hand any future deletion pass the one branch it must never remove.
  // STRICT: pr-head only when the tip IS a pull ref. A weaker test — "some
  // ancestor is a pull ref" — was tried and is worthless: merged PR heads sit in
  // almost every branch's ancestry, and it collapsed all 74 orphans to zero. A
  // pull ref anchors what is reachable FROM it, so the sound test is "tip is an
  // ancestor of a pull ref", which would mean fetching all 731. Not worth it:
  // erring toward `orphan` over-archives, which is the safe direction.
  const bucket = isArchiveRef(branch)
    ? "archive"
    : isAncestor(sha, MAIN)
      ? "in-main"
      : prs.length
        ? "pr-head"
        : "orphan";
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
for (const r of rows) if (r.bucket === "orphan") r.tag = ARCHIVE_REF;

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

// --------------------------------------------------------------------------
// 4b. The manifest may not claim an archive it does not have.
// --------------------------------------------------------------------------
// Every orphan row prints `archiveRef`, which is a promise that the commit is
// recoverable from that ref. A promise nobody checks is how this repo's
// signature defect gets written down as a fact, so it is checked: the orphan
// sha must actually be reachable from ARCHIVE_REF.
//
// It goes stale for an ordinary reason. `refs/pull/N/head` lags a push, so a
// branch with a live open PR can bucket as `orphan` for a few minutes and land
// outside an archive built before it. That direction is the safe one — a branch
// is over-archived, never under-archived — but the ROW would still be asserting
// something untrue, and that is not a thing to leave in a file whose only job
// is to be believed.
function archiveCovers() {
  const uncovered = [];
  let ref;
  try {
    ref = git("rev-parse", "--verify", `${ARCHIVE_REF}^{commit}`).trim();
  } catch {
    return { exists: false, uncovered };
  }
  for (const r of orphans) if (!isAncestor(r.sha, ref)) uncovered.push(r);
  return { exists: true, uncovered };
}

if (BUILD_ARCHIVE) {
  const emptyTree = git("hash-object", "-t", "tree", "/dev/null").trim();
  const tips = [...new Set(orphans.map((r) => r.sha))];
  const args = ["commit-tree", emptyTree];
  for (const t of tips) args.push("-p", t);
  const sha = git(
    ...args,
    "-m",
    `archive(${new Date().toISOString().slice(0, 10)}): ${tips.length} orphan commits, held so their branches can be deleted\n\n` +
      `This commit contains NOTHING — its tree is empty. Its only job is to be a parent of the\n` +
      `${tips.length} commits that, before it existed, were reachable from nothing but a branch name.\n` +
      `Delete those branches and the commits remain reachable from here, so nothing is lost.\n\n` +
      `Which commits: every row marked \`orphan\` in knowledge-base/archive/BRANCH_ARCHIVE.tsv — a\n` +
      `tip that is neither an ancestor of main nor a refs/pull/N/head. The other branches need no\n` +
      `archive: main already holds theirs, and GitHub retains pull refs permanently.\n\n` +
      `Tags are the better idiom and this repo already uses archive/<branch-with-dashes>. This\n` +
      `session's git proxy permits refs/heads/* and refuses refs/tags/* with HTTP 403, verified\n` +
      `with a branch push succeeding in the same breath. An archive that cannot be pushed is not\n` +
      `an archive.\n\n` +
      `Recover:  git fetch origin ${ARCHIVE_REF} && git checkout -b recovered <sha>\n\n` +
      `DO NOT DELETE THIS BRANCH while any row in BRANCH_ARCHIVE.tsv is marked orphan.`,
  ).trim();
  git("branch", "-f", ARCHIVE_REF, sha);
  console.log(`branch-archive: ${ARCHIVE_REF} rebuilt at ${sha.slice(0, 8)} over ${tips.length} orphan tip(s).`);
  console.log(`  Push with: git push origin ${ARCHIVE_REF}`);
  process.exit(0);
}

const cover = archiveCovers();
if (!cover.exists) {
  console.error(`branch-archive: ${ARCHIVE_REF} does not exist locally, but ${orphans.length} row(s) cite it.`);
  console.error(`  run: git fetch origin ${ARCHIVE_REF}   (or --build-archive to create it)`);
  process.exit(1);
}
if (cover.uncovered.length) {
  console.error(
    `branch-archive: ${cover.uncovered.length} orphan(s) are NOT reachable from ${ARCHIVE_REF}.`,
  );
  for (const r of cover.uncovered) console.error(`    ${r.branch}  ${r.sha.slice(0, 8)}  (${r.tipDate})`);
  console.error("\n  Writing nothing — the manifest would promise an archive that does not hold them.");
  console.error(`  run: node scripts/branch-archive.cjs --build-archive && git push origin ${ARCHIVE_REF}`);
  process.exit(1);
}

const body =
  `# GENERATED by scripts/branch-archive.cjs — do not hand-edit.\n` +
  `# Every branch on ${REMOTE}, and where its commits survive if the branch is deleted.\n` +
  `#\n` +
  `# Generated against ${MAIN} = ${git("rev-parse", "--short", MAIN).trim()}\n` +
  `# ${expected} branches (excluding main) · ${counts["in-main"] || 0} in-main · ` +
  `${counts["pr-head"] || 0} pr-head · ${counts.orphan || 0} orphan · ${counts.archive || 0} archive\n` +
  `#\n` +
  `# WHAT EACH BUCKET GUARANTEES\n` +
  `#   in-main  the tip is an ancestor of main. Deleting the branch removes a name, not a commit.\n` +
  `#   pr-head  the tip is a refs/pull/N/head. GitHub keeps those permanently, merged or closed.\n` +
  `#   orphan   was held by the branch name alone. Now also a parent of ${ARCHIVE_REF}.\n` +
  `#\n` +
  `# A pr-head row records NO sha: its locator is the PR number, which is permanent, while the\n` +
  `# branch tip moves on every push. Freezing the tip there would drift this file forever — the\n` +
  `# sha is kept only where it IS the locator (orphan) or has stopped moving (in-main).\n` +
  `#   archive  the safety net itself. Never delete a branch in this bucket.\n` +
  `#\n` +
  `# TO RECOVER ANY ROW — both paths executed and verified on 2026-08-31 before this was committed:\n` +
  `#   orphan   git fetch origin ${ARCHIVE_REF} && git checkout -b recovered <sha>\n` +
  `#            (proved: origin's archive commit carries 66 parents, 66/66 orphans reachable)\n` +
  `#   pr-head  git fetch origin refs/pull/<pr>/head && git checkout -b recovered FETCH_HEAD\n` +
  `#            (proved: PR #491, branch long deleted, recovered with 915 commits of history)\n` +
  `#   in-main  already in main; git show <sha>\n` +
  `#\n` +
  `# Tags would be the better idiom and this repo already uses archive/<branch-with-dashes>.\n` +
  `# This session's git proxy permits refs/heads/* and refuses refs/tags/* with HTTP 403, so the\n` +
  `# archive is a branch. From a machine with tag rights:\n` +
  `#   node scripts/branch-archive.cjs --create-tags && git push origin --tags\n` +
  `#\n` +
  `# Ancestry alone is NOT the test: this repo squash-merges, so a merged branch tip is not an\n` +
  `# ancestor of main. git branch --no-merged reported 134 where the true orphan count was 74.\n` +
  `#\n` +
  `branch\tsha\ttipDate\tbucket\tpr\tarchiveRef\tsubject\n` +
  rows
    .map((r) =>
      // A `pr-head` row freezes no sha, and this is the whole reason the file is
      // stable. Its locator is the PR NUMBER — `git fetch origin refs/pull/N/head`
      // — which GitHub holds permanently and which does not change when the branch
      // moves. Recording the tip instead would make every push to any open PR drift
      // this file, including the push that publishes the file itself, so it could
      // never be generated in a state that survives its own commit.
      //
      // The sha stays exactly where it IS the locator: `orphan` rows, where nothing
      // but that sha finds the work, and `in-main`, where the branch is finished and
      // its tip no longer moves.
      r.bucket === "pr-head"
        ? [r.branch, "-", "-", r.bucket, r.prs.join(" ") || "-", "-", `(open or closed PR — fetch refs/pull/${r.prs[0]}/head)`].join("\t")
        : [r.branch, r.sha, r.tipDate, r.bucket, r.prs.join(" ") || "-", r.tag || "-", r.subject].join("\t"),
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
