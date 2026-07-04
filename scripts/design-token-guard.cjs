#!/usr/bin/env node
/**
 * Design-token ratchet guard (zero-dep).
 *
 * The "Obsidian Indigo" system routes all color through semantic tokens
 * (bg-background, text-muted-foreground, bg-success-subtle, the <Badge>/<Alert>
 * variants, …). Raw Tailwind palette utilities (text-emerald-600, bg-amber-100,
 * bg-blue-900, …) bypass the system AND frequently fail WCAG AA — e.g. amber
 * text on the Paper Ice canvas is 1.98:1. See client/src/index.css.
 *
 * This guard counts raw-palette occurrences under client/src and compares to a
 * committed baseline:
 *   • count > baseline  -> FAIL (a new violation was introduced) + list offenders
 *   • count < baseline  -> tighten the baseline to the new low and PASS
 *   • count == baseline -> PASS
 *
 * The ratchet means the number can only ever go down. Migrate a page onto tokens
 * and the baseline auto-tightens on the next run; try to add a raw color and CI
 * blocks it. Run: `node scripts/design-token-guard.cjs`
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
// A palette utility, optionally variant-prefixed (dark:, hover:, md:, …).
// Lookbehind rejects mid-identifier matches; the color name list excludes every
// semantic token (primary, muted, success, …) so only raw palette usage counts.
const RE = new RegExp(
  `(?<![a-zA-Z0-9-])(?:${PROP})-(?:${COLOR})-(?:${SHADE})(?![a-zA-Z0-9])`,
  "g",
);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const perFile = [];
let total = 0;
for (const file of walk(SCAN_DIR)) {
  const matches = fs.readFileSync(file, "utf8").match(RE);
  if (matches && matches.length) {
    perFile.push([path.relative(ROOT, file), matches.length]);
    total += matches.length;
  }
}
perFile.sort((a, b) => b[1] - a[1]);

let baseline = null;
if (fs.existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")).rawColorOccurrences;
}

const writeBaseline = (n) =>
  fs.writeFileSync(
    BASELINE_FILE,
    JSON.stringify({ rawColorOccurrences: n, updated: new Date().toISOString().slice(0, 10) }, null, 2) + "\n",
  );

if (baseline === null) {
  writeBaseline(total);
  console.log(`design-token-guard: bootstrapped baseline at ${total} raw-palette occurrences.`);
  process.exit(0);
}

if (total > baseline) {
  console.error(
    `FAIL  design-token-guard: raw palette color usage rose ${baseline} -> ${total} (+${total - baseline}).`,
  );
  console.error("      Use a semantic token or a <Badge>/<Alert> variant instead of a raw palette color.");
  console.error("      Top files with raw palette colors:");
  for (const [f, n] of perFile.slice(0, 8)) console.error(`        ${String(n).padStart(4)}  ${f}`);
  process.exit(1);
}

if (total < baseline) {
  writeBaseline(total);
  console.log(`design-token-guard: ratcheted down ${baseline} -> ${total}. Baseline tightened. ✅`);
  process.exit(0);
}

console.log(`design-token-guard: ${total} raw-palette occurrences (at baseline, no regression). ✅`);
process.exit(0);
