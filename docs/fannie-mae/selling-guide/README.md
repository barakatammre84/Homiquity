# Fannie Mae Selling Guide — the local corpus

**Edition 08-05-2026 · 1,185 pages · 423 citable sections.** The Selling Guide is the top
of this repo's compliance document hierarchy (CLAUDE.md): eligibility, underwriting,
income, credit, property and delivery logic all traces to it, `pnpm guard:authority`
makes PRs cite it, and the coverage map works it down section by section. This directory
is where the Guide physically lives for every developer and Claude session.

**It is also the core document for decisions taken above the code** — product, pricing,
marketing, founder calls. The one-page rule for that, written for a reader who will never
run a test suite, is
[knowledge-base/compliance/SELLING_GUIDE_DECISION_RULE.md](../../../knowledge-base/compliance/SELLING_GUIDE_DECISION_RULE.md).

**Read the markdown rendering.** The corpus carries two renderings of the same PDF pages:
markdown, which reconstructs the Guide's **tables**, and plain text, which flattens them.
The Guide states most of its real thresholds and eligibility grids in tables, so markdown
is the default and text is the fallback. Both are below.

## One command, no setup

```bash
python3 scripts/extract-selling-guide.py        # needs: pip3 install pymupdf pymupdf4llm
```

That regenerates the full corpus locally: the text layer and the tracked fact layer in ~3
seconds, plus the markdown layer in ~2 minutes more. `--no-markdown` stops after the fast
part (what the SessionStart hook uses); `--markdown` insists on the slow part and fails
loudly rather than skipping if `pymupdf4llm` is absent. **`pymupdf4llm` is optional on
purpose:** without it everything else is unchanged and byte-identical, which is what keeps
`--check` and the CI extraction proof on one small pinned dependency. It finds the PDF via
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
| **`extracted/markdown/<ID>.md`** | **Start here.** One markdown file per section (423), with a provenance header (pages, breadcrumb, revised-this-edition flag, table count, a ready-made `Cite as:` line) and inline `[[PAGE n]]` markers. **Tables survive as tables.** |
| **`selling-guide.md`** | **Whole-book markdown grep.** Every page prefixed `[[PAGE n \| <section>]]`, so a plain `grep -n` names the governing section and the page to cite. |
| `Selling-Guide_08-05-2026.pdf` | The authority of last resort — any threshold or matrix cell that decides money or eligibility, and anything where rendering fidelity is in doubt. |
| `selling-guide-text.txt` | The plain-text whole-book stream, same page markers. Faithful to reading order; **flattens tables**. |
| `extracted/sections/<ID>.txt` | The plain-text file per section (423) — the `md` file's counterpart. |
| `extracted/markdown-groups/…`, `extracted/groups/…` | Part/Subpart/Chapter banner and intro text in each rendering, so no page of the book is unaccounted for. |
| `extracted/front-matter.txt` | Cover pages. |
| `extracted/extraction-report.json` | Anchor methods, verification results, and the markdown layer's completeness audit for the run. |

## Finding things

```bash
# which section governs this? (tracked — works with zero setup)
grep -n "Monthly Debt" docs/fannie-mae/selling-guide/section-index.tsv

# read one section, tables intact
python3 scripts/extract-selling-guide.py --section B3-6-05 --markdown
# …or directly: docs/fannie-mae/selling-guide/extracted/markdown/B3-6-05.md
# drop --markdown for the plain-text rendering (extracted/sections/B3-6-05.txt)

# search the whole book
grep -n "boarder income" docs/fannie-mae/selling-guide/selling-guide.md

# or search section files to get hits grouped by section
grep -rln "boarder income" docs/fannie-mae/selling-guide/extracted/markdown/

# read a threshold matrix — the reason the markdown layer exists
grep -A6 "Maximum Number of" docs/fannie-mae/selling-guide/extracted/markdown/B2-2-03.md
```

⚠️ Use `grep -F` for phrases containing `$` — BSD grep reads it as an anchor and reports
zero matches on text that is verbatim present. Lines wrap mid-sentence; grep a fragment.

**Citing:** section id + PDF page, e.g. *B3-6-05, p. 523*. Ids must resolve in
`section-index.tsv` — `pnpm guard:authority` enforces that on changed lines, because the
Guide renumbers between editions and a stale id does not 404. Cite tracked artifacts (or
the conformance ledger), never `selling-guide-text.txt` or `selling-guide.md` paths, in
anything CI reads.

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
  from section files so paragraphs read unbroken; the page-marked text stream keeps pages
  verbatim. The markdown layer strips it from its stream and its section files alike —
  there it can sit anywhere in the page, because markdown is emitted in layout order
  rather than page order.
- **The markdown layer segments by the tracked TOC, not by the converter's own headings.**
  Those are unreliable: the converter promotes some section titles to markdown headings
  and not others, and emits an empty `####` where it drops one. Segmenting on them would
  have cut the book in the wrong places. Both renderings therefore run the *same*
  anchoring code over the *same* TOC, so a section id means the same span in both — and
  the extraction report records the outcome: all 554 nodes anchor by heading or
  section-id line, none by page fallback, in either rendering.
- **`<mark>` highlight spans are dropped** from the markdown. The renderer wraps this
  edition's revisions in them, which splits words from grep's point of view. The revision
  signal is already a tracked fact (`revised-sections.tsv`, and each section file's
  header), so it is not worth damaging the text to restate it.

### Tables — the gap that closed, and what is left of it

This README carried a standing 🚨 for months: text extraction **flattens tables**, so
B2-2-03's financed-property limits arrived as three unlabelled runs of words and no reader
could say which maximum belonged to which occupancy. Flagging tables was probed and
rejected then — a detector that cannot see borderless tables certifies "no table here"
falsely, and two-thirds of pages carry ruled ones, so the flag was noise.

**The markdown layer answers it properly**, because it does not flag tables, it *renders*
them. That same B2-2-03 page now reads:

| Subject Property Occupancy | Transaction | Maximum Number of Financed Properties |
|---|---|---|
| Principal residence | Transactions other than HomeReady loans | No limit |
| Principal residence | HomeReady loans | DU and manually underwritten - 2 |
| Second home or Investment property | All | DU - 10 |

840 tables across 701 pages of this edition, the borderless ones included.

**What is left of the gap, honestly.** The markdown renderer reconstructs tables from each
page's ruled graphics — and on **94 of 1,185 pages** of this edition it discards the page
*with* those graphics and returns the empty string, plus **4 more** where it returns only a
fraction of the prose. Shipping that silently would have put 8% of the Guide into "the
document everyone reads" as blank pages. So the extractor renders every page twice where it
has to:

1. the default pass, which sees tables;
2. an `ignore_graphics` rescue pass for any page carrying less than **90%** of the text
   layer's letters and digits, which sees all the prose and no tables.

The fuller text wins — 98 pages of this edition — and where the rescue pass wins on a page
that had tables, those tables are appended below it under a `[[TABLES FROM THE GRAPHICS
PASS …]]` marker. Nothing is dropped, and the page says which pass produced it. Every run
re-measures this against the text layer and **fails** if any page is still short — that
check is what would have caught the 94 blanks, so it is a verification problem, not a note.
Today it reports `every page ≥90% of the text layer`, and the whole corpus (both renderings)
is byte-identical across two consecutive runs.

🚨 **The rail is unchanged: a threshold, matrix cell, or limit that decides money or
eligibility is unverified until confirmed against the PDF page.** Markdown makes the table
readable; it does not make it authoritative. The PDF is one command away.

## Verification and drift

Every run verifies: PDF SHA-256 matches the pinned edition, every section file exists,
is non-empty and starts at its own heading, segments cover the whole book with no gaps,
and every anchor lands within two pages of where the TOC says. When the markdown layer
builds, it re-proves all of that on its own stream **and** checks every page against the
text layer's character count. Problems fail the run.

```bash
python3 scripts/extract-selling-guide.py --check   # tracked fact layer current? exit 1 on drift
```

Output is deterministic for a given PDF + pymupdf version (no timestamps), so `git diff`
after a run is itself the drift check for the tracked layer. `--check` needs **only**
pymupdf: the tracked fact layer is derived from the text layer alone, so a machine without
pymupdf4llm regenerates it byte-identically, and the CI extraction proof keeps its one
small pinned dependency.

## When the next edition lands

1. Drop the new PDF here (or point `$SELLING_GUIDE_PDF` at it), update `EDITION`,
   `PDF_SHA256`, `PDF_BYTES` in `scripts/extract-selling-guide.py` (the run prints the
   mismatch), and clear/refresh the git-recovery constants deliberately.
2. Re-run; commit the changed fact layer. `git diff section-index.tsv` — sections whose
   parenthesised date changed, plus the new `revised-sections.tsv`, scope the re-scrub.
   Re-read the run's markdown line: the rescued-page count and the completeness check are
   edition-specific, and a new edition can move both.
3. Re-scrub conformance: [SELLING_GUIDE_CONFORMANCE.md](../../../knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md)
   and the coverage map (`pnpm coverage:sg`) key off section ids that may have renumbered.

## Why the text is not committed

This repository is **public**. The Guide is Fannie Mae's copyrighted work, and a complete
extraction is the same content in another format, not a lesser form of it — **and a
markdown rendering is no more publishable than a text one**; if anything it is closer to
the original, because it keeps the tables. Committing either would be redistribution (that
is also why `extracted/` is gitignored wholesale, and why the ignore list names
`selling-guide.md` explicitly instead of `*.md`, which would have swallowed this file and
`INDEX.md`). The fact layer above is titles, numbers and structure. Relaxing this split is
a founder decision, not an agent's.
