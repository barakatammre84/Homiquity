#!/usr/bin/env node
/**
 * Selling Guide corpus coherence guard — `pnpm guard:corpus`, run in ci.yml's gate.
 *
 * The Guide corpus is a fact layer derived from one PDF by one extractor
 * (scripts/extract-selling-guide.py). Every file in it must agree with every other
 * file and with the extractor's pinned constants, or a session will trust a count,
 * an id, or an edition that the source no longer backs. This guard is the cheap,
 * dependency-free half of that proof: pure node, no pymupdf, no PDF, <1s. The
 * expensive half — recover the PDF from git history, re-extract, byte-compare —
 * is the separate "extraction proof" gate step and the daily steward drill.
 *
 * DERIVE, NEVER DUPLICATE. The pinned identity (edition, sha256, byte size, git
 * blob, pymupdf pin) is parsed OUT OF the extractor's source with anchored
 * regexes, not restated here — three hand-held copies of a sha drift apart, and
 * two of them keep passing. A parse miss is therefore a loud FAIL, never a skip:
 * a guard whose anchor moved and which silently checks nothing is the
 * silent-success defect class this repo names, and
 * tests/sellingGuideCorpusGuard.test.ts pins the parse against the real file so a
 * constant rename turns the suite red instead of making this guard inert.
 *
 * INERT rule (same as selling-guide-coverage.cjs): no section-index.tsv on this
 * ref means the corpus has not landed on this branch — print INERT and pass,
 * because failing every unrelated branch teaches route-arounds. Any OTHER missing
 * or disagreeing file while the index IS present is a real FAIL.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/** All inputs env-overridable so the test can prove the FAILING directions. */
function defaultPaths() {
  const dir = process.env.SG_DIR || path.join(ROOT, "docs/fannie-mae/selling-guide");
  return {
    dir,
    extractor: process.env.SG_EXTRACTOR_PATH || path.join(ROOT, "scripts/extract-selling-guide.py"),
    coverage:
      process.env.SG_COVERAGE_PATH ||
      path.join(ROOT, "knowledge-base/compliance/selling-guide-coverage.json"),
  };
}

/** A leaf section id, mirroring the extractor's SECTION_ID_RE. */
const SG_ID_RE = /^([A-E][0-9]?(?:-[0-9]+(?:\.[0-9]+)?)*-[0-9]{2}), /;

const CONSTANT_ANCHORS = {
  EDITION: /^EDITION = "([^"]+)"$/m,
  PDF_SHA256: /^PDF_SHA256 = "([0-9a-f]{64})"$/m,
  PDF_BYTES: /^PDF_BYTES = (\d+)$/m,
  PDF_GIT_BLOB: /^PDF_GIT_BLOB = "([0-9a-f]{40})"$/m,
  PYMUPDF_PINNED: /^PYMUPDF_PINNED = "([^"]+)"$/m,
};

/** Pinned corpus identity, parsed out of the extractor source. Throws on a miss. */
function parseExtractorConstants(extractorPath) {
  const src = fs.readFileSync(extractorPath, "utf8");
  const out = {};
  for (const [name, re] of Object.entries(CONSTANT_ANCHORS)) {
    const m = re.exec(src);
    if (!m) {
      throw new Error(
        `cannot parse ${name} out of ${path.basename(extractorPath)} — the anchor moved. ` +
          `Fix the CONSTANT_ANCHORS regex in this guard IN THE SAME PR as the extractor ` +
          `change; a guard that cannot find its constants must fail, not silently pass.`,
      );
    }
    out[name] = name === "PDF_BYTES" ? Number(m[1]) : m[1];
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isSorted(keys) {
  for (let i = 1; i < keys.length; i++) if (keys[i - 1] > keys[i]) return false;
  return true;
}

/**
 * Returns { inert, errors, facts }. Pure of process.exit so tests can drive it.
 */
function runChecks(paths = defaultPaths()) {
  const errors = [];
  const indexPath = path.join(paths.dir, "section-index.tsv");
  if (!fs.existsSync(indexPath)) return { inert: true, errors, facts: {} };

  let constants;
  try {
    constants = parseExtractorConstants(paths.extractor);
  } catch (e) {
    return { inert: false, errors: [e.message], facts: {} };
  }

  // --- section-index.tsv --------------------------------------------------------
  const indexRows = fs
    .readFileSync(indexPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && l.split("\t").length >= 3)
    .slice(1); // header
  const indexLeafIds = indexRows
    .map((r) => SG_ID_RE.exec(r.split("\t")[2].trim()))
    .filter(Boolean)
    .map((m) => m[1]);

  // --- manifest.json ------------------------------------------------------------
  let manifest = null;
  const manifestPath = path.join(paths.dir, "manifest.json");
  try {
    manifest = readJson(manifestPath);
  } catch (e) {
    errors.push(`manifest.json unreadable: ${e.message}`);
  }
  if (manifest) {
    if (manifest.edition !== constants.EDITION)
      errors.push(`manifest edition ${manifest.edition} != extractor EDITION ${constants.EDITION}`);
    const sp = manifest.source_pdf || {};
    if (sp.sha256 !== constants.PDF_SHA256)
      errors.push(`manifest source_pdf.sha256 != extractor PDF_SHA256`);
    if (sp.bytes !== constants.PDF_BYTES)
      errors.push(`manifest source_pdf.bytes ${sp.bytes} != extractor PDF_BYTES ${constants.PDF_BYTES}`);
    if (sp.git_blob !== constants.PDF_GIT_BLOB)
      errors.push(`manifest source_pdf.git_blob != extractor PDF_GIT_BLOB`);
    if (sp.filename !== `Selling-Guide_${constants.EDITION}.pdf`)
      errors.push(`manifest source_pdf.filename ${sp.filename} does not carry edition ${constants.EDITION}`);
    for (const rel of manifest.tracked || []) {
      if (!fs.existsSync(path.join(paths.dir, rel)))
        errors.push(`manifest lists tracked file ${rel}, which does not exist`);
    }
  }

  // --- toc.json -----------------------------------------------------------------
  let toc = null;
  try {
    toc = readJson(path.join(paths.dir, "toc.json"));
  } catch (e) {
    errors.push(`toc.json unreadable: ${e.message}`);
  }
  const tocSectionIds = new Set();
  if (toc) {
    const entries = toc.entries || [];
    if (entries.length !== indexRows.length)
      errors.push(`toc.json has ${entries.length} entries, section-index.tsv has ${indexRows.length} rows`);
    if (manifest && manifest.pdf && entries.length !== manifest.pdf.toc_entries)
      errors.push(`toc.json entries ${entries.length} != manifest pdf.toc_entries ${manifest.pdf.toc_entries}`);
    let prevPage = 0;
    for (const e of entries) {
      if (e.pdf_page < prevPage) {
        errors.push(`toc.json pages not monotonic at ${e.title}`);
        break;
      }
      prevPage = e.pdf_page;
    }
    for (const e of entries) {
      if (e.kind === "section") {
        if (tocSectionIds.has(e.id)) errors.push(`toc.json duplicate section id ${e.id}`);
        tocSectionIds.add(e.id);
      }
    }
    if (tocSectionIds.size !== indexLeafIds.length)
      errors.push(
        `toc.json has ${tocSectionIds.size} sections, section-index.tsv has ${indexLeafIds.length} leaf rows`,
      );
    if (manifest && manifest.structure && tocSectionIds.size !== manifest.structure.leaf_sections)
      errors.push(
        `toc.json sections ${tocSectionIds.size} != manifest structure.leaf_sections ${manifest.structure.leaf_sections}`,
      );
  }

  // --- INDEX.md -----------------------------------------------------------------
  const indexMdPath = path.join(paths.dir, "INDEX.md");
  if (fs.existsSync(indexMdPath)) {
    const md = fs.readFileSync(indexMdPath, "utf8");
    const linkCount = (md.match(/\]\(extracted\/sections\//g) || []).length;
    if (tocSectionIds.size && linkCount !== tocSectionIds.size)
      errors.push(`INDEX.md links ${linkCount} section files, toc.json has ${tocSectionIds.size} sections`);
    if (!md.includes(constants.EDITION))
      errors.push(`INDEX.md does not name edition ${constants.EDITION}`);
  } else {
    errors.push("INDEX.md missing");
  }

  // --- links.json ---------------------------------------------------------------
  let links = null;
  try {
    links = readJson(path.join(paths.dir, "links.json"));
  } catch (e) {
    errors.push(`links.json unreadable: ${e.message}`);
  }
  if (links) {
    if (links.edition !== constants.EDITION)
      errors.push(`links.json edition ${links.edition} != extractor EDITION ${constants.EDITION}`);
    const ext = links.external || {};
    const extKeys = Object.keys(ext);
    // sorted keys are the determinism tripwire: the extractor serializes with
    // sort_keys, so unsorted keys mean the file was hand-edited or regenerated
    // by something that is not the extractor
    if (!isSorted(extKeys)) errors.push("links.json external keys are not sorted");
    const classes = { ok: 0, mailto: 0, malformed: 0 };
    for (const [url, e] of Object.entries(ext)) {
      if (!(e.class in classes)) {
        errors.push(`links.json ${url}: unknown class ${e.class}`);
        break;
      }
      classes[e.class]++;
    }
    const s = links.summary || {};
    if (s.unique_urls !== extKeys.length)
      errors.push(`links.json summary.unique_urls ${s.unique_urls} != ${extKeys.length} external entries`);
    for (const cls of ["ok", "mailto", "malformed"]) {
      if (s[`${cls}_urls`] !== classes[cls])
        errors.push(`links.json summary.${cls}_urls ${s[`${cls}_urls`]} != counted ${classes[cls]}`);
    }
    const xrefs = links.internal_xrefs || {};
    let edgeCount = 0;
    for (const [src, targets] of Object.entries(xrefs)) {
      edgeCount += targets.length;
      if (tocSectionIds.size && !tocSectionIds.has(src)) {
        errors.push(`links.json internal_xrefs source ${src} not a toc section id`);
        break;
      }
      for (const t of targets) {
        if (tocSectionIds.size && !tocSectionIds.has(t)) {
          errors.push(`links.json internal_xrefs target ${t} (from ${src}) not a toc section id`);
          break;
        }
      }
    }
    if (s.xref_edges !== edgeCount)
      errors.push(`links.json summary.xref_edges ${s.xref_edges} != counted ${edgeCount}`);
    const canonical = Object.keys(links.canonical_html || {});
    if (tocSectionIds.size && canonical.length !== tocSectionIds.size)
      errors.push(
        `links.json canonical_html has ${canonical.length} entries, toc.json has ${tocSectionIds.size} sections`,
      );
    if (manifest && manifest.links && manifest.links.unique_urls !== extKeys.length)
      errors.push(`manifest links.unique_urls ${manifest.links.unique_urls} != links.json ${extKeys.length}`);
  }

  // --- revised-sections.tsv -----------------------------------------------------
  const revisedPath = path.join(paths.dir, "revised-sections.tsv");
  if (fs.existsSync(revisedPath)) {
    const rows = fs
      .readFileSync(revisedPath, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .slice(1);
    for (const r of rows) {
      const title = (r.split("\t")[1] || "").trim();
      const m = SG_ID_RE.exec(title);
      if (m && tocSectionIds.size && !tocSectionIds.has(m[1])) {
        errors.push(`revised-sections.tsv names ${m[1]}, which toc.json does not know`);
        break;
      }
    }
  } else {
    errors.push("revised-sections.tsv missing");
  }

  // --- coverage.json edition ratchet -------------------------------------------
  // The 423-row coverage map derives its rows from section-index.tsv, so an
  // edition bump that regenerates the corpus without re-basing the coverage
  // edition is exactly the renumbering trap §10 exists for. Same-PR or FAIL.
  if (fs.existsSync(paths.coverage)) {
    try {
      const cov = readJson(paths.coverage);
      if (cov.edition && cov.edition !== constants.EDITION)
        errors.push(
          `selling-guide-coverage.json edition ${cov.edition} != extractor EDITION ` +
            `${constants.EDITION} — an edition bump re-bases the coverage map in the same PR`,
        );
    } catch (e) {
      errors.push(`selling-guide-coverage.json unreadable: ${e.message}`);
    }
  }

  return {
    inert: false,
    errors,
    facts: {
      edition: constants.EDITION,
      toc_entries: indexRows.length,
      sections: tocSectionIds.size,
      unique_urls: links && links.summary ? links.summary.unique_urls : null,
      pymupdf_pinned: constants.PYMUPDF_PINNED,
    },
  };
}

function main() {
  const { inert, errors, facts } = runChecks();
  if (inert) {
    console.log(
      "selling-guide-corpus-guard: INERT — no docs/fannie-mae/selling-guide/section-index.tsv.\n" +
        "  The Guide corpus has not landed on this branch, so there is nothing to be coherent\n" +
        "  with. This guard arms itself automatically once the corpus is present.",
    );
    return;
  }
  if (errors.length) {
    console.error("selling-guide-corpus-guard: FAIL — the corpus fact layer disagrees with itself:\n");
    for (const e of errors) console.error(`  • ${e}`);
    console.error(
      "\nRegenerate the whole layer with `python3 scripts/extract-selling-guide.py` and commit\n" +
        "every changed tracked file together — the files are one derivation, never hand-edited.",
    );
    process.exit(1);
  }
  console.log(
    `selling-guide-corpus-guard: ok — edition ${facts.edition}, ${facts.toc_entries} TOC entries, ` +
      `${facts.sections} sections, ${facts.unique_urls} link URLs, pymupdf pinned ${facts.pymupdf_pinned}.`,
  );
}

module.exports = { parseExtractorConstants, runChecks, defaultPaths, CONSTANT_ANCHORS, SG_ID_RE };

if (require.main === module) main();
