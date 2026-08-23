#!/usr/bin/env node
/**
 * handoff-facts — keep knowledge-base/handoff/FACTS.md honest by re-running it.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every row of FACTS.md carries the command that produced its value. That was
 * deliberate: a number with its own derivation attached can be re-checked by
 * anyone, and a corpus whose numbers can be re-checked is one a reader is
 * allowed to distrust. But "can be re-checked" is not "is re-checked", and the
 * fresh-hire audit of the first draft found FIVE hand-typed numbers that were
 * wrong and SIX `path:line` citations that had drifted — every one of them
 * mechanically detectable. This script is that mechanism.
 *
 * WHAT IT IS NOT
 * --------------
 * It is deliberately in NO guard chain and NO gate step that runs it. The repo
 * must not depend on a docs generator: delete this file and every guard, test
 * and CI job still passes (verified by moving it aside and running them).
 * `pnpm handoff:facts --check` in a refresh PR is the whole contract.
 *
 * ONE EXCEPTION, and it is the reason for the next paragraph: the gate's
 * "Guard scripts parse" step runs `node --check` over `ls scripts/*.cjs`, which
 * INCLUDES this file. So a syntax error here reds the gate for every PR in the
 * repo. That step exists because of #594 — a backtick inside a template literal
 * in browser-probe.cjs made every probe crash, and a sweep read the stack trace
 * as CLEAN. Run `node --check scripts/handoff-facts.cjs` before pushing a change
 * to it; `pnpm preflight` does this for you.
 *
 * MODES
 *   --table    print the regenerated table to stdout; touch nothing
 *   --write    rewrite the generated block in FACTS.md, and re-stamp the SHA
 *   --check    exit 1 if any checkable row disagrees with its live command
 *   --cite     exit 1 if any `path:line` in handoff/** is missing or out of range
 *   --verbose  with --check, print every row, not just the failures
 *
 * THE ONE SUBTLETY — "checkable"
 * ------------------------------
 * Not every row is machine-comparable, and pretending otherwise would be worse
 * than not checking at all. A value cell may carry prose the command cannot
 * produce ("5 dirs (`admin agent-broker …`) · 4"). So a row is CHECKABLE when
 * its command's output is purely numeric — a sequence of integers — and the
 * check is: the measured integers equal the FIRST N integers in the value cell,
 * in order. Everything after those N integers is annotation and is preserved
 * verbatim by --write.
 *
 * Rows that are not checkable are COUNTED AND NAMED, never silently passed.
 * A "0 failures" line that quietly skipped a third of the table is the exact
 * unearned-success shape this corpus is about.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FACTS = path.join(ROOT, "knowledge-base", "handoff", "FACTS.md");
const HANDOFF_DIR = path.join(ROOT, "knowledge-base", "handoff");

const BEGIN = "<!-- BEGIN GENERATED — do not hand-edit; re-derive with the recipe below and paste -->";
const END = "<!-- END GENERATED -->";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const VERBOSE = has("--verbose");

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * A table row is `| id | fact | command | value |`. Splitting on "|" is wrong:
 * commands contain pipes, constantly (`grep … | wc -l`), and they are inside
 * backticks. So we walk the line and only treat a "|" as a cell boundary when
 * we are not inside a backtick span. Markdown's own escape (`\|`) appears in
 * the file too, for pipes the author wanted rendered — those are never
 * boundaries either.
 */
function splitRow(line) {
  const cells = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "`") { inCode = !inCode; cur += c; continue; }
    if (c === "\\" && line[i + 1] === "|") { cur += "\\|"; i++; continue; }
    if (c === "|" && !inCode) { cells.push(cur); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur);
  // A well-formed row starts and ends with "|", so the first and last cells are empty.
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((s) => s.trim());
}

/** Undo the markdown escaping so the shell sees the command the reader sees. */
function unescapeCommand(cell) {
  const m = cell.match(/^`(.*)`$/s);
  const inner = m ? m[1] : cell;
  return inner.replace(/\\\|/g, "|");
}

function readFacts() {
  const doc = fs.readFileSync(FACTS, "utf8");
  const a = doc.indexOf(BEGIN);
  const b = doc.indexOf(END);
  if (a === -1 || b === -1) {
    fail(`${rel(FACTS)} has no generated block. It must contain, on their own lines:\n${BEGIN}\n${END}`);
  }
  const block = doc.slice(a + BEGIN.length, b);
  const rows = [];
  let header = null;
  for (const line of block.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    if (/^\|[\s|:-]+\|$/.test(t)) continue;            // the |---|---| separator
    const cells = splitRow(t);
    if (cells.length < 4) continue;
    if (cells[0] === "id") { header = cells; continue; }
    if (!/^F-\d+$/.test(cells[0])) continue;
    rows.push({ id: cells[0], fact: cells[1], cmdCell: cells[2], value: cells[3] });
  }
  return { doc, a, b, rows, header };
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

/**
 * Integers in a string, in order. Commas inside a number are thousands
 * separators (`1,087`) and are stripped; a comma between numbers is not.
 */
function integersIn(s) {
  const out = [];
  for (const m of s.matchAll(/\d[\d,]*/g)) {
    const n = m[0].replace(/,/g, "");
    if (/^\d+$/.test(n)) out.push(Number(n));
  }
  return out;
}

function run(cmd) {
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      shell: "/bin/sh",           // NOT zsh: the corpus's commands are written for sh word-splitting
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, LC_ALL: "C" },
    });
    return { ok: true, out };
  } catch (e) {
    // A non-zero exit is normal for these: `grep -c` exits 1 on zero matches,
    // and a pipeline's status is its LAST command's. What matters is the text.
    return { ok: false, out: (e.stdout || "") + "", err: (e.stderr || "") + "", status: e.status };
  }
}

/** Purely numeric output: whitespace-separated integers and nothing else. */
function isNumericOutput(out) {
  const t = out.trim();
  return t.length > 0 && /^[\d\s,]+$/.test(t) && integersIn(t).length > 0;
}

function measure(row) {
  const cmd = unescapeCommand(row.cmdCell);
  const r = run(cmd);
  const out = (r.out || "").trim();
  const checkable = isNumericOutput(out);
  return {
    ...row,
    cmd,
    raw: out,
    stderr: (r.err || "").trim(),
    checkable,
    measured: checkable ? integersIn(out) : null,
    expected: integersIn(row.value),
  };
}

// ---------------------------------------------------------------------------
// Comparing and rewriting
// ---------------------------------------------------------------------------

function agrees(m) {
  if (!m.checkable) return null;
  const want = m.measured;
  const got = m.expected.slice(0, want.length);
  return want.length === got.length && want.every((v, i) => v === got[i]);
}

/**
 * Replace the first N integers of the value cell positionally, preserving the
 * prose around them AND each number's own comma style — `1,077` becomes
 * `1,087`, not `1087`. Everything after the Nth integer is annotation and is
 * left exactly as the author wrote it.
 */
function rewriteValue(cell, measured) {
  let i = 0;
  return cell.replace(/\d[\d,]*/g, (tok) => {
    if (i >= measured.length) return tok;
    const hadCommas = tok.includes(",");
    const n = measured[i++];
    return hadCommas ? n.toLocaleString("en-US") : String(n);
  });
}

function currentSha() {
  const r = run("git rev-parse --short HEAD");
  return r.out.trim();
}

function renderTable(measured, sha) {
  const rows = [];
  rows.push(`| id | fact | command (run from the worktree root) | value @ ${sha} |`);
  rows.push("|---|---|---|---|");
  for (const m of measured) {
    const value = m.checkable ? rewriteValue(m.value, m.measured) : m.value;
    rows.push(`| ${m.id} | ${m.fact} | ${m.cmdCell} | ${value} |`);
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// --cite : every `path:line` resolves, and the line exists
// ---------------------------------------------------------------------------

/**
 * The repo's own citation-guard cannot see this form: its regex closes on the
 * file extension, so `foo.ts:341` is checked as `foo.ts` and the line number is
 * invisible. That is exactly the drift the fresh-hire audit found six of —
 * a path that still exists, pointing at a line that moved.
 */
const CITE = /`([A-Za-z0-9_./@-]+\.(?:ts|tsx|js|cjs|mjs|json|sh|md|yml|yaml|css|sql)):(\d+)(?:-(\d+))?`/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const lineCache = new Map();
function lineCount(file) {
  if (lineCache.has(file)) return lineCache.get(file);
  let n = 0;
  try {
    const s = fs.readFileSync(file, "utf8");
    n = s.length === 0 ? 0 : s.split("\n").length - (s.endsWith("\n") ? 1 : 0);
  } catch { n = -1; }
  lineCache.set(file, n);
  return n;
}

function checkCitations() {
  const problems = [];
  let checked = 0;
  let unresolvable = 0;
  for (const md of walk(HANDOFF_DIR)) {
    const lines = fs.readFileSync(md, "utf8").split("\n");
    lines.forEach((line, idx) => {
      for (const m of line.matchAll(CITE)) {
        const [, p, aStr, bStr] = m;
        const target = path.join(ROOT, p);
        if (!fs.existsSync(target)) {
          // Bare basenames (`sla.test.ts:12`) and deliberately-absent files are
          // the citation-guard's business, not ours. We only judge line numbers
          // on paths that resolve from the repo root.
          unresolvable++;
          continue;
        }
        checked++;
        const n = lineCount(target);
        const hi = bStr ? Number(bStr) : Number(aStr);
        const lo = Number(aStr);
        if (lo < 1 || hi > n || lo > hi) {
          problems.push(`${rel(md)}:${idx + 1}  ->  ${p}:${aStr}${bStr ? "-" + bStr : ""}  (file has ${n} lines)`);
        }
      }
    });
  }
  return { problems, checked, unresolvable };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const rel = (p) => path.relative(ROOT, p);
function fail(msg) { console.error(`handoff-facts: ${msg}`); process.exit(1); }

function usage() {
  console.log(`handoff-facts — re-run every row of ${rel(FACTS)}

  node scripts/handoff-facts.cjs --table     print the regenerated table
  node scripts/handoff-facts.cjs --write     rewrite the generated block + re-stamp the SHA
  node scripts/handoff-facts.cjs --check     exit 1 when a checkable row disagrees
  node scripts/handoff-facts.cjs --cite      exit 1 on a missing or out-of-range path:line
  ... --check --verbose                      print every row, not only failures

Runs from the repo root; safe to run in any worktree. In no CI job by design.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (!argv.length || has("--help") || has("-h")) { usage(); process.exit(0); }

let exitCode = 0;

if (has("--table") || has("--write") || has("--check")) {
  const { doc, a, b, rows } = readFacts();
  if (!rows.length) fail(`parsed 0 rows from ${rel(FACTS)} — the table shape changed. Fix the parser, do not lower the bar.`);

  const measured = rows.map(measure);
  const sha = currentSha();

  const checkable = measured.filter((m) => m.checkable);
  const uncheckable = measured.filter((m) => !m.checkable);
  const disagree = checkable.filter((m) => agrees(m) === false);

  if (has("--table")) {
    console.log(renderTable(measured, sha));
    process.exit(0);
  }

  if (has("--write")) {
    // The one way this tool can corrupt the file it maintains: run it from a
    // feature branch. F-31 counts commits reachable from HEAD and the stamp
    // names the commit, so --write here would record the BRANCH as the verified
    // state of `main` — a wrong number carrying a generator's authority, which
    // is worse than the stale one it replaced. Refuse, and say how to proceed.
    const ahead = run("git rev-list --count origin/main..HEAD").out.trim();
    if (ahead && ahead !== "0" && !has("--force")) {
      console.error(`handoff-facts: refusing to --write from a branch ${ahead} commit(s) ahead of origin/main.`);
      console.error("  FACTS.md records the verified state of `main`, and two rows measure HEAD:");
      console.error("  F-31 (commits on `main`) and the SHA stamp. Writing here would stamp the branch.");
      console.error("");
      console.error("  Do this instead — derive on main, then bring the block onto your branch:");
      console.error("    git worktree add /tmp/hq-facts-main origin/main");
      console.error("    cd /tmp/hq-facts-main && pnpm install --frozen-lockfile");
      console.error("    node scripts/handoff-facts.cjs --write");
      console.error("");
      console.error("  --force overrides, and is correct in exactly one case: a docs-only branch that");
      console.error("  has not moved any measured code, where you accept the branch SHA as the stamp.");
      process.exit(1);
    }
    let next = doc.slice(0, a + BEGIN.length) + "\n\n" + renderTable(measured, sha) + "\n\n" + doc.slice(b);
    // Re-stamp the two header lines that name the commit, so the file cannot
    // claim a SHA its numbers were not measured at.
    const full = run("git rev-parse HEAD").out.trim();
    next = next.replace(
      /^> \*\*Verified against\*\* `origin\/main` @ \*\*[0-9a-f]+\*\* \(full `[0-9a-f]+`\)\./m,
      `> **Verified against** \`origin/main\` @ **${sha}** (full \`${full}\`).`
    );
    fs.writeFileSync(FACTS, next);
    console.log(`handoff-facts: rewrote ${rows.length} rows in ${rel(FACTS)} @ ${sha}. Commit it.`);
    if (uncheckable.length) {
      console.log(`handoff-facts: ${uncheckable.length} row(s) left verbatim (output is not purely numeric) — verify by hand:`);
      for (const m of uncheckable) console.log(`    ${m.id}  ${m.fact}`);
    }
    process.exit(0);
  }

  // --check
  console.log(`handoff-facts: ${rows.length} rows · ${checkable.length} checkable · ${uncheckable.length} not machine-comparable`);
  // FACTS.md's discipline is "run in a clean worktree of the stamped commit".
  // On a feature branch that is not true, and two rows will always look wrong
  // for a reason that is not drift: F-31 counts commits reachable from HEAD,
  // and the stamp names main. Say so, rather than letting a reader learn to
  // ignore a red they were never told was expected.
  const ahead = run("git rev-list --count origin/main..HEAD").out.trim();
  if (ahead && ahead !== "0") {
    console.log(`  CONTEXT    HEAD is ${ahead} commit(s) ahead of origin/main. F-31 (commits on \`main\`) and the`);
    console.log(`             SHA stamp measure HEAD, so both will differ here by design. Judge them from a`);
    console.log(`             clean worktree of origin/main; everything else is branch-independent.`);
  }
  for (const m of measured) {
    const verdict = agrees(m);
    if (verdict === false) {
      console.log(`  DISAGREES  ${m.id}  ${m.fact}`);
      console.log(`             doc says   ${m.expected.slice(0, m.measured.length).join(" · ") || "(no number)"}`);
      console.log(`             command    ${m.measured.join(" · ")}`);
      console.log(`             $ ${m.cmd}`);
    } else if (VERBOSE) {
      console.log(`  ${verdict === null ? "not-comparable" : "ok            "}  ${m.id}  ${m.fact}`);
    }
  }
  if (uncheckable.length && !VERBOSE) {
    console.log(`  the ${uncheckable.length} not machine-comparable row(s): ${uncheckable.map((m) => m.id).join(", ")}`);
    console.log("  (their commands print prose, not a number — re-read them by hand on a refresh)");
  }

  const stamped = (readFacts().doc.match(/\*\*Verified against\*\* `origin\/main` @ \*\*([0-9a-f]+)\*\*/) || [])[1];
  if (stamped && stamped !== sha) {
    console.log(`  STAMP      FACTS.md says @ ${stamped}; HEAD is ${sha}. Re-run with --write after re-reading the prose.`);
    exitCode = 1;
  }

  if (disagree.length) {
    console.log(`\nFAIL  ${disagree.length} row(s) disagree with the live measurement.`);
    console.log("      A number moving is not a bug — it is the corpus doing its job. Run --write,");
    console.log("      then grep the chapters for each OLD value and fix the prose in the same commit:");
    console.log('        grep -rn "<old value>" knowledge-base/handoff/*.md');
    exitCode = 1;
  } else if (!exitCode) {
    console.log("\nhandoff-facts: every checkable row agrees with its command. ✅");
  }
}

if (has("--cite")) {
  const { problems, checked, unresolvable } = checkCitations();
  console.log(`handoff-facts --cite: ${checked} resolvable path:line citation(s) checked · ${unresolvable} skipped (path does not resolve from the repo root — that is citation-guard's job)`);
  if (problems.length) {
    console.log(`\nFAIL  ${problems.length} citation(s) point past the end of the file, or backwards:`);
    for (const p of problems) console.log(`      ${p}`);
    console.log("\n      A path that still exists pointing at a line that moved is the drift this");
    console.log("      catches: the reader follows it, lands on unrelated code, and trusts it.");
    exitCode = 1;
  } else {
    console.log("handoff-facts --cite: every citation lands inside its file. ✅");
  }
}

process.exit(exitCode);
