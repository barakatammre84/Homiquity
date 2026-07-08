#!/usr/bin/env node
/**
 * Knowledge Base index guard — run by `npm run checkup` (and CI once it lands).
 * Enforces TEAM_PRACTICES: "an unindexed doc is an unread doc."
 *
 * FAILS (exit 1) when either:
 *   1. a `.md` under knowledge-base/ is not represented in knowledge-base/README.md
 *      (either linked directly, or under a section directory that the index links), or
 *   2. an index link points at a knowledge-base/ path that does not exist (dead link).
 *
 * Zero-dependency; walks the tree and parses markdown links. Directory links in the
 * index (targets ending in `/`) cover every doc beneath them, so dated-snapshot buckets
 * (logs/…, research/…, archive/…) are indexed once, not file-by-file.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const KB = path.join(ROOT, "knowledge-base");
const INDEX = path.join(KB, "README.md");

if (!fs.existsSync(INDEX)) {
  console.error("kb-index-guard: knowledge-base/README.md (the index) is missing.");
  process.exit(1);
}

/** Recursively list files matching a filter, as paths relative to KB. */
function walk(dir, filter) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, filter));
    else if (filter(abs)) out.push(path.relative(KB, abs));
  }
  return out;
}

const mdFiles = walk(KB, (p) => p.endsWith(".md")).filter((rel) => rel !== "README.md");

// Extract local link targets from the index: ](target) where target is a repo-local path.
const indexText = fs.readFileSync(INDEX, "utf8");
const linkTargets = [...indexText.matchAll(/\]\(([^)]+)\)/g)]
  .map((m) => m[1].trim())
  .filter((t) => !/^(https?:|mailto:|#)/.test(t)) // skip external + anchors
  .map((t) => t.replace(/#.*$/, "")) // strip in-page anchors
  .filter(Boolean);

const fileLinks = new Set(); // exact file targets, relative to KB
const dirPrefixes = []; // directory targets (end with /), relative to KB
for (const t of linkTargets) {
  const clean = t.replace(/^\.\//, "");
  if (clean.endsWith("/")) dirPrefixes.push(clean);
  else fileLinks.add(clean);
}

// 1. Coverage: every doc is linked exactly or lives under a linked directory.
const uncovered = mdFiles.filter(
  (rel) => !fileLinks.has(rel) && !dirPrefixes.some((d) => rel.startsWith(d))
);

// 2. Dead links: every index target that looks like a KB path must exist on disk.
const dead = [];
for (const t of linkTargets) {
  const clean = t.replace(/^\.\//, "").replace(/\/$/, "");
  if (clean.startsWith("..")) continue; // points outside KB — not our concern
  const abs = path.join(KB, clean);
  if (!fs.existsSync(abs)) dead.push(t);
}

let failed = false;
if (uncovered.length) {
  failed = true;
  console.error(
    `kb-index-guard: ${uncovered.length} doc(s) not indexed in knowledge-base/README.md:`
  );
  uncovered.forEach((f) => console.error(`  - knowledge-base/${f}`));
  console.error("  → add an index line, or place it under an already-indexed section directory.");
}
if (dead.length) {
  failed = true;
  console.error(`kb-index-guard: ${dead.length} dead link(s) in knowledge-base/README.md:`);
  dead.forEach((t) => console.error(`  - ${t}`));
}

if (failed) process.exit(1);
console.log(`KB index OK: ${mdFiles.length} docs, all indexed; no dead links.`);
