#!/usr/bin/env python3
"""Materialize the Fannie Mae Selling Guide as the local source of truth.

The Selling Guide is the top of the compliance document hierarchy (CLAUDE.md), but a
1,185-page PDF cannot be grepped and cannot be read section-by-section. This script
turns it into an organized local corpus:

  docs/fannie-mae/selling-guide/
    selling-guide-text.txt        page stream, every page prefixed [[PAGE n | <section>]]
    extracted/sections/<ID>.txt   one file per section (423), heading-anchored, with a
                                  provenance header and inline [[PAGE n]] markers
    extracted/groups/<node>.txt   Part/Subpart/Chapter banner + intro text (nothing lost)
    extracted/front-matter.txt    cover pages before the first TOC node
    extracted/extraction-report.json  anchor methods + verification results for this run

and (re)generates the tracked fact layer — titles, page numbers, structure, link
inventory; no Guide prose — that works even before anyone runs this script:

    section-index.tsv  revised-sections.tsv  toc.json  links.json  manifest.json  INDEX.md

WHY THE TEXT IS NOT COMMITTED: this repository is PUBLIC. The Guide is Fannie Mae's
copyrighted work, and a complete text extraction is the same content in another format,
not a lesser form of it. Publishing either would be redistribution. The generated
content artifacts are gitignored; only the fact layer above is tracked. Relaxing that
is a founder decision, not an agent's.

WHERE THE PDF COMES FROM, in order:
  1. $SELLING_GUIDE_PDF
  2. docs/fannie-mae/selling-guide/Selling-Guide_08-05-2026.pdf  (gitignored)
  3. recovered from this repository's own git history: the PDF was committed on
     2026-08-20 (repo then private) and removed from the tip on 2026-08-22 when the
     repo went public — but the blob remains in the merged history, so `git cat-file`
     can materialize it in any clone with no network at all. The recovered bytes are
     verified against a pinned SHA-256 before use. If the founder ever purges history,
     this path fails cleanly and the first two remain.

If all three fail it says so and STOPS. That is deliberate and matches CLAUDE.md: when
a document you need is missing, SAY SO — never answer a Fannie policy question from
memory. A missing source is an honest gap, not a licence to guess.

EXTRACTION FIDELITY — two defects of the first-generation extraction are fixed here,
both verified against the 08-05-2026 PDF:
  * Ligature glyphs are expanded (ﬁ→fi, ﬂ→fl, …). The PDF's body text uses ligature
    codepoints, so `grep Indemnification` used to miss 30 of 36 occurrences.
  * Page labels come from the actual section active on the page, whatever its TOC
    level. The old level>=4 rule missed Part E's level-3 leaves, so all ~66 glossary
    pages were labeled D2-1-04.

USAGE:
    python3 scripts/extract-selling-guide.py               extract + verify everything
    python3 scripts/extract-selling-guide.py --section B3-6-05    print one section
    python3 scripts/extract-selling-guide.py --check       verify the tracked fact layer
                                                           is current; exit 1 on drift

Requires pymupdf (`pip3 install pymupdf`) only to regenerate; reading the output needs
nothing. Output is deterministic for a given PDF + pymupdf version (no timestamps), so
re-running and `git diff` is the drift check for the tracked layer.
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from bisect import bisect_right

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "docs", "fannie-mae", "selling-guide")
EXTRACTED = os.path.join(DIR, "extracted")
MD_SECTIONS = os.path.join(EXTRACTED, "markdown")

EDITION = "08-05-2026"
PDF_NAME = f"Selling-Guide_{EDITION}.pdf"

# Pinned identity of the source PDF. The sha256 is the edition check: a different
# Guide edition (or a corrupted recovery) fails loudly instead of silently producing
# an extraction that disagrees with the tracked fact layer.
PDF_SHA256 = "9b3fd0e850736142868d6801e2ef7b7674f1e0a26e2cf633db537773ac28e239"
PDF_BYTES = 3606598
# Where the bytes live inside this repository's own history (see docstring).
PDF_GIT_BLOB = "c984148cc8300ce6821687b6af6b0e637cafc461"
PDF_GIT_COMMIT = "978ec3839a69d15058c819d17cf19697cd7cd2dd"

# Extraction output is deterministic only for a fixed PDF + pymupdf version. The
# tracked fact layer is TOC-derived and version-independent except the anchor-based
# page_end values and the link inventory; CI and the steward install exactly this
# version, so a local mismatch is a warning, not an error.
PYMUPDF_PINNED = "1.28.2"

# The markdown layer (below) is produced by pymupdf4llm, a separate package that
# wraps the same pymupdf. It is OPTIONAL: absent, the text layer is unaffected and
# the tracked fact layer is bit-identical, which is why --check and the CI
# extraction proof need only pymupdf. Pinned for the same reason as above — markdown
# rendering (table detection, heading levels) differs across versions.
PYMUPDF4LLM_PINNED = "1.28.2"

RUNNING_HEADER = "Published August 5, 2026"

# The markdown layer's file names, kept next to the text layer's.
MD_STREAM_NAME = "selling-guide.md"

# Section IDs: A1-1-01, A2-3.1-01, B3-6-05, E-3-26, … A TOC entry whose title starts
# with one of these is a leaf section regardless of its TOC level (Part E's leaves sit
# at level 3; A2-3.x leaves at level 5).
SECTION_ID_RE = re.compile(
    r"^([A-E][0-9]?(?:-[0-9]+(?:\.[0-9]+)?)*-[0-9]{2}), (.+?)(?: \((\d{2}/\d{2}/\d{4})\))?$"
)
FRONT_TITLES = ("Table of Contents", "Preface")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def acquire_pdf():
    """Find or recover the PDF; return its path, or stop honestly."""
    env = os.environ.get("SELLING_GUIDE_PDF")
    local = os.path.join(DIR, PDF_NAME)
    for p in (env, local):
        if p and os.path.exists(p):
            return p

    # Recover from git history. cat-file needs no network and works in any clone that
    # still carries the blob; verify the bytes before trusting them.
    recovery_note = ""
    try:
        r = subprocess.run(
            ["git", "-C", ROOT, "cat-file", "blob", PDF_GIT_BLOB],
            capture_output=True, timeout=120,
        )
        if r.returncode == 0:
            digest = hashlib.sha256(r.stdout).hexdigest()
            if digest == PDF_SHA256:
                os.makedirs(DIR, exist_ok=True)
                with open(local, "wb") as fh:
                    fh.write(r.stdout)
                print(f"recovered {PDF_NAME} from git history "
                      f"(blob {PDF_GIT_BLOB[:12]}, sha256 verified) -> {local}")
                return local
            recovery_note = f"git blob {PDF_GIT_BLOB[:12]} exists but sha256 mismatch ({digest[:12]}…)"
        else:
            recovery_note = f"git blob {PDF_GIT_BLOB[:12]} not in this clone's history"
    except Exception as exc:  # git absent, timeout — recovery is best-effort
        recovery_note = f"git recovery failed: {exc}"

    sys.exit(
        "Selling Guide PDF not found — the repo is public, so it is deliberately not\n"
        "committed at the tip. Tried, in order:\n"
        f"  1. $SELLING_GUIDE_PDF          ({'unset' if not env else env + ' (missing)'})\n"
        f"  2. {local}  (missing)\n"
        f"  3. recovery from git history   ({recovery_note};\n"
        f"     the blob lives in commit {PDF_GIT_COMMIT[:12]} — a shallow clone may need\n"
        "     `git fetch --unshallow` first)\n"
        "Point SELLING_GUIDE_PDF at your copy, or drop it at path 2, and re-run.\n"
        "Do NOT answer a Fannie policy question from memory instead."
    )


# ---------------------------------------------------------------------------- TOC model

class Node:
    __slots__ = ("level", "title", "page", "kind", "sec_id", "name", "effective",
                 "breadcrumb", "anchor", "anchor_method", "end", "page_start", "page_end")

    def __init__(self, level, title, page):
        self.level, self.title, self.page = level, title, page
        m = SECTION_ID_RE.match(title)
        if m:
            self.kind = "section"
            self.sec_id, self.name, self.effective = m.group(1), m.group(2), m.group(3)
        elif title in FRONT_TITLES:
            self.kind, self.sec_id, self.name, self.effective = "front", None, title, None
        else:
            self.kind, self.sec_id, self.name, self.effective = "group", None, title, None
        self.breadcrumb = []

    def slug(self):
        base = self.sec_id if self.kind == "section" else self.title.split(",")[0]
        return re.sub(r"[^A-Za-z0-9.\-]+", "-", base).strip("-")

    def relfile(self):
        sub = "sections" if self.kind == "section" else "groups"
        return f"extracted/{sub}/{self.slug()}.txt"


def build_nodes(toc):
    nodes = [Node(lvl, title, page) for lvl, title, page in toc]
    stack = []  # breadcrumbs from TOC nesting levels
    for n in nodes:
        while stack and stack[-1].level >= n.level:
            stack.pop()
        n.breadcrumb = [s.title for s in stack]
        stack.append(n)
    return nodes


# ------------------------------------------------------------------- text + anchoring

def page_texts(doc, pymupdf):
    # Expand ligatures so the corpus matches how humans (and grep) spell words.
    flags = pymupdf.TEXTFLAGS_TEXT & ~pymupdf.TEXT_PRESERVE_LIGATURES
    return [doc[i].get_text("text", flags=flags) for i in range(doc.page_count)]


def strip_running_header(text):
    """Drop the per-page running header (the publication line and the printed page
    number adjacent to it). Only lines glued to the header line are dropped, so a
    legitimate bare number at the top of a page body survives."""
    lines = text.split("\n")
    head = lines[:3]
    try:
        h = next(i for i, ln in enumerate(head) if ln.strip() == RUNNING_HEADER)
    except StopIteration:
        return text, 0
    drop = {h}
    for adj in (h - 1, h + 1):
        if 0 <= adj < len(head) and re.fullmatch(r"\d{1,4}", lines[adj].strip()):
            drop.add(adj)
            break
    return "\n".join(ln for i, ln in enumerate(lines) if i not in drop), 1


def build_stream(pages_stripped):
    """One string for the whole document plus page-boundary offsets."""
    offsets, parts, pos = [], [], 0
    for t in pages_stripped:
        offsets.append(pos)
        parts.append(t)
        pos += len(t)
    return "".join(parts), offsets


def build_norm(stream):
    """Whitespace-collapsed view with a map back to original offsets, so a heading
    that wraps lines — or breaks across a page boundary — still matches."""
    chars, back, prev_space = [], [], True
    for i, ch in enumerate(stream):
        if ch.isspace():
            if not prev_space:
                chars.append(" ")
                back.append(i)
            prev_space = True
        else:
            chars.append(ch)
            back.append(i)
            prev_space = False
    return "".join(chars), back


def norm_title(title):
    return re.sub(r"\s+", " ", title).strip()


def compute_anchors(nodes, stream, norm, norm_back, page_offsets, npages,
                    title_norm=None, id_prefix=""):
    """Give every TOC node a character offset in `stream`. Preference order: the full
    heading found near its TOC page; a section ID at line start; the top of its TOC
    page. Anchors are monotonic, so segments tile the document exactly.

    Pure: returns a list of (anchor, method, end, page_start, page_end) parallel to
    `nodes` and mutates nothing. The text layer assigns the result onto the nodes
    (anchor_nodes, below); the markdown layer runs the SAME machinery over a second,
    differently-rendered stream and keeps its answer separate — one TOC, two
    renderings, no cross-contamination of the tracked fact layer.
    """
    orig2norm_keys = norm_back  # sorted original offsets of surviving chars

    def to_norm(orig):
        return bisect_right(orig2norm_keys, orig - 1)

    def page_start(pno):  # 1-based
        return page_offsets[pno - 1] if pno - 1 < len(page_offsets) else len(stream)

    def page_end(pno):
        return page_offsets[pno] if pno < len(page_offsets) else len(stream)

    title_norm = title_norm or norm_title
    prev = 0
    anchors, methods = [], []
    for n in nodes:
        lo = max(prev, page_start(n.page))
        hi = page_end(min(n.page + 2, npages))
        if lo > hi:
            lo = prev
        method, pos = "page-fallback", None
        m = None
        nlo, nhi = to_norm(lo), to_norm(hi)
        idx = norm.find(title_norm(n.title), nlo, nhi)
        if idx >= 0:
            pos, method = norm_back[idx], "heading"
        elif n.kind == "section":
            # id_prefix lets the markdown stream match a heading the renderer wrapped
            # in "#### " or "**" — without it every such section falls through to the
            # page fallback, and a monotonic fallback squeezes its neighbour to nothing.
            m = re.compile(rf"(?m)^{id_prefix}{re.escape(n.sec_id)}, ").search(stream, lo, hi)
            if m:
                pos, method = m.start(), "id-line"
        if pos is None:
            pos = max(prev, page_start(n.page))
        anchors.append(max(pos, prev))
        methods.append(method)
        prev = anchors[-1]

    out = []
    for i, n in enumerate(nodes):
        end = anchors[i + 1] if i + 1 < len(nodes) else len(stream)
        last = max(anchors[i], end - 1)
        page_end = bisect_right(page_offsets, last)  # 1-based page containing last char
        out.append((anchors[i], methods[i], end, n.page, max(page_end, n.page)))
    return out


def anchor_nodes(nodes, stream, norm, norm_back, page_offsets, npages):
    """compute_anchors, assigned onto the nodes — the text layer's view."""
    for n, a in zip(nodes, compute_anchors(nodes, stream, norm, norm_back, page_offsets, npages)):
        n.anchor, n.anchor_method, n.end, n.page_start, n.page_end = a


# ------------------------------------------------------------------------ file writers

NEVER_COMMIT = ("Generated locally by scripts/extract-selling-guide.py — gitignored; "
                "NEVER commit (Fannie Mae copyrighted work).")
RULE = "─" * 78


def page_marker_body(stream, page_offsets, start, end):
    """Slice of the stream with [[PAGE n]] markers inserted at page boundaries."""
    out = []
    pno = bisect_right(page_offsets, start)  # 1-based page containing `start`
    out.append(f"[[PAGE {pno}]]\n")
    pos = start
    while pos < end:
        nxt = page_offsets[pno] if pno < len(page_offsets) else end
        out.append(stream[pos:min(nxt, end)])
        pos = min(nxt, end)
        if pos < end:
            pno += 1
            out.append(f"\n[[PAGE {pno}]]\n")
    return "".join(out)


def write_section_file(n, stream, page_offsets, revised_pages):
    revised = "yes" if any(n.page_start <= p <= n.page_end for p in revised_pages.get(n.sec_id, [])) else "no"
    crumb = " > ".join(n.breadcrumb) if n.breadcrumb else "(top level)"
    pages = f"{n.page_start}" if n.page_start == n.page_end else f"{n.page_start}-{n.page_end}"
    header = (
        f"{n.title}\n"
        f"Fannie Mae Selling Guide · edition {EDITION} · PDF page(s) {pages}\n"
        f"{crumb}\n"
        f"Revised in this edition: {revised}\n"
        f"{NEVER_COMMIT}\n"
        f"{RULE}\n"
    )
    body = page_marker_body(stream, page_offsets, n.anchor, n.end)
    path = os.path.join(DIR, n.relfile())
    with open(path, "w") as fh:
        fh.write(header + body + "\n")


def write_group_file(n, stream, page_offsets):
    crumb = " > ".join(n.breadcrumb) if n.breadcrumb else "(top level)"
    header = (
        f"{n.title}\n"
        f"Fannie Mae Selling Guide · edition {EDITION} · banner/intro text only — "
        f"the sections under this node live in extracted/sections/\n"
        f"{crumb}\n"
        f"{NEVER_COMMIT}\n"
        f"{RULE}\n"
    )
    body = page_marker_body(stream, page_offsets, n.anchor, n.end) if n.end > n.anchor else "(no intro text)\n"
    with open(os.path.join(DIR, n.relfile()), "w") as fh:
        fh.write(header + body + "\n")


def write_page_stream(raw_pages, nodes, path):
    """The legacy grep target: every page verbatim (ligatures expanded), prefixed
    [[PAGE n | <label>]] where the label is the section active on that page."""
    label_at = {}
    for n in nodes:
        if n.kind == "section":
            label_at.setdefault(n.page, n.title)
    current = "(front matter)"
    with open(path, "w") as fh:
        for i, text in enumerate(raw_pages):
            pno = i + 1
            current = label_at.get(pno, current)
            fh.write(f"\n[[PAGE {pno} | {current}]]\n")
            fh.write(text)


# --------------------------------------------------------------------- markdown layer
#
# WHY A SECOND RENDERING. The text layer above is faithful to the reading order of the
# page and is what `grep` wants, but it FLATTENS TABLES: B2-2-03's financed-property
# limits arrive as three unlabelled column runs, and no reader can say which maximum
# belongs to which occupancy. The Guide states a large share of its actual thresholds
# in tables, so that is not a cosmetic loss — it is the one place the corpus could not
# answer the question it exists to answer, and the README has carried it as a standing
# 🚨 since the corpus landed.
#
# pymupdf4llm renders the same pages as markdown and reconstructs those tables as
# markdown tables, cell by cell, including borderless ones. Same PDF, same TOC, same
# anchoring machinery — a second VIEW of the identical bytes, never a second source.
# Where the two disagree the PDF page settles it, exactly as before.
#
# It stays OPTIONAL on purpose: the tracked fact layer must remain derivable from
# pymupdf alone so `--check` and the CI extraction proof keep their small, pinned
# dependency. Absent pymupdf4llm, everything above is unchanged and this layer simply
# does not build.

# pymupdf expands these itself (TEXT_PRESERVE_LIGATURES off); pymupdf4llm does not, so
# the markdown layer would otherwise spell "identify" with a glyph grep cannot match —
# the exact defect the text layer fixed in its first generation.
LIGATURES = {
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi",
    "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st",
}

# Highlight annotations mark this edition's revisions; the newer pymupdf4llm renders
# them as <mark>…</mark> INSIDE the prose, which splits words from grep's point of view
# ("<mark>B3-6-05, Monthly Debt" no longer matches the title). The revision signal is
# already a tracked fact (revised-sections.tsv, and each section file's header), so the
# tags are dropped here rather than duplicated in a form that damages the text.
MD_MARK_RE = re.compile(r"</?mark>")

# The running header/footer, as markdown emphasis. Unlike the text layer's, it can land
# anywhere in the chunk: pymupdf4llm emits it in layout order, not page order.
MD_HEADER_RE = re.compile(
    rf"^\*\*{re.escape(RUNNING_HEADER)}\*\*\n(?:\s*\n)*(?:\*\*[0-9IVXLC]{{1,5}}\*\*\n)?",
    re.MULTILINE,
)


def expand_ligatures(text):
    for glyph, plain in LIGATURES.items():
        text = text.replace(glyph, plain)
    return text


# A page whose markdown carries less than this share of the text layer's letters and
# digits has lost prose, not formatting, and gets the rescue pass below. Measured, not
# guessed: on the 08-05-2026 edition the median page scores 0.992 and the distribution
# is bimodal — 94 pages at zero and a thin tail at 0.55-0.89, with nothing in between
# that a 0.90 line splits wrongly.
MD_COMPLETENESS_FLOOR = 0.90

TABLE_ROW_RE = re.compile(r"(?m)^\|.*\|\s*$")

MD_RESCUED_TABLES = "[[TABLES FROM THE GRAPHICS PASS — the text above is complete; " \
                    "these are the same page's tables, which that pass flattens]]"


def alnum_len(text):
    return len(re.sub(r"[^0-9A-Za-z]", "", text))


def _clean_chunk(c):
    md = expand_ligatures(MD_MARK_RE.sub("", c.get("text", "")))
    return MD_HEADER_RE.sub("", md)


def markdown_pages(pdf_path, text_pages):
    """Per-page markdown for the whole book, plus per-page table counts.

    Returns (pages, table_counts, rescued, version). Raises ImportError when
    pymupdf4llm is not installed — the caller decides whether that is fatal.

    TWO PASSES, because neither alone is complete on this PDF:

    * The default pass reconstructs tables from the page's ruled graphics — the whole
      reason this layer exists — but on 94 of 1,185 pages of the 08-05-2026 edition it
      returns the EMPTY STRING, and on a handful more it returns a fraction of the
      prose. Those pages are graphics-heavy; the renderer discards the page with them.
      Shipping that silently would put ~8% of the Guide's pages into "the document
      everyone reads" as blanks, which is worse than having no markdown at all.
    * The rescue pass (`ignore_graphics=True`) recovers every one of those pages —
      byte-for-byte the same letters the text layer has — but sees no tables at all.

    So: render every page the first way, measure it against the text layer, and for any
    page that came up short render it the second way and keep the fuller text, with the
    first pass's tables appended under a labelled marker. Nothing is dropped, and where
    the two disagree the page says so instead of quietly picking one.
    """
    import pymupdf4llm

    version = getattr(pymupdf4llm, "__version__", "unknown")
    chunks = pymupdf4llm.to_markdown(pdf_path, page_chunks=True, show_progress=False)
    pages, tables = [], []
    for c in chunks:
        pages.append(_clean_chunk(c))
        tables.append(len(c.get("tables") or []))

    short = [
        i for i, md in enumerate(pages)
        if i < len(text_pages)
        and alnum_len(text_pages[i])
        and alnum_len(md) < MD_COMPLETENESS_FLOOR * alnum_len(text_pages[i])
    ]
    rescued = []
    if short:
        redone = pymupdf4llm.to_markdown(
            pdf_path, pages=short, page_chunks=True, show_progress=False,
            ignore_graphics=True,
        )
        for i, c in zip(short, redone):
            md = _clean_chunk(c)
            if alnum_len(md) <= alnum_len(pages[i]):
                continue  # the graphics pass was already the fuller one
            table_rows = TABLE_ROW_RE.findall(pages[i])
            if table_rows:
                md = md.rstrip() + "\n\n" + MD_RESCUED_TABLES + "\n\n" + "\n".join(table_rows) + "\n"
            pages[i] = md
            rescued.append(i + 1)
    return pages, tables, rescued, version


# Markdown decoration a heading may be wrapped in. Stripped for ANCHORING only — the
# stored text keeps every character, because the emphasis is how a table cell says
# "this row is the header".
MD_DECORATION_RE = re.compile(r"[*_`#\[\]]")


def norm_md_title(title):
    return re.sub(r"\s+", " ", MD_DECORATION_RE.sub("", title)).strip()


def build_md_norm(stream):
    """build_norm's counterpart for markdown: collapse whitespace AND drop emphasis,
    keeping a map back to original offsets so an anchor lands on real text."""
    chars, back, prev_space = [], [], True
    for i, ch in enumerate(stream):
        if MD_DECORATION_RE.match(ch):
            continue
        if ch.isspace():
            if not prev_space:
                chars.append(" ")
                back.append(i)
            prev_space = True
        else:
            chars.append(ch)
            back.append(i)
            prev_space = False
    return "".join(chars), back


def md_page_marker_body(stream, page_offsets, start, end):
    """page_marker_body for markdown: the same [[PAGE n]] markers, but on their own
    fenced-off line so they never fuse with a table row or a heading."""
    out = []
    pno = bisect_right(page_offsets, start)
    out.append(f"\n[[PAGE {pno}]]\n\n")
    pos = start
    while pos < end:
        nxt = page_offsets[pno] if pno < len(page_offsets) else end
        out.append(stream[pos:min(nxt, end)])
        pos = min(nxt, end)
        if pos < end:
            pno += 1
            out.append(f"\n\n[[PAGE {pno}]]\n\n")
    return "".join(out)


def md_relfile(n):
    sub = "markdown" if n.kind == "section" else "markdown-groups"
    return f"extracted/{sub}/{n.slug()}.md"


def write_markdown_files(nodes, md_stream, md_page_offsets, md_anchors, table_counts,
                         revised_pages):
    """One markdown file per TOC node, with a provenance header that says what this
    rendering is good for and what still has to be checked against the PDF."""
    written = 0
    for n, (anchor, _method, end, page_start, page_end) in zip(nodes, md_anchors):
        crumb = " > ".join(n.breadcrumb) if n.breadcrumb else "(top level)"
        pages = f"{page_start}" if page_start == page_end else f"{page_start}-{page_end}"
        ntables = sum(table_counts[p - 1] for p in range(page_start, page_end + 1)
                      if 0 < p <= len(table_counts))
        if n.kind == "section":
            revised = "yes" if any(page_start <= p <= page_end
                                   for p in revised_pages.get(n.sec_id, [])) else "no"
            revised_line = f"- **Revised in this edition:** {revised}\n"
        else:
            revised_line = ""
        header = (
            f"# {n.title}\n\n"
            f"> Fannie Mae **Selling Guide**, edition {EDITION} — PDF page(s) {pages}.\n"
            f"> {NEVER_COMMIT}\n\n"
            f"- **Where this sits:** {crumb}\n"
            f"{revised_line}"
            f"- **Tables rendered on these pages:** {ntables} "
            f"(a count of what the renderer *found* — it is not a certification that "
            f"there are no others; see README)\n"
            f"- **Cite as:** `{n.sec_id or n.title.split(',')[0]}, p. {page_start}`\n\n"
            f"---\n"
        )
        body = md_page_marker_body(md_stream, md_page_offsets, anchor, end) \
            if end > anchor else "\n_(no text under this node — its sections are separate files)_\n"
        with open(os.path.join(DIR, md_relfile(n)), "w") as fh:
            fh.write(header + body + "\n")
        written += 1
    return written


def write_markdown_stream(md_pages, nodes, path):
    """The whole book as one markdown file, page-marked and section-labelled — the
    markdown counterpart of selling-guide-text.txt, and the file to grep when you do
    not yet know which section governs."""
    label_at = {}
    for n in nodes:
        if n.kind == "section":
            label_at.setdefault(n.page, n.title)
    current = "(front matter)"
    with open(path, "w") as fh:
        fh.write(
            f"# Fannie Mae Selling Guide — edition {EDITION}\n\n"
            f"> {NEVER_COMMIT}\n>\n"
            f"> Whole-book markdown rendering. Every page below is prefixed\n"
            f"> `[[PAGE n | <section>]]`, so a plain `grep -n` names the governing\n"
            f"> section and the PDF page to cite. Tables are rendered as markdown\n"
            f"> tables — this is the layer to read a threshold matrix from.\n\n"
        )
        for i, text in enumerate(md_pages):
            pno = i + 1
            current = label_at.get(pno, current)
            fh.write(f"\n\n[[PAGE {pno} | {current}]]\n\n")
            fh.write(text)


def verify_markdown(nodes, md_stream, md_anchors, md_page_offsets, report):
    """The markdown layer's own proof, mirroring verify(): every section file present
    and non-empty, segments tile the stream, anchors land where the TOC says."""
    problems = []
    sections = [(n, a) for n, a in zip(nodes, md_anchors) if n.kind == "section"]

    for n, (anchor, method, end, _ps, _pe) in sections:
        path = os.path.join(DIR, md_relfile(n))
        if not os.path.exists(path):
            problems.append(f"markdown: missing file {md_relfile(n)}")
            continue
        body = open(path).read().split("\n---\n", 1)[-1]
        if len(body.strip()) < 40:
            problems.append(f"markdown: near-empty section body {n.sec_id}")
        if method == "page-fallback":
            report["markdown_unanchored_sections"].append(n.sec_id)

    covered = md_anchors[0][0] if md_anchors else len(md_stream)
    for n, (anchor, _m, end, _ps, _pe) in zip(nodes, md_anchors):
        if anchor != covered:
            problems.append(f"markdown: coverage gap before {n.title!r}")
            break
        covered = end
    else:
        if covered != len(md_stream):
            problems.append("markdown: coverage gap at end of document")

    off_page = []
    for n, (anchor, _m, _e, _ps, _pe) in sections:
        apage = bisect_right(md_page_offsets, anchor)
        if not (n.page <= apage <= n.page + 2):
            off_page.append(f"{n.sec_id}@{apage}(toc {n.page})")
    # Recorded, not fatal: markdown reorders a page's blocks by layout, so a heading
    # that the text layer finds on its TOC page can legitimately drift a page here.
    # The tracked fact layer's page numbers come from the text layer and are unmoved.
    report["markdown_off_page_anchors"] = off_page

    return problems


def build_markdown_layer(pdf_path, nodes, npages, revised_pages, text_pages, report):
    """Materialize the markdown layer. Returns a one-line summary, or None when
    pymupdf4llm is not installed (an honest skip, never a silent one)."""
    try:
        md_pages, table_counts, rescued, version = markdown_pages(pdf_path, text_pages)
    except ImportError:
        return None

    if version != PYMUPDF4LLM_PINNED:
        print(
            f"warning: pymupdf4llm {version} != pinned {PYMUPDF4LLM_PINNED} — table "
            "detection and heading levels differ across versions",
            file=sys.stderr,
        )

    md_stream, md_page_offsets = build_stream(md_pages)
    md_norm, md_back = build_md_norm(md_stream)
    md_anchors = compute_anchors(nodes, md_stream, md_norm, md_back, md_page_offsets,
                                 npages, title_norm=norm_md_title, id_prefix=r"[#*_ ]*")

    os.makedirs(MD_SECTIONS, exist_ok=True)
    os.makedirs(os.path.join(EXTRACTED, "markdown-groups"), exist_ok=True)
    written = write_markdown_files(nodes, md_stream, md_page_offsets, md_anchors,
                                   table_counts, revised_pages)
    write_markdown_stream(md_pages, nodes, os.path.join(DIR, MD_STREAM_NAME))

    first = md_anchors[0][0] if md_anchors else len(md_stream)
    with open(os.path.join(EXTRACTED, "markdown-groups", "front-matter.md"), "w") as fh:
        fh.write(f"# Selling Guide cover pages (before the first TOC entry)\n\n> {NEVER_COMMIT}\n\n---\n")
        fh.write(md_page_marker_body(md_stream, md_page_offsets, 0, first) + "\n")

    problems = verify_markdown(nodes, md_stream, md_anchors, md_page_offsets, report)
    # Completeness, page by page, against the text layer — the only rendering proven to
    # lose nothing. This is the check that would have caught the 94 blank pages, so it
    # runs on every extraction and its residue is a PROBLEM, not a note.
    thin = []
    for i, md in enumerate(md_pages):
        want = alnum_len(text_pages[i]) if i < len(text_pages) else 0
        if want and alnum_len(md) < MD_COMPLETENESS_FLOOR * want:
            thin.append(f"p{i + 1}({alnum_len(md)}/{want})")
    if thin:
        problems.append(
            f"markdown: {len(thin)} page(s) below {MD_COMPLETENESS_FLOOR:.0%} of the text "
            f"layer after the rescue pass: {', '.join(thin[:12])}"
            + (" …" if len(thin) > 12 else "")
        )

    report["pymupdf4llm"] = version
    report["markdown_tables_rendered"] = sum(table_counts)
    report["markdown_pages_with_tables"] = sum(1 for t in table_counts if t)
    report["markdown_rescued_pages"] = rescued
    report["markdown_completeness_floor"] = MD_COMPLETENESS_FLOOR
    report["markdown_thin_pages"] = thin
    report["markdown_problems"] = problems

    nsec = sum(1 for n in nodes if n.kind == "section")
    completeness = (f"every page ≥{MD_COMPLETENESS_FLOOR:.0%} of the text layer"
                    if not thin else f"{len(thin)} STILL THIN")
    summary = (
        f"markdown: pymupdf4llm={version} {MD_STREAM_NAME} + {written} node files "
        f"({nsec} sections) — {sum(table_counts)} tables rendered on "
        f"{sum(1 for t in table_counts if t)} pages; "
        f"{len(rescued)} page(s) rescued by the graphics pass; {completeness}"
    )
    if report["markdown_off_page_anchors"]:
        summary += f"\n    off-page anchors (layout reorder, not fatal): {len(report['markdown_off_page_anchors'])}"
    if problems:
        summary += "\n    " + "\n    ".join(f"✗ {p}" for p in problems)
    return summary


# ----------------------------------------------------------------------- link corpus

URL_OK_RE = re.compile(r"^https?://[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:[/:?#]|$)")
# The PDF itself carries a handful of corrupt link annotations — a zero-width-space
# wrapper around a second URL, and internal-memo artifacts like
# https://IM%20B3-3.4-151. Cleaning is a pure function of the URI string so
# links.json stays deterministic; anything unrepairable is classified malformed and
# is documented, never probed.
WRAPPED_URL_RE = re.compile(r"^https?://(?:%E2%80%8B|%20|\s)+(https?://.+)$", re.IGNORECASE)


def clean_url(uri):
    """Repaired form of a corrupt URI, or None when no repair applies."""
    m = WRAPPED_URL_RE.match(uri)
    cleaned = m.group(1) if m else uri
    cleaned = re.sub(r"(?:%20|\s)+$", "", cleaned)
    return cleaned if cleaned != uri else None


def classify_url(uri):
    target = clean_url(uri) or uri
    if target.startswith("mailto:"):
        return "mailto"
    return "ok" if URL_OK_RE.match(target) else "malformed"


def url_domain(uri):
    m = re.match(r"^https?://([^/:?#]+)", uri)
    return m.group(1).lower() if m else ""


def html_slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def leaf_active_by_page(nodes, npages):
    """Leaf section id active on each 1-based page — the carry-forward rule the page
    stream labels use. None before the first section (cover/ToC/Preface)."""
    start = {}
    for n in nodes:
        if n.kind == "section":
            start.setdefault(n.page, n.sec_id)
    out, current = [], None
    for pno in range(1, npages + 1):
        current = start.get(pno, current)
        out.append(current)
    return out


def render_links_json(doc, nodes, pymupdf, npages):
    """Tracked inventory of every link annotation in the PDF. Facts only: URLs,
    section ids, page numbers, counts — never the anchor text (that is Guide prose).
    Attribution is page-grain: a link belongs to the leaf section active on its page.
    Returns (json_text, stats)."""
    leaf_at = leaf_active_by_page(nodes, npages)
    external = {}
    xref = {}
    goto_total = unresolved = annotations = 0
    for i in range(npages):
        src = leaf_at[i]
        for lnk in doc[i].get_links():
            kind = lnk.get("kind")
            if kind == pymupdf.LINK_URI:
                annotations += 1
                uri = lnk.get("uri", "")
                e = external.get(uri)
                if e is None:
                    cls = classify_url(uri)
                    e = external[uri] = {
                        "class": cls,
                        "domain": url_domain(clean_url(uri) or uri) if cls == "ok" else "",
                        "pages": [],
                        "count": 0,
                    }
                    repaired = clean_url(uri)
                    if repaired:
                        e["cleaned"] = repaired
                e["count"] += 1
                if (i + 1) not in e["pages"]:
                    e["pages"].append(i + 1)
            elif kind in (pymupdf.LINK_GOTO, pymupdf.LINK_NAMED):
                goto_total += 1
                tpage = lnk.get("page")
                if tpage is None or tpage < 0 or tpage >= npages:
                    unresolved += 1
                    continue
                tgt = leaf_at[tpage]
                if src and tgt and src != tgt:
                    xref.setdefault(src, set()).add(tgt)
    for e in external.values():
        e["pages"].sort()
    xrefs = {k: sorted(v) for k, v in xref.items()}
    stats = {
        "external_annotations": annotations,
        "unique_urls": len(external),
        "ok_urls": sum(1 for e in external.values() if e["class"] == "ok"),
        "mailto_urls": sum(1 for e in external.values() if e["class"] == "mailto"),
        "malformed_urls": sum(1 for e in external.values() if e["class"] == "malformed"),
        "internal_links": goto_total,
        "internal_unresolved": unresolved,
        "xref_edges": sum(len(v) for v in xrefs.values()),
    }
    canonical = {
        n.sec_id: f"https://selling-guide.fanniemae.com/sel/{n.sec_id.lower()}/{html_slug(n.name)}"
        for n in nodes
        if n.kind == "section"
    }
    payload = {
        "_": (
            "Every link annotation inside the Selling Guide PDF — facts only (URLs, "
            "section ids, pages, counts; never anchor text, which is Guide prose). "
            "external: each verbatim URI with class ok|mailto|malformed (malformed = "
            "corrupt in the PDF itself; mailto and malformed are documented, never "
            "probed) and a deterministic 'cleaned' repair where one applies. internal_xrefs: leaf-to-leaf "
            "cross-reference adjacency at page grain. canonical_html: the DERIVED "
            "per-section URL on selling-guide.fanniemae.com (best-effort form, not "
            "verified reachable — scripts/selling-guide-watch.cjs owns probing). "
            "Generated by scripts/extract-selling-guide.py; do not hand-edit."
        ),
        "edition": EDITION,
        "summary": stats,
        "external": external,
        "internal_xrefs": xrefs,
        "canonical_html": canonical,
    }
    return json.dumps(payload, indent=1, ensure_ascii=False, sort_keys=True) + "\n", stats


# ------------------------------------------------------------------ tracked fact layer

def render_section_index(toc):
    lines = ["level\tpdf_page\tsection\n"]
    for lvl, title, page in toc:
        lines.append(f"{lvl}\t{page}\t{title}\n")
    return "".join(lines)


def compute_revised(doc, toc):
    """Sections revised in this edition, from the PDF's highlight annotations.
    Same attribution rule as the first-generation script (nearest preceding TOC
    node of any level), so revised-sections.tsv stays byte-identical."""

    def section_for(pno):
        best = "(front matter)"
        for lvl, title, page in toc:
            if page <= pno:
                best = title
            else:
                break
        return best

    revised = {}
    for i, page in enumerate(doc):
        for _ in page.annots() or []:
            revised.setdefault(section_for(i + 1), i + 1)
    return revised


def render_revised(revised):
    lines = ["pdf_page\tsection\n"]
    for title, pno in sorted(revised.items(), key=lambda kv: kv[1]):
        lines.append(f"{pno}\t{title}\n")
    return "".join(lines)


def render_toc_json(nodes, npages, annotations):
    entries = []
    for n in nodes:
        e = {
            "level": n.level,
            "kind": n.kind,
            "title": n.title,
            "pdf_page": n.page,
            "page_end": n.page_end,
        }
        if n.kind == "section":
            e["id"] = n.sec_id
            e["name"] = n.name
            e["effective"] = n.effective
            e["file"] = n.relfile()
        if n.breadcrumb:
            e["breadcrumb"] = n.breadcrumb
        entries.append(e)
    payload = {
        "_": ("Fannie Mae Selling Guide structure — titles, pages, dates only (facts). "
              "The text itself is generated locally by scripts/extract-selling-guide.py "
              "and never committed: this repo is public and the Guide is copyrighted."),
        "edition": EDITION,
        "pdf_pages": npages,
        "highlight_annotations": annotations,
        "entries": entries,
    }
    return json.dumps(payload, indent=1, ensure_ascii=False) + "\n"


def render_manifest(nodes, npages, toc_len, annotations, link_stats):
    kinds = {}
    for n in nodes:
        kinds[n.kind] = kinds.get(n.kind, 0) + 1
    payload = {
        "_": ("Identity of the Selling Guide corpus. The sha256 pins the exact edition; "
              "git_blob/git_commit is where the PDF is recoverable from this repo's own "
              "history with no network (scripts/extract-selling-guide.py does this "
              "automatically). Facts only — no Guide content."),
        "edition": EDITION,
        "source_pdf": {
            "filename": PDF_NAME,
            "sha256": PDF_SHA256,
            "bytes": PDF_BYTES,
            "git_blob": PDF_GIT_BLOB,
            "git_commit": PDF_GIT_COMMIT,
        },
        "pdf": {"pages": npages, "toc_entries": toc_len, "highlight_annotations": annotations},
        "structure": {
            "leaf_sections": kinds.get("section", 0),
            "group_nodes": kinds.get("group", 0),
            "front_matter_nodes": kinds.get("front", 0),
        },
        "links": link_stats,
        "tracked": ["README.md", "INDEX.md", "section-index.tsv", "revised-sections.tsv",
                    "toc.json", "links.json", "manifest.json"],
        "generated_gitignored": [PDF_NAME, "selling-guide-text.txt", MD_STREAM_NAME,
                                 "extracted/"],
        "renderings": {
            "_": ("Two renderings of the same PDF pages, never two sources. text is "
                  "faithful to reading order and is what grep wants; markdown "
                  "reconstructs the Guide's TABLES, which the text layer flattens. "
                  "The tracked fact layer is derived from the text layer alone, so it "
                  "is identical on a machine without pymupdf4llm."),
            "text": {"stream": "selling-guide-text.txt", "sections": "extracted/sections/",
                     "requires": f"pymupdf=={PYMUPDF_PINNED}"},
            "markdown": {"stream": MD_STREAM_NAME, "sections": "extracted/markdown/",
                         "requires": f"pymupdf4llm=={PYMUPDF4LLM_PINNED}", "optional": True},
        },
        "regenerate": "python3 scripts/extract-selling-guide.py",
        "format_version": 4,
    }
    return json.dumps(payload, indent=1, ensure_ascii=False) + "\n"


def render_index_md(nodes, npages):
    out = [
        "# Fannie Mae Selling Guide — section index\n\n",
        f"Edition **{EDITION}** · {npages} PDF pages. This index is tracked (titles and\n",
        "page numbers are facts); the linked files are **generated locally** by\n",
        "`python3 scripts/extract-selling-guide.py` and are gitignored — run it once and\n",
        "every link below resolves. See [README.md](README.md) for why.\n\n",
        "Each section links twice: **`md`** is the markdown rendering — read this one, it\n",
        "keeps the Guide's tables intact — and **`txt`** is the plain-text rendering, which\n",
        "flattens them. The markdown layer needs `pip3 install pymupdf4llm`; without it the\n",
        "`md` links do not resolve and the `txt` links still do.\n\n",
    ]
    for n in nodes:
        indent = "  " * (n.level - 1)
        pages = f"p. {n.page_start}" if n.page_start == n.page_end else f"pp. {n.page_start}–{n.page_end}"
        if n.kind == "section":
            date = f" ({n.effective})" if n.effective else ""
            out.append(
                f"{indent}- `{n.sec_id}` {n.name}{date} — {pages} "
                f"· [md]({md_relfile(n)}) · [txt]({n.relfile()})\n"
            )
        else:
            out.append(f"{indent}- **{n.title}** — {pages}\n")
    return "".join(out)


# ----------------------------------------------------------------------- verification

def verify(nodes, stream, page_offsets, doc, report):
    problems = []
    sections = [n for n in nodes if n.kind == "section"]

    # Every section file exists, is non-empty, and contains its own heading.
    for n in sections:
        path = os.path.join(DIR, n.relfile())
        if not os.path.exists(path):
            problems.append(f"missing file: {n.relfile()}")
            continue
        with open(path) as fh:
            content = fh.read()
        body = content.split(RULE, 1)[-1]
        if len(body.strip()) < 40:
            problems.append(f"near-empty section body: {n.sec_id}")
        if norm_title(n.title) not in re.sub(r"\s+", " ", body) and n.anchor_method == "page-fallback":
            # fallback anchors are page-accurate but the heading itself was not
            # located — recorded, not fatal, so the gap stays visible
            report["unanchored_sections"].append(n.sec_id)

    # Segments tile the whole stream: no character of the Guide is dropped.
    covered = (nodes[0].anchor if nodes else len(stream))
    for i, n in enumerate(nodes):
        if n.anchor != covered:
            problems.append(f"coverage gap before {n.title!r}")
        covered = n.end
    if covered != len(stream):
        problems.append("coverage gap at end of document")

    # Anchors found where the TOC said they would be.
    for n in sections:
        apage = bisect_right(page_offsets, n.anchor)
        if not (n.page <= apage <= n.page + 2):
            problems.append(f"{n.sec_id}: anchor on page {apage}, TOC says {n.page}")

    report["problems"] = problems
    return problems


def compare_tracked(rendered):
    """rendered: {relpath: text}. Returns list of paths whose on-disk content differs."""
    drift = []
    for rel, text in rendered.items():
        path = os.path.join(DIR, rel)
        on_disk = open(path).read() if os.path.exists(path) else None
        if on_disk != text:
            drift.append(rel)
    return drift


# ------------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--section", metavar="ID", help="print one section (extracting first if needed)")
    ap.add_argument("--check", action="store_true",
                    help="verify the tracked fact layer matches the PDF; exit 1 on drift")
    ap.add_argument("--markdown", action="store_true",
                    help="require the markdown layer — the table-preserving rendering; exits "
                         "nonzero if pymupdf4llm is missing instead of skipping it. Also "
                         "selects the markdown file for --section. (By default the layer is "
                         "built when pymupdf4llm is importable and skipped with a note if not.)")
    ap.add_argument("--no-markdown", action="store_true",
                    help="skip the markdown layer (keeps the run at the text layer's ~3s — this is "
                         "what the SessionStart hook uses)")
    args = ap.parse_args()

    if args.markdown and args.no_markdown:
        sys.exit("--markdown and --no-markdown are contradictory")

    if args.section and not args.check:
        # fast path: already extracted -> print with no PDF and no re-run. --markdown
        # asks for the table-preserving rendering; without it, the text layer, which
        # is always present once the corpus is materialized.
        want = args.section.strip()
        fast = (os.path.join(MD_SECTIONS, want + ".md") if args.markdown
                else os.path.join(EXTRACTED, "sections", want + ".txt"))
        if os.path.exists(fast):
            with open(fast) as fh:
                sys.stdout.write(fh.read())
            return
        if args.markdown and os.path.exists(os.path.join(EXTRACTED, "sections", want + ".txt")):
            print(f"markdown layer not built yet — run: python3 {os.path.relpath(__file__, ROOT)} --markdown",
                  file=sys.stderr)

    pdf_path = acquire_pdf()
    digest = sha256_file(pdf_path)
    if digest != PDF_SHA256:
        sys.exit(
            f"{os.path.basename(pdf_path)} sha256 {digest[:16]}… does not match the pinned\n"
            f"{EDITION} edition ({PDF_SHA256[:16]}…). A different edition needs the pinned\n"
            "constants in this script updated deliberately — and the conformance scrub\n"
            "re-run — not silently extracted."
        )

    try:
        import pymupdf
    except ImportError:
        sys.exit("pymupdf required to regenerate: pip3 install pymupdf")

    if pymupdf.__version__ != PYMUPDF_PINNED:
        print(
            f"warning: pymupdf {pymupdf.__version__} != pinned {PYMUPDF_PINNED} — CI and "
            "the steward run the pinned version; anchor page_ends and link extraction "
            "could differ across versions",
            file=sys.stderr,
        )

    doc = pymupdf.open(pdf_path)
    toc = doc.get_toc()
    npages = doc.page_count
    nodes = build_nodes(toc)

    raw_pages = page_texts(doc, pymupdf)
    stripped, header_hits = [], 0
    for t in raw_pages:
        s, hit = strip_running_header(t)
        stripped.append(s)
        header_hits += hit
    stream, page_offsets = build_stream(stripped)
    norm, norm_back = build_norm(stream)
    anchor_nodes(nodes, stream, norm, norm_back, page_offsets, npages)

    revised = compute_revised(doc, toc)
    annotations = sum(1 for p in doc for _ in (p.annots() or []))

    # revised pages per section id, for the per-file "Revised in this edition" flag
    revised_pages = {}
    for title, pno in revised.items():
        m = SECTION_ID_RE.match(title)
        if m:
            revised_pages.setdefault(m.group(1), []).append(pno)

    links_text, link_stats = render_links_json(doc, nodes, pymupdf, npages)
    rendered = {
        "section-index.tsv": render_section_index(toc),
        "revised-sections.tsv": render_revised(revised),
        "toc.json": render_toc_json(nodes, npages, annotations),
        "links.json": links_text,
        "manifest.json": render_manifest(nodes, npages, len(toc), annotations, link_stats),
        "INDEX.md": render_index_md(nodes, npages),
    }

    if args.check:
        drift = compare_tracked(rendered)
        if drift:
            print("tracked fact layer is STALE relative to the PDF: " + ", ".join(drift))
            print("re-run `python3 scripts/extract-selling-guide.py` and commit the tracked files")
            sys.exit(1)
        print(f"tracked fact layer is current (edition {EDITION}, {npages} pages, "
              f"{len(toc)} TOC entries, {annotations} annotations)")
        return

    os.makedirs(os.path.join(EXTRACTED, "sections"), exist_ok=True)
    os.makedirs(os.path.join(EXTRACTED, "groups"), exist_ok=True)

    report = {
        "edition": EDITION,
        "pymupdf": pymupdf.__version__,
        "pages": npages,
        "toc_entries": len(toc),
        "running_headers_stripped": header_hits,
        "anchor_methods": {},
        "unanchored_sections": [],
        "pymupdf4llm": None,
        "markdown_unanchored_sections": [],
        "markdown_off_page_anchors": [],
        "markdown_problems": [],
    }
    for n in nodes:
        report["anchor_methods"][n.anchor_method] = report["anchor_methods"].get(n.anchor_method, 0) + 1

    # front matter: everything before the first TOC node
    first_anchor = nodes[0].anchor if nodes else len(stream)
    with open(os.path.join(EXTRACTED, "front-matter.txt"), "w") as fh:
        fh.write(f"Selling Guide cover pages (before the first TOC entry)\n{NEVER_COMMIT}\n{RULE}\n")
        fh.write(page_marker_body(stream, page_offsets, 0, first_anchor) + "\n")

    for n in nodes:
        if n.kind == "section":
            write_section_file(n, stream, page_offsets, revised_pages)
        else:
            write_group_file(n, stream, page_offsets)

    write_page_stream(raw_pages, nodes, os.path.join(DIR, "selling-guide-text.txt"))

    for rel, text in rendered.items():
        with open(os.path.join(DIR, rel), "w") as fh:
            fh.write(text)

    problems = verify(nodes, stream, page_offsets, doc, report)

    # The markdown layer runs LAST and never touches anything above it: the tracked
    # fact layer is already on disk and already derived from pymupdf alone, so a
    # machine without pymupdf4llm produces byte-identical tracked files. That is what
    # keeps --check and the CI extraction proof on one small pinned dependency.
    md_summary = None
    if not args.no_markdown:
        md_summary = build_markdown_layer(pdf_path, nodes, npages, revised_pages,
                                          stripped, report)
        if md_summary is None:
            note = (f"markdown layer skipped — pymupdf4llm not installed "
                    f"(pip3 install pymupdf4llm=={PYMUPDF4LLM_PINNED}). The text layer above is "
                    f"complete; markdown is the rendering that keeps TABLES intact.")
            if args.markdown:
                sys.exit(note.replace("skipped", "requested but unavailable"))
            print(note, file=sys.stderr)
        else:
            problems.extend(report["markdown_problems"])

    with open(os.path.join(EXTRACTED, "extraction-report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
        fh.write("\n")

    sections = [n for n in nodes if n.kind == "section"]
    print(
        f"source={os.path.basename(pdf_path)} sha256=✓ pages={npages} toc={len(toc)} "
        f"sections={len(sections)} groups={sum(1 for n in nodes if n.kind != 'section')} "
        f"revised={len(revised)} headers_stripped={header_hits}\n"
        f"  anchors: {report['anchor_methods']}"
        + (f" unanchored={report['unanchored_sections']}" if report["unanchored_sections"] else "")
        + "\n"
        f"  links: {link_stats['unique_urls']} unique urls "
        f"({link_stats['ok_urls']} ok / {link_stats['mailto_urls']} mailto / "
        f"{link_stats['malformed_urls']} malformed) {link_stats['xref_edges']} xref edges\n"
        f"  tracked:    section-index.tsv revised-sections.tsv toc.json links.json manifest.json INDEX.md\n"
        f"  gitignored: selling-guide-text.txt extracted/ ({len(sections)} section files) — never commit"
        + (f"\n  {md_summary}" if md_summary else "")
    )
    if problems:
        print("\nVERIFICATION PROBLEMS:")
        for p in problems:
            print(f"  ✗ {p}")
        sys.exit(1)

    if args.section:
        want = args.section.strip()
        match = next((n for n in sections if n.sec_id == want), None)
        if not match:
            sys.exit(f"no section {want!r} in the {EDITION} TOC — check INDEX.md")
        rel = md_relfile(match) if (args.markdown and md_summary) else match.relfile()
        with open(os.path.join(DIR, rel)) as fh:
            print("\n" + fh.read())


if __name__ == "__main__":
    main()
