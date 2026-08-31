#!/usr/bin/env node
/**
 * Selling Guide conformance register guard — `pnpm guard:conformance`, run in ci.yml's gate.
 *
 * knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md is the per-claim record of what
 * our code agrees and disagrees with in the Guide. Until 2026-08-23 it was checked by
 * NOTHING — no script, no test, no CI step read it — while six code comments cited its
 * gap ids as stable keys. A register nobody validates is a register that rots in the one
 * direction that matters: quietly, while still reading as authoritative.
 *
 * WHY THIS EXISTS, CONCRETELY. On 2026-08-22 two sessions each added a pair of findings
 * and each numbered them C-9 and C-10 (commits 809517b/e29a99a, then 8f0cb29). Four
 * findings, two ids, one file that other files cite by id — and a green suite throughout.
 * Check 1 below is that defect, made mechanical.
 *
 * WHAT THIS PROVES AND DOES NOT PROVE — read before trusting it.
 *   It proves the register is internally consistent and points at sections that exist in
 *   the committed edition. It proves NOTHING about whether any entry's claim is TRUE:
 *   not that the cited section says what the entry says, not that a "Verified conforming"
 *   row still conforms, not that a gap is still open, and not that the register is
 *   COMPLETE — a conflict nobody recorded is invisible to every check here. Semantics are
 *   the scrub loop's job (the "The scrub loop" section of the register itself), and that
 *   loop is a human/agent reading the Guide, not a regex.
 *
 * DERIVE, NEVER DUPLICATE. The section-id regex and the historical-citation marker come
 * from selling-guide-authority-guard.cjs; the pinned edition comes from the extractor via
 * selling-guide-corpus-guard.cjs. Nothing about the corpus is restated here — a second
 * copy of a sha or an id pattern drifts, and the copy keeps passing.
 *
 * INERT rule (same as the corpus and coverage guards): no section-index.tsv on this ref
 * means the corpus has not landed on this branch, so there is nothing to resolve ids
 * against — print INERT and pass. A missing REGISTER while the index IS present is a real
 * FAIL: the register is tracked and load-bearing.
 */

const fs = require("fs");
const path = require("path");

const { SG_ID, loadSectionIndex } = require("./selling-guide-authority-guard.cjs");
const { parseExtractorConstants } = require("./selling-guide-corpus-guard.cjs");

const ROOT = path.join(__dirname, "..");

/** All inputs env-overridable so the test can drive the FAILING directions. */
function defaultPaths() {
  const dir = process.env.SG_DIR || path.join(ROOT, "docs/fannie-mae/selling-guide");
  return {
    dir,
    register:
      process.env.SG_CONFORMANCE_PATH ||
      path.join(ROOT, "knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md"),
    extractor: process.env.SG_EXTRACTOR_PATH || path.join(ROOT, "scripts/extract-selling-guide.py"),
    codeRoots: (process.env.SG_CODE_ROOTS || "server,shared,client/src,tests")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => path.join(ROOT, r)),
  };
}

/** `### C-11 — …` / `### G-6 — …`. The negative lookaheads keep `C-9-04` (a
 *  feature-review finding id, a different namespace) from reading as C-9. */
const ENTRY_HEADING = /^###\s+([CG])-(\d{1,3})(?!\d)(?!-\d)/;

/** The register header's own edition stamp: `… edition **08-05-2026**.` */
const REGISTER_EDITION = /edition\s+\*\*(\d{2}-\d{2}-\d{4})\*\*/;

/** A register id as cited from code — `(gap G-9)`, `recorded as G-15`. */
const CODE_REFERENCE = /(?<![A-Za-z0-9])([CG]-\d{1,2})(?!\d)(?!-\d)/g;

/**
 * Reg B's model adverse-action notices are literally named Form C-1 … C-5, and
 * server/services/creditCatalogs.ts cites one. That is not a reference to this
 * register, and resolving it against correction ids would be a coincidence rather
 * than a check. Skip the ECOA form namespace explicitly instead of relying on
 * C-1 happening to exist.
 */
const FORM_NAMESPACE = /Form\s+$/;

/**
 * This guard's own test must contain a deliberately-unresolvable id to prove the
 * failing direction, and scanning tests/ would otherwise flag its fixture. Same
 * carve-out, same reason, as selling-guide-authority-guard.cjs's
 * CITATION_FIXTURE_FILES — found the honest way, by the guard failing on itself.
 */
const CITATION_FIXTURE_FILES = new Set(["tests/sellingGuideConformanceGuard.test.ts"]);

const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "coverage", "__snapshots__"]);

/** Lines of lookback for a historical marker, matching the authority guard. */
const MARKER_LOOKBACK_LINES = 2;

/**
 * The authority guard's marker, re-derived rather than re-typed: it exports SG_ID
 * but not the marker, so accept an injected one and fall back to the same source of
 * truth. Kept in one place so "formerly B3-3.1-08" means the same thing everywhere.
 */
function historicalMarker() {
  const src = fs.readFileSync(path.join(__dirname, "selling-guide-authority-guard.cjs"), "utf8");
  const m = /^const HISTORICAL_MARKER = (\/.+\/[a-z]*);$/m.exec(src);
  if (!m) {
    throw new Error(
      "cannot parse HISTORICAL_MARKER out of selling-guide-authority-guard.cjs — the anchor " +
        "moved. Fix this regex IN THE SAME PR as that guard; a guard that cannot find its " +
        "constants must fail, not silently pass.",
    );
  }
  const body = m[1].slice(1, m[1].lastIndexOf("/"));
  const flags = m[1].slice(m[1].lastIndexOf("/") + 1);
  return new RegExp(body, flags);
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out);
    } else if (CODE_EXTENSIONS.has(path.extname(e.name))) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/**
 * Returns { inert, errors, facts }. Pure of process.exit so tests can drive it.
 */
function runChecks(paths = defaultPaths()) {
  const errors = [];
  const indexPath = path.join(paths.dir, "section-index.tsv");
  if (!fs.existsSync(indexPath)) return { inert: true, errors, facts: {} };

  if (!fs.existsSync(paths.register)) {
    return {
      inert: false,
      errors: [
        `${path.relative(ROOT, paths.register)} is missing while the corpus is present — the ` +
          `conformance register is tracked and other files cite its ids`,
      ],
      facts: {},
    };
  }

  let marker;
  let constants;
  try {
    marker = historicalMarker();
    constants = parseExtractorConstants(paths.extractor);
  } catch (e) {
    return { inert: false, errors: [e.message], facts: {} };
  }

  const sectionIds = loadSectionIndex(indexPath);
  const lines = fs.readFileSync(paths.register, "utf8").split("\n");

  // --- 1. every C-/G- id is used once -------------------------------------------
  // The founding check: two findings answering to one id, in the file whose ids
  // other files cite, is not a typo — it is a broken key.
  const seen = new Map();
  const corrections = new Set();
  const gaps = new Set();
  lines.forEach((line, i) => {
    const m = ENTRY_HEADING.exec(line);
    if (!m) return;
    const id = `${m[1]}-${m[2]}`;
    if (seen.has(id)) {
      errors.push(`duplicate entry id ${id}: headings at lines ${seen.get(id)} and ${i + 1}`);
    } else {
      seen.set(id, i + 1);
      (m[1] === "C" ? corrections : gaps).add(id);
    }
  });

  // --- 2. every section id the register cites resolves ---------------------------
  // The renumbering trap, applied to the register itself: an id that does not exist
  // in the committed edition is a WRONG citation, not merely an old one, because the
  // stale URL keeps returning HTTP 200. A historical mention says so on its own line
  // (or within two lines above), exactly as the authority guard requires of a diff.
  const unresolved = new Map();
  lines.forEach((line, i) => {
    let marked = marker.test(line);
    for (let back = 1; back <= MARKER_LOOKBACK_LINES && !marked; back++) {
      const prev = lines[i - back];
      if (prev === undefined) break;
      if (marker.test(prev)) marked = true;
    }
    if (marked) return;
    for (const m of line.matchAll(SG_ID)) {
      if (!sectionIds.has(m[1]) && !unresolved.has(m[1])) unresolved.set(m[1], i + 1);
    }
  });
  for (const [id, line] of unresolved) {
    errors.push(
      `cites ${id} at line ${line}, which is not a section in the committed edition ` +
        `(${constants.EDITION}) — re-derive it from section-index.tsv, or mark the mention ` +
        `as historical if it is deliberately naming a superseded id`,
    );
  }

  // --- 3. the register's edition stamp matches the corpus ------------------------
  // A parse miss is a loud FAIL, never a skip: a guard whose anchor moved and which
  // silently checks nothing is the silent-success class this repo names.
  const editionMatch = REGISTER_EDITION.exec(lines.join("\n"));
  if (!editionMatch) {
    errors.push(
      "cannot find the register's edition stamp (expected `edition **MM-DD-YYYY**` in the " +
        "header) — restore it, or fix REGISTER_EDITION in this guard in the same PR",
    );
  } else if (editionMatch[1] !== constants.EDITION) {
    errors.push(
      `register names edition ${editionMatch[1]}, extractor EDITION is ${constants.EDITION} — ` +
        `an edition bump re-verifies the Verified-conforming rows in the same PR`,
    );
  }

  // --- 4. every register id cited from code exists -------------------------------
  // Six comments in the decision path point a reader at a gap id. A pointer into a
  // renumbered or deleted entry sends them somewhere that does not exist.
  let codeRefs = 0;
  for (const root of paths.codeRoots) {
    for (const file of walk(root)) {
      if (CITATION_FIXTURE_FILES.has(path.relative(ROOT, file))) continue;
      const src = fs.readFileSync(file, "utf8");
      if (!src.includes("C-") && !src.includes("G-")) continue;
      src.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(CODE_REFERENCE)) {
          if (FORM_NAMESPACE.test(line.slice(0, m.index))) continue;
          codeRefs++;
          if (!seen.has(m[1])) {
            errors.push(
              `${path.relative(ROOT, file)}:${i + 1} cites ${m[1]}, which is not an entry in ` +
                `the register`,
            );
          }
        }
      });
    }
  }

  return {
    inert: false,
    errors,
    facts: {
      corrections: corrections.size,
      gaps: gaps.size,
      edition: editionMatch ? editionMatch[1] : null,
      codeRefs,
    },
  };
}

function main() {
  const { inert, errors, facts } = runChecks();
  if (inert) {
    console.log(
      "selling-guide-conformance: INERT — no docs/fannie-mae/selling-guide/section-index.tsv.\n" +
        "  The Guide corpus has not landed on this branch, so there is nothing to resolve the\n" +
        "  register's citations against. This guard arms itself once the corpus is present.",
    );
    return;
  }
  if (errors.length) {
    console.error(
      "selling-guide-conformance: FAIL — the conformance register disagrees with itself or " +
        "with the corpus:\n",
    );
    for (const e of errors) console.error(`  • ${e}`);
    console.error(
      "\nFix the register in the same PR — every C-/G- id is a stable key other files cite,\n" +
        "and a citation that resolves to nothing is a lie the reader cannot detect.\n" +
        "This guard checks the register's SHAPE only; whether an entry's claim is true is the\n" +
        "scrub loop's job (see \"The scrub loop\" in the register).",
    );
    process.exit(1);
  }
  console.log(
    `selling-guide-conformance: ok — ${facts.corrections} corrections, ${facts.gaps} gaps, ` +
      `edition ${facts.edition}, ${facts.codeRefs} code references resolve.`,
  );
}

module.exports = { runChecks, defaultPaths, ENTRY_HEADING, CODE_REFERENCE, REGISTER_EDITION };

if (require.main === module) main();
