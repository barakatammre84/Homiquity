#!/usr/bin/env node
/**
 * Design-token ratchet guard (zero-dep).
 *
 * The "Charcoal Emerald" system routes all color through semantic tokens
 * (bg-background, text-muted-foreground, bg-success-subtle, the <Badge>/<Alert>
 * variants, …). See client/src/index.css. Two things bypass it:
 *
 *   1. rawColorOccurrences — raw Tailwind palette utilities (text-emerald-600,
 *      bg-amber-100, bg-blue-900, …). These also frequently fail WCAG AA (amber
 *      text on the white canvas is ~1.98:1). Hard target: 0.
 *   2. whiteBlackLiterals — bare white/black utilities (bg-white, text-white,
 *      bg-black). Sometimes legitimate (white type on a dark hero) but usually a
 *      token dodge for text-primary-foreground / bg-card / bg-background. The
 *      shade-only regex above can't see these, so they get their own metric —
 *      tracked and ratcheted down, not banned outright.
 *
 * For each metric the guard counts occurrences under client/src vs a committed
 * baseline:
 *   • count > baseline  -> FAIL (a regression) + list offender files
 *   • count < baseline  -> tighten the baseline to the new low and PASS
 *   • count == baseline -> PASS
 *
 * The ratchet means each number can only ever go down. Run:
 *   node scripts/design-token-guard.cjs
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIR = path.join(ROOT, "client", "src");
const BASELINE_FILE = path.join(__dirname, "design-token-baseline.json");

const PROP =
  "bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|placeholder|caret|accent|shadow";
const COLOR =
  "gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const SHADE = "50|100|200|300|400|500|600|700|800|900|950";

// Each metric: a key in the baseline file, a matcher, and a remediation hint.
// Lookbehind rejects mid-identifier matches; the palette color list excludes
// every semantic token (primary, muted, success, …) so only raw usage counts.
const METRICS = [
  {
    key: "rawColorOccurrences",
    label: "raw palette color",
    re: new RegExp(`(?<![a-zA-Z0-9-])(?:${PROP})-(?:${COLOR})-(?:${SHADE})(?![a-zA-Z0-9])`, "g"),
    hint: "Use a semantic token or a <Badge>/<Alert> variant instead of a raw palette color.",
  },
  {
    key: "whiteBlackLiterals",
    label: "bare white/black literal",
    re: new RegExp(`(?<![a-zA-Z0-9-])(?:${PROP})-(?:white|black)(?![a-zA-Z0-9-])`, "g"),
    hint: "Prefer a token (text-primary-foreground, bg-card, bg-background) unless it's type on a dark hero.",
  },
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = walk(SCAN_DIR);
for (const m of METRICS) {
  m.total = 0;
  m.perFile = [];
}
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of METRICS) {
    const matches = src.match(m.re);
    if (matches && matches.length) {
      m.perFile.push([path.relative(ROOT, file), matches.length]);
      m.total += matches.length;
    }
  }
}
for (const m of METRICS) m.perFile.sort((a, b) => b[1] - a[1]);

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
    console.log(`design-token-guard: bootstrapped ${m.label} baseline at ${m.total}.`);
  } else if (m.total > base) {
    failed = true;
    console.error(
      `FAIL  design-token-guard: ${m.label} usage rose ${base} -> ${m.total} (+${m.total - base}).`,
    );
    console.error(`      ${m.hint}`);
    console.error("      Top files:");
    for (const [f, n] of m.perFile.slice(0, 8)) console.error(`        ${String(n).padStart(4)}  ${f}`);
  } else if (m.total < base) {
    nextBaseline[m.key] = m.total;
    changed = true;
    console.log(`design-token-guard: ${m.label} ratcheted down ${base} -> ${m.total}. Baseline tightened. ✅`);
  } else {
    console.log(`design-token-guard: ${m.total} ${m.label} occurrences (at baseline, no regression). ✅`);
  }
}

if (failed) process.exit(1);
if (changed) {
  nextBaseline.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(nextBaseline, null, 2) + "\n");
}
process.exit(0);
