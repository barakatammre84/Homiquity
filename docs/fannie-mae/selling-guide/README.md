# Fannie Mae Selling Guide — the local corpus

**Edition 08-05-2026 · 1,185 pages · 423 citable sections.** The Selling Guide is the top
of this repo's compliance document hierarchy (CLAUDE.md): eligibility, underwriting,
income, credit, property and delivery logic all traces to it, `pnpm guard:authority`
makes PRs cite it, and the coverage map works it down section by section. This directory
is where the Guide physically lives for every developer and Claude session.

## One command, no setup

```bash
python3 scripts/extract-selling-guide.py        # needs: pip3 install pymupdf
```

That regenerates the full corpus locally in ~3 seconds. It finds the PDF via
`$SELLING_GUIDE_PDF`, then the gitignored copy here, then — **in any fresh clone, with no
network** — recovers it from this repository's own git history (the PDF was committed
2026-08-20 while the repo was private; the blob remains in the merged history and is
SHA-256-verified on recovery). If all three fail it says so and **stops**: a missing
source is an honest gap, never a licence to answer a Fannie policy question from memory.

## What lives here

**Tracked — the fact layer** (titles, page numbers, dates, structure; no Guide prose;
works before anyone runs the script):

| File | What it answers |
|---|---|
| `section-index.tsv` | "Which section governs X, and what page is it on?" — `grep -n "B3-6-05" docs/fannie-mae/selling-guide/section-index.tsv`. All 554 TOC entries. Parsed by `scripts/selling-guide-authority-guard.cjs` and `scripts/selling-guide-coverage.cjs`. |
| `revised-sections.tsv` | The 25 sections revised in this edition (from the PDF's highlight annotations) — the release change list. |
| `toc.json` | The same structure, machine-readable: id, title, effective date, page range, breadcrumb, and which generated file holds each section's text. |
| `links.json` | Every link annotation in the PDF: 319 unique external URLs (classed ok / mailto / malformed), the 989-edge section-to-section cross-reference graph, and each section's derived canonical URL on selling-guide.fanniemae.com. See "The Guide's own links" below. |
| `INDEX.md` | The whole Guide as a browsable tree, every section linked to its generated file. |
| `manifest.json` | The corpus identity: PDF SHA-256 (pins the edition), byte size, git blob/commit for recovery, structural counts. |
| `README.md` | This file. |

**Generated, gitignored — the content layer** (the copyrighted work; never commit):

| Artifact | Use it for |
|---|---|
| `Selling-Guide_08-05-2026.pdf` | The authority of last resort — anything tables (see below), anything where extraction fidelity is in doubt. |
| `selling-guide-text.txt` | Whole-book grep. Every page is prefixed `[[PAGE n \| <section>]]`, so a plain `grep -n` names the governing section and page. |
| `extracted/sections/<ID>.txt` | One file per section (423) — `extracted/sections/B3-6-05.txt` is the whole of B3-6-05 with a provenance header (pages, breadcrumb, revised-this-edition flag) and inline `[[PAGE n]]` markers for citation. |
| `extracted/groups/…` | Part/Subpart/Chapter banner and intro text, so no page of the book is unaccounted for. |
| `extracted/front-matter.txt` | Cover pages. |
| `extracted/extraction-report.json` | Anchor methods and verification results for the run. |

## Finding things

```bash
# which section governs this? (tracked — works with zero setup)
grep -n "Monthly Debt" docs/fannie-mae/selling-guide/section-index.tsv

# read one section
python3 scripts/extract-selling-guide.py --section B3-6-05
# …or directly: docs/fannie-mae/selling-guide/extracted/sections/B3-6-05.txt

# search the whole book
grep -n "boarder income" docs/fannie-mae/selling-guide/selling-guide-text.txt

# or search section files to get hits grouped by section
grep -rln "boarder income" docs/fannie-mae/selling-guide/extracted/sections/
```

⚠️ Use `grep -F` for phrases containing `$` — BSD grep reads it as an anchor and reports
zero matches on text that is verbatim present. Lines wrap mid-sentence; grep a fragment.

**Citing:** section id + PDF page, e.g. *B3-6-05, p. 523*. Ids must resolve in
`section-index.tsv` — `pnpm guard:authority` enforces that on changed lines, because the
Guide renumbers between editions and a stale id does not 404. Cite tracked artifacts (or
the conformance ledger), never `selling-guide-text.txt` paths, in anything CI reads.

## The Guide's own links

`links.json` (tracked — URLs, ids, pages and counts are facts; anchor text is Guide
prose and is deliberately never stored) inventories all 1,475 external link annotations
and 4,267 internal cross-reference links in the PDF:

- **external** — 319 unique URLs, mostly `singlefamily.fanniemae.com` forms, SEL
  announcements and exhibits. Classes: `ok` (295 — probeable), `mailto` (22), and
  `malformed` (2 — corrupt annotations in the PDF itself, e.g.
  `https://IM%20B3-3.4-151`; documented, never probed). A deterministic `cleaned`
  repair is recorded where one applies (e.g. a zero-width-space-wrapped URL).
- **internal_xrefs** — leaf-to-leaf adjacency at page grain: `grep B3-6-05` here
  answers both "what does B3-6-05 cite" and "who cites B3-6-05".
- **canonical_html** — each section's derived URL on the HTML edition
  (`https://selling-guide.fanniemae.com/sel/<id>/<slug>`). Derived form, not verified
  reachable — `scripts/selling-guide-watch.cjs` owns probing and records per-URL
  reachability in `data/regulatory/selling-guide-watch-state.json`; content fetched
  from links lands only under gitignored `linked/`, never in the tree.

## Extraction fidelity — what is fixed, what is not

Verified against this edition (see `extracted/extraction-report.json` after a run):

- **Ligatures are expanded** (ﬁ→fi, ﬂ→fl). The PDF's body text uses ligature glyphs;
  before this, `grep Indemnification` missed 30 of 36 occurrences.
- **Page labels come from the section actually active on the page**, whatever its TOC
  level. The first-generation extraction labeled all ~66 Part E pages (including the
  whole E-3 glossary) with the last Part D section.
- **Sections are heading-anchored, not page-sliced.** 553 of 554 TOC nodes anchor on
  their printed heading (including headings that wrap lines or break across a page
  boundary); the two whose headings hyphenate at the wrap anchor on the section id at
  line start; the one remainder is the Table of Contents banner. Anchors tile the book —
  every character of the text layer lands in exactly one file.
- **The running header** ("Published August 5, 2026" + printed page number) is stripped
  from section files so paragraphs read unbroken; the page-marked stream keeps pages
  verbatim.

🚨 **Not fixed, by design: tables.** Text extraction flattens them — ruled tables
survive readably, borderless ones do not (B2-2-03's financed-property limits table is
the known case). Table detection was probed and rejected: it cannot see borderless
tables — certifying "no table here" falsely — and roughly two-thirds of pages contain
ruled ones, so a flag adds noise, not signal. The rail stays: **a threshold, matrix
cell, or limit read out of extracted text is unverified until confirmed against the PDF
page** — and the PDF is now always one command away.

## Verification and drift

Every run verifies: PDF SHA-256 matches the pinned edition, every section file exists,
is non-empty and starts at its own heading, segments cover the whole book with no gaps,
and every anchor lands within two pages of where the TOC says. Problems fail the run.

```bash
python3 scripts/extract-selling-guide.py --check   # tracked fact layer current? exit 1 on drift
```

Output is deterministic for a given PDF + pymupdf version (no timestamps), so `git diff`
after a run is itself the drift check for the tracked layer.

## When the next edition lands

1. Drop the new PDF here (or point `$SELLING_GUIDE_PDF` at it), update `EDITION`,
   `PDF_SHA256`, `PDF_BYTES` in `scripts/extract-selling-guide.py` (the run prints the
   mismatch), and clear/refresh the git-recovery constants deliberately.
2. Re-run; commit the changed fact layer. `git diff section-index.tsv` — sections whose
   parenthesised date changed, plus the new `revised-sections.tsv`, scope the re-scrub.
3. Re-scrub conformance: [SELLING_GUIDE_CONFORMANCE.md](../../../knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md)
   and the coverage map (`pnpm coverage:sg`) key off section ids that may have renumbered.

## Why the text is not committed

This repository is **public**. The Guide is Fannie Mae's copyrighted work, and a complete
text extraction is the same content in another format, not a lesser form of it —
committing either would be redistribution (that is also why `extracted/` is gitignored
wholesale). The fact layer above is titles, numbers and structure. Relaxing this split is
a founder decision, not an agent's.
