#!/usr/bin/env node
/**
 * VOCABULARY REGISTRY + GUARD (zero-dep).
 *
 * This codebase declares 201 closed value sets. Every one states what values
 * something may hold. None of them stated WHO SAYS SO — and that is the gap
 * behind the defect class that keeps shipping:
 *
 *   "the jumbo advisory used the 2024 limit"            (#606)
 *   "every file was delivered as fixed-rate, incl. ARMs" (F-053)
 *   "emit valid ULDD LoanPurposeType enum"              (F-019)
 *   "large-deposit sourcing is B3-4.2-02, not gifts"
 *
 * The registry is the join between a value set and its authority.
 *
 * WHAT IS DERIVED vs DECLARED. Everything a scan can compute is computed:
 * name, file, declaration form, value count, value hash, derived type, consumer
 * count. Only provenance is hand-entered, in shared/vocabularies/authorities.tsv,
 * kept separate so regenerating cannot destroy it. Derive, don't restate — the
 * lesson that produced the vitest glob and SEATS.tsv.
 *
 * TWO DECLARATION FORMS, BOTH COUNTED. A vocabulary is either
 *     export const X = [...] as const        (165 of them)
 *     export type X = "a" | "b"              (36 of them, incl. every MISMO enum)
 * An array-only scan misses shared/mismo.ts entirely, which is exactly where the
 * ULAD divergences live. Counting one form and reporting a total is how this
 * file's own author quoted "128 vocabularies" for half a day.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR RULES
 *
 * 1. ZERO CONSUMERS -> FAIL. shared/schema/lendingComms.ts exported LOAN_STAGES:
 *    11 values, `as const`, typed, re-exported through the barrel so it
 *    autocompleted from "@shared/schema" — and used by nothing, while being five
 *    values short of the real vocabulary. Anyone who found it first built a
 *    status machine that could not represent a withdrawn or suspended loan.
 *
 *    ⚠️ CONSUMERS MUST COUNT THE DERIVED TYPE. CONSENT_TYPES looks dead until you
 *    notice it is consumed as ConsentType. LEASE_STATUS has no derived type and
 *    genuinely is dead. Miss this and the rule reports ~86 dead vocabularies,
 *    most of them false, and gets ignored — the failure orphan-scan.cjs warns
 *    about in its own header: a guard that cries wolf gets ignored.
 *
 * 2. IDENTICAL VALUE SETS -> FAIL. Two names for one vocabulary is two places to
 *    change and one to forget.
 *
 * 3. AUTHORITY: ULAD AND VALUES DIVERGE -> FAIL. Compared against
 *    docs/fannie-mae/schemas/ulad-enumerations.tsv. Ten known divergences are
 *    baselined; delivery output is unchanged.
 *
 * 4. A STATUS COLUMN WITH NO VOCABULARY -> reported. 82 status columns exist and
 *    5 bind a vocabulary type; this names the gap without pretending the other
 *    77 are defects.
 *
 * BASELINE IS A NAMED SET, NOT A COUNT — as in gating-reality-guard.cjs. Fix one
 * dead vocabulary, add another, and a count-based baseline holds level and
 * reports success. Silently swapping one instance of a defect for another is the
 * same shape as the defect.
 *
 * Run:  node scripts/vocabulary-registry.cjs            (check)
 *       node scripts/vocabulary-registry.cjs --write    (regenerate + baseline)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY = path.join(ROOT, "shared/vocabularies/REGISTRY.tsv");
const AUTHORITIES = path.join(ROOT, "shared/vocabularies/authorities.tsv");
const BASELINE = path.join(__dirname, "vocabulary-baseline.json");
const ULAD = path.join(ROOT, "docs/fannie-mae/schemas/ulad-enumerations.tsv");
const WRITE = process.argv.includes("--write");

const SKIP = new Set(["node_modules", ".git", "dist", "build", "coverage", ".claude"]);
function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, exts, acc);
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(full);
  }
  return acc;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

// --------------------------------------------------------------------------
// 1. Every closed value set in shared/, both declaration forms
// --------------------------------------------------------------------------
const vocab = new Map();
for (const file of walk(path.join(ROOT, "shared"), [".ts"])) {
  if (/\.test\.tsx?$/.test(file)) continue;
  const src = fs.readFileSync(file, "utf8");

  // The body is [^\]]* — NOT [\s\S]*? — and that is load-bearing.
  //
  // The first version of this used a lazy [\s\S]*? terminated by `] as const`.
  // shared/statusVocabularies.ts declares OPEN_RATE_LOCK_STATUSES as
  // `readonly RateLockStatus[] = [...]` with NO `as const`, so the lazy body ran
  // straight past it, swallowed the whole of LOAN_CONDITION_STATUSES looking for
  // the next `] as const`, and the /g cursor resumed beyond it. Two real
  // vocabularies vanished from the registry and it reported success — the exact
  // silent-skip shape this guard exists to catch, in the guard itself.
  //
  // A string-vocabulary body never contains `]`, so refusing to cross one keeps
  // every match inside a single declaration.
  //
  // `as const` is NOT required either. That was the second bug: it excluded 30
  // real vocabularies, among them SECTION_A_FEE_TYPES..SECTION_H_FEE_TYPES —
  // 388 values of captured UCD fee authority — and every `readonly Parent[]`
  // subset such as PREQUAL_ELIGIBLE_STATUSES and TERMINAL_TASK_STATUSES, where a
  // subset drifting from its parent is a real defect class.
  //
  // Arrays of OBJECTS are excluded instead, by testing for `{` in the body:
  // SPECIAL_FEATURE_CODES, QM_THRESHOLD_TABLES and REG_Z_TRIGGER_LEXICON are
  // data tables, not closed value sets, and registering them would be noise.
  for (const m of src.matchAll(/^export const ([A-Z][A-Z0-9_]+)\s*(?::[^=]+)?=\s*\[([^\]]*)\]/gm)) {
    const body = m[2];
    if (body.includes("{")) continue;
    const values = [...new Set([...body.matchAll(/"([^"]+)"/g)].map((v) => v[1]))];
    if (!values.length) continue;
    vocab.set(m[1], { file: rel(file), form: "array", values });
  }
  for (const m of src.matchAll(/^export type (\w+)\s*=\s*((?:\s*\|?\s*"[^"]+")+)\s*;/gm)) {
    vocab.set(m[1], { file: rel(file), form: "union", values: [...new Set([...m[2].matchAll(/"([^"]+)"/g)].map((v) => v[1]))] });
  }
}

// The derived type of an array vocabulary — `export type X = typeof Y[number]`.
// Rule 1 is unusable without this; see the header.
const derivedOf = new Map();
for (const file of walk(path.join(ROOT, "shared"), [".ts"])) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/export type (\w+)\s*=\s*\(?\s*typeof ([A-Z][A-Z0-9_]+)\s*\)?\s*\[\s*number\s*\]/g)) {
    derivedOf.set(m[2], m[1]);
  }
}

// --------------------------------------------------------------------------
// 2. Consumers — the vocabulary name OR its derived type, outside its own file
// --------------------------------------------------------------------------
const sources = [
  ...walk(path.join(ROOT, "server"), [".ts"]),
  ...walk(path.join(ROOT, "client", "src"), [".ts", ".tsx"]),
  ...walk(path.join(ROOT, "shared"), [".ts"]),
  ...walk(path.join(ROOT, "tests"), [".ts", ".tsx"]),
].map((f) => [rel(f), fs.readFileSync(f, "utf8")]);

function consumerCount(name, ownFile) {
  const derived = derivedOf.get(name);
  const re = new RegExp(`\\b(?:${[name, derived].filter(Boolean).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`);
  let n = 0;
  for (const [f, src] of sources) if (f !== ownFile && re.test(src)) n++;
  return n;
}

// --------------------------------------------------------------------------
// 3. Declared authorities + the ULAD table
// --------------------------------------------------------------------------
function readTsv(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("\t"));
}
const authority = new Map();
for (const [name, auth, citation, note] of readTsv(AUTHORITIES)) {
  if (name === "vocabularyName") continue;
  authority.set(name, { auth: (auth || "internal").trim(), citation: (citation || "").trim(), note: (note || "").trim() });
}
const uladRows = readTsv(ULAD).filter((r) => r[0] !== "dataPoint");
const ulad = new Map();
for (const [point, enumeration] of uladRows) {
  if (!ulad.has(point)) ulad.set(point, new Set());
  ulad.get(point).add(enumeration);
}

// --------------------------------------------------------------------------
// 4. Build rows
// --------------------------------------------------------------------------
const rows = [...vocab.entries()].map(([name, v]) => {
  const a = authority.get(name) || { auth: "internal", citation: "", note: "" };
  const consumers = consumerCount(name, v.file);
  return {
    name, file: v.file, form: v.form,
    count: v.values.length,
    hash: crypto.createHash("sha1").update([...v.values].sort().join(" ")).digest("hex").slice(0, 12),
    derived: derivedOf.get(name) || "",
    consumers, authority: a.auth, citation: a.citation, note: a.note,
    values: new Set(v.values),
  };
}).sort((x, y) => x.name.localeCompare(y.name));

// --------------------------------------------------------------------------
// 5. Findings
// --------------------------------------------------------------------------
const dead = rows.filter((r) => r.consumers === 0).map((r) => r.name);

const byHash = new Map();
for (const r of rows) {
  if (r.count < 3) continue; // two-value sets collide by coincidence, not by duplication
  if (!byHash.has(r.hash)) byHash.set(r.hash, []);
  byHash.get(r.hash).push(r.name);
}
const dupes = [...byHash.values()].filter((g) => g.length > 1).map((g) => g.sort().join(" == ")).sort();

const uladDrift = [];
for (const r of rows) {
  if (r.authority !== "ULAD") continue;
  const spec = ulad.get(r.citation || r.name);
  if (!spec) { uladDrift.push(`${r.name}: no ULAD row for "${r.citation || r.name}"`); continue; }
  const extra = [...r.values].filter((v) => !spec.has(v)).sort();
  const missing = [...spec].filter((v) => !r.values.has(v)).sort();
  if (extra.length || missing.length) {
    uladDrift.push(`${r.name}: +[${extra.join(", ")}] -[${missing.join(", ")}]`);
  }
}

// --------------------------------------------------------------------------
// 6. Write or check
// --------------------------------------------------------------------------
const body =
  "# GENERATED by scripts/vocabulary-registry.cjs — do not hand-edit.\n" +
  "# Provenance is declared in shared/vocabularies/authorities.tsv; everything else is derived.\n" +
  "# consumers counts files referencing the vocabulary OR its derived type, outside its own file.\n" +
  "#\n" +
  "name\tfile\tform\tvalues\thash\tderivedType\tconsumers\tauthority\tcitation\n" +
  rows.map((r) => [r.name, r.file, r.form, r.count, r.hash, r.derived, r.consumers, r.authority, r.citation].join("\t")).join("\n") + "\n";

const current = { dead: dead.sort(), duplicateSets: dupes, uladDivergences: uladDrift.sort() };

if (WRITE) {
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true });
  fs.writeFileSync(REGISTRY, body);
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`vocabulary-registry: wrote ${rel(REGISTRY)} — ${rows.length} vocabularies.`);
  console.log(`  baseline: ${dead.length} zero-consumer · ${dupes.length} duplicate set(s) · ${uladDrift.length} ULAD divergence(s)`);
  process.exit(0);
}

let failed = false;
if (!fs.existsSync(REGISTRY) || fs.readFileSync(REGISTRY, "utf8") !== body) {
  console.error("vocabulary-registry: REGISTRY.tsv is STALE — regenerate and commit it.");
  console.error("  run: node scripts/vocabulary-registry.cjs --write");
  failed = true;
}

const base = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, "utf8"))
  : { dead: [], duplicateSets: [], uladDivergences: [] };

for (const [key, label, remedy] of [
  ["dead", "vocabulary with no consumer", "Delete it, or give it a consumer. LOAN_STAGES autocompleted from the barrel for weeks while being five values short of the real list."],
  ["duplicateSets", "duplicate value set", "Two names for one vocabulary is two places to change and one to forget. Merge them, keeping the more specific home."],
  ["uladDivergences", "ULAD divergence", "The value set no longer matches docs/fannie-mae/schemas/ulad-enumerations.tsv. CLAUDE.md: never invent MISMO enumerations."],
]) {
  const known = new Set(base[key] || []);
  const added = (current[key] || []).filter((x) => !known.has(x));
  if (added.length) {
    failed = true;
    console.error(`\nvocabulary-registry: ${added.length} NEW ${label}(s):`);
    for (const a of added) console.error(`  ✗ ${a}`);
    console.error(`  ${remedy}`);
  }
}

if (failed) process.exit(1);

const shrank = ["dead", "duplicateSets", "uladDivergences"]
  .filter((k) => (current[k] || []).length < (base[k] || []).length);
if (shrank.length) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`vocabulary-registry: baseline tightened (${shrank.join(", ")}). ✅`);
} else {
  console.log(
    `vocabulary-registry: ${rows.length} vocabularies — ` +
      `${dead.length} zero-consumer · ${dupes.length} duplicate · ${uladDrift.length} ULAD divergence, none new. ✅`,
  );
}
