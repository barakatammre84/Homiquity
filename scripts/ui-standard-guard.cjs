#!/usr/bin/env node
/**
 * UI-standard ratchet guard (zero-dep).
 *
 * Companion to scripts/design-token-guard.cjs. That guard answers ONE question —
 * "is any colour bypassing the semantic tokens?" This one answers the rest of
 * DESIGN_SYSTEM.md's mechanically-checkable questions, because the standard was
 * adopted 2026-07-14 and then measured itself only in prose, which rotted:
 * the doc said "the 57% that opt out" while the real number had grown to 82%,
 * and it described three primitives as future work five weeks after they shipped.
 *
 * A number in prose goes stale silently. A number in a baseline file cannot.
 *
 * For each metric the guard counts hits under client/src vs a committed baseline:
 *   • count > baseline  -> FAIL (a regression) + list offender files
 *   • count < baseline  -> tighten the baseline to the new low and PASS
 *   • count == baseline -> PASS
 *
 * The ratchet means each number can only ever go down, so the propagation sweep
 * is irreversible once a batch lands. Run:  pnpm guard:ui
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD CANNOT SEE — read this before calling a green run "conformant".
 *
 * It is a text scan. It has no layout engine, no browser and no renderer, so it
 * cannot tell you that a screen is usable at 320px, that contrast passes AA,
 * that focus order is sane, or that a component looks right. It does not read
 * .css, .html, server/ or shared/. Its className metrics only see literal
 * double-quoted class strings — classes assembled in cn(), template literals or
 * cva variants are invisible to it, so every count here is a FLOOR, not a total.
 *
 * Green means "no new instances of seven specific mistakes". Nothing more.
 * (knowledge-base/routines/CHARTER.md §10: "A guard only answers its own question.")
 * ---------------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIR = path.join(ROOT, "client", "src");
const BASELINE_FILE = path.join(__dirname, "ui-standard-baseline.json");

/** The one file allowed to import lucide-react directly (it IS the registry). */
const ICON_REGISTRY = path.join("client", "src", "lib", "icons.ts");

/** PageShell itself owns the only legitimate min-h-screen (its `fullHeight` prop). */
const PAGE_SHELL = path.join("client", "src", "components", "PageShell.tsx");

const PALETTE =
  "gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const SHADE = "50|100|200|300|400|500|600|700|800|900|950";

/**
 * unit: "occurrence" counts every match; "file" counts each offending file once.
 * scan:  a function (src, relPath) => number of hits, or null to skip the file.
 */
const METRICS = [
  {
    key: "pageShellDrift",
    label: "PageShell drift (hand-rolled min-h-screen in a file that also imports PageShell)",
    unit: "file",
    hint:
      "Delete the hand-rolled wrapper and let <PageShell> own page geometry — DESIGN_SYSTEM.md, PageShell adoption checklist.",
    scan: (src, rel) =>
      rel !== PAGE_SHELL && /\bmin-h-screen\b/.test(src) && /\bPageShell\b/.test(src) ? 1 : 0,
  },
  {
    key: "directLucideImports",
    label: "direct lucide-react import (icon-registry drift)",
    unit: "file",
    hint:
      'Import by semantic name from "@/lib/icons" instead — one glyph per concept. DESIGN_SYSTEM.md, Iconography.',
    scan: (src, rel) =>
      rel === ICON_REGISTRY ? 0 : /from\s*["']lucide-react["']/.test(src) ? 1 : 0,
  },
  {
    key: "nestedInteractive",
    label: "nested interactive control (a link wrapping a button)",
    unit: "occurrence",
    hint:
      "Use <Button asChild> inside the link (45 sites already spell it that way) — a <button> inside an <a> is invalid HTML and breaks keyboard and AT navigation.",
    res: [
      /<Link\b(?![^>]*\basChild\b)[^>]*>\s*(?:\{[^{}]*\}\s*)?<Button\b(?![^>]*\basChild\b)/gs,
      /<Link\b(?![^>]*\basChild\b)[^>]*>\s*<button\b/gs,
      /<a\b[^>]*>\s*<Button\b(?![^>]*\basChild\b)/gs,
    ],
  },
  {
    key: "rawHexLiterals",
    label: "raw hex colour literal",
    unit: "occurrence",
    hint:
      "Use a semantic token. The design-token guard's regex is class-shaped and structurally cannot see a hex literal — this metric is that blind spot.",
    res: [/#[0-9a-fA-F]{6}\b/g],
  },
  {
    key: "arbitraryColorValues",
    label: "arbitrary colour value (bg-[…] / text-[…])",
    unit: "occurrence",
    hint:
      "Arbitrary values escape the token guard entirely. Use the semantic utility — every -subtle token IS mapped in tailwind.config.ts.",
    res: [
      new RegExp(
        `(?<![a-zA-Z0-9-])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|placeholder|caret|accent|shadow)-\\[`,
        "g",
      ),
    ],
  },
  {
    key: "blindSpotPaletteClasses",
    label: "palette class in a shape the token guard cannot see",
    unit: "occurrence",
    hint:
      "Same rule as the token guard: no raw palette colour. These spellings (border-t-*, ring-offset-*, divide-x-*) slip past its regex, so they are held at zero here.",
    res: [
      new RegExp(
        `(?<![a-zA-Z0-9-])(?:border-[trblxyse]|ring-offset|divide-[xy]|outline-offset)-(?:${PALETTE})-(?:${SHADE})(?![a-zA-Z0-9])`,
        "g",
      ),
    ],
  },
  {
    key: "unprefixedMultiColGrid",
    label: "multi-column grid with no responsive prefix (mobile breakage)",
    unit: "occurrence",
    hint:
      "A grid-cols-N with no sm:/md:/lg: sibling stays N columns at 320px. Start single-column and widen at a breakpoint — DESIGN_SYSTEM.md, Mobile invariants.",
    scan: (src) => {
      let hits = 0;
      for (const m of src.matchAll(/className="([^"]*)"/g)) {
        const cls = m[1];
        if (/(?<![a-z:])grid-cols-[2-9]/.test(cls) && !/(sm|md|lg|xl|2xl):grid-cols/.test(cls)) {
          hits += 1;
        }
      }
      return hits;
    },
  },
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.(tsx?|jsx?)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(SCAN_DIR);
for (const m of METRICS) {
  m.total = 0;
  m.perFile = [];
}

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, "utf8");
  for (const m of METRICS) {
    let hits = 0;
    if (m.scan) {
      hits = m.scan(src, rel);
    } else {
      for (const re of m.res) {
        re.lastIndex = 0;
        const found = src.match(re);
        if (found) hits += found.length;
      }
    }
    if (hits > 0) {
      m.perFile.push([rel, hits]);
      m.total += m.unit === "file" ? 1 : hits;
    }
  }
}

let baseline = {};
if (fs.existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
}

let failed = false;
let tightened = false;
const nextBaseline = { ...baseline };

for (const m of METRICS) {
  const base = baseline[m.key];
  if (typeof base !== "number") {
    nextBaseline[m.key] = m.total;
    tightened = true;
    console.log(`BOOTSTRAP  ${m.key}: ${m.total} ${m.unit}(s) — baseline created.`);
    continue;
  }
  if (m.total > base) {
    failed = true;
    console.error(`\nFAIL  ${m.key}: ${m.total} ${m.unit}(s), baseline ${base} (+${m.total - base})`);
    console.error(`      ${m.label}`);
    console.error(`      → ${m.hint}`);
    const worst = [...m.perFile].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [f, n] of worst) console.error(`        ${f} (${n})`);
    if (m.perFile.length > worst.length) {
      console.error(`        …and ${m.perFile.length - worst.length} more file(s)`);
    }
  } else if (m.total < base) {
    nextBaseline[m.key] = m.total;
    tightened = true;
    console.log(`TIGHTEN  ${m.key}: ${base} → ${m.total} ${m.unit}(s). Ratchet lowered.`);
  } else {
    console.log(`OK       ${m.key}: ${m.total} ${m.unit}(s) (at baseline)`);
  }
}

if (failed) {
  console.error(
    "\nui-standard-guard: a UI-standard count went UP. Each number here may only ever go down.",
  );
  console.error("See knowledge-base/handbook/design/DESIGN_SYSTEM.md.\n");
  process.exit(1);
}

if (tightened) {
  nextBaseline.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(sortKeys(nextBaseline), null, 2) + "\n");
  console.log(`\nBaseline tightened → ${path.relative(ROOT, BASELINE_FILE)} (commit it).`);
}

console.log(`\nUI standard OK: ${files.length} files scanned, ${METRICS.length} metrics at or below baseline.`);

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}
