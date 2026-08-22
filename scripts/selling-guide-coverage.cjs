#!/usr/bin/env node
/**
 * Selling Guide coverage map — generator and validator (`pnpm coverage:sg`).
 *
 * Turns the Guide into the standing map of what this codebase does and does not implement.
 * `--check` validates and is safe for CI; the default run rewrites the markdown.
 *
 * DERIVE, NEVER INCREMENT. The 423 section rows are read out of
 * `docs/fannie-mae/selling-guide/section-index.tsv` every run. They are never typed into the
 * status file, so the map cannot drift from the edition, cannot invent a section, and cannot
 * silently omit one. A status key that is not in the index is a FAIL, not a warning — that is
 * the same renumbering trap the authority guard exists for.
 *
 * WHY A SEPARATE ARTIFACT FROM THE CONFORMANCE LEDGER. They answer different questions and
 * decay differently. SELLING_GUIDE_CONFORMANCE.md is the deep record of rules actually checked
 * ("we read B7-1-02 and the code agrees"). This is the broad map of all 423 sections, whose
 * value is mostly in the rows nobody has looked at yet. Merging them would either bury the
 * verified readings in 400 rows of `unreviewed`, or shrink the map to only what is verified —
 * which is the one thing a coverage map must not do.
 *
 * 🚨 `evidence` MUST NAME CODE ON THE DECISION PATH. Not a citation grep, and not merely a
 * function that exists. Two failures in this repo define the rule:
 *   - conformance C-2: `assessLiabilities` cited B3-6-07 from branches the URLA form could not
 *     emit, so the rule was unimplemented while a citation grep said "covered".
 *   - `derivePreUnderwritingFlags` is reached in production only through `await import(...)`,
 *     which a static import grep misses — and the flags it returns are read by neither
 *     `decisionEngine.ts` nor `underwritingEngine.ts`. Present, computed, and still not binding.
 * "The function exists" is not coverage. Trace the call, or mark the row `partial`.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "docs/fannie-mae/selling-guide/section-index.tsv");
const DATA = path.join(ROOT, "knowledge-base/compliance/selling-guide-coverage.json");
const OUT = path.join(ROOT, "knowledge-base/compliance/SELLING_GUIDE_COVERAGE.md");

const ORDER = ["implemented", "partial", "absent", "not_applicable", "unreviewed"];
const LABEL = {
  implemented: "✅ implemented",
  partial: "🟡 partial",
  absent: "❌ absent",
  not_applicable: "➖ n/a",
  unreviewed: "· unreviewed",
};

/** Leaf sections, in Guide order, with their part/chapter. */
function readIndex() {
  if (!fs.existsSync(INDEX)) return null;
  const rows = [];
  for (const line of fs.readFileSync(INDEX, "utf8").split("\n")) {
    const c = line.split("\t");
    if (c.length < 3) continue;
    const title = c[2].trim();
    const m = /^([A-E]\d{0,2}-\d(?:\.\d+)?-\d{2}),\s*(.+?)\s*\((\d{2}\/\d{2}\/\d{4})\)\s*$/.exec(title);
    if (!m) continue;
    rows.push({
      id: m[1],
      title: m[2],
      amended: m[3],
      page: Number(c[1]),
      part: m[1][0],
      chapter: m[1].split("-").slice(0, 2).join("-"),
    });
  }
  return rows;
}

function classify(rows, data) {
  const explicit = data.sections || {};
  const na = data.notApplicable || [];
  return rows.map((r) => {
    if (explicit[r.id]) return { ...r, ...explicit[r.id] };
    const hit = na.find((n) => r.id.startsWith(n.prefix));
    if (hit) return { ...r, status: "not_applicable", evidence: hit.reason, basis: hit.basis };
    return { ...r, status: "unreviewed" };
  });
}

function validate(rows, data) {
  const ids = new Set(rows.map((r) => r.id));
  const errs = [];
  for (const id of Object.keys(data.sections || {})) {
    if (!ids.has(id)) errs.push(`status file names ${id}, which is not a section in the committed edition`);
  }
  for (const [id, v] of Object.entries(data.sections || {})) {
    if (!ORDER.includes(v.status)) errs.push(`${id}: unknown status "${v.status}"`);
    if (v.status !== "unreviewed" && !v.evidence) errs.push(`${id}: status "${v.status}" with no evidence`);
  }
  for (const n of data.notApplicable || []) {
    if (!n.reason) errs.push(`notApplicable ${n.prefix}: no reason`);
    if (![...ids].some((i) => i.startsWith(n.prefix))) errs.push(`notApplicable prefix ${n.prefix} matches no section`);
  }
  return errs;
}

function render(rows, data) {
  const tally = (rs) => ORDER.map((s) => [s, rs.filter((r) => r.status === s).length]);
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const reviewed = rows.filter((r) => r.status !== "unreviewed").length;

  const partName = {
    A: "Part A — Doing Business with Fannie Mae",
    B: "Part B — Origination Through Closing",
    C: "Part C — Selling, Securitizing, Delivering",
    D: "Part D — Quality Control",
    E: "Part E — Quick Reference",
  };

  let md = `# Selling Guide coverage map

> **Freshness:** last verified ${data.updated} · review every 30 days

**Generated — do not hand-edit.** Run \`pnpm coverage:sg\` after editing
[\`knowledge-base/compliance/selling-guide-coverage.json\`](selling-guide-coverage.json). The section rows come from
\`docs/fannie-mae/selling-guide/section-index.tsv\` (edition ${data.edition}); the status file
carries only judgements, so this map cannot invent or omit a section.

This is the **standing map of all ${rows.length} citable sections**.
[\`knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md\`](SELLING_GUIDE_CONFORMANCE.md) is the companion: the deep record
of rules actually read and checked. Coverage says *have we looked*; conformance says *what did we
find*. Deliberate overlays we run stricter than the Guide live in
[\`data/regulatory/regulatory-ledger.json\`](../../data/regulatory/regulatory-ledger.json).

## Where we stand

**${reviewed} of ${rows.length} sections have been looked at (${pct(reviewed, rows.length)}%).**
The rest are \`unreviewed\` — not a backlog someone forgot, but the honest measure of how much of
the book has never been checked against this codebase. Domain Oracle works this map down daily,
sampling **randomly as well as by suspicion**, because a queue worked only by what someone already
worried about measures nothing about the rest (D1-1-01).

| Status | Sections | Meaning |
|---|---:|---|
`;
  for (const [s, n] of tally(rows)) md += `| ${LABEL[s]} | ${n} | ${data.statuses[s]} |\n`;

  md += `\n## By part\n\n| Part | Sections | Reviewed | ✅ | 🟡 | ❌ | ➖ |\n|---|---:|---:|---:|---:|---:|---:|\n`;
  for (const p of ["A", "B", "C", "D", "E"]) {
    const rs = rows.filter((r) => r.part === p);
    if (!rs.length) continue;
    const g = (s) => rs.filter((r) => r.status === s).length;
    md += `| ${partName[p]} | ${rs.length} | ${rs.length - g("unreviewed")} | ${g("implemented")} | ${g("partial")} | ${g("absent")} | ${g("not_applicable")} |\n`;
  }

  md += `\n### What binds a broker\n\nHomiquity is a broker — a **third-party originator** in the Guide's vocabulary (A3-3-01), keyed off
\`shared/businessChannel.ts\`. **B1–B7 are the product backlog**: the wholesale lender underwrites to
them, so a file that fails them is a file kicked back. The \`➖\` rows are functions we do not
perform, and each one carries its reason — *not applicable* is a finding, not a gap. Part D binds
the lender; we adopt its shape for our own quality program **by choice**, and say so.

## Reviewed sections

| Section | Title | Status | Evidence |
|---|---|---|---|
`;
  for (const r of rows.filter((x) => x.status !== "unreviewed" && x.status !== "not_applicable")) {
    const ev = String(r.evidence || "").replace(/\|/g, "\\|");
    md += `| \`${r.id}\` | ${r.title} | ${LABEL[r.status]} | ${ev} |\n`;
  }

  md += `\n## Not applicable\n\n| Sections | Reason | Basis |\n|---|---|---|\n`;
  for (const n of data.notApplicable) {
    const c = rows.filter((r) => r.id.startsWith(n.prefix)).length;
    md += `| \`${n.prefix}*\` (${c}) | ${n.reason} | ${n.basis} |\n`;
  }

  md += `\n## Reading a row honestly

\`evidence\` names code **on the decision path**, never a citation grep. Two local failures set that
bar. Conformance **C-2**: \`assessLiabilities\` cited B3-6-07 from branches the URLA form cannot
emit, so the rule was unimplemented while the suite stayed green and a grep for the citation said
"covered." And \`derivePreUnderwritingFlags\` is reached in production only through
\`await import(...)\` — invisible to a static import grep — while the flags it returns are read by
neither \`decisionEngine.ts\` nor \`underwritingEngine.ts\`. Present, computed, and still not binding.
That is why B3-4.1-01 and B3-4.2-02 are 🟡 and not ✅.

🚨 **A value read out of a table is unverified until the PDF page is open.** The text extraction
flattens tables — ruled ones survive, borderless ones do not (B2-2-03's financed-property limits
table is the known case). Prose may be trusted from the extraction; a threshold, matrix cell or
eligibility limit may not.
`;
  return md;
}

function main() {
  const check = process.argv.includes("--check");
  const rows = readIndex();
  if (!rows) {
    console.log("selling-guide-coverage: INERT — no section-index.tsv; the Guide corpus has not landed on this branch.");
    return;
  }
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const errs = validate(rows, data);
  if (errs.length) {
    console.error("selling-guide-coverage: FAIL");
    for (const e of errs) console.error(`  • ${e}`);
    process.exit(1);
  }
  const md = render(classify(rows, data), data);
  if (check) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (cur !== md) {
      console.error("selling-guide-coverage: FAIL — SELLING_GUIDE_COVERAGE.md is stale. Run `pnpm coverage:sg`.");
      process.exit(1);
    }
    console.log(`selling-guide-coverage: ok — ${rows.length} sections, map current.`);
    return;
  }
  fs.writeFileSync(OUT, md);
  const rev = classify(rows, data).filter((r) => r.status !== "unreviewed").length;
  console.log(`selling-guide-coverage: wrote ${path.relative(ROOT, OUT)} — ${rows.length} sections, ${rev} reviewed.`);
}

module.exports = { readIndex, classify, validate, render };
if (require.main === module) main();
