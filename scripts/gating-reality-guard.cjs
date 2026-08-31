#!/usr/bin/env node
/**
 * GATING-REALITY GUARD (zero-dep).
 *
 * A completeness scorer marks a field `required`. Nothing in the product ever
 * collects that field. Every real file therefore fails the gate forever, while
 * every seeded and fixtured file sails through it — so the suite is green and
 * the gate is impassable.
 *
 * That is not hypothetical. #491 (42813a0d0e2e, 2026-08-12):
 *
 *   "fix(urla): section 5 required a citizenship column nothing writes,
 *    blocking every application"
 *
 * and its own commentary names the mechanism exactly:
 *
 *   "It went unnoticed because server/scripts/seedDemoFile.ts sets the field,
 *    so demo files passed the gate that no genuine file could."
 *
 * Scored against the 45 real shipped defects of 2026-07-03..08-23, this check
 * is worth 2/45 — more than any intervention that was actually proposed at the
 * time, none of which scored above zero.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT CHECKS
 *
 *   For every field a gating scorer marks `required`, at least one file under
 *   client/src must name that field. If none does, no borrower can ever supply
 *   it, and the requirement is unsatisfiable.
 *
 * WHY THIS RULE AND NOT AN OBVIOUS ONE. Two broader formulations were measured
 * against the live tree first and BOTH are unusable — recorded so they are not
 * rebuilt:
 *
 *   "column written by fixtures/seeds, read by product, no product writer"
 *       -> 53 false positives. server/routes/borrower/urla.ts writes whole
 *          sections via `...pickTableFields(URLA_TABLES.declarations, …)`, a
 *          generic spread that no `field:` regex can see. It flagged the entire
 *          declarations set, every member of which IS written.
 *
 *   "…and additionally no client surface names it"
 *       -> 179. Worse, because MOST columns correctly have no client surface:
 *          passwordHash, ssnEncrypted, entryHash, and every ULDD field in
 *          shared/schema/delivery.ts are all server-computed by design.
 *
 * Narrowing to fields a scorer REQUIRES is what makes the signal clean: a
 * server-computed column is never `required` of the borrower, so the whole
 * false-positive class disappears. 57 required fields -> 6 real findings.
 *
 * ---------------------------------------------------------------------------
 * TWO DESIGN CHOICES THAT ARE LOAD-BEARING
 *
 * 1. SCOPE IS DISCOVERED, NEVER HAND-LISTED. Scorers are found by walking
 *    server/services for the descriptor shape, not by naming files here. A
 *    hand-listed scope is the defect in 75ea2762d0ea (#606) — the conforming-
 *    limit test named one seed file, so the stale 2024 limit lived on in a file
 *    it did not name, and every borrower between $766,500 and $806,500 was told
 *    a conforming loan was jumbo. A guard that picks its own subjects checks
 *    whatever it happens to remember.
 *
 * 2. THE BASELINE IS A NAMED SET, NOT A COUNT. The sibling ratchets in this
 *    directory count occurrences. That is right for them and wrong here: fix
 *    one unsatisfiable field, introduce another, and a count-based baseline
 *    stays level and reports success. Silently swapping one instance of a
 *    defect for another is the same shape as the defect itself. New name ->
 *    FAIL, even when the total is unchanged.
 *
 *   • a required field with no client surface, not in the baseline -> FAIL
 *   • a baselined name that is now satisfied  -> drop it, tighten, PASS
 *   • unchanged                               -> PASS
 *
 * Run:  node scripts/gating-reality-guard.cjs
 *       node scripts/gating-reality-guard.cjs --update   (accept the new set)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASELINE_FILE = path.join(__dirname, "gating-reality-baseline.json");
const UPDATE = process.argv.includes("--update");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".claude"]);

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, acc);
    else if (exts.some((e) => entry.name.endsWith(e))) acc.push(full);
  }
  return acc;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

// ---------------------------------------------------------------------------
// 1. Discover gating scorers
// ---------------------------------------------------------------------------
// The descriptor shape this repo uses for a completeness section is an array of
// `{ name: "...", value: <expr>, required: <expr> }`. Discovery is deliberately
// structural — a file qualifies by containing that shape, never by being named
// in this script. See design choice (1) above.
const DESCRIPTOR = /\{\s*name:\s*"([^"]+)"\s*,\s*value:\s*([\s\S]*?),\s*required:\s*([^,}]+)/g;

function findScorers() {
  return walk(path.join(ROOT, "server", "services"), [".ts"])
    .filter((f) => !f.endsWith(".test.ts"))
    .map((f) => ({ file: f, src: fs.readFileSync(f, "utf8") }))
    .filter((s) => {
      DESCRIPTOR.lastIndex = 0;
      return DESCRIPTOR.test(s.src);
    });
}

// ---------------------------------------------------------------------------
// 2. Extract the fields each scorer REQUIRES
// ---------------------------------------------------------------------------
// `required` is an expression, not always a literal: `required: true`,
// `required: isVa`, `required: false`. Anything that is not literally `false`
// can require the field for some borrower, so only an explicit `false` is
// exempt — a conditional requirement still blocks the borrowers it applies to,
// which is exactly the VA case this guard first found.
function requiredFieldsOf(src) {
  const out = new Map(); // identifier -> descriptor label
  let m;
  DESCRIPTOR.lastIndex = 0;
  while ((m = DESCRIPTOR.exec(src)) !== null) {
    const [, label, valueExpr, requiredExpr] = m;
    if (/^\s*false\s*$/.test(requiredExpr)) continue;
    // Pull every property access out of the value expression. Digits are part
    // of an identifier — truncating at one turns hasOwnershipInterestInPast3Years
    // into a name that matches nothing and reports a phantom finding.
    for (const idm of valueExpr.matchAll(/\??\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const id = idm[1];
      if (["length", "toString", "map", "filter", "some", "trim"].includes(id)) continue;
      if (!out.has(id)) out.set(id, label.trim());
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Does any client surface name the field?
// ---------------------------------------------------------------------------
const clientSources = walk(path.join(ROOT, "client", "src"), [".ts", ".tsx"])
  .filter((f) => !/\.test\.tsx?$/.test(f))
  .map((f) => ({ file: f, src: fs.readFileSync(f, "utf8") }));

const clientNames = (() => {
  const set = new Set();
  for (const { src } of clientSources) {
    for (const m of src.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) set.add(m[0]);
  }
  return set;
})();

// ---------------------------------------------------------------------------
// 4. Compare against the baseline
// ---------------------------------------------------------------------------
const findings = [];
for (const { file, src } of findScorers()) {
  for (const [field, label] of requiredFieldsOf(src)) {
    if (clientNames.has(field)) continue;
    findings.push({ key: `${rel(file)}::${field}`, field, label, file: rel(file) });
  }
}
findings.sort((a, b) => a.key.localeCompare(b.key));

const baseline = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  : null;

if (!baseline) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ unsatisfiable: findings.map((f) => f.key) }, null, 2) + "\n",
  );
  console.log(`gating-reality-guard: bootstrapped baseline with ${findings.length} known finding(s).`);
  console.log("  Review them — each is a gate no borrower can pass.");
  for (const f of findings) console.log(`    ${f.key}  (${f.label})`);
  process.exit(0);
}

const known = new Set(baseline.unsatisfiable || []);
const current = new Set(findings.map((f) => f.key));
const added = findings.filter((f) => !known.has(f.key));
const fixed = [...known].filter((k) => !current.has(k));

if (added.length) {
  console.error(
    `\ngating-reality-guard: ${added.length} NEW required field(s) that no client surface produces.\n`,
  );
  for (const f of added) {
    console.error(`  ✗ ${f.file}`);
    console.error(`      field    : ${f.field}`);
    console.error(`      gates    : ${f.label}`);
    console.error(`      problem  : marked required, but nothing under client/src names it, so no`);
    console.error(`                 real borrower can ever satisfy it. Seeds and fixtures can.`);
  }
  console.error(
    `\n  This is the #491 shape: "section 5 required a citizenship column nothing writes,\n` +
      `  blocking every application". Either give the field a real client surface, or drop the\n` +
      `  requirement with the reasoning written down — #491 removed its gate rather than\n` +
      `  inventing a collector. Do NOT backfill a value to make the gate pass.\n`,
  );
  process.exit(1);
}

if (fixed.length && !UPDATE) {
  // Tightening is automatic and safe: the set only shrinks.
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ unsatisfiable: [...current].sort() }, null, 2) + "\n",
  );
  console.log(`gating-reality-guard: ${fixed.length} field(s) now satisfiable — baseline tightened. ✅`);
  for (const k of fixed) console.log(`    fixed: ${k}`);
  process.exit(0);
}

if (UPDATE) {
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ unsatisfiable: [...current].sort() }, null, 2) + "\n",
  );
  console.log(`gating-reality-guard: baseline written with ${current.size} entry/entries.`);
  process.exit(0);
}

console.log(
  `gating-reality-guard: ${findings.length} known unsatisfiable gate(s), none new. ✅`,
);
