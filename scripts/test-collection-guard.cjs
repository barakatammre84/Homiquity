#!/usr/bin/env node
"use strict";

// COLLECTED-COUNT FLOOR for `pnpm test`.
//
// WHY THIS EXISTS. Three times on 2026-08-20/21, under heavy machine load,
// `pnpm test` ran FEWER test files than exist on disk and still exited 0:
//
//     client lane   "Test Files 111 passed (111)"   118 existed
//     combined      "Test Files 214 passed (215)"
//     client lane   "Test Files 113 passed (113)"   119 existed
//
// Re-running the lane alone collected the full set and passed. The code was
// green; the runner silently ran less of it and reported success. That is the
// repo's signature defect — the operation does not happen and nothing says so —
// sitting on the gate itself. CI's `gate` job runs `pnpm test` on every PR, so
// that is where this binds; .githooks/pre-push skips the suite by default (#660,
// PREPUSH_TESTS=1 opts in) precisely because the laptop it runs on is the machine
// whose load causes the shortfall in the first place.
//
// ROOT CAUSE (proven, not guessed). Vitest 4 discovers test files through
// tinyglobby -> fdir. tinyglobby never passes `suppressErrors`, so fdir's
// default of `true` applies, and fdir's async walk is literally:
//
//     fs.readdir(crawlPath, opts, (error, entries = []) => {
//       callback(entries, directoryPath, currentDepth);            // entries = [] on error
//       state.queue.dequeue(suppressErrors ? null : error, state); // error discarded
//     });
//
// A directory that FAILED to read is therefore indistinguishable from an EMPTY
// one. Injecting a single EMFILE into one `readdir` under `client/src` — through
// tinyglobby's own `fs` passthrough, with the exact options vitest uses — took
// the glob from 118 files to 82, resolved normally, and signalled nothing. Under
// load (load average 25-50, ~46 MB free, dozens of concurrent vitest processes
// against a `kern.maxfiles` of 30720) a transient EMFILE/ENFILE/ENOMEM on one
// readdir is entirely ordinary. That is the bug.
//
// It is NOT worker OOM, which the report reasonably suspected: vitest 4 raises
// "Worker exited unexpectedly" on a dead worker, so that path is loud already.
//
// WHAT THIS DOES. Enumerates what SHOULD run from disk, runs each lane asking
// vitest for a machine-readable list of what it actually collected, and fails on
// any shortfall — naming the files that went missing.
//
// THREE PROPERTIES THAT MAKE IT WORTH HAVING. Change none of them casually:
//
//   1. NO HAND-MAINTAINED EXPECTED TOTAL. Every number is derived from disk and
//      from the configs themselves. A pinned constant would drift and then get
//      bumped to green, which is how a floor becomes a rubber stamp.
//
//   2. THE GUARD'S OWN ENUMERATION FAILS LOUD. walkLoud() has no try/catch, on
//      purpose. If this script used tinyglobby to count the expected files, BOTH
//      sides of the comparison would shrink together under the very conditions
//      being guarded against and the guard would pass — the exact bug, wearing a
//      guard's clothes. Enumeration is loud fs.readdirSync; matching is pure
//      string work that cannot touch the filesystem.
//
//   3. "COULD NOT VERIFY" EXITS NON-ZERO. Missing JSON, unparseable JSON, an
//      unreadable config, an unsupported glob — all are failures, never passes.
//
// It also catches the PERMANENT form of the same defect: a test file that no
// lane's `include` matches, which never runs at all. That floor is zero and
// needs no baseline.
//
// USAGE
//   node scripts/test-collection-guard.cjs           # both lanes + the floor
//   node scripts/test-collection-guard.cjs <args...> # passthrough; floor DISABLED
//
// Wired as `pnpm test`, so CI's `gate` job and .githooks/pre-push both get it.
// `pnpm test:unit` / `pnpm test:client` remain raw, unguarded escape hatches.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const url = require("node:url");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

// Lanes this script RUNS. Order mirrors the `pnpm test` it replaces: node then
// client, stopping if the first lane's tests fail (fail-fastest-first, the same
// contract `A && B` gave).
const LANES = [
  { id: "node", config: "vitest.config.ts", label: "node lane" },
  { id: "client", config: "vitest.client.config.ts", label: "client lane" },
];

// Not run here (it needs a live server), but its include list still counts as
// coverage for the orphan check — those files are not stranded, just elsewhere.
const COVERAGE_ONLY = ["vitest.integration.config.ts"];

const slash = (p) => p.split(path.sep).join("/");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// Reading the configs
// ---------------------------------------------------------------------------

// The include lists are read from the CONFIGS THEMSELVES rather than restated
// here, so this guard can never disagree with what vitest is actually told to
// run. The configs are TypeScript and use `__dirname`, which is not defined in
// an ES module — hence the transpile-with-banner dance. The temp file must live
// in the repo root: that is where `vitest/config` and `@vitejs/plugin-react`
// resolve from, and where `__dirname` has to point.
const BANNER = [
  "import { fileURLToPath as __hqFileURLToPath } from 'node:url';",
  "import { dirname as __hqDirname } from 'node:path';",
  "const __filename = __hqFileURLToPath(import.meta.url);",
  "const __dirname = __hqDirname(__filename);",
].join("\n");

let tmpSeq = 0;

// Returns { include, exclude } — both repo-relative pattern arrays, `exclude`
// defaulting to [] for a config that declares none.
//
// EXCLUDE MATTERS AS MUCH AS INCLUDE. The node lane's include became the glob
// `tests/**/*.test.{ts,tsx}` on 2026-08-24 (it was ~230 hand-typed paths, the
// most-churned file in the repo). That glob also matches the 18 integration
// files, which belong to a lane needing a live HTTP server, so the node config
// excludes them. A guard that read only `include` would compute an expected set
// 18 files larger than any correct run and fail every time — loudly, but for a
// reason that is not the code. Read both, or verify neither.
async function loadInclude(configFile) {
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch {
    throw new Error(
      "esbuild is not installed, so the vitest configs cannot be read.\n" +
        "  fix:  pnpm install --frozen-lockfile",
    );
  }
  const src = fs.readFileSync(path.join(ROOT, configFile), "utf8");
  const { code } = esbuild.transformSync(src, {
    loader: "ts",
    format: "esm",
    target: `node${process.versions.node.split(".")[0]}`,
    banner: BANNER,
    sourcefile: configFile,
  });

  // The filename must be UNIQUE PER CONFIG, not just per process. Node caches ES
  // modules by URL, so reusing one temp name returns the FIRST config's exports
  // for every later config — silently, with a plausible-looking array. That is
  // the same class of bug this whole script exists to catch, and it bit the
  // prototype of this function.
  const tmp = path.join(ROOT, `.hq-test-collection-guard.${process.pid}.${tmpSeq++}.mjs`);
  fs.writeFileSync(tmp, code);
  try {
    const mod = await import(url.pathToFileURL(tmp).href);
    const test = mod && mod.default && mod.default.test;
    const include = test && test.include;
    if (!Array.isArray(include) || include.length === 0) {
      throw new Error(
        `${configFile}: could not read test.include (got ${JSON.stringify(include)}). ` +
          "Refusing to verify a collection count against an unknown expectation.",
      );
    }
    const exclude = test && test.exclude;
    if (exclude !== undefined && !Array.isArray(exclude)) {
      throw new Error(
        `${configFile}: test.exclude is present but not an array (got ${JSON.stringify(exclude)}). ` +
          "Refusing to guess which files a lane drops.",
      );
    }
    return { include, exclude: exclude ?? [] };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ---------------------------------------------------------------------------
// Enumerating what SHOULD run
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "coverage", ".next", ".turbo", ".cache",
  // `.claude/worktrees/` holds one full checkout PER SESSION (TEAM_PRACTICES §4).
  // Without this, running the guard from the primary checkout walks into every
  // sibling worktree and reports several hundred of OTHER branches' test files as
  // orphans of THIS one — a confident, entirely fabricated failure. It does not
  // reproduce from inside a worktree, which is where this was written.
  ".claude",
]);

// NO try/catch, ON PURPOSE — see property (2) in the header. A readdir that
// fails must blow this script up, not quietly shrink its answer.
//
// Symlinked directories are not followed (`isDirectory()` is false for a
// symlink). vitest's glob does follow them; if a test directory ever becomes a
// symlink the two will disagree and this guard reports a SURPLUS, which is a
// loud "my derivation is wrong" rather than a silent pass. That is the intended
// failure mode.
function walkLoud(absDir, out, fsImpl = fs) {
  for (const entry of fsImpl.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkLoud(path.join(absDir, entry.name), out, fsImpl);
    } else if (entry.isFile()) {
      out.push(path.join(absDir, entry.name));
    }
  }
  return out;
}

// Deliberately understands only `*`, `**` and `{a,b}` — every construct these
// configs actually use — and THROWS on anything else. A mini-glob that guesses
// at an unfamiliar pattern produces a wrong expected count, which is worse than
// no guard: it would be wrong in whichever direction happens to be quiet.
// Extend this on purpose, with a test, when a config needs more.
const UNSUPPORTED_GLOB = /[?[\]()!+@|]/;

function globToRegExp(pattern) {
  if (UNSUPPORTED_GLOB.test(pattern)) {
    throw new Error(
      `unsupported glob construct in "${pattern}".\n` +
        "  This guard translates only *, ** and {a,b}, and errors on anything else\n" +
        "  rather than silently computing a wrong expected count. Extend\n" +
        "  globToRegExp() in scripts/test-collection-guard.cjs deliberately.",
    );
  }
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          re += "(?:[^/]*\\/)*"; // `**/` — zero or more path segments
          i += 2;
        } else {
          re += ".*"; // bare `**` — anything, including `/`
          i += 1;
        }
      } else {
        re += "[^/]*"; // `*` — anything within one segment
      }
    } else if (c === "{") {
      const end = pattern.indexOf("}", i);
      if (end === -1) throw new Error(`unbalanced { in "${pattern}"`);
      const alts = pattern.slice(i + 1, end).split(",");
      if (alts.some((a) => /[/*{]/.test(a))) {
        throw new Error(`only simple {a,b} alternation is supported: "${pattern}"`);
      }
      re += `(?:${alts.map(escapeRe).join("|")})`;
      i = end;
    } else {
      re += escapeRe(c);
    }
  }
  return new RegExp(`^${re}$`);
}

function staticPrefix(pattern) {
  const firstMeta = pattern.search(/[*{]/);
  const head = firstMeta === -1 ? pattern : pattern.slice(0, firstMeta);
  const cut = head.lastIndexOf("/");
  return cut === -1 ? "" : head.slice(0, cut);
}

// Returns { files: string[], missingLiterals: string[] } — repo-relative, sorted.
//
// `exclude` is subtracted AFTER the include set is built, which is the order
// vitest itself applies them. Its patterns go through the same mini-glob, so an
// unsupported construct throws here too rather than silently dropping nothing —
// an exclude that quietly matches zero files would inflate the expected set and
// fail the lane for a reason that is not the code.
//
// A literal exclude naming a file that does not exist is NOT an error the way a
// literal include is: an include claims coverage it does not have, while an
// exclude that matches nothing is merely inert. The double-claim check in main()
// is what catches an exclude that has drifted away from the lane it protects.
function expectedFor(include, exclude = [], root = ROOT) {
  const files = new Set();
  const missingLiterals = [];
  for (const pattern of include) {
    if (!/[*{]/.test(pattern)) {
      // A literal entry in an explicit allowlist. vitest ignores one that does
      // not exist, so a stale entry is coverage the config CLAIMS but does not
      // have — worth failing on, and a one-line fix.
      if (fs.existsSync(path.join(root, pattern))) files.add(slash(pattern));
      else missingLiterals.push(pattern);
      continue;
    }
    const re = globToRegExp(pattern);
    const base = staticPrefix(pattern);
    const absBase = path.join(root, base);
    if (!fs.existsSync(absBase)) {
      throw new Error(`glob "${pattern}" is rooted at "${base || "."}", which does not exist`);
    }
    for (const abs of walkLoud(absBase, [])) {
      const rel = slash(path.relative(root, abs));
      if (re.test(rel)) files.add(rel);
    }
  }
  for (const pattern of exclude) {
    // Only a pattern with NO glob metacharacter at all is treated as a literal
    // path. Anything else — including a construct globToRegExp cannot translate,
    // which carries none of `*` or `{` — goes through it and throws. Falling
    // through to `files.delete()` on an untranslatable pattern would drop
    // nothing, silently, and leave the expected set 18 files too large.
    if (/[*{]/.test(pattern) || UNSUPPORTED_GLOB.test(pattern)) {
      const re = globToRegExp(pattern);
      for (const rel of [...files]) if (re.test(rel)) files.delete(rel);
      continue;
    }
    files.delete(slash(pattern));
  }
  return { files: [...files].sort(), missingLiterals };
}

// The whole point, in four lines. `missing` is the silent shortfall: files that
// exist, that the config includes, and that vitest did not run. `surplus` is the
// guard doubting ITSELF — vitest ran something this script failed to predict, so
// the expected set is wrong and the floor above it means nothing. Both are
// failures; neither is ever a warning.
function compareCollection(expected, collected) {
  const collectedSet = new Set(collected);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((f) => !collectedSet.has(f)),
    surplus: collected.filter((f) => !expectedSet.has(f)),
  };
}

// ---------------------------------------------------------------------------
// Running a lane and asking it what it actually collected
// ---------------------------------------------------------------------------

function vitestBin() {
  const bin = path.join(ROOT, "node_modules", ".bin", "vitest");
  if (!fs.existsSync(bin)) {
    throw new Error(
      "node_modules/.bin/vitest is missing, so nothing can be run or verified.\n" +
        "  fix:  pnpm install --frozen-lockfile",
    );
  }
  return bin;
}

// The `--reporter=json` list is what makes this checkable at all: it names every
// file vitest actually ran, so a shortfall can be reported by NAME instead of as
// a bare count. The default reporter stays on so a human still sees live output.
function runLane(lane, passthrough) {
  const outFile = path.join(os.tmpdir(), `hq-test-collection.${process.pid}.${lane.id}.json`);
  fs.rmSync(outFile, { force: true });

  const result = spawnSync(
    vitestBin(),
    [
      "run",
      "--config", lane.config,
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${outFile}`,
      ...passthrough,
    ],
    { stdio: "inherit", cwd: ROOT, env: process.env },
  );

  let collected = null;
  let readError = null;
  try {
    if (fs.existsSync(outFile)) {
      const json = JSON.parse(fs.readFileSync(outFile, "utf8"));
      if (Array.isArray(json.testResults)) {
        collected = json.testResults.map((t) => slash(path.relative(ROOT, t.name))).sort();
      } else {
        readError = "the JSON report has no testResults array";
      }
    } else {
      readError = "vitest wrote no JSON report";
    }
  } catch (err) {
    readError = `the JSON report could not be parsed: ${err.message}`;
  } finally {
    fs.rmSync(outFile, { force: true });
  }

  const status = result.status === null ? 1 : result.status;
  return { status, signal: result.signal, collected, readError };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function listSome(files, cap = 15) {
  const shown = files.slice(0, cap).map((f) => `      - ${f}`);
  if (files.length > cap) shown.push(`      … and ${files.length - cap} more`);
  return shown.join("\n");
}

async function main() {
  const passthrough = process.argv.slice(2);
  const floorEnabled = passthrough.length === 0;

  console.log("test collection floor — every file on disk must actually run\n");

  if (!floorEnabled) {
    console.log("  ⚠ COLLECTION FLOOR DISABLED — arguments were passed, so this is a");
    console.log("    filtered run and a shortfall is expected:");
    console.log(`      ${passthrough.join(" ")}`);
    console.log("    Run `pnpm test` with no arguments for the gated, full-suite run.\n");
  }

  const failures = [];

  // ---- the lanes -----------------------------------------------------------
  // Every config is read BEFORE any lane runs. The orphan check below needs the
  // full set, and a red node lane breaks out of the run loop early — reading the
  // client config lazily inside that loop meant a single failing unit test made
  // all 118 client files look like orphans, burying the real failure under a
  // fabricated one.
  const laneIncludes = new Map();
  for (const lane of LANES) laneIncludes.set(lane.id, await loadInclude(lane.config));
  for (const cfg of COVERAGE_ONLY) laneIncludes.set(cfg, await loadInclude(cfg));

  // ---- no file belongs to two lanes ----------------------------------------
  // The orphan check at the bottom catches a file in ZERO lanes. This catches
  // the opposite, which the node lane's glob made reachable: `tests/**` matches
  // the integration files too, so the node config excludes them by name. Add an
  // integration test and forget that exclude, and the file runs in BOTH lanes —
  // in the node lane with no server, where it fails for a reason that is not the
  // code. Neither list can drift from the other while this holds.
  if (floorEnabled) {
    const claims = new Map(); // repo-relative file -> [config, ...]
    for (const [id, patterns] of laneIncludes) {
      const cfg = LANES.find((l) => l.id === id)?.config ?? id;
      for (const f of expectedFor(patterns.include, patterns.exclude).files) {
        claims.set(f, [...(claims.get(f) ?? []), cfg]);
      }
    }
    const doubles = [...claims.entries()].filter(([, cfgs]) => cfgs.length > 1);
    if (doubles.length) {
      failures.push(`${doubles.length} test file(s) are claimed by more than one lane`);
      console.log(`\n  ✗ ${doubles.length} test file(s) belong to two lanes at once:`);
      console.log(listSome(doubles.map(([f, cfgs]) => `${f}  (${cfgs.join(" + ")})`)));
      console.log("    A file must run in exactly one lane. If this is an integration test,");
      console.log("    add it to the node lane's `exclude` in vitest.config.ts.");
    }
  }

  let skippedLanes = [];
  for (const lane of LANES) {
    const { include, exclude } = laneIncludes.get(lane.id);

    const { files: expected, missingLiterals } = floorEnabled
      ? expectedFor(include, exclude)
      : { files: [], missingLiterals: [] };

    const run = runLane(lane, passthrough);

    if (run.status !== 0) {
      failures.push(`${lane.label}: tests failed${run.signal ? ` (signal ${run.signal})` : ""}`);
    }

    if (floorEnabled) {
      if (missingLiterals.length) {
        failures.push(`${lane.label}: ${missingLiterals.length} include entr(y/ies) name a file that does not exist`);
        console.log(`\n  ✗ ${lane.label} — ${lane.config} lists ${missingLiterals.length} file(s) that are not on disk.`);
        console.log("    The allowlist claims coverage it does not have. Delete the stale line(s):");
        console.log(listSome(missingLiterals));
      }

      if (run.collected === null) {
        failures.push(`${lane.label}: collection could not be verified (${run.readError})`);
        console.log(`\n  ✗ ${lane.label} — COULD NOT VERIFY: ${run.readError}.`);
        console.log("    Treated as a failure on purpose: an unverifiable run is not a passing one.");
      } else {
        const { missing, surplus } = compareCollection(expected, run.collected);

        const verdict = missing.length ? `SHORT BY ${missing.length}` : "ok";
        console.log(
          `\n  ${missing.length ? "✗" : "✓"} ${lane.label.padEnd(12)} ` +
            `on disk ${String(expected.length).padStart(4)} · collected ${String(run.collected.length).padStart(4)}   ${verdict}`,
        );

        if (missing.length) {
          failures.push(`${lane.label}: collected ${run.collected.length} of ${expected.length} files`);
          console.log("\n    These files exist and are included by the config, but vitest did NOT run them:");
          console.log(listSome(missing));
          console.log("\n    This is the silent-shortfall bug, not a flake: vitest's file glob");
          console.log("    (tinyglobby -> fdir) discards readdir errors, so a directory that");
          console.log("    failed to read under load reads as an EMPTY one and the run exits 0.");
          console.log("    Re-run the lane — it will very likely pass. The push is blocked because");
          console.log("    THIS run proved nothing about those files, not because the code is bad.");
          console.log("    If it reproduces on a quiet machine, the config or the file is wrong.");
        }

        if (surplus.length) {
          failures.push(`${lane.label}: ran ${surplus.length} file(s) this guard did not expect`);
          console.log("\n    vitest ran files this guard did not predict, so its derivation of the");
          console.log("    expected set is wrong and the floor above cannot be trusted:");
          console.log(listSome(surplus));
        }
      }
    }

    // Fail-fastest-first: `pnpm test` was `A && B`, so a red node lane never
    // reached the client lane. Preserved — but only for genuine test failures,
    // never for a floor violation, which we want reported for every lane.
    if (run.status !== 0) {
      skippedLanes = LANES.slice(LANES.indexOf(lane) + 1);
      break;
    }
  }

  // A lane that never ran is a lane whose files were not checked. Say so —
  // an omitted line reads as "fine" to anyone skimming the gate output.
  for (const lane of skippedLanes) {
    console.log(`\n  – ${lane.label.padEnd(12)} not run (an earlier lane failed), so its files were NOT verified`);
  }

  // ---- orphan test files ---------------------------------------------------
  // The permanent form of the same defect: a test file no lane's `include`
  // matches never runs at all, and nothing anywhere says so. Floor is zero; no
  // baseline constant, because a baseline is a place to hide one more.
  if (floorEnabled) {
    // Coverage is what a lane actually RUNS, so exclude counts here too: a file
    // the node lane globs in and then excludes is covered only if some other
    // lane includes it. Ignoring exclude would let an integration test dropped
    // from vitest.integration.config.ts still read as covered — by the very lane
    // that refuses to run it.
    const covered = new Set();
    for (const { include, exclude } of laneIncludes.values()) {
      for (const f of expectedFor(include, exclude).files) covered.add(f);
    }

    const allTests = walkLoud(ROOT, [])
      .map((abs) => slash(path.relative(ROOT, abs)))
      .filter((rel) => /\.test\.tsx?$/.test(rel))
      .sort();
    const orphans = allTests.filter((f) => !covered.has(f));

    console.log(
      `\n  ${orphans.length ? "✗" : "✓"} orphan files  ` +
        `${String(allTests.length).padStart(4)} test files on disk · ${orphans.length} matched by no lane`,
    );
    if (orphans.length) {
      failures.push(`${orphans.length} test file(s) belong to no lane and never run`);
      console.log("\n    These exist, look like tests, and are run by NOTHING. Add each to the");
      console.log("    include list of the lane it belongs to (vitest.config.ts for pure unit");
      console.log("    tests, vitest.integration.config.ts if it needs a running server):");
      console.log(listSome(orphans));
    }
  }

  if (failures.length) {
    console.log(`\ntest collection floor FAILED — ${failures.length} problem(s):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }

  console.log(floorEnabled ? "\nall lanes ran every file on disk\n" : "\nfiltered run complete (floor not checked)\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\ntest collection floor ERRORED — treated as a failure, never as a pass:\n");
    console.error(`  ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
}

// Exported for tests/testCollectionGuard.test.ts. The repo's other guards do the
// same (migration-ledger-guard, security-review-guard): the pure decision
// functions are separable from the I/O, so the gate's own logic is testable
// without running the thing it gates.
module.exports = {
  LANES,
  COVERAGE_ONLY,
  globToRegExp,
  staticPrefix,
  walkLoud,
  expectedFor,
  compareCollection,
  loadInclude,
};
