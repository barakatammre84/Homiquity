#!/usr/bin/env node
/**
 * Orphan file scanner — finds .ts/.tsx files that nothing imports.
 *
 * Used by `npm run checkup` (scripts/checkup.sh). Exits 1 if any orphans are
 * found so the checkup can flag them; exits 0 when the codebase is fully
 * connected. Read-only.
 *
 * Known limits: string-built dynamic import paths are invisible to the regex,
 * so verify a candidate really is dead (grep its basename) before deleting it.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Files that are executed directly (npm scripts, platform entrypoints) rather
// than imported. Anything else with zero inbound imports is an orphan.
const ENTRY_FILES = new Set([
  "client/src/main.tsx",
  "server/index-dev.ts",
  "server/index-prod.ts",
  "server/app.ts", // esbuild entry for the Vercel bundle (api/_app.mjs)
  "server/mcp/index.ts",
  "server/scripts/seedLendingGrids.ts",
  "server/scripts/backfillSsnEncryption.ts",
  "server/scripts/markMigrationsApplied.ts",
  "server/seed.ts",
  "api/index.ts",
]);

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
    const content = fs.readFileSync(f, "utf8");
    let m;
    while ((m = IMPORT_RE.exec(content))) {
      const spec = m[1] || m[2] || m[3] || m[4];
      if (!spec) continue;
      const r = resolve(spec, path.dirname(f));
      if (r) referenced.add(r);
    }
  }

  const orphans = files
    .map(rel)
    .filter((f) => !referenced.has(f) && !ENTRY_FILES.has(f))
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
