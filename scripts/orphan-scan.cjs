#!/usr/bin/env node
/**
 * Orphan file scanner — finds .ts/.tsx files that nothing imports.
 *
 * Used by `npm run checkup` (scripts/checkup.sh). Exits 1 if any orphans are
 * found so the checkup can flag them; exits 0 when the codebase is fully
 * connected. Read-only.
 *
 * Accuracy rules learned the hard way — a guard that cries wolf gets ignored:
 * - Comments are stripped before matching. A file's own header often documents
 *   its usage (`import { Icons } from "@/lib/icons"`), and counting that as a
 *   real import let an orphan cloak itself.
 * - A file importing itself never counts as an inbound reference.
 * - npm-script entrypoints are derived from package.json, not hand-listed, so
 *   adding a `tsx foo.ts` script can't silently turn foo.ts into a false orphan.
 *
 * Known limit: string-built dynamic import paths are invisible to the regex, so
 * verify a candidate really is dead (grep its basename) before deleting it.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Executed by the platform/bundler rather than imported, and invisible to
// package.json (no `tsx <path>` to parse). Keep this list to things nothing
// else can infer.
const PLATFORM_ENTRIES = new Set([
  "client/src/main.tsx", // Vite html entry
  "server/index-dev.ts",
  "server/index-prod.ts",
  "server/app.ts", // esbuild entry for the Vercel bundle (api/_app.mjs)
  "api/index.ts", // Vercel serverless function
  "server/seed.ts",
]);

// Ad-hoc operator tools, run by hand via tsx (each documents its own
// invocation). Real entrypoints — not rot — but deliberately not npm scripts.
const ADHOC_SCRIPTS = new Set([
  "server/scripts/scrubProhibitedComms.ts", // one-off Reg N scrub (#138)
  "server/scripts/seedDemoFile.ts", // lender-walkthrough demo seed (#145)
  "server/scripts/seedLendingGrids.ts", // pricing/underwriting test fixtures
  "server/scripts/backfillSsnEncryption.ts", // one-off ssnVault backfill
]);

// Built ahead of the code that will consume it. Unimported ON PURPOSE — each
// entry needs a reason and an adoption trigger, so this can't become a
// graveyard. Delete the entry (and adopt or remove the file) when it fires.
const INERT_BY_DESIGN = new Map([
  ["client/src/components/brand/Logo.tsx", "design Phase 2 (#166); adopted when BrandingProvider mounts in Phase 4"],
  ["client/src/components/ui/typography.tsx", "design Phase 2 (#166); adopted by the Phase 3 type-scale migration"],
  ["client/src/lib/icons.ts", "design Phase 2 (#166); adopted by the Phase 3 icon-registry migration"],
]);

/** Entrypoints named by package.json scripts (`tsx x.ts`, `node x.cjs`, ...). */
function npmScriptEntries() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const found = new Set();
  for (const cmd of Object.values(pkg.scripts ?? {})) {
    for (const m of cmd.matchAll(/(?:^|\s)((?:[\w./-]+\/)?[\w.-]+\.(?:ts|tsx))(?=\s|$)/g)) {
      found.add(path.normalize(m[1]));
    }
  }
  return found;
}

const ENTRY_FILES = new Set([
  ...PLATFORM_ENTRIES,
  ...ADHOC_SCRIPTS,
  ...INERT_BY_DESIGN.keys(),
  ...npmScriptEntries(),
]);

/**
 * Blanks out line/block comments so commented-out or documented imports don't
 * count as real references. Quote-aware: a "//" inside a string literal (URLs)
 * is left alone, and lengths are preserved so nothing else shifts.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
    } else if (c === "/" && next === "*") {
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") { out += src[i]; i++; }
        if (i < src.length) { out += src[i]; i++; }
      }
      if (i < src.length) { out += src[i]; i++; }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const SCAN_ROOTS = ["client/src", "server", "shared"];
const SEARCH_ROOTS = ["client/src", "server", "shared", "api", "tests"];

const ALIASES = {
  "@": "client/src",
  "@shared": "shared",
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const isSource = (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts");
// Colocated client component tests (client/src/**/*.test.{ts,tsx}) are vitest
// ENTRIES — glob-included by vitest.client.config.ts, imported by nothing —
// so they are excluded from orphan candidacy. They still count as reference
// sources: a module imported only by its test remains (correctly) an orphan.
const isTestEntry = (f) => /\.test\.(ts|tsx)$/.test(f);
const rel = (f) => path.relative(ROOT, f);

// Matches: import "x" (side-effect) | import/export ... from "x" | import("x")
// | require("x"). The from-clause may span lines (multi-line braces) but must
// not cross a quote or semicolon, so one statement can't swallow the next.
const IMPORT_RE =
  /import\s+["']([^"']+)["']|(?:import|export)\s+[^"';]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

function main() {
  const files = SCAN_ROOTS.filter((d) => fs.existsSync(path.join(ROOT, d)))
    .flatMap((d) => walk(path.join(ROOT, d)))
    .filter(isSource);
  const fileSet = new Set(files.map(rel));

  const resolve = (spec, fromDir) => {
    let base = null;
    for (const [alias, target] of Object.entries(ALIASES)) {
      if (spec === alias || spec.startsWith(alias + "/")) {
        base = path.join(target, spec.slice(alias.length));
        break;
      }
    }
    if (!base && spec.startsWith(".")) base = path.join(rel(fromDir), spec);
    if (!base) return null;
    for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      const cand = path.normalize(base + suffix);
      if (fileSet.has(cand)) return cand;
    }
    return null;
  };

  const referenced = new Set();
  const sources = SEARCH_ROOTS.filter((d) => fs.existsSync(path.join(ROOT, d)))
    .flatMap((d) => walk(path.join(ROOT, d)))
    .filter(isSource);
  for (const f of sources) {
    const content = stripComments(fs.readFileSync(f, "utf8"));
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content))) {
      const spec = m[1] || m[2] || m[3] || m[4];
      if (!spec) continue;
      const r = resolve(spec, path.dirname(f));
      // A file can't keep itself alive.
      if (r && r !== rel(f)) referenced.add(r);
    }
  }

  const orphans = files
    .map(rel)
    .filter((f) => !referenced.has(f) && !ENTRY_FILES.has(f) && !isTestEntry(f))
    .sort();

  if (orphans.length === 0) {
    console.log("No orphaned files — codebase fully connected.");
    process.exit(0);
  }
  console.log(`${orphans.length} orphaned file(s) (never imported):`);
  for (const f of orphans) console.log(`  ${f}`);
  process.exit(1);
}

main();
