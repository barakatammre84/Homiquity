#!/usr/bin/env node
/**
 * Doc-staleness ratchet guard (zero-dep).
 *
 * Living documentation is Claude's memory: CLAUDE.md, knowledge-base/**, the
 * skills and agents, the docs/ READMEs. The 2026-08-18 knowledge-file audit
 * (knowledge-base/logs/2026-08-18-knowledge-file-audit.md §2b) found that a
 * living doc can drift while its freshness line stays green — TEAM_PRACTICES
 * still routed writers to a roadmap section that no longer existed, to dead
 * kb/ paths, and to npm commands in a pnpm repo. The freshness guard attests
 * verification RECENCY; this one attests VOCABULARY: known-dead names may not
 * spread through living docs.
 *
 * Immutable history is deliberately excluded — knowledge-base/archive/**,
 * logs/**, routines/reports/**, and the append-only teardown raw notes. A
 * dated log carrying an old name is correct history, not rot (TEAM_PRACTICES
 * §2). Legitimate historical mentions inside living docs (the CICD former-name
 * banner, CHARTER §0's rename story) are absorbed by the baseline; the ratchet
 * means each count can only ever go down, so new stale references fail while
 * documented history stands.
 *
 *   node scripts/doc-staleness-guard.cjs          # ratchet check (CI / checkup)
 *   node scripts/doc-staleness-guard.cjs --list   # every hit, with line numbers
 *
 * Adding a metric: only for a rename/retirement that already burned a reader —
 * a noisy denylist converts this guard into boilerplate (TEAM_PRACTICES §9's
 * keep-the-triggers-narrow rule applies here too).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BASELINE_FILE = path.join(__dirname, "doc-staleness-baseline.json");
const LIST = process.argv.includes("--list");

// Immutable history — never scanned. Everything else tracked *.md is living.
const EXCLUDED = [
  /^knowledge-base\/archive\//,
  /^knowledge-base\/logs\//,
  /^knowledge-base\/routines\/reports\//,
  /^knowledge-base\/research\/better-teardown\/better-teardown-raw-notes\.md$/,
  /^knowledge-base\/runbooks\/CHANGE_LEDGER\.md$/, // append-only dated ledger — history
  // A document *about* dead vocabulary has to be allowed to name it. The doc-accuracy
  // routine's own skill lists the retired terms it hunts for, and its ledger quotes the
  // drift each DA-… row fixed; policing them here would make the guard fight the routine
  // that shares its purpose. Both are self-policing — the routine re-reads its ledger on
  // every tick (rail D2), and its skill is reviewed like any other.
  /^\.claude\/skills\/doc-accuracy\/SKILL\.md$/,
  /^knowledge-base\/doc-accuracy\/LEDGER\.md$/,
];

// Each metric names a rename/retirement that already cost a reader. Hints say
// what the living replacement is.
const METRICS = [
  {
    key: "kbPathRefs",
    label: "dead kb/ path",
    re: /(?<![\w./-])kb\//g,
    hint: "kb/ was renamed knowledge-base/ (archive history lives under knowledge-base/archive/).",
  },
  {
    key: "npmCommandRefs",
    label: "npm-as-instruction",
    re: /\bnpm (run|test|install|ci|audit)\b/g,
    hint: "The repo standard is pnpm (routines/CHARTER.md §2 standing facts).",
  },
  {
    key: "launchSprintRefs",
    label: "launch-sprint reference",
    re: /launch[- ]sprint/gi,
    hint: "The launch sprint is retired; the work queue is CTO_ROADMAP.md §0–§5 (Evening Triage owns §0–§3).",
  },
  {
    key: "oldRepoRefs",
    label: "old repo name",
    re: /MortgageStream/g,
    hint: "The repo is barakatammre84/Homiquity; label old-name mentions as history or remove them.",
  },
  {
    key: "deadHostRefs",
    label: "dead Vercel host",
    re: /mortgage-stream\.vercel\.app/g,
    hint: "Vercel is deleted (404); prod is Railway — machine probes use homiquity-production.up.railway.app.",
  },
];

const files = execSync("git ls-files '*.md'", { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !EXCLUDED.some((re) => re.test(f)));

for (const m of METRICS) {
  m.total = 0;
  m.perFile = [];
  m.hits = [];
}
for (const file of files) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const lines = src.split("\n");
  for (const m of METRICS) {
    let count = 0;
    lines.forEach((line, i) => {
      const matches = line.match(m.re);
      if (matches) {
        count += matches.length;
        if (LIST) m.hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
    if (count) {
      m.perFile.push([file, count]);
      m.total += count;
    }
  }
}
for (const m of METRICS) m.perFile.sort((a, b) => b[1] - a[1]);

if (LIST) {
  for (const m of METRICS) {
    console.log(`\n== ${m.label} (${m.total}) ==`);
    for (const h of m.hits) console.log("  " + h);
  }
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  : {};
const nextBaseline = { ...baseline };

let failed = false;
let changed = false;

for (const m of METRICS) {
  const base = typeof baseline[m.key] === "number" ? baseline[m.key] : null;
  if (base === null) {
    nextBaseline[m.key] = m.total;
    changed = true;
    console.log(`doc-staleness-guard: bootstrapped ${m.label} baseline at ${m.total}.`);
  } else if (m.total > base) {
    failed = true;
    console.error(`FAIL  doc-staleness-guard: ${m.label} rose ${base} -> ${m.total} (+${m.total - base}).`);
    console.error(`      ${m.hint}`);
    console.error("      Top files:");
    for (const [f, n] of m.perFile.slice(0, 8)) console.error(`        ${String(n).padStart(4)}  ${f}`);
    console.error("      Run with --list for exact lines.");
  } else if (m.total < base) {
    nextBaseline[m.key] = m.total;
    changed = true;
    console.log(`doc-staleness-guard: ${m.label} ratcheted down ${base} -> ${m.total}. Baseline tightened. ✅`);
  } else {
    console.log(`doc-staleness-guard: ${m.total} ${m.label} occurrences (at baseline, no regression). ✅`);
  }
}

if (failed) process.exit(1);
if (changed) {
  nextBaseline.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(nextBaseline, null, 2) + "\n");
}
process.exit(0);
